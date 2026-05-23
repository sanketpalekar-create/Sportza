import { describe, it, expect } from "vitest";
import {
  getBaseK,
  getTier,
  getConfidence,
  getConfidenceMultiplier,
  getTeamSizeMultiplier,
  getRatingGapDampener,
  extractNormalisedMargin,
  movMultiplierFromMargin,
  isSmurfPattern,
  expectedScore,
  clampRating,
  calcNewRating,
} from "./elo";

// ─── getBaseK — continuous decay ──────────────────────────────────────────────

describe("getBaseK", () => {
  it("returns 32 at 0 matches", () => {
    expect(getBaseK(0)).toBe(32);
  });

  it("returns ~21 at 20 matches", () => {
    // 32 / (1 + 20/40) = 32 / 1.5 = 21.3 → 21
    expect(getBaseK(20)).toBe(21);
  });

  it("returns ~16 at 40 matches (half-life point)", () => {
    // 32 / (1 + 40/40) = 32 / 2 = 16
    expect(getBaseK(40)).toBe(16);
  });

  it("returns ~11 at 80 matches", () => {
    // 32 / (1 + 80/40) = 32 / 3 = 10.67 → 11
    expect(getBaseK(80)).toBe(11);
  });

  it("never falls below 8 (floor)", () => {
    expect(getBaseK(500)).toBe(8);
    expect(getBaseK(1000)).toBe(8);
  });

  it("is strictly decreasing", () => {
    const values = [0, 10, 20, 40, 80, 150, 300].map(getBaseK);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });
});

// ─── Confidence tiers ─────────────────────────────────────────────────────────

describe("getTier", () => {
  it("tier 0 for 0–19 matches", () => {
    expect(getTier(0)).toBe(0);
    expect(getTier(19)).toBe(0);
  });

  it("tier 1 for 20–39 matches", () => {
    expect(getTier(20)).toBe(1);
    expect(getTier(39)).toBe(1);
  });

  it("tier 6 caps at 120+ matches", () => {
    expect(getTier(120)).toBe(6);
    expect(getTier(999)).toBe(6);
  });
});

describe("getConfidence", () => {
  it("returns unranked for 0–19 matches", () => {
    expect(getConfidence(0)).toBe("unranked");
    expect(getConfidence(19)).toBe("unranked");
  });

  it("returns beginner for 20–39 matches", () => {
    expect(getConfidence(20)).toBe("beginner");
  });

  it("returns developing for 40–59 matches", () => {
    expect(getConfidence(40)).toBe("developing");
  });

  it("returns established for 60–79 matches", () => {
    expect(getConfidence(60)).toBe("established");
  });

  it("returns advanced for 80–99 matches", () => {
    expect(getConfidence(80)).toBe("advanced");
  });

  it("returns expert for 100–119 matches", () => {
    expect(getConfidence(100)).toBe("expert");
  });

  it("returns master for 120+ matches", () => {
    expect(getConfidence(120)).toBe("master");
    expect(getConfidence(500)).toBe("master");
  });
});

describe("getConfidenceMultiplier", () => {
  it("unranked has highest multiplier", () => {
    expect(getConfidenceMultiplier("unranked")).toBe(1.15);
  });

  it("master has lowest multiplier", () => {
    expect(getConfidenceMultiplier("master")).toBe(0.55);
  });

  it("multiplier decreases monotonically through tiers", () => {
    const tiers = ["unranked", "beginner", "developing", "established", "advanced", "expert", "master"];
    const mults = tiers.map(getConfidenceMultiplier);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeLessThan(mults[i - 1]);
    }
  });

  it("handles legacy labels gracefully", () => {
    expect(getConfidenceMultiplier("provisional")).toBe(1.15);
    expect(getConfidenceMultiplier("low")).toBe(1.05);
    expect(getConfidenceMultiplier("medium")).toBe(0.95);
    expect(getConfidenceMultiplier("high")).toBe(0.85);
    expect(getConfidenceMultiplier("unknown_label")).toBe(1.0);
  });
});

// ─── Team-size multiplier ─────────────────────────────────────────────────────

describe("getTeamSizeMultiplier", () => {
  it("singles → 1.0", () => {
    expect(getTeamSizeMultiplier(1)).toBe(1.0);
  });

  it("doubles → 0.9", () => {
    expect(getTeamSizeMultiplier(2)).toBe(0.9);
  });

  it("3+ → 0.82", () => {
    expect(getTeamSizeMultiplier(3)).toBe(0.82);
    expect(getTeamSizeMultiplier(11)).toBe(0.82);
  });
});

// ─── Rating-gap dampener ──────────────────────────────────────────────────────

describe("getRatingGapDampener", () => {
  it("no dampening for small gaps (<150)", () => {
    expect(getRatingGapDampener(1000, 1050)).toBe(1.0);
    expect(getRatingGapDampener(1000, 1000)).toBe(1.0);
  });

  it("slight dampening for 150–300 gap", () => {
    expect(getRatingGapDampener(1000, 1200)).toBe(0.95);
  });

  it("stronger dampening for 300–500 gap", () => {
    expect(getRatingGapDampener(1000, 1400)).toBe(0.85);
  });

  it("maximum dampening for 500+ gap", () => {
    expect(getRatingGapDampener(1000, 1600)).toBe(0.75);
    expect(getRatingGapDampener(500, 2000)).toBe(0.75);
  });
});

// ─── MOV extraction — happy paths ────────────────────────────────────────────

describe("extractNormalisedMargin — happy paths", () => {
  it("badminton 3-0 blowout has larger margin than 2-1 close game", () => {
    const blowout = extractNormalisedMargin(
      { gamesWon: { A: 3, B: 0 } },
      "badminton",
      "A",
    );
    const close = extractNormalisedMargin(
      { gamesWon: { A: 2, B: 1 } },
      "badminton",
      "A",
    );
    expect(blowout).toBeGreaterThan(close);
  });

  it("badminton composite: dominant point wins yield higher margin than narrow wins (same game result)", () => {
    // Both matches end 2-1 in games, but points tell very different stories
    const dominantPoints = extractNormalisedMargin(
      {
        gamesWon:      { A: 2, B: 1 },
        completedGames: [
          { A: 21, B: 5 },   // winner dominates
          { A: 5,  B: 21 },  // loser's one win
          { A: 21, B: 8 },   // winner dominates again
        ],
      },
      "badminton",
      "A",
    );
    const narrowPoints = extractNormalisedMargin(
      {
        gamesWon:      { A: 2, B: 1 },
        completedGames: [
          { A: 22, B: 20 },  // tight win
          { A: 20, B: 22 },  // tight loss
          { A: 22, B: 20 },  // tight win
        ],
      },
      "badminton",
      "A",
    );
    expect(dominantPoints).toBeGreaterThan(narrowPoints);
    expect(dominantPoints).toBeGreaterThan(0);
    expect(narrowPoints).toBeGreaterThan(0);
    expect(dominantPoints).toBeLessThanOrEqual(1);
  });

  it("tennis sets 3-0 vs 3-2 — blowout wins", () => {
    const blowout = extractNormalisedMargin(
      { setsWon: { A: 3, B: 0 } },
      "tennis",
      "A",
    );
    const narrow = extractNormalisedMargin(
      { setsWon: { A: 3, B: 2 } },
      "tennis",
      "A",
    );
    expect(blowout).toBeGreaterThan(narrow);
  });

  it("football 3-0 blowout has larger margin than 2-1 close game", () => {
    const blowout = extractNormalisedMargin(
      { scores: { A: 3, B: 0 } },
      "football",
      "A",
    );
    const close = extractNormalisedMargin(
      { scores: { A: 2, B: 1 } },
      "football",
      "A",
    );
    expect(blowout).toBeGreaterThan(close);
  });

  it("basketball large point spread yields high margin", () => {
    const margin = extractNormalisedMargin(
      { scores: { A: 100, B: 60 } },
      "basketball",
      "A",
    );
    expect(margin).toBeGreaterThan(0.3);
  });

  it("cricket run difference produces non-zero margin", () => {
    const margin = extractNormalisedMargin(
      {
        completedInnings: [
          { battingTeam: "A", runs: 200, completed: true },
          { battingTeam: "B", runs: 120, completed: true },
        ],
      },
      "cricket",
      "A",
    );
    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeLessThanOrEqual(1);
  });
});

describe("extractNormalisedMargin — edge cases", () => {
  it("unknown scoreType → 0", () => {
    expect(extractNormalisedMargin({ scores: { A: 3, B: 0 } }, "hockey", "A")).toBe(0);
  });

  it("null winnerTeam → 0", () => {
    expect(extractNormalisedMargin({ scores: { A: 1, B: 1 } }, "football", null)).toBe(0);
  });

  it("missing scores → 0, no throw", () => {
    expect(extractNormalisedMargin({}, "football", "A")).toBe(0);
    expect(extractNormalisedMargin(null, "badminton", "A")).toBe(0);
  });

  it("loser perspective → 0 (by convention, not by this fn — callers pass 0)", () => {
    // The function itself still computes a value for the winner side;
    // callers are responsible for passing 0 when result !== 1.
    const margin = extractNormalisedMargin({ scores: { A: 3, B: 0 } }, "football", "A");
    expect(margin).toBeGreaterThan(0);
  });
});

// ─── movMultiplierFromMargin ──────────────────────────────────────────────────

describe("movMultiplierFromMargin", () => {
  it("margin 0 → multiplier 1.0 (no bonus)", () => {
    expect(movMultiplierFromMargin(0)).toBe(1.0);
  });

  it("margin 1.0 → multiplier 1.35 (max bonus)", () => {
    expect(movMultiplierFromMargin(1)).toBeCloseTo(1.35, 5);
  });

  it("margin 0.5 → multiplier 1.175", () => {
    expect(movMultiplierFromMargin(0.5)).toBeCloseTo(1.175, 5);
  });

  it("clamps above 1 and below 0", () => {
    expect(movMultiplierFromMargin(2)).toBeCloseTo(1.35, 5);
    expect(movMultiplierFromMargin(-1)).toBe(1.0);
  });
});

// ─── isSmurfPattern ───────────────────────────────────────────────────────────

describe("isSmurfPattern", () => {
  it("triggers when <10 matches, >80% win rate, avg MOV >0.7", () => {
    // 8 matches, 7 wins, totalMOV = 7 × 0.9 = 6.3 → avgMOV = 6.3/7 = 0.9
    expect(isSmurfPattern(8, 7, 6.3)).toBe(true);
  });

  it("does not trigger at 10+ matches", () => {
    expect(isSmurfPattern(10, 9, 8.1)).toBe(false);
    expect(isSmurfPattern(20, 18, 16)).toBe(false);
  });

  it("does not trigger when win rate ≤80%", () => {
    // 8 matches, 6 wins = 75% — borderline below threshold
    expect(isSmurfPattern(8, 6, 5.4)).toBe(false);
  });

  it("does not trigger when avg MOV ≤0.7 even with high win rate", () => {
    // 8 matches, 7 wins (87.5%), but each won game was close — totalMOV = 7 × 0.3 = 2.1 → avg 0.3
    expect(isSmurfPattern(8, 7, 2.1)).toBe(false);
  });

  it("does not trigger at 0 matches", () => {
    expect(isSmurfPattern(0, 0, 0)).toBe(false);
  });
});

// ─── Core Elo helpers ─────────────────────────────────────────────────────────

describe("expectedScore", () => {
  it("equal ratings → 0.5", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it("higher rating → expected > 0.5", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
  });

  it("lower rating → expected < 0.5", () => {
    expect(expectedScore(800, 1000)).toBeLessThan(0.5);
  });
});

describe("clampRating", () => {
  it("rounds to nearest integer", () => {
    expect(clampRating(1000.7)).toBe(1001);
  });

  it("clamps to floor of 100", () => {
    expect(clampRating(50)).toBe(100);
  });

  it("clamps to ceiling of 3000", () => {
    expect(clampRating(3500)).toBe(3000);
  });
});

// ─── calcNewRating ────────────────────────────────────────────────────────────

describe("calcNewRating", () => {
  it("winner gains rating", () => {
    const next = calcNewRating(1000, 1000, 1, 0, "unranked", 0.5, 1);
    expect(next).toBeGreaterThan(1000);
  });

  it("loser loses rating", () => {
    const next = calcNewRating(1000, 1000, 0, 0, "unranked", 0, 1);
    expect(next).toBeLessThan(1000);
  });

  it("draw at equal ratings → rating unchanged", () => {
    const next = calcNewRating(1000, 1000, 0.5, 0, "unranked", 0, 1);
    expect(next).toBe(1000);
  });

  it("unranked player gains more than master after same win", () => {
    const newUnranked = calcNewRating(1000, 1000, 1, 5,   "unranked", 0.5, 1);
    const newMaster   = calcNewRating(1000, 1000, 1, 200, "master",   0.5, 1);
    expect(newUnranked - 1000).toBeGreaterThan(newMaster - 1000);
  });

  it("MOV bonus: blowout win gains more than narrow win", () => {
    const narrow  = calcNewRating(1000, 1000, 1, 20, "developing", 0.1, 1);
    const blowout = calcNewRating(1000, 1000, 1, 20, "developing", 0.9, 1);
    expect(blowout).toBeGreaterThan(narrow);
  });

  it("team size reduces gain", () => {
    const singles = calcNewRating(1000, 1000, 1, 20, "developing", 0.5, 1);
    const doubles = calcNewRating(1000, 1000, 1, 20, "developing", 0.5, 2);
    expect(singles).toBeGreaterThan(doubles);
  });

  it("rating-gap dampener reduces favourite's gain in mismatched match", () => {
    const close   = calcNewRating(1500, 1480, 1, 30, "established", 0.5, 1);
    const farGap  = calcNewRating(1500, 800,  1, 30, "established", 0.5, 1);
    expect(close - 1500).toBeGreaterThan(farGap - 1500);
  });

  it("smurf dampener reduces MOV bonus", () => {
    const normal = calcNewRating(1000, 1000, 1, 5, "unranked", 0.9, 1, false);
    const smurf  = calcNewRating(1000, 1000, 1, 5, "unranked", 0.9, 1, true);
    expect(normal).toBeGreaterThan(smurf);
  });

  it("smurf dampener does NOT reduce non-MOV gain (margin=0)", () => {
    const normal = calcNewRating(1000, 1000, 1, 5, "unranked", 0, 1, false);
    const smurf  = calcNewRating(1000, 1000, 1, 5, "unranked", 0, 1, true);
    expect(normal).toBe(smurf);
  });

  it("result stays within [100, 3000]", () => {
    const floor   = calcNewRating(101, 3000, 0, 0, "unranked", 0, 1);
    const ceiling = calcNewRating(2999, 100, 1, 0, "unranked", 1, 1);
    expect(floor).toBeGreaterThanOrEqual(100);
    expect(ceiling).toBeLessThanOrEqual(3000);
  });
});
