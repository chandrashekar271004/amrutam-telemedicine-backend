# Production Runbook

## Health
- `/health/live` proves the process is alive.
- `/health/ready` verifies PostgreSQL and Redis.
- `/metrics` exposes Prometheus metrics.

## Incident: elevated 5xx
1. Check API error rate and latency in Prometheus.
2. Correlate request IDs in structured logs.
3. Check PostgreSQL connection saturation and slow queries.
4. Check Redis health and queue depth.
5. Roll back the last deployment if a release correlates with the incident.

## Incident: booking conflicts
Check `availability_slots` status, transaction serialization errors and unique constraints. Never manually mark a slot as booked without a corresponding consultation/payment review.

## Backup/DR
Use managed PostgreSQL PITR with daily full backups. Recommended assignment target: RPO ≤15m and RTO ≤60m. Test restoration into an isolated environment and document the exact restore command/result.

## Scaling
Scale API replicas horizontally first. Add PostgreSQL read replicas for read-heavy endpoints. Partition/archive audit data as volume grows. Move analytics to a replica/warehouse rather than running large aggregates against the OLTP primary.
