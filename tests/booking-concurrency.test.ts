import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

async function createPatient(label: string) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `concurrency-${label}-${unique}@example.com`;
  const password = 'StrongPassword123!';

  const register = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password,
      firstName: 'Concurrency',
      lastName: label,
    })
    .expect(201);

  const userId = register.body.data.id;

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email,
      password,
    })
    .expect(200);

  return {
    email,
    id: userId,
    token: login.body.data.accessToken,
  };
}

describe('booking concurrency', () => {
  it('allows only one patient to book the same slot', async () => {
    const doctor = await prisma.doctor.findFirstOrThrow({
      where: {
        isVerified: true,
      },
    });

    const patient1 = await createPatient('One');
    const patient2 = await createPatient('Two');

    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startsAt.setSeconds(0, 0);

    const endsAt = new Date(
      startsAt.getTime() + 30 * 60 * 1000,
    );

    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor.id,
        startsAt,
        endsAt,
        status: 'AVAILABLE',
      },
    });

    try {
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${patient1.token}`)
          .set(
            'Idempotency-Key',
            `concurrent-${Date.now()}-one`,
          )
          .send({
            slotId: slot.id,
            reason: 'Concurrent booking test',
          }),

        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${patient2.token}`)
          .set(
            'Idempotency-Key',
            `concurrent-${Date.now()}-two`,
          )
          .send({
            slotId: slot.id,
            reason: 'Concurrent booking test',
          }),
      ]);

      const statuses = [
        response1.status,
        response2.status,
      ].sort();

      expect(statuses).toEqual([201, 409]);

      const consultations = await prisma.consultation.findMany({
        where: {
          slotId: slot.id,
        },
      });

      expect(consultations).toHaveLength(1);

      const bookedSlot =
        await prisma.availabilitySlot.findUniqueOrThrow({
          where: {
            id: slot.id,
          },
        });

      expect(bookedSlot.status).toBe('BOOKED');
      expect(bookedSlot.version).toBe(1);
    } finally {
      await prisma.auditLog.deleteMany({
        where: {
          resource: 'Consultation',
          actorId: {
            in: [patient1.id, patient2.id],
          },
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

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [patient1.id, patient2.id],
          },
        },
      });
    }
  });
});
