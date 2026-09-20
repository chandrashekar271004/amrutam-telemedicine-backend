# Amrutam Telemedicine Backend

Production-oriented telemedicine backend built with **Node.js + TypeScript + Express + PostgreSQL + Prisma + Redis + BullMQ**.

## Scope

- User lifecycle, JWT authentication, RBAC and TOTP MFA
- Doctor search/filtering and verification
- Doctor availability slots
- Concurrency-safe consultation booking
- Idempotent write endpoints
- Consultation lifecycle and prescriptions
- Payment record lifecycle foundation
- Audit trails
- Admin analytics
- Prometheus metrics + OpenTelemetry traces + Jaeger
- Docker Compose
- GitHub Actions CI
- OpenAPI schema

## Architecture choice

This is a **modular monolith** intentionally: it has domain boundaries and dependency direction without the operational cost of microservices for a 4–5 day assignment. The boundaries can later be extracted into services.

## Prerequisites

- Node.js 22+
- Docker Desktop
- Git

## Local setup

```bash
git clone <your-repo-url>
cd amrutam-telemedicine-backend
cp .env.example .env
npm install
docker compose up -d postgres redis
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API: `http://localhost:5000`

OpenAPI: `http://localhost:5000/openapi.yaml`

Metrics: `http://localhost:5000/metrics`

Jaeger UI: `http://localhost:16686`

Prometheus: `http://localhost:9090`

## Full container stack

```bash
docker compose up --build
```

## Tests

```bash
npm test
npm run build
```

Tests expect PostgreSQL and Redis to be available using the values in `.env`.

## Seed admin

```bash
SEED_ADMIN_PASSWORD='Use-A-Strong-Local-Password' npm run seed
```

The seed creates `admin@example.com`. Change this approach for real production; use an audited admin provisioning workflow.

## Main endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/mfa/setup`
- `POST /api/v1/auth/mfa/enable`
- `GET/PATCH /api/v1/users/me`
- `GET /api/v1/doctors`
- `POST /api/v1/doctors` (admin)
- `POST /api/v1/doctors/:id/verify` (admin)
- `GET /api/v1/availability/:doctorId`
- `POST /api/v1/availability/:doctorId` (doctor)
- `POST /api/v1/consultations/book` (patient + Idempotency-Key)
- `GET /api/v1/consultations`
- `PATCH /api/v1/consultations/:id/status`
- `POST /api/v1/prescriptions/:consultationId` (doctor)
- `GET /api/v1/prescriptions/:id`
- `GET /api/v1/search/doctors`
- `GET /api/v1/admin/analytics` (admin)

## Production hardening before real healthcare use

This repository is an assignment-grade foundation, not a clinical production deployment. Before handling real patient data, add managed secrets/KMS, key rotation with `kid`, refresh-token rotation in secure HTTP-only cookies, stronger MFA recovery controls, WAF/DDoS protection, managed PostgreSQL HA/PITR, Redis HA, centralized immutable audit storage, formal retention/deletion policies, compliance/legal review, payment-provider integration, notification provider, video provider, consent workflows, penetration testing and restore/failover drills.

## Documentation

- `docs/architecture.md`
- `docs/booking-sequence.md`
- `docs/er-diagram.md`
- `docs/security-threat-model.md`
- `docs/runbook.md`
- `openapi.yaml`

> After the first successful `npm install`, commit the generated `package-lock.json` and change Docker/CI installs to `npm ci` for reproducible builds.
