import { describe, expect, it } from "vitest";
import { sportNameVariants } from "./tournament-sport";
import { computeStandings } from "./tournament-standings";

describe("sportNameVariants", () => {
  it("includes displayName and slug forms for Pickleball", () => {
    const variants = sportNameVariants("Pickleball");
    expect(variants).toContain("Pickleball");
    expect(variants).toContain("pickleball");
  });

  it("normalizes spaces and hyphens", () => {
    const variants = sportNameVariants("Pickle Ball");
    expect(variants).toContain("pickle_ball");
    expect(variants).toContain("pickleball");
  });
});

describe("computeStandings alias resolution", () => {
  it("maps match snapshot names through team aliases", () => {
    const teams = [
      { name: "Alpha", aliases: ["team a"] },
      { name: "Beta", aliases: ["team b"] },
    ];
    const matches = [
      {
        status: "completed",
        winnerTeam: "A",
        teams: { A: { name: "team a" }, B: { name: "team b" } },
        scores: { A: 11, B: 5 },
      },
    ];
    const rows = computeStandings(matches, teams);
    expect(rows.map((r) => r.team)).toEqual(["Alpha", "Beta"]);
    expect(rows[0].won).toBe(1);
    expect(rows[1].lost).toBe(1);
  });
});
