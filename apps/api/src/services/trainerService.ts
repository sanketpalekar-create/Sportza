import prisma from "../lib/prisma";

export async function getTrainerDashboard(trainerId: number) {
  const [batches, totalStudents, monthlyEarnings, totalEarnings, recentSessions] =
    await Promise.all([
      prisma.batch.count({ where: { trainerId, isActive: true } }),

      prisma.batchMembership.count({
        where: {
          batch: { trainerId },
          status: "active",
        },
      }),

      prisma.batchPayment.aggregate({
        where: {
          batch: { trainerId },
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          status: "completed",
        },
        _sum: { trainerNetAmount: true },
      }),

      prisma.batchPayment.aggregate({
        where: {
          batch: { trainerId },
          status: "completed",
        },
        _sum: { trainerNetAmount: true },
      }),

      prisma.batchSession.findMany({
        where: {
          batch: { trainerId },
          date: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) },
        },
        include: {
          batch: { select: { id: true, name: true } },
          attendance: true,
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
    ]);

  return {
    activeBatches: batches,
    totalStudents,
    monthlyEarnings: monthlyEarnings._sum.trainerNetAmount || 0,
    totalEarnings: totalEarnings._sum.trainerNetAmount || 0,
    recentSessions,
  };
}

export async function getTrainerSettlements(
  trainerId: number,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.batchPayment.findMany({
      where: { batch: { trainerId }, status: "completed" },
      include: {
        batch: { select: { id: true, name: true } },
        player: { select: { id: true, name: true } },
        payer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.batchPayment.count({
      where: { batch: { trainerId }, status: "completed" },
    }),
  ]);

  const summary = await prisma.batchPayment.groupBy({
    by: ["batchId"],
    where: { batch: { trainerId }, status: "completed" },
    _sum: {
      amount: true,
      trainerNetAmount: true,
      platformCommissionAmount: true,
    },
    _count: true,
  });

  return {
    payments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary,
  };
}

export async function updateTrainerProfile(
  userId: number,
  data: {
    bio?: string;
    yearsExperience?: number;
    sports?: any;
    certifications?: any;
    achievements?: any;
  }
) {
  const profile = await prisma.trainerProfile.upsert({
    where: { userId },
    update: {
      bio: data.bio,
      yearsExperience: data.yearsExperience,
      sports: data.sports as any,
      certifications: data.certifications as any,
      achievements: data.achievements as any,
    },
    create: {
      userId,
      bio: data.bio || "",
      yearsExperience: data.yearsExperience || 0,
      sports: data.sports as any,
      certifications: data.certifications as any,
      achievements: data.achievements as any,
    },
  });

  return profile;
}

export async function getTrainerReviewSummary(trainerId: number) {
  const reviews = await prisma.trainerReview.findMany({
    where: { trainerId },
  });

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  await prisma.trainerProfile.updateMany({
    where: { userId: trainerId },
    data: {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    },
  });

  return { averageRating: avgRating, totalReviews: reviews.length };
}
