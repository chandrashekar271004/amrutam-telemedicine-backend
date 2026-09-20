# Amrutam Telemedicine Backend - Security Checklist and Threat Model

## 1. Purpose

The Amrutam Telemedicine Backend handles authentication, patient information, doctor information, consultation records, prescriptions, payments, and audit data.

The security design follows defense-in-depth principles:

* Authentication
* Authorization
* MFA
* Input validation
* Rate limiting
* Secure HTTP headers
* Secret management
* Data integrity
* Audit logging
* Sensitive-data redaction
* Monitoring and incident response

Production deployment must additionally comply with the organization's applicable healthcare, privacy, and data-retention requirements.

---

## 2. Security Objectives

The primary security objectives are:

1. Prevent unauthorized access to patient and doctor information.
2. Protect authentication credentials.
3. Prevent privilege escalation.
4. Prevent duplicate or unauthorized booking operations.
5. Protect sensitive data during transmission and storage.
6. Maintain an audit trail for sensitive actions.
7. Reduce the impact of credential compromise.
8. Detect suspicious or abnormal activity.
9. Prevent common web/API attacks.
10. Support incident investigation.

---

## 3. Authentication

The API uses JWT-based authentication.

Authentication flow:

```text id="c7bq3w"
Client
  |
  | credentials
  v
Authentication API
  |
  +--> Verify password hash
  |
  +--> Check account state
  |
  +--> MFA verification when enabled
  |
  v
JWT access token
```

Access tokens are short-lived.

Authentication failures return generic credential errors rather than revealing whether an email/account exists.

---

## 4. Multi-Factor Authentication

The system supports TOTP-based MFA.

When MFA is enabled:

```text id="6y7o5q"
Password
   +
TOTP code
   |
   v
Authentication successful
```

MFA setup requires verification of the generated TOTP secret before MFA is enabled.

Successful MFA activation generates an audit event.

### Production hardening

The following controls should be applied before production:

* Encrypt MFA secrets at rest.
* Restrict database access.
* Never expose MFA secrets in logs.
* Never commit MFA secrets to source control.
* Provide a secure MFA recovery process.
* Rate-limit MFA verification attempts.
* Require re-authentication for sensitive MFA changes.

---

## 5. Password Security

Passwords are never stored in plaintext.

The application stores password hashes.

Security requirements:

* Strong password hashing algorithm
* Unique password hash per user
* Generic authentication error responses
* Rate limiting on authentication endpoints
* No passwords in logs
* No passwords in audit metadata
* Secrets supplied through environment/secret management

---

## 6. Authorization

Authorization uses role-based access control.

Primary roles:

```text id="19fk7x"
ADMIN
DOCTOR
PATIENT
```

Authorization is enforced at the API layer.

Resource-level authorization is also required.

For example:

```text id="p7u9im"
Patient A
   |
   +----> Patient A prescription    ALLOWED
   |
   +----> Patient B prescription    DENIED
```

Possession of a resource identifier must not be sufficient to access another user's clinical data.

---

## 7. Privilege Boundaries

The application separates responsibilities between roles.

### Patient

Can access resources belonging to the authenticated patient and perform patient-level operations.

### Doctor

Can access doctor-specific functionality and authorized consultation/prescription operations.

### Admin

Can access administrative analytics and privileged administrative operations.

Authorization checks should always be performed server-side.

Client-side role information must never be treated as a security boundary.

---

## 8. Input Validation

Request bodies, parameters, and query values should be validated before reaching business logic.

The application uses Zod schemas for request validation.

Validation protects against:

* Invalid data types
* Missing required fields
* Unexpected values
* Malformed identifiers
* Invalid date/time values
* Oversized or malformed request data

Validation should reject invalid input early.

---

## 9. Rate Limiting

API rate limiting is enabled to reduce abuse and brute-force attempts.

Particularly sensitive endpoints include:

```text
/login
/register
/mfa/*
```

Rate limiting helps mitigate:

* Credential brute force
* MFA brute force
* Automated abuse
* Excessive API requests
* Resource exhaustion

Production deployments should tune limits based on endpoint sensitivity and expected traffic.

---

## 10. Security Headers

Helmet is used to configure common HTTP security headers.

Examples include:

```text id="i6k0ip"
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
```

HTTPS should be mandatory in production.

---

## 11. CORS

Cross-Origin Resource Sharing is explicitly configured.

Production CORS configuration should allow only trusted application origins.

Avoid:

```text id="m6s75s"
Access-Control-Allow-Origin: *
```

for authenticated healthcare APIs.

Allowed origins should be configured through deployment environment variables.

---

## 12. JWT Security

JWT security requirements include:

* Strong signing secret
* Short access-token lifetime
* Secure secret storage
* Role information validated server-side
* Token signature verification
* Token expiration verification
* Account-state verification

The signing secret must never be committed to Git.

Production should use a dedicated secrets manager or protected deployment secret.

---

## 13. Refresh Token Security

Refresh tokens are stored as hashes.

The system therefore follows:

```text id="o6rdwx"
Raw refresh token
       |
       v
SHA-256 hash
       |
       v
Database
```

If the database is exposed, the stored value is not directly usable as the original refresh token.

Refresh tokens should additionally support:

* Expiration
* Revocation
* Rotation where appropriate
* Session/device management

---

## 14. Sensitive Logging Protection

Application logs must not expose authentication credentials or other sensitive secrets.

Authorization headers are redacted.

Example:

```text id="5jfr8f"
authorization: [Redacted]
```

The same principle must be applied to:

* Passwords
* JWTs
* Refresh tokens
* MFA secrets
* API keys
* Payment credentials
* Sensitive personal data

Structured logs should contain request identifiers so incidents can be investigated without exposing confidential values.

---

## 15. SQL Injection

The application uses Prisma for database access.

Application code should avoid constructing SQL queries by directly concatenating untrusted user input.

For any raw SQL that becomes necessary:

* Use parameterized queries.
* Never concatenate request parameters into SQL.
* Restrict raw-query permissions.

---

## 16. NoSQL Injection

The current primary database is PostgreSQL, so MongoDB-style query injection is not a primary application threat.

Nevertheless, all input should remain validated and typed.

---

## 17. Cross-Site Scripting

The backend validates structured input and returns JSON responses.

Additional controls include:

* Content Security Policy
* Output encoding where applicable
* Avoiding unsafe HTML rendering
* Rejecting unexpected input fields

If a future frontend renders user-generated consultation or profile content as HTML, that frontend must apply appropriate output encoding/sanitization.

---

## 18. CSRF

The API primarily uses bearer-token authentication.

If authentication is later moved to browser cookies, CSRF protection must be enabled using appropriate:

* SameSite cookie settings
* CSRF tokens
* Origin/Referer validation

Cookie-based authentication should not be introduced without revisiting the threat model.

---

## 19. Booking Security

Booking has both authorization and concurrency requirements.

The secure flow is:

```text id="jlr8qh"
Authenticated Patient
        |
        v
RBAC / resource validation
        |
        v
Idempotency check
        |
        v
Database transaction
        |
        v
Atomic slot reservation
        |
        v
Consultation creation
        |
        v
Audit event
```

The system prevents unauthorized booking and protects against double booking.

---

## 20. Threat Model

The following threats are considered high-priority API threats.

| Threat                 | Example                                          | Mitigation                            |
| ---------------------- | ------------------------------------------------ | ------------------------------------- |
| Credential theft       | Stolen password                                  | Password hashing + MFA                |
| Brute force            | Repeated login attempts                          | Rate limiting                         |
| JWT theft              | Stolen access token                              | Short TTL + HTTPS                     |
| Privilege escalation   | Patient calling admin endpoint                   | RBAC                                  |
| IDOR                   | Patient accessing another patient's prescription | Resource-level authorization          |
| Double booking         | Two patients booking one slot                    | Transaction + optimistic concurrency  |
| Duplicate writes       | Network retry                                    | Idempotency key                       |
| SQL injection          | Malicious query input                            | Prisma + validation                   |
| Secret leakage         | Token in logs                                    | Log redaction                         |
| MFA compromise         | TOTP secret exposed                              | Secret protection + MFA controls      |
| API abuse              | High request volume                              | Rate limiting                         |
| Database compromise    | DB credentials exposed                           | Secret management + restricted access |
| Data interception      | HTTP traffic capture                             | TLS/HTTPS                             |
| Dependency outage      | Redis/Postgres failure                           | Health checks + retry strategy        |
| Malicious admin action | Privileged misuse                                | RBAC + audit logging                  |

---

## 21. STRIDE Analysis

### Spoofing

An attacker attempts to impersonate a user.

Controls:

* Password hashing
* JWT authentication
* MFA
* Rate limiting
* HTTPS

### Tampering

An attacker attempts to modify booking or consultation data.

Controls:

* Authorization
* Database constraints
* Transactions
* Optimistic concurrency
* Audit logging

### Repudiation

A user denies performing an operation.

Controls:

* Audit logs
* Request IDs
* Structured logging
* Timestamps

### Information Disclosure

An attacker attempts to access another user's healthcare information.

Controls:

* Resource-level authorization
* RBAC
* HTTPS
* Log redaction
* Database access restrictions

### Denial of Service

An attacker sends excessive requests.

Controls:

* Rate limiting
* Request validation
* Health checks
* Resource monitoring
* Bounded retries

### Elevation of Privilege

A lower-privileged user attempts to access administrative or doctor functionality.

Controls:

* RBAC
* Server-side authorization
* Resource-level authorization
* JWT role validation

---

## 22. Secrets Management

Production secrets must never be committed to the repository.

Sensitive values include:

```text id="w4kvxh"
DATABASE_URL
JWT_SECRET
Redis credentials
MFA encryption keys
Payment provider keys
Notification provider keys
```

Development may use a local `.env` file.

Production should use:

* Cloud secret manager
* Deployment platform secrets
* Container/orchestrator secrets
* Restricted environment configuration

`.env` files containing secrets must remain ignored by Git.

---

## 23. Data Protection

Production healthcare data should use:

### Encryption in transit

```text
Client
  |
 HTTPS/TLS
  |
 API
```

### Encryption at rest

Database storage, backups, and other persistent sensitive storage should use encryption provided by the infrastructure/platform.

### Least privilege

Only services and operators that require access should receive database credentials or sensitive data access.

---

## 24. Database Security

Production PostgreSQL should be configured with:

* Private networking where possible
* Strong credentials
* Restricted inbound access
* TLS connections
* Least-privilege database users
* Encrypted storage
* Automated backups
* Audit/monitoring capabilities

The application should not use a superuser database account in production.

---

## 25. Container Security

Production containers should follow:

* Minimal base images
* Non-root execution where possible
* No unnecessary packages
* Pinned dependency versions
* Vulnerability scanning
* Read-only filesystem where practical
* Restricted network access
* No secrets baked into images

The Docker image should not contain `.env` files or private credentials.

---

## 26. Dependency Security

Dependencies should be regularly reviewed.

Recommended CI checks include:

```text
npm audit
Dependency update review
Container vulnerability scanning
Secret scanning
```

Dependencies should be updated in controlled changes with tests executed before deployment.

---

## 27. Audit and Monitoring

Security-relevant events should be monitored.

Examples:

```text
LOGIN_FAILURE
MFA_ENABLED
MFA_FAILURE
ROLE/PRIVILEGE CHANGES
BOOKING_CONFLICT
UNAUTHORIZED_ACCESS_ATTEMPT
ADMIN_ACTION
```

Audit records should be retained according to the organization's security and regulatory requirements.

Operational alerts should be configured for abnormal patterns such as:

* Sudden authentication failure spikes
* Repeated MFA failures
* Excessive 403 responses
* Unusual booking conflicts
* Increased 5xx responses
* Database connectivity failures

---

## 28. Incident Response

When a security incident is detected:

```text id="j7k35c"
Detect
  |
  v
Contain
  |
  v
Investigate
  |
  v
Remediate
  |
  v
Recover
  |
  v
Review
```

Useful evidence includes:

* Request IDs
* Structured logs
* Audit records
* Prometheus metrics
* OpenTelemetry traces
* Database events
* Deployment history

Incident response procedures should define responsible personnel, escalation paths, communication requirements, and evidence-retention rules.

---

## 29. Production Security Checklist

### Authentication

* [x] Password hashing
* [x] JWT authentication
* [x] Short-lived access tokens
* [x] TOTP MFA
* [x] Authentication rate limiting
* [ ] MFA secret encryption at rest
* [ ] Secure MFA recovery flow

### Authorization

* [x] RBAC
* [x] Resource-level authorization
* [x] Server-side permission checks
* [ ] Formal permission matrix

### Input/API Security

* [x] Zod validation
* [x] Rate limiting
* [x] Helmet
* [x] CORS configuration
* [x] Centralized error handling
* [x] Request IDs

### Data Security

* [x] Password hashes
* [x] Refresh-token hashes
* [x] Database constraints
* [ ] Production encryption-at-rest verification
* [ ] Production TLS database configuration

### Logging/Monitoring

* [x] Structured logs
* [x] Sensitive-header redaction
* [x] Prometheus metrics
* [x] OpenTelemetry tracing
* [x] Audit logs
* [ ] Security alert rules

### Infrastructure

* [x] Docker
* [x] Health checks
* [x] CI tests
* [x] CI build
* [ ] Container vulnerability scanning
* [ ] Production secrets manager
* [ ] Automated production backup verification

---

## 30. Security Priorities Before Production

The following items should be completed before handling real patient data:

1. Encrypt MFA secrets at rest.
2. Use a managed secrets solution.
3. Enforce HTTPS/TLS everywhere.
4. Configure encrypted PostgreSQL backups.
5. Restrict production database network access.
6. Run dependency and container vulnerability scans.
7. Define formal RBAC/permission matrix.
8. Configure security alerts.
9. Test backup restoration.
10. Conduct penetration/security testing.
11. Define incident response procedures.
12. Validate applicable healthcare/privacy compliance requirements.

---

## 31. Summary

The backend implements multiple security layers rather than relying on a single control.

```text id="0rgh8e"
                    ┌─────────────────┐
                    │   HTTPS / TLS   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Rate Limiting   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Authentication  │
                    │ JWT + MFA       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ RBAC + Resource │
                    │ Authorization   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Input Validation│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Business Logic  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Transactions +  │
                    │ DB Constraints  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Audit + Monitor │
                    └─────────────────┘
```

The current implementation provides the core application security controls required for the assignment. Production deployment must additionally harden infrastructure, secrets management, encryption, backups, dependency security, and operational monitoring before processing real healthcare data.
