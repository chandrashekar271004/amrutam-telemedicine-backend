import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { audit } from '../audit/service';

export async function create(
  doctorUserId: string,
  consultationId: string,
  medicines: any[],
  instructions?: string,
) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
  });

  if (!consultation) {
    throw new AppError(
      404,
      'Consultation not found',
      'NOT_FOUND',
    );
  }

  if (consultation.doctorId !== doctorUserId) {
    throw new AppError(
      403,
      'Only the assigned doctor can prescribe',
      'FORBIDDEN',
    );
  }

  if (
    consultation.status !== 'COMPLETED' &&
    consultation.status !== 'IN_PROGRESS'
  ) {
    throw new AppError(
      400,
      'Consultation is not active',
      'INVALID_CONSULTATION_STATE',
    );
  }

  const prescription = await prisma.prescription.upsert({
    where: { consultationId },
    update: {
      medicinesJson: medicines,
      instructions,
    },
    create: {
      consultationId,
      prescriberId: doctorUserId,
      medicinesJson: medicines,
      instructions,
    },
  });

  await audit({
    actorId: doctorUserId,
    action: 'PRESCRIPTION_UPSERTED',
    resource: 'Prescription',
    resourceId: prescription.id,
  });

  return prescription;
}

export async function get(
  patientId: string,
  role: any,
  id: string,
) {
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    include: {
      consultation: true,
      prescriber: {
        select: {
          id: true,
          profile: true,
        },
      },
    },
  });

  if (!prescription) {
    throw new AppError(
      404,
      'Prescription not found',
      'NOT_FOUND',
    );
  }

  if (
    role === 'PATIENT' &&
    prescription.consultation.patientId !== patientId
  ) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (
    role === 'DOCTOR' &&
    prescription.consultation.doctorId !== patientId
  ) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  return prescription;
}
