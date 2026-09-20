import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';

export async function createBooking(
  patientId: string,
  slotId: string,
  reason?: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        include: {
          doctor: {
            select: {
              userId: true,
              specialty: true,
              consultationFee: true,
              isVerified: true,
            },
          },
        },
      });

      if (!slot) {
        throw new AppError(
          404,
          'Availability slot not found',
          'SLOT_NOT_FOUND',
        );
      }

      if (!slot.doctor.isVerified) {
        throw new AppError(
          403,
          'Doctor is not verified',
          'DOCTOR_NOT_VERIFIED',
        );
      }

      if (slot.startsAt <= new Date()) {
        throw new AppError(
          400,
          'Cannot book a slot in the past',
          'PAST_SLOT',
        );
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: {
          id: slotId,
          status: 'AVAILABLE',
          version: slot.version,
        },
        data: {
          status: 'BOOKED',
          version: {
            increment: 1,
          },
        },
      });

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'Slot is no longer available',
          'SLOT_UNAVAILABLE',
        );
      }

      try {
        const consultation = await tx.consultation.create({
          data: {
            patientId,
            doctorId: slot.doctor.userId,
            slotId: slot.id,
            scheduledAt: slot.startsAt,
            status: 'SCHEDULED',
            reason,
          },
          include: {
            slot: true,
            doctorProfile: {
              select: {
                id: true,
                specialty: true,
                consultationFee: true,
                experienceYears: true,
              },
            },
            patient: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: patientId,
            action: 'BOOKING_CREATED',
            resource: 'Consultation',
            resourceId: consultation.id,
            metadata: {
              slotId,
              doctorId: slot.doctorId,
              scheduledAt: slot.startsAt.toISOString(),
            },
          },
        });

        return consultation;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new AppError(
            409,
            'Slot has already been booked',
            'SLOT_ALREADY_BOOKED',
          );
        }

        throw error;
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}

export async function getBooking(
  patientId: string,
  consultationId: string,
) {
  const consultation = await prisma.consultation.findUnique({
    where: {
      id: consultationId,
    },
    include: {
      slot: true,
      doctorProfile: {
        select: {
          id: true,
          specialty: true,
          consultationFee: true,
          experienceYears: true,
          registrationNo: true,
        },
      },
      patient: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!consultation || consultation.patientId !== patientId) {
    throw new Error('Booking not found');
  }

  return consultation;
}