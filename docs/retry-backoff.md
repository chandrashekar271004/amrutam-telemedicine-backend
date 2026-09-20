# Amrutam Telemedicine Backend - Retry and Backoff Strategy

## 1. Purpose

The telemedicine platform depends on PostgreSQL, Redis, background workers, and potentially external services such as notification and payment providers.

Temporary failures can occur because of:

* Network interruptions
* Connection resets
* Temporary service unavailability
* Database failover
* Redis interruptions
* External API timeouts
* Transient infrastructure failures

Retries should therefore be applied selectively to transient failures while avoiding duplicate business operations.

---

## 2. Retry Principles

The system follows these principles:

1. Retry only transient failures.
2. Do not retry validation errors.
3. Do not retry authentication or authorization failures.
4. Do not blindly retry booking conflicts.
5. Use exponential backoff.
6. Add jitter to prevent synchronized retries.
7. Limit the maximum number of attempts.
8. Make retryable operations idempotent whenever possible.
9. Record failed attempts for operational investigation.

---

## 3. Exponential Backoff

A typical backoff calculation is:

```text
delay = min(maxDelay, baseDelay * 2^attempt)
```

For example:

```text
Attempt 1 -> 100 ms
Attempt 2 -> 200 ms
Attempt 3 -> 400 ms
Attempt 4 -> 800 ms
Attempt 5 -> 1600 ms
```

A maximum delay prevents the retry interval from growing indefinitely.

---

## 4. Jitter

Pure exponential backoff can still cause many clients to retry at approximately the same time.

Random jitter is therefore added.

Conceptually:

```text
delay = exponentialBackoff + randomJitter
```

Example:

```text
Base delay:       400 ms
Random jitter:    0-200 ms
Actual delay:     400-600 ms
```

This reduces synchronized retry bursts during dependency recovery.

---

## 5. Retry Classification

| Failure                       | Retry?      | Reason                                   |
| ----------------------------- | ----------- | ---------------------------------------- |
| HTTP 400 validation error     | No          | Request is invalid                       |
| HTTP 401 authentication error | No          | Credentials/token invalid                |
| HTTP 403 authorization error  | No          | Caller lacks permission                  |
| HTTP 404 resource not found   | No          | Resource does not exist                  |
| HTTP 409 booking conflict     | No          | Another request may have booked the slot |
| HTTP 429 rate limit           | Conditional | Retry after server-provided delay        |
| HTTP 500 internal error       | Conditional | Depends on operation safety              |
| HTTP 502/503/504              | Yes         | Usually transient infrastructure failure |
| Database connection timeout   | Yes         | Potential transient dependency failure   |
| Redis connection failure      | Yes         | Potential transient dependency failure   |
| External notification timeout | Yes         | Safe if job is idempotent                |
| External payment timeout      | Conditional | Must use provider idempotency            |

---

## 6. Booking Must Not Be Blindly Retried

Booking is a special case.

Suppose two patients attempt to reserve the same slot.

```text
Patient A ──┐
            ├──> Same AvailabilitySlot
Patient B ──┘
```

One request successfully reserves the slot.

The other receives:

```text
HTTP 409
SLOT_UNAVAILABLE
```

This is not a transient infrastructure failure.

Retrying the same booking automatically would be incorrect because the slot may legitimately belong to another patient.

The client can instead ask the user to select another available slot.

---

## 7. Idempotency and Retry Safety

For write operations that may be retried because of network failures, the API should use an idempotency key.

Example:

```http
POST /api/bookings
Idempotency-Key: booking-abc123
```

The request lifecycle becomes:

```text
Client
  |
  | Request
  v
API
  |
  +--> Idempotency check
  |
  +--> Process operation
  |
  +--> Store result
  |
  v
Response
```

If the client does not receive the response and retries:

```text
Client
  |
  | Same Idempotency-Key
  v
API
  |
  +--> Existing result found
  |
  v
Return previous result
```

This prevents a network retry from becoming a duplicate business operation.

---

## 8. Database Retry Boundaries

Database operations should generally be retried only for known transient failures.

Examples include:

* Connection termination
* Temporary connection exhaustion
* Serialization failures
* Deadlocks, depending on transaction design

The transaction must be completely retried rather than retrying only an individual statement when transaction state may have been invalidated.

Conceptually:

```text
BEGIN TRANSACTION
      |
      +--> operation
      |
      +--> transient failure
                |
                v
             ROLLBACK
                |
                v
          Backoff + jitter
                |
                v
         Retry transaction
```

Business logic must remain safe under repeated execution.

---

## 9. Background Job Retries

Background jobs are particularly suitable for controlled retries.

Example:

```text
API
 |
 +--> Queue notification
          |
          v
       BullMQ
          |
          v
       Worker
          |
     +----+----+
     |         |
 Success    Failure
     |         |
     v         v
  Complete   Retry
               |
               v
          Backoff
               |
               v
            Worker
```

Retryable jobs should have a finite attempt count.

After the maximum number of attempts, the job should enter a failed/dead-letter state for investigation or manual recovery.

---

## 10. External Notification Services

Notification delivery may fail temporarily.

Recommended behavior:

```text
Attempt 1
   |
   +--> Timeout
   |
   v
Backoff
   |
Attempt 2
   |
   +--> Timeout
   |
   v
Backoff
   |
Attempt 3
   |
   +--> Success
```

The notification job should contain a unique business identifier so that a retry does not accidentally send multiple notifications when the provider supports idempotency.

---

## 11. Payment Operations

Payment operations require special treatment because an external provider may process a payment even when the application does not receive the response.

The payment request should therefore use the provider's idempotency mechanism where available.

```text
Application
    |
    | payment request + idempotency key
    v
Payment Provider
    |
    +--> processed
    |
    +--> response lost
    |
    v
Application timeout
    |
    v
Retry with SAME idempotency key
    |
    v
Provider returns original result
```

The application must never create a second logical payment merely because the first response timed out.

---

## 12. Retry Budget

Retries consume resources and can increase system load during an outage.

Therefore retries should have a bounded budget.

Example policy:

```text
Maximum attempts: 3
Base delay:       100 ms
Maximum delay:    2 seconds
Jitter:           enabled
```

The exact values should be tuned using production latency and failure metrics.

A retry budget prevents a dependency outage from turning into a retry storm.

---

## 13. Circuit Breaker Consideration

For frequently accessed external dependencies, a circuit breaker can prevent repeated calls while the dependency is unavailable.

Conceptually:

```text
             ┌─────────────┐
             │    CLOSED   │
             │ normal      │
             └──────┬──────┘
                    │ failures
                    ▼
             ┌─────────────┐
             │    OPEN     │
             │ fail fast   │
             └──────┬──────┘
                    │ timeout
                    ▼
             ┌─────────────┐
             │ HALF-OPEN   │
             │ test request│
             └──────┬──────┘
                    │
              +-----+-----+
              |           |
           success      failure
              |           |
              v           v
           CLOSED        OPEN
```

This is particularly useful for external notification, payment, or other remote services.

---

## 14. Observability for Retries

Retry activity should be observable.

Recommended metrics include:

```text
retry_attempts_total
retry_failures_total
retry_success_total
retry_exhausted_total
```

Structured logs should contain:

```text
requestId
operation
attempt
maximumAttempts
errorType
backoffDelay
```

Distributed traces should identify retries so that increased latency can be distinguished from normal request processing.

---

## 15. Operational Guidance

When repeated transient failures are detected:

1. Check application error rate.
2. Check dependency health.
3. Inspect retry metrics.
4. Inspect structured logs.
5. Inspect distributed traces.
6. Verify whether the dependency is recovering.
7. Avoid increasing retry counts blindly.
8. Use circuit breaking or traffic reduction when necessary.

Retries are a resilience mechanism, not a replacement for fixing an unhealthy dependency.

---

## 16. Summary

The retry strategy follows:

```text
Transient failure
       |
       v
Is operation safely retryable?
       |
    +--+--+
    |     |
   No    Yes
    |     |
    v     v
Fail    Retry
fast      |
          v
   Exponential backoff
          |
          v
       Jitter
          |
          v
    Retry attempt
          |
     +----+----+
     |         |
 Success    Failure
     |         |
     v         v
 Complete   More attempts?
                |
            +---+---+
            |       |
           Yes      No
            |       |
            v       v
          Retry   Failed/
                  Dead-letter
```

The most important rule for the booking domain is that 409 booking conflicts are business conflicts, not transient failures. They must not be automatically retried as though they were infrastructure errors.

Idempotency keys provide an additional safety boundary for retried write requests, while bounded exponential backoff and jitter protect dependencies from retry storms.
