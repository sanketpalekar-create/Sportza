import { describe, expect, it } from "vitest";
import {
  createEmptyStatsForSport,
  getSportPlayerStatSchema,
  normalizePlayerStats,
  normalizeSportName,
} from "./tournament-player-stats";

describe("tournament player stats schema", () => {
  it("normalizes sport aliases", () => {
    expect(normalizeSportName("Pickle Ball")).toBe("pickleball");
    expect(normalizeSportName("association football")).toBe("football");
  });

  it("returns pickleball schema", () => {
    const schema = getSportPlayerStatSchema("pickleball");
    expect(schema.fields.map((f) => f.key)).toEqual(["putaways", "setups", "aces"]);
  });

  it("returns default schema for unknown sport", () => {
    const schema = getSportPlayerStatSchema("some_future_sport");
    expect(schema.fields.map((f) => f.key)).toEqual(["goals", "assists", "points"]);
  });

  it("creates empty stats for sport fields", () => {
    expect(createEmptyStatsForSport("basketball")).toEqual({
      points: 0,
      rebounds: 0,
      assists: 0,
    });
  });

  it("normalizes legacy flat values to schema fields", () => {
    const normalized = normalizePlayerStats(
      { goals: 4, assists: 2, points: 7 },
      "football"
    );
    expect(normalized).toEqual({ goals: 4, assists: 2, points: 7 });
  });
});
