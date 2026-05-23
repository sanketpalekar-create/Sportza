/**
 * Time-of-day slot boundaries (24h format HH:mm).
 * Morning: 06:00–12:00, Afternoon: 12:00–18:00, Evening: 18:00–22:00
 */
const SLOTS = {
  morning:   { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '18:00' },
  evening:   { start: '18:00', end: '22:00' }
};

const SLOT_ORDER = ['morning', 'afternoon', 'evening'];

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getSlotForTime(timeStr) {
  const min = timeToMinutes(timeStr);
  for (const slot of SLOT_ORDER) {
    const start = timeToMinutes(SLOTS[slot].start);
    const end = timeToMinutes(SLOTS[slot].end);
    if (min >= start && min < end) return slot;
  }
  return 'evening';
}

function splitRangeBySlots(startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (endMin <= startMin) return [];

  const segments = [];
  let current = startMin;

  while (current < endMin) {
    const slot = getSlotForTime(minutesToTime(current));
    const slotEnd = timeToMinutes(SLOTS[slot].end);
    const segmentEnd = Math.min(endMin, slotEnd);
    if (segmentEnd <= current) {
      current = slotEnd;
      continue;
    }
    const hours = (segmentEnd - current) / 60;
    segments.push({ slot, startMinutes: current, endMinutes: segmentEnd, hours });
    current = segmentEnd;
  }
  return segments;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * True if date is Saturday (6) or Sunday (0).
 */
function isWeekend(bookingDate) {
  const d = bookingDate instanceof Date ? bookingDate : new Date(bookingDate);
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Get rate from a rates object (venue.sportRates[].rates or sport.defaultRates).
 */
function getRateFromRatesObject(r, slot, isWeekend) {
  if (!r) return null;
  const dayKey = isWeekend ? 'weekend' : 'weekday';
  const dayRates = r[dayKey];
  if (dayRates && (typeof dayRates[slot] === 'number' || typeof dayRates.default === 'number')) {
    return typeof dayRates[slot] === 'number' ? dayRates[slot] : dayRates.default;
  }
  if (typeof r[slot] === 'number') return r[slot];
  if (typeof r.default === 'number') return r.default;
  return null;
}

/**
 * Get rate for sport + slot + weekday/weekend. Uses venue.sportRates first; falls back to sport.defaultRates / defaultPricePerHour.
 * @param {Object} [sportDoc] - Sport document (optional); if provided, used when venue has no rate.
 */
function getRateForSportAndSlot(venue, sport, slot, isWeekend, defaultRate, sportDoc) {
  if (venue.sportRates && Array.isArray(venue.sportRates)) {
    const sportRate = venue.sportRates.find(s => s.sport === sport);
    if (sportRate && sportRate.rates) {
      const rate = getRateFromRatesObject(sportRate.rates, slot, isWeekend);
      if (typeof rate === 'number') return rate;
    }
  }
  if (sportDoc && sportDoc.defaultRates) {
    const rate = getRateFromRatesObject(sportDoc.defaultRates, slot, isWeekend);
    if (typeof rate === 'number') return rate;
  }
  if (sportDoc && typeof sportDoc.defaultPricePerHour === 'number') {
    return sportDoc.defaultPricePerHour;
  }
  if (venue.pricePerHour != null) return venue.pricePerHour;
  return typeof defaultRate === 'number' ? defaultRate : 0;
}

/**
 * Get minimum booking hours for this sport at this venue. Uses venue first; falls back to sport.defaultMinBookingHours.
 * @param {Object} [sportDoc] - Sport document (optional).
 */
function getMinBookingHours(venue, sport, sportDoc) {
  if (venue.sportRates && Array.isArray(venue.sportRates)) {
    const sportRate = venue.sportRates.find(s => s.sport === sport);
    if (sportRate && typeof sportRate.minBookingHours === 'number' && sportRate.minBookingHours > 0) {
      return sportRate.minBookingHours;
    }
  }
  if (sportDoc && typeof sportDoc.defaultMinBookingHours === 'number' && sportDoc.defaultMinBookingHours > 0) {
    return sportDoc.defaultMinBookingHours;
  }
  return 0;
}

/**
 * Calculate subtotal for a booking (before tax).
 * Price per hour comes from Sport (defaultRates / defaultPricePerHour); Venue may override via sportRates.
 * @param {Object} venue
 * @param {string} sport - sport name (slug)
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @param {Date|string} bookingDate - for weekday vs weekend
 * @param {Object} [sportDoc] - Sport document (optional); used when venue has no rate for this sport
 * @returns {{ totalHours: number, subtotal: number, breakdown: Array }}
 */
function calculateBookingAmount(venue, sport, startTime, endTime, bookingDate, sportDoc) {
  const defaultRate = (sportDoc && typeof sportDoc.defaultPricePerHour === 'number')
    ? sportDoc.defaultPricePerHour
    : (venue.pricePerHour != null ? venue.pricePerHour : 0);
  const segments = splitRangeBySlots(startTime, endTime);
  const weekend = isWeekend(bookingDate);
  let subtotal = 0;
  const breakdown = [];

  for (const seg of segments) {
    const rate = getRateForSportAndSlot(venue, sport, seg.slot, weekend, defaultRate, sportDoc);
    const amount = Math.round(seg.hours * rate * 100) / 100;
    subtotal += amount;
    breakdown.push({
      slot: seg.slot,
      hours: seg.hours,
      rate,
      amount,
      weekend
    });
  }

  const totalHours = segments.reduce((sum, s) => sum + s.hours, 0);
  return {
    totalHours,
    subtotal: Math.round(subtotal * 100) / 100,
    breakdown
  };
}

/**
 * Apply GST to subtotal.
 * @param {number} subtotal
 * @param {number} gstRate - e.g. 18 for 18%
 * @returns {{ gstRate: number, gstAmount: number, totalAmount: number }}
 */
function applyGst(subtotal, gstRate = 18) {
  const rate = Number(gstRate) || 0;
  const gstAmount = Math.round((subtotal * rate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return { gstRate: rate, gstAmount, totalAmount };
}

/**
 * Apply facility pricing rules to a base price for a given slot time and date.
 * Rules are evaluated in order; all matching rules are applied additively.
 *
 * Supported ruleType values:
 *   TIME_BASED_SURCHARGE  — metadata: { after_time:"19:00", price_increase:200 }
 *   DAY_BASED_PRICING     — metadata: { days:["saturday","sunday"], price_increase:300 }
 *   PEAK_HOUR_PRICING     — metadata: { start_time:"17:00", end_time:"21:00", price_increase:150 }
 *   EVENT_PRICING          — metadata: { event_dates:["2026-03-15"], price_increase:500 }
 *   SEASON_PRICING         — metadata: { start_date:"2026-04-01", end_date:"2026-06-30", price_increase:100 }
 *
 * @param {number} basePrice
 * @param {Array}  rules - FacilityPricingRule[] (active rules for the facility)
 * @param {string} slotStartTime - "HH:mm" 24h
 * @param {Date|string} date - booking date
 * @returns {{ finalPrice:number, appliedRules:Array }}
 */
function applyPricingRules(basePrice, rules, slotStartTime, date) {
  if (!rules || rules.length === 0) return { finalPrice: basePrice, appliedRules: [] };

  const d = date instanceof Date ? date : new Date(date);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dateStr = d.toISOString().slice(0, 10);
  const slotMin = timeToMinutes(slotStartTime);
  const appliedRules = [];
  let surcharge = 0;

  for (const rule of rules) {
    if (!rule.isActive) continue;
    const meta = typeof rule.metadata === 'string' ? JSON.parse(rule.metadata) : (rule.metadata || {});

    switch (rule.ruleType) {
      case 'TIME_BASED_SURCHARGE': {
        const afterMin = meta.after_time ? timeToMinutes(meta.after_time) : null;
        if (afterMin !== null && slotMin >= afterMin) {
          const inc = Number(meta.price_increase) || rule.ruleValue || 0;
          surcharge += inc;
          appliedRules.push({ ruleType: rule.ruleType, increase: inc });
        }
        break;
      }
      case 'DAY_BASED_PRICING': {
        const days = Array.isArray(meta.days) ? meta.days.map(d => d.toLowerCase()) : [];
        if (days.includes(dayName)) {
          const inc = Number(meta.price_increase) || rule.ruleValue || 0;
          surcharge += inc;
          appliedRules.push({ ruleType: rule.ruleType, increase: inc });
        }
        break;
      }
      case 'PEAK_HOUR_PRICING': {
        const peakStart = meta.start_time ? timeToMinutes(meta.start_time) : null;
        const peakEnd = meta.end_time ? timeToMinutes(meta.end_time) : null;
        if (peakStart !== null && peakEnd !== null && slotMin >= peakStart && slotMin < peakEnd) {
          const inc = Number(meta.price_increase) || rule.ruleValue || 0;
          surcharge += inc;
          appliedRules.push({ ruleType: rule.ruleType, increase: inc });
        }
        break;
      }
      case 'EVENT_PRICING': {
        const eventDates = Array.isArray(meta.event_dates) ? meta.event_dates : [];
        if (eventDates.includes(dateStr)) {
          const inc = Number(meta.price_increase) || rule.ruleValue || 0;
          surcharge += inc;
          appliedRules.push({ ruleType: rule.ruleType, increase: inc });
        }
        break;
      }
      case 'SEASON_PRICING': {
        const sStart = meta.start_date ? new Date(meta.start_date) : null;
        const sEnd = meta.end_date ? new Date(meta.end_date) : null;
        if (sStart && sEnd && d >= sStart && d <= sEnd) {
          const inc = Number(meta.price_increase) || rule.ruleValue || 0;
          surcharge += inc;
          appliedRules.push({ ruleType: rule.ruleType, increase: inc });
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    finalPrice: Math.round((basePrice + surcharge) * 100) / 100,
    appliedRules
  };
}

/**
 * Generate hourly time slots for a facility between operating hours.
 * @param {string} openTime  - "HH:mm" e.g. "06:00"
 * @param {string} closeTime - "HH:mm" e.g. "22:00"
 * @param {number} durationMin - slot duration in minutes (default 60)
 * @returns {Array<{start:string, end:string}>}
 */
function generateTimeSlots(openTime = '06:00', closeTime = '22:00', durationMin = 60) {
  const slots = [];
  let cur = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  while (cur + durationMin <= close) {
    slots.push({ start: minutesToTime(cur), end: minutesToTime(cur + durationMin) });
    cur += durationMin;
  }
  return slots;
}

module.exports = {
  SLOTS,
  SLOT_ORDER,
  getSlotForTime,
  splitRangeBySlots,
  getRateForSportAndSlot,
  getMinBookingHours,
  isWeekend,
  calculateBookingAmount,
  applyGst,
  applyPricingRules,
  generateTimeSlots,
  timeToMinutes,
  minutesToTime
};
