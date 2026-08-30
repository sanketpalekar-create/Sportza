import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  default: {
    tournamentFixture: {
      findMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    match: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "./prisma";
import {
  isPointerRef,
  propagateMatchResult,
  syncKnockoutBracket,
} from "./tournament-bracket-resolve";

const mocked = prisma as unknown as {
  tournamentFixture: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  match: { findUnique: ReturnType<typeof vi.fn> };
};

describe("isPointerRef", () => {
  it("treats winner/loser refs without names as pointers", () => {
    expect(isPointerRef({ stage: 2, round: 1, match: 1 })).toBe(true);
    expect(isPointerRef({ name: "Acers", playerNames: ["A", "B"] })).toBe(false);
    expect(isPointerRef({ bye: true })).toBe(false);
  });
});

describe("propagateMatchResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tournamentFixture.update.mockResolvedValue({});
  });

  it("fills QF slots from R16 winners without touching locked fixtures", async () => {
    const r16 = {
      id: 101,
      tournamentId: 3,
      stage: 2,
      round: 1,
      matchOrder: 1,
      team1Type: "team",
      team1Ref: { name: "Hybrid Hitters", playerNames: ["A", "B"] },
      team2Type: "team",
      team2Ref: { name: "Fighters", playerNames: ["C", "D"] },
      matchId: 501,
      status: "completed",
    };

    const qf1 = {
      id: 201,
      tournamentId: 3,
      stage: 2,
      round: 2,
      matchOrder: 1,
      team1Type: "winner",
      team1Ref: { stage: 2, round: 1, match: 1 },
      team2Type: "winner",
      team2Ref: { stage: 2, round: 1, match: 2 },
      matchId: null,
      status: "scheduled",
    };

    const lockedQf = {
      id: 202,
      tournamentId: 3,
      stage: 2,
      round: 2,
      matchOrder: 2,
      team1Type: "winner",
      team1Ref: { stage: 2, round: 1, match: 1 },
      team2Type: "winner",
      team2Ref: { stage: 2, round: 1, match: 3 },
      matchId: 999,
      status: "in_progress",
    };

    mocked.tournamentFixture.findMany.mockResolvedValue([r16, qf1, lockedQf]);

    const updates = await propagateMatchResult(r16, "A");
    expect(updates).toBe(1);
    expect(mocked.tournamentFixture.update).toHaveBeenCalledTimes(1);
    expect(mocked.tournamentFixture.update).toHaveBeenCalledWith({
      where: { id: 201 },
      data: expect.objectContaining({
        team1Type: "team",
        team1Ref: expect.objectContaining({
          name: "Hybrid Hitters",
          source: { stage: 2, round: 1, match: 1 },
        }),
      }),
    });
  });

  it("fills Bronze with SF losers", async () => {
    const sf1 = {
      id: 301,
      tournamentId: 3,
      stage: 2,
      round: 3,
      matchOrder: 1,
      team1Type: "team",
      team1Ref: { name: "Team W" },
      team2Type: "team",
      team2Ref: { name: "Team L" },
      matchId: 601,
      status: "completed",
    };
    const bronze = {
      id: 401,
      tournamentId: 3,
      stage: 2,
      round: 4,
      matchOrder: 1,
      team1Type: "loser",
      team1Ref: { stage: 2, round: 3, match: 1, loserOf: "SF1" },
      team2Type: "loser",
      team2Ref: { stage: 2, round: 3, match: 2, loserOf: "SF2" },
      matchId: null,
      status: "scheduled",
    };
    const final = {
      id: 402,
      tournamentId: 3,
      stage: 2,
      round: 4,
      matchOrder: 2,
      team1Type: "winner",
      team1Ref: { stage: 2, round: 3, match: 1 },
      team2Type: "winner",
      team2Ref: { stage: 2, round: 3, match: 2 },
      matchId: null,
      status: "scheduled",
    };

    mocked.tournamentFixture.findMany.mockResolvedValue([sf1, bronze, final]);

    const updates = await propagateMatchResult(sf1, "A");
    expect(updates).toBe(2);
    const bronzeCall = mocked.tournamentFixture.update.mock.calls.find(
      (c) => c[0].where.id === 401
    );
    const finalCall = mocked.tournamentFixture.update.mock.calls.find(
      (c) => c[0].where.id === 402
    );
    expect(bronzeCall?.[0].data.team1Ref).toEqual(
      expect.objectContaining({ name: "Team L", slotKind: "loser" })
    );
    expect(finalCall?.[0].data.team1Ref).toEqual(
      expect.objectContaining({ name: "Team W", slotKind: "winner" })
    );
  });
});

describe("syncKnockoutBracket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tournamentFixture.update.mockResolvedValue({});
  });

  it("propagates from completed R16 into QF in order", async () => {
    mocked.tournamentFixture.findMany
      .mockResolvedValueOnce([
        {
          id: 101,
          tournamentId: 3,
          stage: 2,
          round: 1,
          matchOrder: 1,
          team1Type: "team",
          team1Ref: { name: "Alpha" },
          team2Type: "team",
          team2Ref: { name: "Beta" },
          matchId: 501,
          status: "completed",
          match: {
            status: "completed",
            winnerTeam: "B",
            teams: { A: { name: "Alpha" }, B: { name: "Beta" } },
            scores: { A: 8, B: 11 },
          },
        },
      ])
      // candidates inside propagateMatchResult
      .mockResolvedValueOnce([
        {
          id: 101,
          tournamentId: 3,
          stage: 2,
          round: 1,
          matchOrder: 1,
          team1Type: "team",
          team1Ref: { name: "Alpha" },
          team2Type: "team",
          team2Ref: { name: "Beta" },
          matchId: 501,
          status: "completed",
        },
        {
          id: 201,
          tournamentId: 3,
          stage: 2,
          round: 2,
          matchOrder: 1,
          team1Type: "winner",
          team1Ref: { stage: 2, round: 1, match: 1 },
          team2Type: "winner",
          team2Ref: { stage: 2, round: 1, match: 2 },
          matchId: null,
          status: "scheduled",
        },
      ]);

    const result = await syncKnockoutBracket(3);
    expect(result.propagated).toBe(1);
    expect(mocked.tournamentFixture.update).toHaveBeenCalledWith({
      where: { id: 201 },
      data: expect.objectContaining({
        team1Ref: expect.objectContaining({ name: "Beta" }),
      }),
    });
  });
});
