# Amrutam Telemedicine Backend - ER Diagram

## 1. Overview

The Amrutam Telemedicine Backend uses PostgreSQL as its primary transactional database.

The data model separates authentication, user profiles, doctor-specific information, availability, consultations, prescriptions, payments, refresh tokens, and audit records.

The database uses relational constraints, foreign keys, unique constraints, and indexes to protect data integrity and support common access patterns.

---

## 2. Entity Relationship Diagram

```text
┌──────────────────────┐
│        User          │
├──────────────────────┤
│ id PK                │
│ email UNIQUE         │
│ phone                │
│ passwordHash         │
│ role                 │
│ isActive             │
│ mfaEnabled           │
│ mfaSecret            │
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │
           │ 1:1
           ▼
┌──────────────────────┐
│       Profile        │
├──────────────────────┤
│ id PK                │
│ userId FK UNIQUE     │
│ firstName            │
│ lastName             │
│ gender               │
│ dateOfBirth          │
│ address              │
└──────────────────────┘


┌──────────────────────┐
│        User          │
└──────────┬───────────┘
           │
           │ 1:0..1
           ▼
┌──────────────────────┐
│       Doctor         │
├──────────────────────┤
│ id PK                │
│ userId FK            │
│ specialization       │
│ licenseNumber        │
│ experienceYears      │
│ consultationFee      │
│ isVerified           │
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│  AvailabilitySlot    │
├──────────────────────┤
│ id PK                │
│ doctorId FK          │
│ startTime            │
│ endTime              │
│ status               │
│ version              │
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │
           │ 1:0..1
           ▼
┌──────────────────────┐
│    Consultation      │
├──────────────────────┤
│ id PK                │
│ patientId FK         │
│ doctorId FK          │
│ slotId FK UNIQUE     │
│ status               │
│ scheduledAt          │
│ startedAt            │
│ completedAt          │
│ notes                │
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│    Prescription      │
├──────────────────────┤
│ id PK                │
│ consultationId FK    │
│ doctorId FK          │
│ patientId FK         │
│ medicines            │
│ instructions         │
│ createdAt            │
└──────────────────────┘


┌──────────────────────┐
│    Consultation      │
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│       Payment        │
├──────────────────────┤
│ id PK                │
│ consultationId FK    │
│ amount               │
│ status               │
│ transactionId        │
│ createdAt            │
│ updatedAt            │
└──────────────────────┘


┌──────────────────────┐
│        User          │
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│    RefreshToken      │
├──────────────────────┤
│ id PK                │
│ userId FK            │
│ tokenHash            │
│ expiresAt            │
│ revokedAt            │
│ createdAt            │
└──────────────────────┘


┌──────────────────────┐
│        User          │
└──────────┬───────────┘
           │
           │ 1:N
           ▼
┌──────────────────────┐
│      AuditLog        │
├──────────────────────┤
│ id PK                │
│ actorId FK           │
│ action               │
│ resource             │
│ resourceId           │
│ metadata             │
│ createdAt            │
└──────────────────────┘
```

---

## 3. Relationship Summary

| Relationship                     | Cardinality | Purpose                                          |
| -------------------------------- | ----------: | ------------------------------------------------ |
| User -> Profile                  |         1:1 | User profile information                         |
| User -> Doctor                   |      1:0..1 | Doctor-specific information                      |
| Doctor -> AvailabilitySlot       |         1:N | Doctor's available consultation slots            |
| AvailabilitySlot -> Consultation |      1:0..1 | A slot can be booked by at most one consultation |
| User -> Consultation as patient  |         1:N | Patient's consultations                          |
| User -> Consultation as doctor   |         1:N | Doctor's consultations                           |
| Consultation -> Prescription     |         1:N | Prescriptions generated during consultation      |
| Consultation -> Payment          |         1:N | Payment records                                  |
| User -> RefreshToken             |         1:N | Refresh-token sessions                           |
| User -> AuditLog                 |         1:N | User activity/audit records                      |

---

## 4. User and Profile

`User` contains identity and authentication information.

`Profile` contains additional personal information.

Separating these concerns allows authentication-related queries to remain smaller while profile information can be accessed only when required.

The `Profile.userId` relationship is unique, enforcing a one-to-one relationship.

---

## 5. Doctor Model

A doctor is associated with a user account.

Doctor-specific attributes include:

* Specialization
* Medical license information
* Experience
* Consultation fee
* Verification state

A doctor can have multiple availability slots.

```text
User
  │
  └── Doctor
        │
        ├── AvailabilitySlot
        ├── AvailabilitySlot
        └── AvailabilitySlot
```

---

## 6. Availability Slots

Availability slots represent time windows during which a doctor can accept consultations.

Important fields include:

* `doctorId`
* `startTime`
* `endTime`
* `status`
* `version`

The `status` field represents the booking state.

Typical states include:

```text
AVAILABLE
BOOKED
```

The `version` field supports optimistic concurrency control.

During booking, the application performs an atomic update using both the current status and expected version.

---

## 7. Consultation

A consultation connects a patient, doctor, and availability slot.

Conceptually:

```text
Patient
   │
   │
   ▼
Consultation
   ▲
   │
   │
Doctor

Consultation
     ▲
     │
AvailabilitySlot
```

The slot relationship is unique so that one availability slot cannot be used by multiple consultations.

Consultation status tracks its lifecycle.

The lifecycle includes states such as:

```text
SCHEDULED
    │
    ▼
IN_PROGRESS
    │
    ▼
COMPLETED
```

Cancellation is also represented through the consultation status model.

---

## 8. Prescription

A prescription belongs to a consultation and records medication/instruction information associated with that consultation.

The prescription also maintains doctor and patient references to support authorization and resource ownership checks.

Access to prescriptions is protected using authentication and resource-level authorization.

---

## 9. Payment

Payment records are associated with consultations.

The model contains information such as:

* Amount
* Payment status
* Transaction identifier
* Timestamps

Payment processing should be treated as a separate consistency boundary from consultation scheduling when integrating an external payment provider.

---

## 10. Refresh Tokens

Refresh tokens are persisted as hashes rather than raw token values.

```text
Client
  │
  │ raw refresh token
  ▼
Authentication service
  │
  │ SHA-256
  ▼
tokenHash
  │
  ▼
PostgreSQL
```

This means a database leak does not directly expose reusable raw refresh-token values.

Expiration and revocation information support session lifecycle management.

---

## 11. Audit Logs

Audit logs record security- and compliance-relevant operations.

Important fields include:

* Actor
* Action
* Resource
* Resource ID
* Metadata
* Timestamp

Example:

```text
User
  │
  │ enables MFA
  ▼
AuditLog
  │
  ├── actorId
  ├── action = MFA_ENABLED
  ├── resource = User
  ├── resourceId
  └── createdAt
```

Audit logs should be protected from unauthorized modification and should follow the organization's retention requirements in production.

---

## 12. Data Integrity Controls

The relational model uses multiple integrity mechanisms.

### Primary keys

Every major entity has a unique primary key.

### Foreign keys

Relationships between users, doctors, slots, consultations, prescriptions, payments, tokens, and audit records are enforced through foreign keys.

### Unique constraints

Important unique relationships include:

```text
User.email
Profile.userId
Consultation.slotId
```

These prevent duplicate logical records.

### Transactions

Multi-record operations such as booking are executed transactionally.

### Optimistic concurrency

Availability slot versioning prevents stale concurrent updates.

---

## 13. Indexing Strategy

Frequently queried fields should be indexed according to actual query patterns.

Important indexing candidates include:

```text
User.email

Doctor.userId
Doctor.specialization
Doctor.isVerified

AvailabilitySlot.doctorId
AvailabilitySlot.status
AvailabilitySlot.startTime

Consultation.patientId
Consultation.doctorId
Consultation.status
Consultation.scheduledAt

Prescription.consultationId
Prescription.patientId

AuditLog.actorId
AuditLog.resourceId
AuditLog.createdAt
```

Indexes should be validated using PostgreSQL query plans and production query statistics rather than added indiscriminately.

---

## 14. Future Partitioning

As historical data grows, high-volume tables can be partitioned.

The primary candidate is the audit log because it is append-heavy and naturally time-oriented.

Example:

```text
AuditLog
   │
   ├── 2026 Q1
   ├── 2026 Q2
   ├── 2026 Q3
   └── 2026 Q4
```

Time-based partitioning can improve maintenance, archival, and large historical queries.

Consultation history can also be considered for partitioning after measuring actual table growth and workload characteristics.

---

## 15. Data Access Pattern

The service layer accesses PostgreSQL through Prisma.

```text
HTTP Request
     │
     ▼
Controller
     │
     ▼
Service
     │
     ▼
Prisma Client
     │
     ▼
PostgreSQL
```

This keeps database-specific operations inside the service/data-access boundary rather than placing database logic directly inside route handlers.

---

## 16. Security Considerations

Healthcare-related information should follow least-privilege access.

The application therefore separates:

* Authentication data
* User profile information
* Doctor information
* Clinical consultation data
* Prescription information
* Payment data
* Audit information

Application-level authorization must be combined with database constraints.

Production environments should additionally use:

* Encryption in transit
* Encryption at rest
* Managed secrets
* Restricted database access
* Database backups
* Appropriate retention policies
* Monitoring and audit controls

---

## 17. Summary

The relational data model provides a strong transactional foundation for the telemedicine platform.

The most important consistency boundary is the relationship between:

```text
Doctor
   │
   ▼
AvailabilitySlot
   │
   ▼
Consultation
```

The unique slot relationship, transaction boundary, and optimistic concurrency version protect the booking workflow from duplicate reservations.

The remaining entities provide authentication, clinical workflow, payment, session, and audit capabilities required by the platform.
