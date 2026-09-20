# Amrutam Telemedicine Backend - Production Runbook

## 1. Purpose

This runbook provides operational procedures for running, monitoring, troubleshooting, deploying, and recovering the Amrutam Telemedicine Backend.

The application consists of:

* Node.js + Express API
* PostgreSQL
* Redis
* Background worker
* Prometheus
* OpenTelemetry Collector
* Jaeger
* Docker Compose

---

## 2. Service Overview

```text
Client
  |
  v
Node.js API :5000
  |
  +----------> PostgreSQL
  |
  +----------> Redis
  |
  +----------> Background Jobs
  |
  +----------> OpenTelemetry Collector
                         |
                         v
                       Jaeger

Prometheus <---------- /metrics
```

Local service endpoints:

| Service                 | Endpoint                           |
| ----------------------- | ---------------------------------- |
| API                     | http://localhost:5000              |
| Swagger                 | http://localhost:5000/docs         |
| OpenAPI JSON            | http://localhost:5000/openapi.json |
| OpenAPI YAML            | http://localhost:5000/openapi.yaml |
| Liveness                | http://localhost:5000/health/live  |
| Readiness               | http://localhost:5000/health/ready |
| Metrics                 | http://localhost:5000/metrics      |
| PostgreSQL              | localhost:5434                     |
| Redis                   | localhost:6379                     |
| Prometheus              | http://localhost:9090              |
| Jaeger                  | http://localhost:16686             |
| OpenTelemetry Collector | localhost:14318                    |

---

## 3. Prerequisites

Required tools:

* Node.js
* npm
* Docker Desktop
* Git

Verify:

```powershell
node --version
npm --version
docker --version
docker compose version
git --version
```

---

## 4. Environment Configuration

Create a local `.env` file.

Example:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://telemedicine:TelemedicineDb123@127.0.0.1:5434/telemedicine?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
OTEL_SERVICE_NAME=amrutam-telemedicine-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

Never commit real secrets.

Production secrets should be supplied through a managed secrets system or deployment environment.

---

## 5. Initial Setup

Install dependencies:

```powershell
npm install
```

Generate Prisma Client:

```powershell
npx prisma generate
```

Validate the schema:

```powershell
npx prisma validate
```

---

## 6. Start Infrastructure

Start PostgreSQL, Redis, Prometheus, Jaeger, and OpenTelemetry Collector:

```powershell
docker compose up -d postgres redis prometheus jaeger otel-collector
```

Check status:

```powershell
docker compose ps
```

PostgreSQL and Redis should report healthy.

---

## 7. Database Migration

Apply production migrations:

```powershell
npx prisma migrate deploy
```

For local development where a new migration is required:

```powershell
npx prisma migrate dev
```

Do not use `migrate dev` against a production database.

---

## 8. Seed Development Data

For the local development environment:

```powershell
npm run seed
```

The seed creates development accounts.

Example development accounts:

```text
Admin:
admin@example.com

Doctor:
doctor@example.com

Patient:
patient@example.com
```

Development passwords are defined in the seed configuration and should never be reused in production.

---

## 9. Build the Application

Compile TypeScript:

```powershell
npm run build
```

The compiled application is generated under:

```text
dist/
```

---

## 10. Start the API Locally

Development mode:

```powershell
npm run dev
```

Production-style local mode:

```powershell
npm run build
npm start
```

The API should listen on:

```text
http://localhost:5000
```

---

## 11. Start the Background Worker

The worker processes asynchronous jobs.

Development:

```powershell
npm run worker
```

Production Docker deployment:

```text
worker container -> Redis queue -> background processing
```

Workers can be horizontally scaled when queue depth increases.

---

## 12. Health Checks

### Liveness

```powershell
Invoke-RestMethod http://localhost:5000/health/live
```

Expected result:

```json
{
  "status": "ok"
}
```

Liveness indicates that the API process is running.

### Readiness

```powershell
Invoke-RestMethod http://localhost:5000/health/ready
```

Readiness verifies dependencies such as PostgreSQL and Redis.

Expected healthy response contains:

```json
{
  "status": "ok"
}
```

A readiness failure should be investigated before routing production traffic to the instance.

---

## 13. Metrics

Prometheus metrics are exposed at:

```text
http://localhost:5000/metrics
```

Verify:

```powershell
Invoke-RestMethod http://localhost:5000/metrics
```

Important metrics include:

* HTTP request count
* HTTP request duration
* Process CPU
* Process memory
* Heap usage
* Garbage collection
* Event loop latency
* Active resources
* Node.js runtime information

Application request metrics include:

```text
http_requests_total
http_request_duration_ms
```

---

## 14. Structured Logging

The application uses structured JSON logging.

Logs contain useful operational fields such as:

* Request ID
* HTTP method
* URL
* Status code
* Response time
* Error information
* Request metadata

Sensitive information must be redacted.

Examples of data that must not appear in logs:

* Passwords
* JWT tokens
* Refresh tokens
* MFA secrets
* Authorization headers
* Database credentials

---

## 15. Distributed Tracing

OpenTelemetry sends traces through the Collector.

Local architecture:

```text
Node.js API
     |
     | OTLP HTTP
     v
OpenTelemetry Collector :14318
     |
     | OTLP gRPC
     v
Jaeger
     |
     v
Jaeger UI :16686
```

Open:

```text
http://localhost:16686
```

Select:

```text
amrutam-telemedicine-api
```

Traces should appear after making API requests.

---

## 16. Swagger and OpenAPI

Swagger UI:

```text
http://localhost:5000/docs
```

OpenAPI JSON:

```text
http://localhost:5000/openapi.json
```

OpenAPI YAML:

```text
http://localhost:5000/openapi.yaml
```

Use the OpenAPI specification as the API contract for frontend, testing, and integration work.

---

## 17. Authentication Troubleshooting

Authentication failures should first be checked for:

1. Correct email
2. Correct password
3. Valid JWT
4. Correct token format
5. User active status
6. MFA requirement
7. Valid TOTP code

Authorization header format:

```text
Authorization: Bearer <access-token>
```

An invalid or expired access token should return:

```text
401 Unauthorized
```

A valid user without sufficient permissions should return:

```text
403 Forbidden
```

---

## 18. MFA Troubleshooting

MFA-enabled users require a valid TOTP code during login.

If MFA login fails:

1. Verify the authenticator device time is synchronized.
2. Generate a fresh TOTP code.
3. Confirm the correct account is being used.
4. Confirm the user's MFA status.
5. Check API logs for the authentication error.
6. Review the audit trail if required.

MFA secrets must never be printed in logs or committed to source control.

---

## 19. Booking Troubleshooting

Booking is a transaction-sensitive operation.

Expected flow:

```text
Patient
   |
   v
Booking API
   |
   v
Validate request
   |
   v
Check idempotency key
   |
   v
PostgreSQL transaction
   |
   +--> Verify slot
   |
   +--> Atomic status/version update
   |
   +--> Create consultation
   |
   +--> Create audit record
   |
   v
Commit
```

If two users attempt to book the same slot simultaneously:

* One request succeeds.
* The competing request receives a conflict response.
* Only one consultation is created.
* The slot becomes unavailable.

Do not resolve booking conflicts by trusting cached Redis availability.

---

## 20. Idempotency Troubleshooting

Write operations use an idempotency key to prevent accidental duplicate processing.

Example header:

```text
Idempotency-Key: unique-request-id
```

If the same request is submitted again with the same key, the previously stored response should be returned.

Clients should generate a unique idempotency key for each logical write operation.

Do not reuse an idempotency key for unrelated operations.

---

## 21. Database Troubleshooting

Check PostgreSQL:

```powershell
docker compose ps postgres
```

View PostgreSQL logs:

```powershell
docker compose logs --tail=100 postgres
```

Check API logs:

```powershell
docker compose logs --tail=100 api
```

Check database readiness:

```powershell
docker exec amrutam-telemedicine-backend-postgres-1 pg_isready -U telemedicine -d telemedicine
```

Check Prisma migration status:

```powershell
npx prisma migrate status
```

If the database is unavailable:

1. Check Docker container status.
2. Check PostgreSQL logs.
3. Verify `DATABASE_URL`.
4. Verify port configuration.
5. Verify credentials.
6. Check available disk space.
7. Check connection limits.

---

## 22. Redis Troubleshooting

Check Redis:

```powershell
docker compose ps redis
```

View logs:

```powershell
docker compose logs --tail=100 redis
```

Test Redis:

```powershell
docker exec amrutam-telemedicine-backend-redis-1 redis-cli ping
```

Expected:

```text
PONG
```

If Redis is unavailable:

1. Check container health.
2. Check Redis logs.
3. Verify `REDIS_URL`.
4. Check memory usage.
5. Restart the Redis service if required.

---

## 23. OpenTelemetry Troubleshooting

Check Collector:

```powershell
docker compose ps otel-collector
```

View Collector logs:

```powershell
docker compose logs --tail=100 otel-collector
```

Check Jaeger:

```powershell
docker compose ps jaeger
```

View Jaeger logs:

```powershell
docker compose logs --tail=100 jaeger
```

If traces are missing:

1. Confirm the API is running.
2. Confirm `OTEL_EXPORTER_OTLP_ENDPOINT`.
3. Confirm Collector is running.
4. Confirm Jaeger is running.
5. Generate a fresh API request.
6. Refresh the Jaeger UI.

Local Windows API configuration:

```text
http://localhost:14318
```

Docker API configuration:

```text
http://otel-collector:4318
```

These addresses are intentionally different because the Docker network uses the Collector service name while the local host uses the published Collector port.

---

## 24. Prometheus Troubleshooting

Open:

```text
http://localhost:9090
```

Verify that the application metrics target is available.

If Prometheus is unavailable:

```powershell
docker compose logs --tail=100 prometheus
```

Check configuration:

```text
infra/prometheus/prometheus.yml
```

Restart:

```powershell
docker compose restart prometheus
```

---

## 25. Docker Troubleshooting

List services:

```powershell
docker compose ps
```

View all logs:

```powershell
docker compose logs --tail=100
```

Restart a service:

```powershell
docker compose restart <service>
```

Example:

```powershell
docker compose restart api
```

Rebuild the API image:

```powershell
docker compose build api
```

Recreate the API:

```powershell
docker compose up -d api
```

Avoid deleting persistent volumes during routine troubleshooting.

Do not run:

```powershell
docker compose down -v
```

unless intentionally destroying the local database and persistent data.

---

## 26. Deployment Procedure

Recommended deployment sequence:

```text
1. Push code
      |
      v
2. CI validation
      |
      v
3. Build application
      |
      v
4. Build container image
      |
      v
5. Apply database migrations
      |
      v
6. Deploy API
      |
      v
7. Deploy worker
      |
      v
8. Run health checks
      |
      v
9. Verify metrics/logs/traces
      |
      v
10. Monitor deployment
```

Database migrations must complete successfully before application instances depend on the new schema.

---

## 27. CI/CD Verification

Before merging or deploying:

```powershell
npm run lint
npm test
npm run build
npx prisma validate
```

Also check:

```powershell
git diff --check
```

CI should verify:

* Dependencies install successfully
* Prisma migrations apply
* Tests pass
* TypeScript compilation succeeds
* Build succeeds
* Security-sensitive configuration is not committed

---

## 28. Production Deployment Checklist

Before production deployment:

* [ ] Production JWT secret configured
* [ ] Production database credentials configured
* [ ] Redis credentials/configuration secured
* [ ] HTTPS enabled
* [ ] CORS restricted to trusted origins
* [ ] Production MFA configuration verified
* [ ] Rate limits reviewed
* [ ] Database backups enabled
* [ ] Point-in-time recovery configured
* [ ] Database access restricted
* [ ] Monitoring configured
* [ ] Alerting configured
* [ ] Logs do not contain secrets
* [ ] OpenTelemetry configured
* [ ] Health checks configured
* [ ] CI pipeline passing
* [ ] Container images scanned
* [ ] Dependencies reviewed
* [ ] Restore procedure tested

---

## 29. Incident Response

When a production incident occurs:

### Step 1 - Identify

Determine:

* What is failing?
* Which service is affected?
* When did the problem begin?
* Is the problem affecting all users or a subset?

### Step 2 - Stabilize

Possible actions:

* Stop unhealthy deployment
* Scale API instances
* Disable a problematic feature
* Restart failed worker/API instances
* Reduce traffic
* Protect the database from overload

### Step 3 - Investigate

Review:

* Application logs
* Request IDs
* Prometheus metrics
* Jaeger traces
* PostgreSQL metrics
* Redis metrics
* Recent deployments

### Step 4 - Recover

Apply the smallest safe corrective action.

Examples:

* Roll back application deployment
* Restart failed service
* Restore database from backup
* Fail over to a healthy database
* Clear or retry failed background jobs

### Step 5 - Verify

Confirm:

* Health endpoints are healthy
* Error rate returned to normal
* Latency returned to normal
* Booking consistency is intact
* Background queues are processing
* No data corruption occurred

### Step 6 - Document

Record:

* Incident timeline
* Root cause
* Impact
* Resolution
* Preventive actions

---

## 30. Database Recovery

If database recovery is required:

1. Stop or isolate application writes.
2. Determine the recovery point.
3. Restore the database using the approved recovery process.
4. Verify schema and migrations.
5. Validate critical records.
6. Run health checks.
7. Resume application traffic.
8. Monitor closely.

Never perform destructive recovery commands without confirming the target database and backup.

---

## 31. Graceful Shutdown

The API supports graceful shutdown.

During termination:

```text
Receive SIGTERM
      |
      v
Stop accepting new requests
      |
      v
Finish active requests
      |
      v
Shutdown tracing
      |
      v
Close Redis
      |
      v
Disconnect PostgreSQL
      |
      v
Exit
```

This allows container orchestrators and deployment systems to replace instances without unnecessarily interrupting active requests.

---

## 32. Performance Investigation

For slow API requests:

1. Check `http_request_duration_ms`.
2. Identify the affected endpoint.
3. Check application logs using the request ID.
4. Inspect Jaeger traces.
5. Check database query performance.
6. Check Redis latency.
7. Check CPU and memory.
8. Review recent code/deployment changes.

For slow database queries, use:

```sql
EXPLAIN ANALYZE <query>;
```

Do not add indexes blindly.

Indexes should be based on actual query patterns and measured performance.

---

## 33. Security Incident Response

For suspected credential or token exposure:

1. Rotate affected credentials.
2. Rotate application secrets where necessary.
3. Revoke affected refresh tokens.
4. Review authentication and audit logs.
5. Identify affected accounts.
6. Check for unauthorized activity.
7. Preserve relevant logs.
8. Document the incident.
9. Apply preventive controls.

Never paste production secrets, JWTs, passwords, refresh tokens, or MFA secrets into tickets, chat, or source control.

---

## 34. Data Protection

Medical and personal information must be treated as sensitive data.

Production deployments should enforce:

* Encryption in transit
* Encryption at rest
* Least-privilege access
* Secure authentication
* MFA
* Resource-level authorization
* Audit logging
* Secure backups
* Controlled retention
* Secure deletion procedures

Development data should not contain real patient information.

---

## 35. Regular Maintenance

Recommended maintenance activities:

### Daily

* Review service health
* Review error rates
* Check background queues
* Check backup status

### Weekly

* Review slow queries
* Review database growth
* Review Redis memory
* Review application errors
* Review security events

### Monthly

* Test restore procedures
* Review dependencies
* Review access permissions
* Review infrastructure capacity
* Review audit retention

### Periodically

* Perform load testing
* Perform vulnerability scanning
* Review threat model
* Conduct security testing
* Validate disaster recovery procedures

---

## 36. Emergency Commands

Check all services:

```powershell
docker compose ps
```

View recent logs:

```powershell
docker compose logs --tail=200
```

Restart API:

```powershell
docker compose restart api
```

Restart worker:

```powershell
docker compose restart worker
```

Restart Redis:

```powershell
docker compose restart redis
```

Restart PostgreSQL:

```powershell
docker compose restart postgres
```

Restart observability:

```powershell
docker compose restart prometheus otel-collector jaeger
```

Check API:

```powershell
Invoke-RestMethod http://localhost:5000/health/live
Invoke-RestMethod http://localhost:5000/health/ready
```

---

## 37. Rollback Strategy

If a deployment introduces a critical regression:

1. Stop further rollout.
2. Identify the previous known-good application version.
3. Roll back application instances.
4. Verify health endpoints.
5. Check metrics and logs.
6. Verify booking and authentication flows.
7. Monitor the system.

Database rollback requires additional caution.

Prefer backward-compatible migrations so that application rollback does not require destructive database changes.

---

## 38. Service-Level Verification

After deployment verify:

```text
API
  |
  +-- /health/live
  +-- /health/ready
  +-- /metrics
  +-- /docs

Authentication
  |
  +-- Login
  +-- JWT
  +-- MFA

Booking
  |
  +-- Availability
  +-- Booking
  +-- Idempotency
  +-- Concurrent booking protection

Consultation
  |
  +-- Lifecycle transitions
  +-- Authorization

Prescription
  |
  +-- Creation
  +-- Resource-level authorization

Observability
  |
  +-- Logs
  +-- Metrics
  +-- Traces
```

---

## 39. Production Readiness Summary

The production deployment should provide:

```text
                 Load Balancer
                       |
              +--------+--------+
              |        |        |
             API      API      API
              |        |        |
              +--------+--------+
                       |
          +------------+------------+
          |                         |
        Redis                  PostgreSQL
          |                    /          \
          |                Primary       Replica
          |                    |
       Workers              Backups
          |
          +----------------------+
                                 |
                         Observability
                      /        |        \
                Prometheus    Logs     Jaeger
```

The operational priorities are:

1. Maintain booking consistency.
2. Protect patient and healthcare data.
3. Monitor application and infrastructure health.
4. Maintain reliable backups and recovery procedures.
5. Deploy through validated CI/CD pipelines.
6. Scale based on measured workload.
7. Keep production secrets outside source control.
8. Test disaster recovery regularly.

---

## 40. Final Operational Checklist

Before considering the environment production-ready:

* [ ] API health check passes
* [ ] API readiness check passes
* [ ] PostgreSQL healthy
* [ ] Redis healthy
* [ ] Background worker healthy
* [ ] Database migrations applied
* [ ] Authentication verified
* [ ] MFA verified
* [ ] RBAC verified
* [ ] Resource-level authorization verified
* [ ] Booking concurrency verified
* [ ] Idempotency verified
* [ ] Consultation lifecycle verified
* [ ] Prescription authorization verified
* [ ] Audit logging verified
* [ ] Metrics endpoint verified
* [ ] Structured logs verified
* [ ] Sensitive headers redacted
* [ ] OpenTelemetry traces verified
* [ ] Prometheus verified
* [ ] Jaeger verified
* [ ] CI pipeline passing
* [ ] Production secrets configured securely
* [ ] HTTPS configured
* [ ] Database backups verified
* [ ] Restore procedure tested
* [ ] Monitoring alerts configured
* [ ] Incident response procedure documented
* [ ] Load testing completed
* [ ] Security review completed

---

## 41. Conclusion

This runbook provides the operational procedures required to run and maintain the Amrutam Telemedicine Backend.

The system is designed around:

* Transactional PostgreSQL data
* Redis-backed shared infrastructure
* Stateless horizontally scalable API instances
* Background workers
* Idempotent write operations
* Concurrency-safe booking
* Structured logging
* Prometheus metrics
* OpenTelemetry tracing
* Health checks
* CI/CD validation
* Backup and recovery procedures
* Security and audit controls

Production capacity and scaling decisions should be validated through load testing, monitoring, and real workload measurements.
