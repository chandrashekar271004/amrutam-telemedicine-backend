# Booking Flow Sequence

```mermaid
sequenceDiagram
    participant P as Patient
    participant API as API Replica
    participant R as Redis
    participant DB as PostgreSQL
    participant W as Worker

    P->>API: POST /consultations/book + Idempotency-Key
    API->>R: SET idem:<fingerprint> PROCESSING NX EX 120
    alt duplicate completed key
        R-->>API: DONE + stored response
        API-->>P: Same response
    else first request
        API->>DB: BEGIN SERIALIZABLE
        API->>DB: SELECT slot
        API->>DB: UPDATE slot SET BOOKED WHERE status=AVAILABLE
        alt slot already claimed
            DB-->>API: 0 rows updated
            API->>DB: ROLLBACK
            API->>R: store failure / release processing key
            API-->>P: 409 SLOT_ALREADY_BOOKED
        else slot claimed
            API->>DB: INSERT consultation
            API->>DB: INSERT payment PENDING
            API->>DB: COMMIT
            API->>R: store DONE response
            API->>W: enqueue notification job
            API-->>P: 201 consultation
        end
    end
```

**Retry policy:** client retries the same request with the same idempotency key. Transient worker failures use exponential backoff with jitter. Database serialization failures may be retried a small bounded number of times inside the service boundary; the whole operation remains idempotent.
