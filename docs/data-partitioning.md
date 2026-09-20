# Amrutam Telemedicine Backend - Data Partitioning and Scaling Strategy

## 1. Purpose

This document describes how the database and application can scale as the platform grows toward 100,000 daily consultations.

The design focuses on:

* Efficient indexing
* Read/write scaling
* Data partitioning
* Archival
* Query optimization
* Connection management
* Cache usage
* Operational safety

---

## 2. Current Database

The application uses PostgreSQL with Prisma ORM.

Primary database entities include:

* User
* Profile
* Doctor
* AvailabilitySlot
* Consultation
* Prescription
* Payment
* RefreshToken
* AuditLog

PostgreSQL is the transactional system of record.

Redis is used for shared caching and background job infrastructure.

---

## 3. Indexing Strategy

Indexes should support the most frequent API queries while avoiding unnecessary indexes that increase write overhead.

### User

Useful indexes:

* Unique email
* Role
* Active status

The unique email constraint also prevents duplicate accounts.

### Doctor

Useful indexes:

* specialization
* verification status
* userId

These support doctor discovery, filtering, and user-to-doctor lookups.

### AvailabilitySlot

Important query patterns include doctor availability and time-range searches.

Recommended indexes:

* doctorId + startTime
* status + startTime
* doctorId + status + startTime

The booking path also relies on the unique slot identifier and atomic status/version update.

### Consultation

Recommended indexes:

* patientId + startTime
* doctorId + startTime
* status + startTime
* slotId

These support:

* Patient consultation history
* Doctor schedules
* Consultation lifecycle queries
* Administrative reporting
* Slot-to-consultation lookup

### AuditLog

Recommended indexes:

* actorId + createdAt
* resource + resourceId
* action + createdAt
* createdAt

Audit data is commonly queried by time range, actor, action, or resource.

---

## 4. Query Optimization

The application should avoid unnecessary full-table scans.

Optimization practices include:

* Select only required columns
* Use pagination for large result sets
* Use cursor pagination for high-volume feeds
* Avoid N+1 queries
* Use appropriate composite indexes
* Analyze slow queries with PostgreSQL query plans
* Avoid unbounded result sets
* Apply filters at the database layer
* Avoid loading large related datasets unnecessarily

Slow queries should be identified through application metrics and PostgreSQL monitoring.

Queries that are frequently executed should be reviewed using `EXPLAIN ANALYZE` before adding or changing indexes.

---

## 5. Read Scaling

Read-heavy workloads can be scaled using PostgreSQL read replicas.

Example architecture:

```text
                  +----------------+
                  | Node.js API    |
                  +-------+--------+
                          |
             +------------+------------+
             |                         |
             v                         v
      Primary PostgreSQL        Read Replica(s)
      Read + Write              Read Only
             |
             v
       Write Operations
```

Write operations continue to use the primary database.

Suitable read operations include:

* Doctor search
* Doctor profiles
* Consultation history
* Availability browsing
* Administrative analytics

Consistency-sensitive operations such as booking must continue to use the primary database.

Read replicas introduce replication lag, so APIs requiring the latest transactional state should not depend on a replica.

---

## 6. Redis Caching

Redis can reduce database load for frequently accessed data.

Potential cache candidates include:

* Doctor search results
* Doctor profiles
* Frequently requested availability data
* Configuration
* Short-lived application state

Cache entries should use appropriate TTLs.

Example:

```text
Client
  |
  v
API
  |
  +----> Redis HIT ----> Response
  |
  +----> Redis MISS
            |
            v
        PostgreSQL
            |
            v
        Redis SET
            |
            v
         Response
```

Cache invalidation should occur when cached resources change.

Booking decisions must not depend solely on cached availability.

PostgreSQL remains the source of truth for slot reservation and booking consistency.

---

## 7. Partitioning Strategy

High-volume tables can eventually be partitioned by time.

The primary candidate is `AuditLog` because audit records continuously accumulate and are naturally queried by time ranges.

Possible strategy:

```text
audit_log
  |
  +-- audit_log_2026_01
  +-- audit_log_2026_02
  +-- audit_log_2026_03
  +-- ...
```

Monthly range partitioning provides:

* Faster time-range queries
* Easier archival
* Smaller indexes per partition
* Easier maintenance
* Controlled data retention
* Reduced operational impact when archiving old data

Consultation data can also be considered for partitioning if volume becomes sufficiently large.

A possible future strategy is monthly partitioning based on consultation start time.

Partitioning should only be introduced after measuring actual database growth and query performance.

---

## 8. Audit Data Retention

Audit logs may grow significantly because security and compliance events are continuously recorded.

A retention policy should define:

* Active database retention period
* Archived data period
* Legal and compliance retention requirements
* Secure deletion requirements
* Access controls for archived records

Older audit partitions can be moved to lower-cost archival storage while maintaining controlled access.

Retention requirements must be confirmed against applicable healthcare, privacy, and data-protection regulations before production deployment.

---

## 9. Connection Pooling

Each API instance should use a controlled PostgreSQL connection pool.

With multiple API instances, the total number of database connections must remain within PostgreSQL capacity.

Example:

```text
API Instance 1 ---> Pool
API Instance 2 ---> Pool
API Instance 3 ---> Pool
                     |
                     v
                PostgreSQL
```

For larger deployments, PgBouncer or a managed connection pool can be introduced.

Connection limits should be calculated based on:

* Number of API instances
* Pool size per instance
* Background worker connections
* Administrative connections
* Database resource capacity

Connection exhaustion should be monitored and alerted.

---

## 10. Horizontal API Scaling

The API should remain stateless so multiple instances can run behind a load balancer.

Example:

```text
                    Load Balancer
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
       API-1          API-2          API-3
          |              |              |
          +--------------+--------------+
                         |
                 PostgreSQL / Redis
```

JWT access tokens allow requests to be authenticated without server-local sessions.

Redis provides shared infrastructure for state that must be accessible across API instances.

Horizontal scaling allows additional API instances to be added as request volume increases.

---

## 11. Booking Consistency

Booking is a consistency-sensitive operation.

The system must not rely on Redis or read replicas to determine whether a slot can be booked.

The authoritative flow is:

```text
Request
   |
   v
Primary PostgreSQL
   |
   +-- Verify slot
   |
   +-- Atomic conditional update
   |
   +-- Create consultation
   |
   +-- Create audit record
   |
   v
Commit transaction
```

The conditional update uses the slot status and version to protect against concurrent booking attempts.

The database transaction and unique slot constraint provide defense in depth.

If two users attempt to reserve the same slot concurrently, only one transaction should successfully reserve it. The other request receives a conflict response.

---

## 12. Analytics Scaling

Administrative analytics can become expensive as consultation volume grows.

Possible improvements include:

* Read replicas
* Pre-aggregated statistics
* Materialized views
* Scheduled aggregation jobs
* Redis caching
* Separate analytics database

Analytics queries should not block transactional booking workloads.

For high-volume analytics, reporting workloads should be separated from latency-sensitive transactional queries.

---

## 13. Background Processing

Long-running or non-critical work should be moved out of the synchronous request path.

Potential background jobs include:

* Notifications
* Reminder processing
* Analytics aggregation
* Audit archival
* Report generation
* Retryable external integrations

The application uses Redis-backed background processing so API instances do not need to wait for every asynchronous operation to complete.

Workers can be scaled horizontally based on queue depth and processing latency.

---

## 14. Backup and Recovery

Production PostgreSQL should use:

* Automated backups
* Point-in-time recovery
* Replication
* Encrypted backup storage
* Backup retention policies
* Periodic restore testing

Recovery objectives should be explicitly defined:

* **RPO:** Maximum acceptable data loss
* **RTO:** Maximum acceptable recovery time

Example:

```text
Primary Database
      |
      +----> Continuous WAL / Replication
      |
      +----> Encrypted Backups
                    |
                    v
             Disaster Recovery
```

Backups should be isolated from the primary database environment so that a database compromise does not automatically compromise all backup copies.

Restore procedures should be tested periodically rather than assuming that successful backup jobs guarantee recoverability.

---

## 15. Scaling Toward 100K Daily Consultations

100,000 consultations per day averages approximately:

```text
100,000 / 86,400 = 1.16 consultations per second
```

The actual peak traffic will be significantly higher than the daily average.

Capacity planning should therefore use peak traffic rather than average traffic.

The architecture supports:

* Horizontal API scaling
* Redis caching
* PostgreSQL indexing
* PostgreSQL read replicas
* Background workers
* Connection pooling
* Database backups
* Monitoring and alerting

Load testing should determine the actual number of API instances, database resources, Redis capacity, and worker concurrency required for the expected peak workload.

The target should be validated using realistic workloads rather than theoretical averages.

---

## 16. Migration Strategy

Database schema changes should use version-controlled Prisma migrations.

Production migrations should:

1. Be tested in CI.
2. Be tested against a production-like database.
3. Be backward compatible where possible.
4. Avoid long blocking operations.
5. Be monitored during deployment.
6. Have a recovery procedure.

Large table migrations should use staged changes instead of long-running blocking migrations.

For example:

```text
Phase 1
Add nullable column

        ↓

Phase 2
Deploy application supporting old + new schema

        ↓

Phase 3
Backfill existing data

        ↓

Phase 4
Switch application reads/writes

        ↓

Phase 5
Add constraints or remove deprecated fields
```

This approach reduces deployment risk and supports rolling deployments.

---

## 17. Operational Monitoring

Monitor at minimum:

* Query latency
* Database CPU
* Database memory
* Connection utilization
* Cache hit ratio
* Redis memory
* API request latency
* Error rate
* Booking conflict rate
* Queue depth
* Background job failures
* Storage growth
* Replica lag
* Backup success/failure

Alerts should be configured for sustained threshold violations.

Application metrics should be correlated with database and infrastructure metrics to identify the actual bottleneck.

---

## 18. Scaling Decision Triggers

Scaling changes should be driven by measurable signals.

Examples:

| Signal                      | Possible Action                                      |
| --------------------------- | ---------------------------------------------------- |
| High API CPU                | Add API instances                                    |
| High database CPU           | Optimize queries or increase database capacity       |
| High read traffic           | Introduce read replicas                              |
| Low cache hit ratio         | Review cache keys and TTLs                           |
| High Redis memory           | Review TTLs or increase Redis capacity               |
| High connection utilization | Tune pools or introduce PgBouncer                    |
| Growing audit table         | Introduce time partitioning and archival             |
| High queue depth            | Increase worker concurrency/instances                |
| High replica lag            | Reduce replica workload or increase replica capacity |
| Slow analytics queries      | Pre-aggregate or isolate analytics workloads         |

Scaling decisions should be validated through metrics and load testing.

---

## 19. Data Consistency Rules

The following operations must use the primary transactional database:

* Booking a slot
* Changing slot status
* Creating consultations
* Updating consultation lifecycle
* Creating prescriptions
* Recording payment state
* Security-sensitive authorization decisions

Redis may improve performance but must not become the authoritative source for transactional medical or booking state.

Read replicas may be used for eventually consistent workloads where replication lag is acceptable.

---

## 20. Security Considerations

Database scaling must preserve security controls.

Production database infrastructure should use:

* Private network access
* TLS for database connections where supported
* Strong database credentials
* Least-privilege database users
* Encrypted storage
* Encrypted backups
* Network-level access restrictions
* Secret management
* Database activity monitoring
* Regular dependency and infrastructure updates

The application should never expose PostgreSQL or Redis directly to the public internet.

---

## 21. Summary

The current architecture uses PostgreSQL as the transactional source of truth and Redis for shared caching and background processing.

The scaling strategy is:

```text
                    Load Balancer
                         |
              +----------+----------+
              |          |          |
             API        API        API
              |          |          |
              +----------+----------+
                         |
                  +------+------+
                  |             |
                Redis      PostgreSQL
                  |          /       \
                  |       Primary   Replica
                  |          |
                  |       Backups
                  |
             Background
               Jobs
```

The design provides a path from a modular monolith to a horizontally scalable production deployment without sacrificing booking consistency.

Partitioning, read replicas, connection pooling improvements, and dedicated analytics infrastructure should be introduced based on measured workload, database growth, and performance data rather than prematurely.
