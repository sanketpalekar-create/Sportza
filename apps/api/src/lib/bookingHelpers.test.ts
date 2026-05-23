/**
 * Unit tests for booking helper pure functions.
 * No database or Express setup required.
 */
import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  hoursBetween,
  calculateSplitShare,
  splitPaymentProgressMeta,
  buildSplitDetailsPayload,
  type SplitRow,
} from "./bookingHelpers";

// ── parseTimeToMinutes ────────────────────────────────────────────────────────

describe("parseTimeToMinutes", () => {
  it("converts 00:00 to 0", () => expect(parseTimeToMinutes("00:00")).toBe(0));
  it("converts 01:00 to 60", () => expect(parseTimeToMinutes("01:00")).toBe(60));
  it("converts 08:30 to 510", () => expect(parseTimeToMinutes("08:30")).toBe(510));
  it("converts 23:59 to 1439", () => expect(parseTimeToMinutes("23:59")).toBe(1439));
});

// ── hoursBetween ──────────────────────────────────────────────────────────────

describe("hoursBetween", () => {
  it("returns 1 for one-hour slot", () => expect(hoursBetween("08:00", "09:00")).toBe(1));
  it("returns 1.5 for 90-minute slot", () => expect(hoursBetween("08:00", "09:30")).toBe(1.5));
  it("returns 2 for two-hour slot", () => expect(hoursBetween("06:00", "08:00")).toBe(2));
  it("returns fractional for 45 minutes", () => expect(hoursBetween("09:00", "09:45")).toBeCloseTo(0.75));
});

// ── calculateSplitShare ───────────────────────────────────────────────────────

describe("calculateSplitShare", () => {
  it("divides evenly for simple amounts", () => {
    // ₹300 split 3 ways → ₹100 each
    expect(calculateSplitShare(300, 3, 0)).toBe(100);
    expect(calculateSplitShare(300, 3, 1)).toBe(100);
    expect(calculateSplitShare(300, 3, 2)).toBe(100);
  });

  it("last participant absorbs rounding so total is exact", () => {
    // ₹100 split 3 ways → 33.33, 33.33, 33.34
    const p0 = calculateSplitShare(100, 3, 0);
    const p1 = calculateSplitShare(100, 3, 1);
    const p2 = calculateSplitShare(100, 3, 2);
    expect(p0).toBe(33.33);
    expect(p1).toBe(33.33);
    expect(Math.round((p0 + p1 + p2) * 100) / 100).toBe(100);
  });

  it("handles 2-way split", () => {
    expect(calculateSplitShare(200, 2, 0)).toBe(100);
    expect(calculateSplitShare(200, 2, 1)).toBe(100);
  });

  it("handles odd-penny amounts in 2-way split", () => {
    // ₹101 split 2 ways
    const p0 = calculateSplitShare(101, 2, 0);
    const p1 = calculateSplitShare(101, 2, 1);
    expect(p0 + p1).toBeCloseTo(101, 2);
  });
});

// ── splitPaymentProgressMeta ─────────────────────────────────────────────────

describe("splitPaymentProgressMeta", () => {
  it("threshold not met when nothing paid", () => {
    const meta = splitPaymentProgressMeta(1000, 0);
    expect(meta.thresholdMet).toBe(false);
    expect(meta.confirmThresholdAmount).toBe(500);
    expect(meta.amountNeededForConfirm).toBe(500);
    expect(meta.paidPercentOfTotal).toBe(0);
  });

  it("threshold met at exactly 50%", () => {
    const meta = splitPaymentProgressMeta(1000, 500);
    expect(meta.thresholdMet).toBe(true);
    expect(meta.amountNeededForConfirm).toBe(0);
    expect(meta.paidPercentOfTotal).toBe(50);
  });

  it("threshold met when more than 50% paid", () => {
    const meta = splitPaymentProgressMeta(1000, 600);
    expect(meta.thresholdMet).toBe(true);
    expect(meta.pendingAmount).toBe(400);
  });

  it("threshold met when 100% paid", () => {
    const meta = splitPaymentProgressMeta(1000, 1000);
    expect(meta.thresholdMet).toBe(true);
    expect(meta.pendingAmount).toBe(0);
    expect(meta.paidPercentOfTotal).toBe(100);
  });

  it("handles zero total amount gracefully", () => {
    const meta = splitPaymentProgressMeta(0, 0);
    expect(meta.thresholdMet).toBe(true); // free booking
    expect(meta.paidPercentOfTotal).toBe(0);
  });

  it("caps paidPercent at 100 even if overpaid", () => {
    const meta = splitPaymentProgressMeta(1000, 1200);
    expect(meta.paidPercentOfTotal).toBe(100);
  });
});

// ── buildSplitDetailsPayload ─────────────────────────────────────────────────

describe("buildSplitDetailsPayload", () => {
  const makeSplitRow = (status: string, amount = 100): SplitRow => ({
    userId: 1,
    amount,
    status,
    user: { name: "Alice", avatar: null },
  });

  it("counts paid and pending participants correctly", () => {
    const splits: SplitRow[] = [
      makeSplitRow("paid"),
      makeSplitRow("pending"),
      makeSplitRow("pending"),
    ];
    const payload = buildSplitDetailsPayload(
      { totalAmount: 300, paidAmount: 100, splitCount: 3, bookingType: "split" },
      splits
    );
    expect(payload.paidCount).toBe(1);
    expect(payload.pendingCount).toBe(2);
    expect(payload.joinedCount).toBe(3);
    expect(payload.perPersonAmount).toBe(100);
  });

  it("includes payment progress meta", () => {
    const splits: SplitRow[] = [makeSplitRow("paid", 200), makeSplitRow("pending", 200)];
    const payload = buildSplitDetailsPayload(
      { totalAmount: 400, paidAmount: 200, splitCount: 2, bookingType: "split" },
      splits
    );
    expect(payload.thresholdMet).toBe(true); // 200/400 = 50%
    expect(payload.paidPercentOfTotal).toBe(50);
  });

  it("returns perPersonAmount 0 for empty splits array", () => {
    const payload = buildSplitDetailsPayload(
      { totalAmount: 500, paidAmount: 0, splitCount: 5, bookingType: "split" },
      []
    );
    expect(payload.perPersonAmount).toBe(0);
    expect(payload.joinedCount).toBe(0);
  });

  it("shapes participants array correctly", () => {
    const splits: SplitRow[] = [
      { userId: 42, amount: 150, status: "paid", user: { name: "Bob", avatar: "avatar.jpg" } },
    ];
    const payload = buildSplitDetailsPayload(
      { totalAmount: 150, paidAmount: 150, splitCount: 1, bookingType: "split" },
      splits
    );
    expect(payload.participants[0]).toMatchObject({
      userId: 42,
      name: "Bob",
      avatar: "avatar.jpg",
      amount: 150,
      status: "paid",
    });
  });
});

// ── Conflict detection logic (edge cases) ─────────────────────────────────────

describe("Slot overlap logic", () => {
  /**
   * The overlap predicate used in all booking create endpoints:
   *   startTime < req.endTime  AND  endTime > req.startTime
   */
  function overlaps(
    existing: { startTime: string; endTime: string },
    req: { startTime: string; endTime: string }
  ): boolean {
    return existing.startTime < req.endTime && existing.endTime > req.startTime;
  }

  it("detects exact overlap (same slot)", () => {
    expect(overlaps({ startTime: "10:00", endTime: "11:00" }, { startTime: "10:00", endTime: "11:00" })).toBe(true);
  });

  it("detects partial overlap (request starts during existing)", () => {
    expect(overlaps({ startTime: "10:00", endTime: "12:00" }, { startTime: "11:00", endTime: "13:00" })).toBe(true);
  });

  it("detects containment (request fully inside existing)", () => {
    expect(overlaps({ startTime: "09:00", endTime: "13:00" }, { startTime: "10:00", endTime: "12:00" })).toBe(true);
  });

  it("detects containment (existing fully inside request)", () => {
    expect(overlaps({ startTime: "10:00", endTime: "11:00" }, { startTime: "09:00", endTime: "13:00" })).toBe(true);
  });

  it("does NOT detect overlap for adjacent slots (back-to-back)", () => {
    expect(overlaps({ startTime: "10:00", endTime: "11:00" }, { startTime: "11:00", endTime: "12:00" })).toBe(false);
  });

  it("does NOT detect overlap for non-adjacent slots", () => {
    expect(overlaps({ startTime: "10:00", endTime: "11:00" }, { startTime: "12:00", endTime: "13:00" })).toBe(false);
  });

  it("does NOT detect overlap when request comes before existing", () => {
    expect(overlaps({ startTime: "12:00", endTime: "13:00" }, { startTime: "09:00", endTime: "11:00" })).toBe(false);
  });
});
