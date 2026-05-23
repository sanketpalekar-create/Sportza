const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { applyPricingRules, generateTimeSlots, applyGst, timeToMinutes } = require('../utils/pricing');

const router = express.Router();

function getBasePriceForFacility(venue, sport, facility) {
  if (venue.sportRates && sport) {
    const sr = venue.sportRates.find(r => r.sport === sport);
    if (sr && sr.rates) {
      const rates = typeof sr.rates === 'string' ? JSON.parse(sr.rates) : sr.rates;
      if (typeof rates.default === 'number') return rates.default;
    }
  }
  if (venue.pricePerHour != null) return venue.pricePerHour;
  return 500;
}

/**
 * GET /api/slots/venue/:venueId?date=YYYY-MM-DD&sport=football
 *
 * Returns all facilities and their slots for a venue on a given date.
 * Grouped by facility for the instant book UI.
 * MUST be registered before /:facilityId to avoid route collision.
 */
router.get('/venue/:venueId', async (req, res) => {
  try {
    const venueId = parseInt(req.params.venueId);
    const { date, sport } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'date query param (YYYY-MM-DD) is required' });
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        sportFacilities: {
          include: { pricingRules: { where: { isActive: true } } }
        },
        sportRates: true
      }
    });

    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }

    let facilities = venue.sportFacilities;
    if (sport) {
      facilities = facilities.filter(f => {
        const fSports = Array.isArray(f.sports) ? f.sports : [];
        return fSports.includes(sport);
      });
    }

    const bookingDate = new Date(date);
    const now = new Date();
    const isToday = bookingDate.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    const currentTimeMin = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    const availability = venue.availability;
    const openTime = (availability && typeof availability === 'object' && availability.open) || '06:00';
    const closeTime = (availability && typeof availability === 'object' && availability.close) || '22:00';
    const rawSlots = generateTimeSlots(openTime, closeTime, 60);

    const allBookings = await prisma.booking.findMany({
      where: {
        venueId,
        bookingDate,
        facilityId: { in: facilities.map(f => f.id) },
        status: { in: ['confirmed', 'fully_paid', 'completed', 'pending'] }
      },
      select: { facilityId: true, startTime: true, endTime: true }
    });

    const gstRate = venue.gstRate != null ? venue.gstRate : 18;

    const facilitySlots = facilities.map(facility => {
      const basePrice = getBasePriceForFacility(venue, sport, facility);
      const facBookings = allBookings.filter(b => b.facilityId === facility.id);

      const slots = rawSlots.map(slot => {
        const slotStartMin = timeToMinutes(slot.start);

        if (isToday && slotStartMin <= currentTimeMin) {
          return { ...slot, price: 0, status: 'past', available: false };
        }

        const isBooked = facBookings.some(b => {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return slotStartMin >= bStart && slotStartMin < bEnd;
        });

        if (isBooked) {
          return { ...slot, price: 0, status: 'booked', available: false };
        }

        const { finalPrice } = applyPricingRules(
          basePrice, facility.pricingRules, slot.start, bookingDate
        );

        return { ...slot, price: finalPrice, status: 'available', available: true };
      });

      return {
        facilityId: facility.id,
        facilityName: facility.name,
        surfaceType: facility.surfaceType,
        sports: facility.sports,
        slots
      };
    });

    res.json({
      venueId: venue.id,
      venueName: venue.name,
      venueLocation: { city: venue.locationCity, address: venue.locationAddr },
      date,
      gstRate,
      facilities: facilitySlots
    });
  } catch (error) {
    console.error('GET /slots/venue/:venueId error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/slots/:facilityId?date=YYYY-MM-DD&sport=football
 *
 * Returns available slots for a single facility on a given date with final calculated prices.
 */
router.get('/:facilityId', async (req, res) => {
  try {
    const facilityId = parseInt(req.params.facilityId);
    const { date, sport } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'date query param (YYYY-MM-DD) is required' });
    }

    const facility = await prisma.sportFacility.findUnique({
      where: { id: facilityId },
      include: {
        venue: {
          include: { sportRates: true }
        },
        pricingRules: { where: { isActive: true } }
      }
    });

    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    const venue = facility.venue;
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: 'Venue not found or inactive' });
    }

    const bookingDate = new Date(date);
    const now = new Date();
    const isToday = bookingDate.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);

    const availability = venue.availability;
    const openTime = (availability && typeof availability === 'object' && availability.open) || '06:00';
    const closeTime = (availability && typeof availability === 'object' && availability.close) || '22:00';

    const rawSlots = generateTimeSlots(openTime, closeTime, 60);

    const basePrice = getBasePriceForFacility(venue, sport, facility);

    const existingBookings = await prisma.booking.findMany({
      where: {
        venueId: venue.id,
        facilityId: facility.id,
        bookingDate,
        status: { in: ['confirmed', 'fully_paid', 'completed', 'pending'] }
      },
      select: { startTime: true, endTime: true, status: true }
    });

    const currentTimeMin = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    const slots = rawSlots.map(slot => {
      const slotStartMin = timeToMinutes(slot.start);

      if (isToday && slotStartMin <= currentTimeMin) {
        return { ...slot, price: 0, status: 'past', available: false };
      }

      const isBooked = existingBookings.some(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return slotStartMin >= bStart && slotStartMin < bEnd;
      });

      if (isBooked) {
        return { ...slot, price: 0, status: 'booked', available: false };
      }

      const { finalPrice, appliedRules } = applyPricingRules(
        basePrice, facility.pricingRules, slot.start, bookingDate
      );

      return {
        ...slot,
        basePrice,
        price: finalPrice,
        status: 'available',
        available: true,
        ...(appliedRules.length > 0 && { rulesApplied: appliedRules.length })
      };
    });

    const gstRate = venue.gstRate != null ? venue.gstRate : 18;

    res.json({
      facilityId: facility.id,
      facilityName: facility.name,
      surfaceType: facility.surfaceType,
      venueId: venue.id,
      venueName: venue.name,
      venueLocation: { city: venue.locationCity, address: venue.locationAddr },
      date,
      gstRate,
      slots
    });
  } catch (error) {
    console.error('GET /slots/:facilityId error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
