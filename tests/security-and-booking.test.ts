import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

async function loginPatient() {
  const email = `booking-test-${Date.now()}@example.com`;

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'StrongPassword123!',
      firstName: 'Booking',
      lastName: 'Test',
    })
    .expect(201);

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email,
      password: 'StrongPassword123!',
    })
    .expect(200);

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
  });

  return {
    email,
    userId: user.id,
    token: login.body.data.accessToken,
  };
}

async function getDoctor() {
  return prisma.doctor.findFirstOrThrow({
    where: {
      isVerified: true,
    },
  });
}

describe('security and booking API', () => {
  it('rejects an invalid JWT', async () => {
    const response = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects patient access to doctor-only endpoint', async () => {
    const email = `security-${Date.now()}@example.com`;

    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'StrongPassword123!',
        firstName: 'Security',
        lastName: 'Test',
      });

    expect(register.status).toBe(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'StrongPassword123!',
      });

    expect(login.status).toBe(200);

    const token = login.body.data.accessToken;

    const response = await request(app)
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        specialty: 'General Medicine',
        registrationNo: `SEC-${Date.now()}`,
        consultationFee: 500,
        experienceYears: 2,
      });

    expect(response.status).toBe(403);

    await prisma.user.delete({
      where: { email },
    });
  });

  it('requires authentication before checking booking idempotency', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send({
        slotId: '00000000-0000-0000-0000-000000000000',
      });

    expect(response.status).toBe(401);
  });

  it('requires Idempotency-Key for an authenticated booking request', async () => {
    const patient = await loginPatient();

    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        slotId: '00000000-0000-0000-0000-000000000000',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    await prisma.user.delete({
      where: { id: patient.userId },
    });
  });

  it('replays the same booking response for the same Idempotency-Key', async () => {
    const patient = await loginPatient();
    const doctor = await getDoctor();

    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    startsAt.setSeconds(0, 0);

    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor.id,
        startsAt,
        endsAt,
        status: 'AVAILABLE',
      },
    });

    const idempotencyKey = `test-idempotency-${Date.now()}`;

    try {
      const first = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${patient.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          slotId: slot.id,
          reason: 'Automated idempotency test',
        });

      expect(first.status).toBe(201);
      expect(first.body.data.id).toBeDefined();

      const second = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${patient.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          slotId: slot.id,
          reason: 'Automated idempotency test',
        });

      expect(second.status).toBe(201);
      expect(second.body.data.id).toBe(first.body.data.id);

      const consultations = await prisma.consultation.count({
        where: {
          slotId: slot.id,
        },
      });

      expect(consultations).toBe(1);
    } finally {
      await prisma.auditLog.deleteMany({
        where: {
          resource: 'Consultation',
          resourceId: {
            not: null,
          },
          actorId: patient.userId,
        },
      });

      await prisma.consultation.deleteMany({
        where: {
          slotId: slot.id,
        },
      });

      await prisma.availabilitySlot.delete({
        where: {
          id: slot.id,
        },
      });

      await prisma.user.delete({
        where: {
          id: patient.userId,
        },
      });
    }
  });

  it('returns readiness when PostgreSQL and Redis are available', async () => {
    const response = await request(app)
      .get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.dependencies.postgres).toBe('ok');
    expect(response.body.dependencies.redis).toBe('ok');
  });

  it('serves the OpenAPI JSON document', async () => {
    const response = await request(app)
      .get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info).toBeDefined();
    expect(response.body.paths).toBeDefined();
  });
});