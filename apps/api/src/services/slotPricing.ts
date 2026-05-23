import prisma from "../lib/prisma";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { generateScheduledSlots } from "../routes/schedules";

export type FacilityPricingRule = {
  id: number;
  facilityId: number;
  venueId: number;
  ruleType: string;
  ruleValue: number;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
};

function generateTimeSlots(
  _dateStr: string,
  start: number = 6,
  end: number = 23
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (let h = start; h < end; h++) {
    const startTime = `${String(h).padStart(2, "0")}:00`;
    const endTime = `${String(h + 1).padStart(2, "0")}:00`;
    slots.push({ startTime, endTime });
  }
  return slots;
}

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export async function getSlotsForFacilityDate(
  facilityId: number,
  date: string
): Promise<{ slots: Array<{ startTime: string; endTime: string }>; closed: boolean; closedReason?: string }> {
  const dateObj = new Date(date + "T00:00:00.000Z");
  const dayOfWeek = dateObj.getUTCDay();

  const [schedule, exception] = await Promise.all([
    prisma.facilitySchedule.findUnique({
      where: { facilityId_dayOfWeek: { facilityId, dayOfWeek } },
    }),
    prisma.scheduleException.findFirst({
      where: { facilityId, startDate: { lte: date }, endDate: { gte: date } },
    }),
  ]);

  if (schedule && !schedule.isOpen) {
    return { slots: [], closed: true, closedReason: "Closed" };
  }
  if (exception?.isFullBlock) {
    return { slots: [], closed: true, closedReason: exception.label ?? exception.type };
  }

  if (!schedule) {
    return { slots: generateTimeSlots(date), closed: false };
  }

  const breaks = (schedule.breakTimes as Array<{ start: string; end: string }> | null) ?? [];
  const generated = generateScheduledSlots(
    { openTime: schedule.openTime, closeTime: schedule.closeTime, slotDuration: schedule.slotDuration, breakTimes: breaks },
    exception ? { isFullBlock: exception.isFullBlock, customOpen: exception.customOpen, customClose: exception.customClose } : null
  );
  return { slots: generated, closed: false };
}

export function applyPricingRules(
  basePrice: number,
  rules: FacilityPricingRule[],
  slotDate: Date,
  slotStartTime: string
): number {
  let price = basePrice;
  const dayOfWeek = slotDate.getDay();
  const [hourStr] = slotStartTime.split(":");
  const hour = parseInt(hourStr, 10);

  for (const rule of rules) {
    if (!rule.isActive || !rule.metadata) continue;

    const meta = rule.metadata as Record<string, unknown>;
    const value = rule.ruleValue;

    switch (rule.ruleType) {
      case "TIME_BASED_SURCHARGE": {
        const afterTime = meta.after_time as string | undefined;
        if (afterTime) {
          const [ath, atm] = afterTime.split(":").map(Number);
          const slotMinutes = hour * 60;
          const thresholdMinutes = ath * 60 + (atm || 0);
          if (slotMinutes >= thresholdMinutes) price += value;
        }
        break;
      }
      case "DAY_BASED_PRICING": {
        const days = meta.days as number[] | undefined;
        if (days && days.includes(dayOfWeek)) price += value;
        break;
      }
      case "PEAK_HOUR": {
        const peakStart = (meta.peak_start as number) ?? 18;
        const peakEnd = (meta.peak_end as number) ?? 21;
        if (hour >= peakStart && hour < peakEnd) price += value;
        break;
      }
      case "EVENT_PRICING":
        price += value;
        break;
      case "SEASON_PRICING": {
        const startDate = meta.start_date as string | undefined;
        const endDate = meta.end_date as string | undefined;
        if (startDate && endDate) {
          const slotDateStr = slotDate.toISOString().slice(0, 10);
          if (slotDateStr >= startDate && slotDateStr <= endDate) price += value;
        }
        break;
      }
      default:
        break;
    }
  }

  return roundMoney(price);
}

export async function getVenueSlotQuote(params: {
  venueId: number;
  facilityId: number;
  date: string;
  startTime: string;
  endTime: string;
  sport?: string;
}) {
  const { venueId, facilityId, date, startTime, endTime, sport } = params;

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      dbFacilities: true,
      sportFacilities: {
        include: { pricingRules: { where: { isActive: true } } },
      },
      sportRates: true,
    },
  });

  if (!venue) throw new NotFoundError("Venue");

  const facility = venue.dbFacilities.find((item) => item.id === facilityId);
  if (!facility) {
    throw new BadRequestError("Selected facility does not belong to this venue");
  }

  const facilitySports = (facility.sports as string[] | null) ?? [];
  if (sport && facilitySports.length > 0 && !facilitySports.some((item) => item.toLowerCase() === sport.toLowerCase())) {
    throw new BadRequestError("Selected facility does not support this sport");
  }

  const slotDate = new Date(date + "T00:00:00.000Z");
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = date === todayStr;

  const sportRate = sport
    ? venue.sportRates.find((item) => item.sport?.toLowerCase() === sport.toLowerCase())
    : venue.sportRates[0];
  const rateMap = (sportRate?.rates as Record<string, number> | null) ?? {};
  const fallbackPrice = venue.pricePerHour ?? 500;

  function getSportBasePrice(hour: number): number {
    if (hour < 12) return rateMap.morning ?? fallbackPrice;
    if (hour < 17) return rateMap.afternoon ?? fallbackPrice;
    return rateMap.evening ?? fallbackPrice;
  }

  const { slots: scheduleSlots, closed, closedReason } = await getSlotsForFacilityDate(facility.id, date);
  if (closed) {
    throw new BadRequestError(closedReason ? `Facility unavailable: ${closedReason}` : "Facility unavailable");
  }

  const matchedSlot = scheduleSlots.find((slot) => slot.startTime === startTime && slot.endTime === endTime);
  if (!matchedSlot) {
    throw new BadRequestError("Selected slot is invalid");
  }

  const [bookings, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: {
        venueId,
        facilityId,
        bookingDate: slotDate,
        status: { notIn: ["cancelled", "cancelled_user", "cancelled_conflict"] },
      },
      select: { startTime: true, endTime: true, status: true },
    }),
    prisma.slot.findMany({
      where: {
        venueId,
        facilityId,
        status: "blocked",
        startTime: { gte: slotDate, lt: new Date(slotDate.getTime() + 86400000) },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const confirmedRanges = new Set<string>();
  const blockedKeys = new Set<string>();

  for (const booking of bookings) {
    const startHour = parseInt(booking.startTime.split(":")[0], 10);
    const endHour = parseInt(booking.endTime.split(":")[0], 10);
    for (let h = startHour; h < endHour; h++) {
      const key = `${String(h).padStart(2, "0")}:00`;
      if (["confirmed", "fully_paid"].includes(booking.status)) {
        confirmedRanges.add(key);
      }
    }
  }

  for (const slot of blockedSlots) {
    const startHour = slot.startTime.getUTCHours();
    const endHour = slot.endTime.getUTCHours();
    for (let h = startHour; h < endHour; h++) {
      blockedKeys.add(`${String(h).padStart(2, "0")}:00`);
    }
  }

  const slotDateTime = new Date(`${date}T${startTime}:00.000Z`);
  const past = isToday && slotDateTime <= now;
  const isBlocked = blockedKeys.has(startTime);
  const isConfirmed = confirmedRanges.has(startTime);
  const available = !past && !isConfirmed && !isBlocked;

  if (!available) {
    throw new BadRequestError("Selected slot is no longer available");
  }

  const sportFacility = venue.sportFacilities.find((item) => item.name === facility.name);
  const rules = (sportFacility?.pricingRules ?? []) as FacilityPricingRule[];
  const hour = parseInt(startTime.split(":")[0], 10);
  const subtotal = applyPricingRules(getSportBasePrice(hour), rules, slotDate, startTime);
  const gstRate = venue.gstRate ?? 18;
  const gstAmount = roundMoney((subtotal * gstRate) / 100);
  const totalAmount = roundMoney(subtotal + gstAmount);

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const totalHours = (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;

  return {
    venueId,
    facilityId: facility.id,
    facilityName: facility.name,
    bookingDate: date,
    startTime,
    endTime,
    subtotal,
    gstRate,
    gstAmount,
    totalAmount,
    totalHours,
  };
}
