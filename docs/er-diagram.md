# ER Diagram

```mermaid
erDiagram
  USERS ||--o| PROFILES : has
  USERS ||--o| DOCTORS : may_be
  DOCTORS ||--o{ AVAILABILITY_SLOTS : publishes
  USERS ||--o{ CONSULTATIONS : patient
  USERS ||--o{ CONSULTATIONS : doctor
  AVAILABILITY_SLOTS ||--o| CONSULTATIONS : reserves
  CONSULTATIONS ||--o| PRESCRIPTIONS : produces
  CONSULTATIONS ||--o| PAYMENTS : has
  USERS ||--o{ PAYMENTS : owns
  USERS ||--o{ AUDIT_LOGS : creates
  USERS ||--o{ REFRESH_TOKENS : owns

  USERS { uuid id PK; string email UK; string phone UK; enum role; bool mfaEnabled; bool isActive }
  PROFILES { uuid id PK; uuid userId FK UK; string firstName; string lastName; date dob }
  DOCTORS { uuid id PK; uuid userId FK UK; string specialty; string registrationNo UK; decimal consultationFee; bool isVerified }
  AVAILABILITY_SLOTS { uuid id PK; uuid doctorId FK; datetime startsAt; datetime endsAt; enum status; int version }
  CONSULTATIONS { uuid id PK; uuid patientId FK; uuid doctorId FK; uuid slotId FK UK; enum status; datetime createdAt }
  PRESCRIPTIONS { uuid id PK; uuid consultationId FK UK; uuid prescriberId FK; json medicinesJson }
  PAYMENTS { uuid id PK; uuid consultationId FK UK; uuid userId FK; decimal amount; enum status }
  AUDIT_LOGS { uuid id PK; uuid actorId FK; string action; string resource; string resourceId; datetime createdAt }
  REFRESH_TOKENS { uuid id PK; uuid userId FK; string tokenHash UK; datetime expiresAt; datetime revokedAt }
```
