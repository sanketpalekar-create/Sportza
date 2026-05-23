const prisma = require('../lib/prisma');

/**
 * Generate batch sessions for N weeks from a start date using the batch schedule.
 * @param {string|number} batchId
 * @param {number} weeks - How many weeks of sessions to generate (default 4)
 * @param {Date} [fromDate] - Start generating from this date (default today)
 * @returns {Object[]} Created BatchSession documents
 */
async function generateSessions(batchId, weeks = 4, fromDate) {
  const batchIdInt = parseInt(batchId);
  const batch = await prisma.batch.findUnique({
    where: { id: batchIdInt }
  });
  if (!batch) throw Object.assign(new Error('Batch not found'), { status: 404 });
  if (!batch.schedule?.daysOfWeek?.length || !batch.schedule?.startTime || !batch.schedule?.endTime) {
    throw Object.assign(new Error('Batch has no schedule configured'), { status: 400 });
  }

  const start = fromDate ? new Date(fromDate) : new Date();
  start.setHours(0, 0, 0, 0);
  const sessions = [];

  for (let w = 0; w < weeks; w++) {
    for (const dow of batch.schedule.daysOfWeek) {
      const date = new Date(start);
      const currentDow = date.getDay();
      let daysUntil = dow - currentDow + w * 7;
      if (w === 0 && daysUntil < 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const exists = await prisma.batchSession.findFirst({
        where: {
          batchId: batchIdInt,
          date: { gte: dayStart, lt: dayEnd }
        }
      });
      if (exists) continue;

      dayStart.setHours(0, 0, 0, 0);
      sessions.push({
        batchId: batchIdInt,
        date: dayStart,
        startTime: batch.schedule.startTime,
        endTime: batch.schedule.endTime,
        status: 'scheduled'
      });
    }
  }

  if (sessions.length === 0) return [];
  const created = await prisma.batchSession.createMany({
    data: sessions
  });
  return prisma.batchSession.findMany({
    where: { batchId: batchIdInt },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: sessions.length
  });
}

/**
 * Get trainer dashboard data: today's sessions, stats, recent payments, announcements.
 */
async function getDashboard(trainerId) {
  const trainerIdInt = parseInt(trainerId);
  const batches = await prisma.batch.findMany({
    where: { trainerId: trainerIdInt, isActive: true },
    include: { venue: { select: { name: true, locationCity: true, locationAddr: true } } }
  });
  const batchIds = batches.map(b => b.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todaySessions, totalPlayers, payments, recentAnnouncements] = await Promise.all([
    prisma.batchSession.findMany({
      where: {
        batchId: { in: batchIds },
        date: { gte: today, lt: tomorrow },
        status: { not: 'cancelled' }
      },
      include: { batch: { select: { name: true, sport: true } } },
      orderBy: { startTime: 'asc' }
    }),

    prisma.batchMembership.count({
      where: { batchId: { in: batchIds }, status: 'active' }
    }),

    prisma.batchPayment.findMany({
      where: {
        batchId: { in: batchIds },
        status: 'completed',
        createdAt: { gte: monthStart }
      }
    }),

    prisma.batchAnnouncement.findMany({
      where: { batchId: { in: batchIds } },
      include: { batch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  const monthPayments = [{
    totalCollected: payments.reduce((s, p) => s + p.amount, 0),
    totalCommission: payments.reduce((s, p) => s + (p.platformCommissionAmount || 0), 0),
    totalNet: payments.reduce((s, p) => s + (p.trainerNetAmount || 0), 0),
    count: payments.length
  }];

  const sessionsWithVenue = todaySessions.map(s => {
    const batch = batches.find(b => b.id === s.batchId);
    return {
      ...s,
      venue: batch?.venue ? { ...batch.venue, location: { city: batch.venue.locationCity, address: batch.venue.locationAddr } } : batch?.venue
    };
  });

  const attendanceRate = await calculateAttendanceRate(batchIds);

  const payment = monthPayments[0] || { totalCollected: 0, totalCommission: 0, totalNet: 0, count: 0 };

  return {
    activeBatches: batches.length,
    totalPlayers,
    todaySessions: sessionsWithVenue,
    monthlyRevenue: payment,
    attendanceRate,
    announcements: recentAnnouncements,
  };
}

/**
 * Calculate average attendance rate across batches.
 */
async function calculateAttendanceRate(batchIds) {
  const sessions = await prisma.batchSession.findMany({
    where: {
      batchId: { in: batchIds },
      status: 'completed'
    },
    select: { id: true },
    take: 100
  });

  if (sessions.length === 0) return 0;
  const sessionIds = sessions.map(s => s.id);

  const [totalRecords, presentRecords] = await Promise.all([
    prisma.sessionAttendance.count({
      where: { sessionId: { in: sessionIds } }
    }),
    prisma.sessionAttendance.count({
      where: { sessionId: { in: sessionIds }, status: 'present' }
    })
  ]);

  return totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
}

/**
 * Generate monthly settlement report for a trainer.
 */
async function generateSettlementReport(trainerId, month, year) {
  const trainerIdInt = parseInt(trainerId);
  const batches = await prisma.batch.findMany({
    where: { trainerId: trainerIdInt },
    select: { id: true, name: true, commissionPercent: true }
  });
  const batchIds = batches.map(b => b.id);

  const payments = await prisma.batchPayment.findMany({
    where: {
      batchId: { in: batchIds },
      cycleMonth: month,
      cycleYear: year,
      status: 'completed'
    },
    include: {
      player: { select: { name: true, email: true } },
      batch: { select: { name: true } }
    }
  });

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const totalCommission = payments.reduce((s, p) => s + (p.platformCommissionAmount || 0), 0);
  const totalNet = payments.reduce((s, p) => s + (p.trainerNetAmount || p.amount), 0);

  const byBatch = {};
  for (const p of payments) {
    const bName = p.batch?.name || 'Unknown';
    if (!byBatch[bName]) byBatch[bName] = { revenue: 0, commission: 0, net: 0, payments: 0 };
    byBatch[bName].revenue += p.amount;
    byBatch[bName].commission += p.platformCommissionAmount || 0;
    byBatch[bName].net += p.trainerNetAmount || p.amount;
    byBatch[bName].payments += 1;
  }

  return {
    trainerId: trainerIdInt, month, year,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    trainerNetAmount: Math.round(totalNet * 100) / 100,
    paymentCount: payments.length,
    batchBreakdown: byBatch,
    payments
  };
}

module.exports = {
  generateSessions,
  getDashboard,
  calculateAttendanceRate,
  generateSettlementReport,
};
