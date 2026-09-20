import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { audit } from '../audit/service.js';

type CreateDoctorInput = {
  userId: string;
  specialty: string;
  registrationNo: string;
  bio?: string;
  consultationFee: number;
  experienceYears: number;
};

type DoctorSearchQuery = {
  page: number;
  limit: number;
  specialty?: string;
  verified?: string | boolean;
};

export async function create(
  input: CreateDoctorInput,
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user || user.role !== 'DOCTOR') {
    throw new AppError(
      400,
      'User must have DOCTOR role',
      'INVALID_DOCTOR_USER',
    );
  }

  const doctor = await prisma.doctor.create({
    data: {
      userId: input.userId,
      specialty: input.specialty,
      registrationNo: input.registrationNo,
      bio: input.bio,
      consultationFee: input.consultationFee,
      experienceYears: input.experienceYears,
    },
  });

  await audit({
    actorId,
    action: 'DOCTOR_CREATED',
    resource: 'Doctor',
    resourceId: doctor.id,
  });

  return doctor;
}

export async function search(q: DoctorSearchQuery) {
  const { page, limit } = q;

  const where = {
    ...(q.specialty
      ? {
          specialty: {
            contains: q.specialty,
            mode: 'insensitive' as const,
          },
        }
      : {}),

    ...(q.verified !== undefined
      ? {
          isVerified:
            q.verified === true ||
            q.verified === 'true',
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.doctor.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        specialty: true,
        bio: true,
        consultationFee: true,
        experienceYears: true,
        isVerified: true,
        user: {
          select: {
            id: true,
            profile: true,
          },
        },
      },
    }),

    prisma.doctor.count({
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

export async function verify(
  id: string,
  actorId: string,
) {
  const doctor = await prisma.doctor.update({
    where: { id },
    data: {
      isVerified: true,
    },
  });

  await audit({
    actorId,
    action: 'DOCTOR_VERIFIED',
    resource: 'Doctor',
    resourceId: id,
  });

  return doctor;
}
