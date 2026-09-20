# Architecture — Amrutam Telemedicine Backend

## 1. Scope and architecture

The first implementation is a **modular monolith** rather than premature microservices. It gives strong domain boundaries while keeping transactions, deployment and local development simple for a 4–5 day assignment. Modules are independently structured as routes/controllers/services and can later be extracted into services without rewriting the domain logic.

**Runtime:** Node.js 22, TypeScript, Express, Prisma, PostgreSQL, Redis, BullMQ, OpenTelemetry, Prometheus and Jaeger.

```text
Clients
  |
  v
[Load Balancer / TLS]
  |
  +--> API replicas (stateless)
  |       |-- Auth/User
  |       |-- Doctor/Availability
  |       |-- Consultation/Prescription
  |       |-- Search
  |       +-- Admin/Audit
  |          |       |
  |          v       v
  |       PostgreSQL Redis
  |          |       |
  |          +--> BullMQ worker --> notifications/heavy jobs
  |
  +--> OpenTelemetry --> Collector --> Jaeger
  +--> Prometheus <-- /metrics
```

All API instances are stateless. JWT access tokens are verified locally. PostgreSQL is the source of truth. Redis is used for short-lived cache, rate limiting support and idempotency coordination. Heavy work is moved to BullMQ workers.

## 2. Core data flow

Registration writes User + Profile in one Prisma transaction. Login validates a bcrypt password and, when enabled, a TOTP MFA code. Doctor availability is persisted as unique time slots. Booking uses a serializable database transaction and an atomic `UPDATE ... WHERE status = AVAILABLE` before creating the consultation and payment record. This makes concurrent booking attempts converge on one successful claimant.

Consultation status changes are authorization-checked against patient/doctor ownership. Prescription creation is restricted to the assigned doctor and active/completed consultations. Every sensitive state change creates an audit event.

## 3. Scalability

The stated workload of 100k daily consultations is roughly 1.16 consultations/sec averaged over 24 hours; production traffic should nevertheless be sized for substantial peak-to-average bursts. Read-heavy doctor search is cached for 60 seconds. PostgreSQL uses indexes on lookup/filter dimensions and should run with connection pooling. API replicas can scale horizontally because no session state is stored in process memory.

For growth, partition `audit_logs` by month, archive old audit partitions, add read replicas for analytics/search, and isolate analytics queries from the transactional primary. Consultation records can later be partitioned by created month after measuring query plans.

## 4. Reliability and transactions

Short critical workflows use PostgreSQL transactions. Booking is the strongest example: slot claim, consultation creation and payment creation are committed atomically. Cross-system work such as notification delivery is asynchronous and retryable. BullMQ jobs should use exponential backoff with jitter, bounded attempts, and a dead-letter/failed-job review process.

Do not retry non-idempotent external payment operations blindly. Use provider idempotency keys and persist provider references before treating a payment as final.

## 5. Caching and concurrency

Doctor search uses a short TTL cache. Cache invalidation is deliberately conservative because search data is not the source of truth. Availability and booking never trust Redis for ownership; PostgreSQL remains authoritative. Booking uses both database uniqueness and an atomic state transition.

Idempotent writes require a client-provided `Idempotency-Key`. Redis stores a request fingerprint and final response for 24 hours. Concurrent reuse of the same key is rejected while the first request is processing.

## 6. Security

Helmet, strict validation, bcrypt password hashing, short-lived JWTs, RBAC, MFA/TOTP, rate limiting, request IDs, redacted structured logs and audit trails are included. Production must use TLS everywhere, a secrets manager/KMS, encrypted PostgreSQL backups, key rotation, secure HTTP-only refresh-token cookies, CSRF protection where cookie authentication is used, and least-privilege database credentials.

Healthcare data should be classified as highly sensitive. Logs must never contain passwords, access tokens, MFA secrets, prescription contents, or unnecessary patient identifiers.

## 7. Availability and DR

A 99.95% target allows about 21.9 minutes of unavailability per 30-day month. Production deployment should use multiple API replicas across failure domains, managed PostgreSQL with automated backups and point-in-time recovery, Redis configured for HA where required, health/readiness probes, rolling deployments and automated rollback.

Recommended initial targets: RPO ≤ 15 minutes and RTO ≤ 60 minutes. Validate these with quarterly restore and failover exercises rather than relying only on configuration.
