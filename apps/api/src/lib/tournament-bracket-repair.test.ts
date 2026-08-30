import { describe, expect, it } from "vitest";
import { knockoutMatchOrdersLookBroken } from "./tournament-bracket-repair";

describe("knockoutMatchOrdersLookBroken", () => {
  it("detects global matchOrder across rounds", () => {
    expect(
      knockoutMatchOrdersLookBroken([
        { stage: 2, round: 1, matchOrder: 1 },
        { stage: 2, round: 1, matchOrder: 8 },
        { stage: 2, round: 2, matchOrder: 9 },
        { stage: 2, round: 2, matchOrder: 12 },
      ])
    ).toBe(true);
  });

  it("accepts within-round matchOrders", () => {
    expect(
      knockoutMatchOrdersLookBroken([
        { stage: 2, round: 1, matchOrder: 1 },
        { stage: 2, round: 1, matchOrder: 2 },
        { stage: 2, round: 1, matchOrder: 3 },
        { stage: 2, round: 1, matchOrder: 4 },
        { stage: 2, round: 1, matchOrder: 5 },
        { stage: 2, round: 1, matchOrder: 6 },
        { stage: 2, round: 1, matchOrder: 7 },
        { stage: 2, round: 1, matchOrder: 8 },
        { stage: 2, round: 2, matchOrder: 1 },
        { stage: 2, round: 2, matchOrder: 2 },
        { stage: 2, round: 2, matchOrder: 3 },
        { stage: 2, round: 2, matchOrder: 4 },
      ])
    ).toBe(false);
  });
});
