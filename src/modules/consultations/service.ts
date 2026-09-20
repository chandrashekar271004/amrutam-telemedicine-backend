import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { audit } from '../audit/service.js';

type Actor = {
  id: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
};

type ConsultationStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

type ConsultationListQuery = {
  page: number;
  limit: number;
  status?: ConsultationStatus;
};

export async function book(
  patientId: string,
  slotId: string,
  reason?: string,
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        throw new AppError(404, 'Slot not found', 'SLOT_NOT_FOUND');
      }

      if (slot.startsAt <= new Date()) {
        throw new AppError(400, 'Cannot book a past slot', 'PAST_SLOT');
      }

      const claimed = await tx.availabilitySlot.updateMany({
        where: {
          id: slotId,
          status: 'AVAILABLE',
        },
        data: {
          status: 'BOOKED',
          version: {
            increment: 1,
          },
        },
      });

      if (claimed.count !== 1) {
        throw new AppError(
          409,
          'Slot is no longer available',
          'SLOT_ALREADY_BOOKED',
        );
      }

      const consultation = await tx.consultation.create({
        data: {
          patientId,
          doctorId: slot.doctorId,
          slotId,
          reason,
          scheduledAt: slot.startsAt,
        },
      });

      const doctor = await tx.doctor.findUniqueOrThrow({
        where: { id: slot.doctorId },
        select: {
          consultationFee: true,
        },
      });

      await tx.payment.create({
        data: {
          consultationId: consultation.id,
          userId: patientId,
          amount: doctor.consultationFee,
        },
      });

      return consultation;
    },
    {
      isolationLevel: 'Serializable',
    },
  );

  await audit({
    actorId: patientId,
    action: 'CONSULTATION_BOOKED',
    resource: 'Consultation',
    resourceId: result.id,
  });

  return result;
}

export async function updateStatus(
  actor: Actor,
  id: string,
  status: ConsultationStatus,
  notes?: string,
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      slot: true,
      doctorProfile: true,
    },
  });

  if (!consultation) {
    throw new AppError(404, 'Consultation not found', 'NOT_FOUND');
  }

  if (
    actor.role === 'PATIENT' &&
    status !== 'CANCELLED'
  ) {
    throw new AppError(
      403,
      'Patient can only cancel',
      'FORBIDDEN',
    );
  }

  if (
    actor.role === 'PATIENT' &&
    consultation.patientId !== actor.id
  ) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (
    actor.role === 'DOCTOR' &&
    consultation.doctorId !== actor.id
  ) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      const updatedConsultation = await tx.consultation.update({
        where: { id },
        data: {
          status,
          notes,
          completedAt:
            status === 'COMPLETED'
              ? new Date()
              : undefined,
        },
      });

      if (status === 'CANCELLED') {
        await tx.availabilitySlot.update({
          where: { id: consultation.slotId },
          data: {
            status: 'AVAILABLE',
          },
        });
      }

      return updatedConsultation;
    },
  );

  await audit({
    actorId: actor.id,
    action: `CONSULTATION_${status}`,
    resource: 'Consultation',
    resourceId: id,
  });

  return updated;
}

export async function list(
  actor: Actor,
  q: ConsultationListQuery,
) {
  const { page, limit } = q;

  const where = {
    ...(actor.role === 'PATIENT'
      ? { patientId: actor.id }
      : actor.role === 'DOCTOR'
        ? { doctorId: actor.id }
        : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.consultation.findMany({
      where,
      include: {
        slot: true,
        patient: {
          select: {
            id: true,
            profile: true,
          },
        },
        doctorProfile: true,
        prescription: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.consultation.count({
      where,
    }),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
