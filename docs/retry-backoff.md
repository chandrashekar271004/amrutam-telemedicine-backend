# Retry & Backoff Strategy

| Operation | Retry | Policy |
|---|---|---|
| HTTP GET from client | Yes | Client exponential backoff + jitter for 429/502/503/504; respect Retry-After |
| Booking write | Client may retry | **Same Idempotency-Key only** |
| PostgreSQL serialization failure | Yes | Up to 2 bounded retries with 25–100ms jitter |
| Redis cache read | No blocking retry | Fail open to PostgreSQL for non-critical cache |
| Notification job | Yes | 5 attempts, exponential backoff + jitter; failed jobs retained for operator review |
| Payment API | Conditional | Only provider-supported idempotent operations with provider idempotency key |

Never blindly retry a payment charge or another side effect that lacks idempotency. Timeouts should be shorter than the caller's overall deadline and propagated through downstream calls.
