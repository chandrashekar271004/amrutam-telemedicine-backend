# Data Partitioning & Scaling Plan

## Current design

The transactional tables use UUID primary keys and indexes aligned to access patterns. Availability uses `(doctorId, startsAt, status)` and a unique `(doctorId, startsAt, endsAt)` constraint. Consultations use patient/doctor + createdAt indexes. Audit logs are indexed by actor and resource.

## At scale

1. **audit_logs:** monthly range partition by `createdAt`; retain hot partitions in primary storage and archive older partitions to cheaper encrypted storage.
2. **consultations:** consider monthly range partitioning only after query-plan/volume measurements. Keep primary access paths partition-prunable by `createdAt` where possible.
3. **payments:** partition by `createdAt` if payment volume justifies it; keep provider reference unique when used.
4. **analytics:** use a read replica or warehouse instead of large OLTP aggregates.

Partitioning is an operational optimization, not a substitute for indexing. Introduce it after measuring table growth and vacuum/query behavior.
