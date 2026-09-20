# Amrutam Telemedicine Backend — Architecture

## 1. Overview

The Amrutam Telemedicine Backend is a production-oriented REST API designed to support a scalable telemedicine platform covering authentication, role-based access control, doctor availability, consultation booking, consultation lifecycle management, prescriptions, search, payments, audit trails, and administrative analytics.

The system is implemented as a modular monolith using Node.js, TypeScript, Express.js, PostgreSQL, Prisma ORM, Redis, and background workers.

The architecture is designed around the following requirements:

* 100,000 daily consultations
* p95 read latency target below 200 ms
* p95 write latency target below 500 ms
* 99.95% availability target
* Secure authentication and authorization
* MFA support
* Idempotent write operations
* Protection against double booking
* Auditability of sensitive operations
* Structured logging, metrics, and distributed tracing
* Containerized deployment and CI validation

---

## 2. Architecture

```text
                         ┌──────────────────────┐
                         │      Client/Web      │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │    Express REST API  │
                         │                      │
                         │ Authentication       │
                         │ RBAC                 │
                         │ Doctors              │
                         │ Availability         │
                         │ Booking              │
                         │ Consultations        │
                         │ Prescriptions        │
                         │ Search               │
                         │ Admin / Analytics    │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └────────────┐
                    ▼                                 ▼
             ┌──────────────┐                  ┌──────────────┐
             │ PostgreSQL   │                  │    Redis     │
             │              │                  │              │
             │ Users        │                  │ Cache        │
             │ Doctors      │                  │ Idempotency  │
             │ Slots        │                  │ Queue        │
             │ Consultations│                  │ BullMQ       │
             │ Prescriptions│                  └──────┬───────┘
             │ Payments     │                         │
             │ Audit Logs   │                         ▼
             └──────────────┘                  ┌──────────────┐
                                               │    Worker    │
                                               │ Background   │
                                               │ Jobs         │
                                               └──────────────┘

              ┌────────────────────────────────────────────┐
              │              Observability                 │
              │                                            │
              │ Pino → Structured Logs                     │
              │ Prometheus → Metrics                       │
              │ OpenTelemetry → Collector → Jaeger         │
              └────────────────────────────────────────────┘
```

The modular monolith keeps domain boundaries clear while avoiding the operational complexity of multiple independently deployed services at the current scale.

---

## 3. Technology Stack

| Layer             | Technology           | Purpose                                   |
| ----------------- | -------------------- | ----------------------------------------- |
| Runtime           | Node.js              | Server-side JavaScript runtime            |
| Language          | TypeScript           | Type safety and maintainability           |
| API               | Express.js           | REST API framework                        |
| Database          | PostgreSQL           | Transactional relational data             |
| ORM               | Prisma               | Database access and migrations            |
| Cache / Queue     | Redis                | Fast temporary data and asynchronous jobs |
| Background jobs   | BullMQ / Redis       | Asynchronous processing                   |
| Authentication    | JWT                  | Stateless access authentication           |
| MFA               | TOTP                 | Multi-factor authentication               |
| Validation        | Zod                  | Request validation                        |
| Logging           | Pino                 | Structured application logging            |
| Metrics           | Prometheus           | Application/system metrics                |
| Tracing           | OpenTelemetry        | Distributed request tracing               |
| Trace UI          | Jaeger               | Trace visualization                       |
| Containers        | Docker               | Reproducible deployment                   |
| CI                | GitHub Actions       | Automated test/build validation           |
| API documentation | OpenAPI / Swagger UI | API discovery and testing                 |

---

## 4. Application Structure

The backend follows a modular architecture:

```text
src/
├── config/
├── jobs/
├── lib/
├── middleware/
├── modules/
│   ├── admin/
│   ├── audit/
│   ├── auth/
│   ├── availability/
│   ├── bookings/
│   ├── consultations/
│   ├── doctors/
│   ├── prescriptions/
│   ├── search/
│   └── users/
└── utils/
```

Each domain module contains its own:

```text
controller.ts
routes.ts
schema.ts
service.ts
```

This separates HTTP concerns, validation, and business logic and allows individual modules to evolve without creating a distributed-services deployment burden.

---

## 5. Request Flow

A typical API request follows this path:

```text
Client
  │
  ▼
Express
  │
  ├── Request ID
  ├── Structured logging
  ├── Security headers
  ├── CORS
  ├── Compression
  ├── Rate limiting
  ├── Authentication
  ├── RBAC
  ├── Idempotency
  └── Request validation
  │
  ▼
Controller
  │
  ▼
Service / Business Logic
  │
  ├── PostgreSQL / Prisma
  ├── Redis
  └── Background jobs
  │
  ▼
Response
```

Centralized error handling converts application errors into consistent HTTP responses while preventing internal implementation details from being exposed to clients.

---

## 6. Authentication and Authorization

Authentication uses short-lived JWT access tokens.

The authentication flow is:

```text
Credentials
    │
    ▼
Password verification
    │
    ├── MFA disabled ───────► Issue JWT
    │
    └── MFA enabled
             │
             ▼
          TOTP check
             │
             ▼
          Issue JWT
```

Password credentials are stored as password hashes rather than plaintext passwords.

Authorization is enforced using role-based access control.

The primary roles are:

* PATIENT
* DOCTOR
* ADMIN

Resource-level authorization is additionally applied where required. For example, a patient must not be able to access another patient's prescription or consultation data merely by knowing its identifier.

---

## 7. MFA

The authentication module supports TOTP-based MFA.

MFA setup generates a TOTP secret and an `otpauth` URI/QR representation compatible with authenticator applications.

MFA enablement requires verification of a valid TOTP code before `mfaEnabled` is activated.

Login for an MFA-enabled account requires:

```text
Password + valid TOTP code
```

Successful MFA activation is recorded in the audit log.

---

## 8. Booking Concurrency and Double-Booking Prevention

Booking is a critical consistency operation because multiple patients may attempt to reserve the same slot concurrently.

The system uses a database transaction combined with optimistic concurrency control.

The slot contains a version value.

The booking operation follows:

```text
BEGIN TRANSACTION
       │
       ▼
Read slot + doctor
       │
       ▼
Verify:
- slot exists
- doctor exists
- slot is AVAILABLE
- slot is not in the past
       │
       ▼
Atomic conditional UPDATE
WHERE:
  id = requestedSlot
  status = AVAILABLE
  version = currentVersion
       │
       ├── affected rows = 0
       │          │
       │          ▼
       │      409 Conflict
       │
       └── affected rows = 1
                  │
                  ▼
          Create consultation
                  │
                  ▼
             Audit event
                  │
                  ▼
             COMMIT
```

The conditional update changes the slot to `BOOKED` and increments its version.

If two requests attempt to book the same slot simultaneously, only one request can successfully modify the expected slot state/version.

The losing request receives a conflict response rather than creating a second consultation.

A unique database constraint on the consultation slot provides an additional integrity boundary.

This provides defense in depth:

1. Application-level availability check
2. Atomic conditional database update
3. Database uniqueness constraint
4. Transactional consistency

---

## 9. Idempotency

Write endpoints support an `Idempotency-Key`.

This prevents clients from accidentally creating duplicate resources when a request is retried because of:

* network timeout
* client retry
* proxy retry
* connection interruption

The logical flow is:

```text
Request + Idempotency-Key
          │
          ▼
     Redis lookup
          │
     ┌────┴────┐
     │         │
   Found     Missing
     │         │
     ▼         ▼
Return      Process
stored      request
response      │
     │        ▼
     │      Store result
     │        │
     └────────┘
```

A repeated request with the same key returns the previously stored result rather than creating another consultation.

The implementation has been verified using a repeated booking request.

---

## 10. Database Design

PostgreSQL is the system of record for transactional healthcare-domain data.

Core entities include:

```text
User
 │
 ├── Profile
 ├── Doctor
 │     └── AvailabilitySlot
 │             └── Consultation
 │                     └── Prescription
 │
 ├── RefreshToken
 └── AuditLog

Consultation
 └── Payment
```

Relational constraints and indexes are used to maintain integrity and support frequently executed queries.

Transactions are used for operations where multiple records must change atomically.

---

## 11. Transaction Management

Transactions are used for consistency-sensitive operations such as consultation booking.

For booking, the following operations are kept within the same transaction:

1. Validate slot state.
2. Atomically reserve the slot.
3. Create the consultation.
4. Record the corresponding audit event.

If any operation fails, the transaction is rolled back.

This prevents partially completed booking operations.

---

## 12. Redis and Background Processing

Redis provides low-latency temporary state and infrastructure for asynchronous processing.

Potential workloads suitable for asynchronous processing include:

* Notifications
* Email/SMS delivery
* Reminder jobs
* Analytics aggregation
* Non-critical audit processing
* Other retryable background operations

These operations should not unnecessarily block latency-sensitive API requests.

The worker process is independently executable from the API process.

```text
API
 │
 ├── Fast transactional work
 │
 └── Queue job ─────► Redis
                         │
                         ▼
                      Worker
                         │
                         ▼
                 External/slow work
```

---

## 13. Search and Read Scalability

Search and read-heavy endpoints should use indexed PostgreSQL queries.

Frequently requested reference data can be cached in Redis where appropriate.

For future horizontal scaling:

```text
                    Load Balancer
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
            API-1      API-2      API-N
              │          │          │
              └──────────┼──────────┘
                         │
                    PostgreSQL
                         │
                       Redis
```

Because access tokens are stateless, API instances do not need in-memory session affinity.

---

## 14. Database Scaling Strategy

The initial deployment uses PostgreSQL as the primary transactional database.

As traffic grows, scaling can proceed incrementally:

### Stage 1 — Vertical scaling

Increase PostgreSQL CPU, RAM, and storage capacity.

### Stage 2 — Read replicas

Route read-heavy workloads such as doctor search and analytics to read replicas where eventual consistency is acceptable.

### Stage 3 — Partitioning

Large append-heavy tables such as audit logs and historical consultation records can be partitioned by time.

Example:

```text
audit_log
   │
   ├── audit_log_2026_01
   ├── audit_log_2026_02
   ├── audit_log_2026_03
   └── ...
```

### Stage 4 — Archival

Old historical records can be moved to lower-cost archival storage according to retention requirements while keeping operational tables smaller.

---

## 15. Reliability and Availability

The target availability is 99.95%.

Reliability mechanisms include:

* Health checks
* Readiness checks
* Graceful shutdown
* Database transactions
* Idempotent writes
* Optimistic concurrency
* Database constraints
* Redis-backed infrastructure
* Background workers
* Retry/backoff strategy
* Container health checks
* Automated CI validation
* Structured operational logs

The API exposes:

```text
GET /health/live
GET /health/ready
```

`/health/live` verifies that the application process is alive.

`/health/ready` verifies required dependencies such as PostgreSQL and Redis are available.

---

## 16. Retry and Failure Handling

Retries should only be applied to operations that are safe to retry.

Recommended retry policy:

```text
Attempt 1
   │
   ├── success → complete
   │
   └── transient failure
          │
          ▼
      exponential backoff
          │
          ▼
      Attempt 2
          │
          ▼
      Attempt 3
          │
          ▼
      dead-letter/manual recovery
```

Exponential backoff with jitter prevents many clients from retrying simultaneously after a dependency failure.

Non-retryable errors such as validation failures, authorization failures, and deterministic conflicts should return immediately.

Booking conflicts are not retried blindly because the slot may already have been successfully reserved by another patient.

---

## 17. Security Architecture

Security controls include:

* JWT authentication
* Role-based authorization
* Resource-level authorization
* TOTP MFA
* Password hashing
* Zod request validation
* Helmet security headers
* CORS configuration
* Rate limiting
* Sensitive-header log redaction
* Centralized error handling
* Audit logging
* Database constraints
* Short-lived access tokens
* Refresh-token storage using hashed token values

Sensitive credentials and production secrets must be supplied through environment/secret-management infrastructure rather than committed to source control.

Production deployments must use HTTPS and strong randomly generated secrets.

---

## 18. Auditability and Compliance

Sensitive operations generate audit events.

Examples include:

* User registration
* MFA activation
* Consultation-related state changes
* Other privileged operations

Audit records should contain enough information to reconstruct who performed an operation, what resource was affected, and when it occurred.

Healthcare-related data requires strict access control and appropriate retention policies.

Production deployments should additionally integrate organization-specific legal, regulatory, retention, and privacy requirements.

---

## 19. Observability

The backend implements three observability pillars.

### Logs

Pino provides structured JSON logs.

Request information includes:

* request ID
* HTTP method
* URL
* status code
* response time
* request metadata

Sensitive authorization data is redacted.

### Metrics

Prometheus-compatible metrics are exposed through:

```text
GET /metrics
```

Metrics include process/runtime information and HTTP request metrics such as:

```text
http_requests_total
http_request_duration_ms
```

These metrics can be consumed by Prometheus for dashboards and alerting.

### Traces

OpenTelemetry instruments HTTP activity and exports traces through the OpenTelemetry Collector.

```text
Node.js API
    │
    │ OTLP HTTP
    ▼
OpenTelemetry Collector
    │
    │ OTLP gRPC
    ▼
Jaeger
    │
    ▼
Jaeger UI
```

This enables request-level latency and dependency investigation.

---

## 20. Deployment Architecture

The application is containerized using Docker Compose for local/integration environments.

The deployment contains:

```text
┌─────────────────────────────────────┐
│             Docker Host             │
│                                     │
│  ┌─────────┐   ┌─────────┐          │
│  │   API   │   │ Worker  │          │
│  └────┬────┘   └────┬────┘          │
│       │             │               │
│  ┌────▼─────────────▼────┐          │
│  │       PostgreSQL      │          │
│  └───────────────────────┘          │
│                                     │
│  ┌───────────────────────┐          │
│  │         Redis         │          │
│  └───────────────────────┘          │
│                                     │
│  ┌─────────────┐ ┌──────────────┐   │
│  │ Prometheus  │ │    Jaeger    │   │
│  └─────────────┘ └──────────────┘   │
│          │             ▲            │
│          └── Collector ┘            │
└─────────────────────────────────────┘
```

For production, the same logical architecture can be deployed using managed PostgreSQL/Redis and horizontally scaled API/worker instances.

---

## 21. CI/CD

GitHub Actions validates the application before changes are merged.

The CI pipeline performs:

```text
Checkout
   │
   ▼
Install dependencies
   │
   ▼
Start PostgreSQL + Redis
   │
   ▼
Run Prisma migrations
   │
   ▼
Seed test data
   │
   ▼
Run tests
   │
   ▼
TypeScript build
```

This prevents basic compilation and regression issues from reaching deployment.

Production CI/CD should additionally include:

* Image build
* Image vulnerability scanning
* Deployment
* Health verification
* Rollback on failed health checks

---

## 22. Backup and Disaster Recovery

Production PostgreSQL should use automated backups with a defined retention policy.

Recommended strategy:

* Automated daily full backups
* Point-in-time recovery where supported
* Periodic restore testing
* Encrypted backups
* Off-host backup storage
* Documented recovery procedures

Redis data should be treated according to workload criticality. Redis should not be the sole source of truth for healthcare or transactional records.

The recovery plan should define:

* Recovery Point Objective (RPO)
* Recovery Time Objective (RTO)
* Backup retention
* Restore ownership
* Incident escalation procedure

---

## 23. Scaling to 100,000 Daily Consultations

100,000 consultations per day averages approximately:

```text
100,000 / 86,400
≈ 1.16 consultations/second
```

However, production capacity cannot be designed around the average alone because consultation demand is bursty.

The architecture therefore separates:

### Synchronous critical path

* Authentication
* Availability lookup
* Slot reservation
* Consultation creation
* Prescription operations

### Asynchronous path

* Notifications
* Reminders
* Non-critical processing
* Long-running background operations

Horizontal API scaling, indexed database queries, Redis caching, connection pooling, background workers, and database scaling can absorb traffic spikes without unnecessarily increasing synchronous request latency.

Load testing must validate the stated p95 latency targets under representative peak workloads before production capacity is finalized.

---

## 24. Key Architectural Decisions

| Decision               | Reason                                                    |
| ---------------------- | --------------------------------------------------------- |
| Modular monolith       | Clear domain boundaries with lower operational complexity |
| PostgreSQL             | Strong relational consistency and transactions            |
| Prisma                 | Type-safe database access and migrations                  |
| Redis                  | Low-latency cache and queue infrastructure                |
| JWT                    | Stateless API authentication                              |
| TOTP MFA               | Additional authentication factor                          |
| Optimistic concurrency | Prevents simultaneous slot reservation                    |
| Idempotency keys       | Prevents duplicate write operations                       |
| Pino                   | Structured production logging                             |
| Prometheus             | Operational metrics                                       |
| OpenTelemetry          | Standardized tracing                                      |
| Jaeger                 | Trace visualization                                       |
| Docker                 | Reproducible environments                                 |
| GitHub Actions         | Automated CI validation                                   |

---

## 25. Conclusion

The architecture provides a scalable foundation for a telemedicine backend while keeping transactional healthcare operations strongly consistent.

The most important correctness guarantees are provided by PostgreSQL transactions, atomic slot reservation, optimistic concurrency control, database uniqueness constraints, resource-level authorization, and idempotent write handling.

Operational reliability is supported through health checks, graceful shutdown, structured logging, metrics, distributed tracing, Redis-backed asynchronous processing, automated tests, and CI.

The system can initially operate as a modular monolith and scale horizontally as traffic increases, while allowing database, caching, worker, and read-scaling strategies to evolve independently.
