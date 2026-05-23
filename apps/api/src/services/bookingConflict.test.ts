/**
 * Unit tests for bookingConflict service.
 *
 * validateBookingTime and getAvailableSlots are tested here.
 * checkBookingConflict / resolveSlotConflict require a real DB and are covered
 * by the integration checklist in docs/BOOKING_STATE_AND_FLOWS.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateBookingTime, getAvailableSlots } from "./bookingConflict";

// ── Prisma mock ───────────────────────────────────────────────────────────────
vi.mock("../lib/prisma", () => ({
  default: {
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    splitPayment: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    refund: { create: vi.fn() },
  },
}));

vi.mock("../lib/queue", () => ({
  addRefundJob: vi.fn(),
  addEmailJob: vi.fn(),
}));

vi.mock("../lib/socket", () => ({
  emitBookingEvent: vi.fn(),
}));

import prisma from "../lib/prisma";

// ── validateBookingTime ───────────────────────────────────────────────────────

describe("validateBookingTime", () => {
  let todayStr: string;
  let yesterday: string;
  let tomorrow: string;

  beforeEach(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    yesterday = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    tomorrow = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
  });

  it("returns valid for a future date with correct time window", async () => {
    const result = await validateBookingTime(tomorrow, "08:00", "10:00");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects a past date", async () => {
    const result = await validateBookingTime(yesterday, "08:00", "10:00");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/past/i);
  });

  it("rejects end time not after start time (equal)", async () => {
    const result = await validateBookingTime(tomorrow, "10:00", "10:00");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/after/i);
  });

  it("rejects end time before start time", async () => {
    const result = await validateBookingTime(tomorrow, "14:00", "09:00");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/after/i);
  });

  it("rejects start hour before 06:00", async () => {
    const result = await validateBookingTime(tomorrow, "05:00", "07:00");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/6:00/);
  });

  it("rejects end hour after 23:00", async () => {
    const result = await validateBookingTime(tomorrow, "22:00", "24:00");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/23:00/);
  });

  it("accepts boundary start 06:00", async () => {
    const result = await validateBookingTime(tomorrow, "06:00", "08:00");
    expect(result.valid).toBe(true);
  });

  it("accepts boundary end 23:00", async () => {
    const result = await validateBookingTime(tomorrow, "21:00", "23:00");
    expect(result.valid).toBe(true);
  });

  it("accepts today's date (not past)", async () => {
    // today is valid as long as it's not before today
    const result = await validateBookingTime(todayStr, "08:00", "10:00");
    // today is >= today, so it should be valid (time of day not checked by this helper)
    expect(result.valid).toBe(true);
  });
});

// ── getAvailableSlots ─────────────────────────────────────────────────────────

describe("getAvailableSlots", () => {
  const VENUE_ID = 1;
  const FACILITY_ID = 1;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an hourly grid of slots for a future date", async () => {
    // Future date, no existing bookings
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const slots = await getAvailableSlots(VENUE_ID, FACILITY_ID, tomorrow, { start: 6, end: 10 });

    expect(slots).toHaveLength(4); // 06–07, 07–08, 08–09, 09–10
    expect(slots.every((s) => s.available)).toBe(true);
    expect(slots[0]).toMatchObject({ startTime: "06:00", endTime: "07:00", available: true });
  });

  it("marks slot as unavailable when a confirmed booking exists", async () => {
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startTime: "08:00", endTime: "09:00", status: "confirmed" },
    ]);

    const slots = await getAvailableSlots(VENUE_ID, FACILITY_ID, tomorrow, { start: 6, end: 10 });

    const booked = slots.find((s) => s.startTime === "08:00");
    expect(booked?.available).toBe(false);

    const free = slots.filter((s) => s.startTime !== "08:00");
    expect(free.every((s) => s.available)).toBe(true);
  });

  it("does NOT mark a slot unavailable for a pending (non-confirmed) booking", async () => {
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    // pending booking at 08:00
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startTime: "08:00", endTime: "09:00", status: "pending" },
    ]);

    const slots = await getAvailableSlots(VENUE_ID, FACILITY_ID, tomorrow, { start: 6, end: 10 });

    // Slot availability is based only on confirmed/fully_paid bookings
    const slot = slots.find((s) => s.startTime === "08:00");
    expect(slot?.available).toBe(true);
  });

  it("skips already-past hours when date is today", async () => {
    const today = new Date().toISOString().split("T")[0];
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const slots = await getAvailableSlots(VENUE_ID, FACILITY_ID, today, { start: 6, end: 23 });

    const now = new Date();
    const currentHour = now.getHours();
    // Slots at or before the current hour should not appear
    const pastSlots = slots.filter((s) => parseInt(s.startTime.split(":")[0], 10) <= currentHour);
    expect(pastSlots).toHaveLength(0);
  });
});
