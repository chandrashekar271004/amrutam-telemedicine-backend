# Booking Sequence and Concurrency Control

## 1. Purpose

Consultation booking is a consistency-critical operation in the Amrutam Telemedicine Backend.

The system must guarantee that two patients cannot successfully reserve the same doctor availability slot at the same time.

The implementation uses:

* PostgreSQL transactions
* Optimistic concurrency control
* Atomic conditional updates
* Database uniqueness constraints
* Idempotency keys
* Audit logging

---

## 2. Normal Booking Flow

```text
Patient
   |
   | POST /api/bookings
   | Authorization: Bearer <JWT>
   | Idempotency-Key: <unique-key>
   | slotId
   v
Express API
   |
   +--> Authentication
   |
   +--> Role authorization
   |
   +--> Request validation
   |
   +--> Idempotency middleware
   |
   v
Booking Service
   |
   v
BEGIN TRANSACTION
   |
   +--> Read availability slot
   |
   +--> Load doctor
   |
   +--> Validate slot
   |       |
   |       +--> exists?
   |       +--> doctor valid?
   |       +--> slot AVAILABLE?
   |       +--> slot not in the past?
   |
   +--> Atomic conditional UPDATE
   |       |
   |       | WHERE id = slotId
   |       | AND status = AVAILABLE
   |       | AND version = expectedVersion
   |       |
   |       +--> affected rows = 1
   |
   +--> Create Consultation
   |
   +--> Create AuditLog
   |
   v
COMMIT
   |
   v
Return consultation
```

---

## 3. Concurrent Booking Scenario

Consider two patients attempting to reserve the same slot.

```text
Patient A                         Patient B
    |                                 |
    | POST booking                    |
    |-------------------------------->|
    |                                 |
    |                 POST booking    |
    |<--------------------------------|
    |                                 |
    +---------------+-----------------+
                    |
                    v
              PostgreSQL
                    |
          Slot version = 0
          Status = AVAILABLE
                    |
             +------+------+
             |             |
             v             v
        Transaction A  Transaction B
             |             |
             | UPDATE      |
             | status=BOOKED
             | version=1
             |
             v
        affected rows = 1
             |
             v
          SUCCESS
             |
             |
             |        Transaction B attempts
             |        same conditional update
             |                |
             |                v
             |        expected state/version
             |        no longer matches
             |                |
             |                v
             |        affected rows = 0
             |                |
             |                v
             |          409 Conflict
```

Only one transaction can successfully transition the slot from:

```text
AVAILABLE, version=N
```

to:

```text
BOOKED, version=N+1
```

The competing request receives a conflict response.

---

## 4. Atomic Conditional Update

The critical database operation is conceptually:

```sql
UPDATE "AvailabilitySlot"
SET
    status = 'BOOKED',
    version = version + 1
WHERE
    id = $slotId
    AND status = 'AVAILABLE'
    AND version = $expectedVersion;
```

The application checks the number of affected rows.

### One row updated

The reservation succeeded.

```text
affectedRows = 1
        |
        v
Create consultation
        |
        v
Create audit event
        |
        v
Commit
```

### Zero rows updated

The slot was already changed by another transaction or its expected version is stale.

```text
affectedRows = 0
        |
        v
Booking conflict
        |
        v
HTTP 409
```

This avoids relying solely on a prior `SELECT` check, which could otherwise create a race condition.

---

## 5. Transaction Boundary

The booking transaction contains all operations that must remain consistent:

```text
BEGIN
  |
  +-- Read slot
  |
  +-- Validate slot
  |
  +-- Atomically reserve slot
  |
  +-- Create consultation
  |
  +-- Create audit record
  |
COMMIT
```

If consultation creation or audit creation fails, the transaction is rolled back.

This prevents a situation where:

```text
Slot = BOOKED
Consultation = missing
```

after an unsuccessful booking operation.

---

## 6. Database-Level Protection

Application-level concurrency control is backed by database constraints.

The consultation slot relationship has a uniqueness constraint so that a slot cannot be associated with multiple consultations.

Therefore, the system has multiple protection layers:

```text
                 Booking Request
                       |
                       v
              Availability Check
                       |
                       v
          Atomic Versioned UPDATE
                       |
                       v
             Database Transaction
                       |
                       v
           Unique Slot Constraint
```

Even if an unexpected application path attempts to create a duplicate consultation, the database remains the final integrity boundary.

---

## 7. Idempotency

A booking request also accepts an `Idempotency-Key`.

Example:

```http
POST /api/bookings
Authorization: Bearer <token>
Idempotency-Key: booking-7f92c1
Content-Type: application/json
```

The client should generate a unique key for each logical booking operation.

If the same request is accidentally sent multiple times because of a timeout or network retry, the idempotency layer can return the previously stored result.

```text
First Request
     |
     v
Idempotency-Key
     |
     v
Redis: key not found
     |
     v
Execute booking
     |
     v
Store response
     |
     v
Return result
     |
     v
Repeated Request
     |
     v
Same Idempotency-Key
     |
     v
Redis: key found
     |
     v
Return previous result
```

The repeated request therefore does not create another consultation.

---

## 8. Idempotency and Concurrency Solve Different Problems

These two mechanisms address different failure modes.

### Concurrency control

Protects against:

```text
Patient A and Patient B
        |
        +--> same slot
        |
        v
Only one reservation succeeds
```

### Idempotency

Protects against:

```text
Same patient
      |
      +--> same logical request
      |
      +--> network retry
      |
      v
No duplicate resource
```

Both mechanisms are required for a robust booking API.

---

## 9. Audit Trail

A successful booking records an audit event.

The audit record associates:

* Actor/user
* Action
* Resource type
* Resource identifier
* Timestamp

This provides an operational trail for investigating sensitive booking operations.

---

## 10. Failure Cases

| Condition                         | Expected result            |
| --------------------------------- | -------------------------- |
| Slot does not exist               | 404                        |
| Doctor does not exist             | Validation/resource error  |
| Slot belongs to another doctor    | Validation/resource error  |
| Slot is in the past               | 400                        |
| Slot is already booked            | 409                        |
| Concurrent reservation loses race | 409                        |
| Invalid JWT                       | 401                        |
| Insufficient role                 | 403                        |
| Duplicate idempotency request     | Previously stored response |
| Database transaction failure      | Rollback + error response  |

---

## 11. Verified Behavior

The implementation has been manually tested with concurrent requests against the same availability slot.

Observed behavior:

```text
Request A -> Successful booking
Request B -> 409 SLOT_UNAVAILABLE
```

Database verification showed:

```text
Consultations for slot = 1
Slot status = BOOKED
Slot version = 1
```

The same booking request was also replayed using the same idempotency key and returned the original consultation rather than creating a duplicate.

These tests demonstrate both:

1. Concurrent booking protection
2. Idempotent request replay

---

## 12. Design Summary

The booking workflow uses defense in depth:

```text
JWT + RBAC
     |
     v
Request Validation
     |
     v
Idempotency
     |
     v
PostgreSQL Transaction
     |
     v
Optimistic Concurrency
     |
     v
Atomic Conditional Update
     |
     v
Unique Database Constraint
     |
     v
Audit Trail
```

This design keeps the booking operation strongly consistent while allowing the API layer to scale horizontally.
