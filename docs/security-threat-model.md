# Security Checklist & Threat Model

## Data classification

- **Restricted:** passwords, MFA secrets, refresh tokens, payment provider credentials.
- **Highly sensitive:** patient profile data, consultations, prescriptions, medical notes.
- **Sensitive:** doctor registration data, payment records, audit metadata.
- **Operational:** service metrics, deployment metadata and non-identifying health checks.

## Attack surface

1. Public authentication and search endpoints.
2. Authenticated patient/doctor APIs.
3. Admin APIs.
4. Database and Redis network endpoints.
5. Worker queue.
6. CI/CD and container registry.
7. Observability pipeline and log storage.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| Credential stuffing | Auth rate limiting, bcrypt, MFA |
| JWT theft | Short access-token TTL, TLS, refresh-token rotation, revocation |
| IDOR/BOLA | Ownership checks on consultations/prescriptions; RBAC |
| Double booking | Serializable transaction + atomic slot state transition + DB uniqueness |
| Replay/double writes | Idempotency-Key with Redis fingerprint/result |
| SQL injection | Prisma parameterized queries + validation |
| XSS | Helmet, JSON API, output encoding at UI layer |
| CSRF | Prefer bearer tokens for API clients; use SameSite + CSRF tokens if cookies are used |
| Abuse/DDoS | Rate limits, WAF/load balancer, payload limits |
| Secret leakage | Env only locally; production secret manager/KMS; log redaction |
| Supply-chain attack | Lockfile, npm audit/SCA, Dependabot/Renovate, pinned base images |
| Insider misuse | Least privilege + immutable audit storage + admin MFA |
| Data loss | Managed PostgreSQL backups + PITR + restore drills |
| Queue failure | Retries, backoff+jitter, bounded attempts, failed-job monitoring |

## Encryption

Use TLS 1.2+ in transit and provider-managed encryption at rest. Encrypt backups. Store application secrets in a secret manager. Rotate JWT signing keys using key IDs and overlapping verification windows when the system moves beyond a single-secret implementation.

## Audit requirements

Audit authentication events, role changes, doctor verification, availability changes, booking/cancellation, consultation state changes, prescriptions, payment state changes and administrative access. Audit records should be append-oriented and protected from application-level deletion by ordinary users.

## Dependency and container security

CI should run dependency vulnerability scanning, secret scanning and container image scanning. Images should run as non-root, use minimal bases, and be rebuilt regularly for security patches.
