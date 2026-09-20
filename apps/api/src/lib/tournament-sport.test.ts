import { describe, expect, it } from "vitest";
import { sportNameVariants } from "./tournament-sport";
import {
  computeStandings,
  computeTournamentStandings,
  pickFinalFixture,
} from "./tournament-standings";

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

  it("awards 3 points per win (Sportza standard)", () => {
    const teams = [{ name: "A" }, { name: "B" }];
    const matches = [
      {
        status: "completed",
        winnerTeam: "A",
        teams: { A: { name: "A" }, B: { name: "B" } },
        scores: { completedGames: [{ A: 15, B: 10 }] },
      },
    ];
    const rows = computeStandings(matches, teams);
    expect(rows[0].points).toBe(3);
    expect(rows[0].pointsFor).toBe(15);
    expect(rows[0].pointDiff).toBe(5);
  });
});

describe("pickFinalFixture", () => {
  it("picks highest round over earlier semis", () => {
    const fixtures = [
      { stage: 2, round: 1, matchOrder: 1, matchId: 10, team1Type: "team", team2Type: "team" },
      { stage: 2, round: 1, matchOrder: 2, matchId: 11, team1Type: "team", team2Type: "team" },
      { stage: 2, round: 2, matchOrder: 1, matchId: 12, team1Type: "team", team2Type: "team" },
    ];
    expect(pickFinalFixture(fixtures)?.matchId).toBe(12);
  });

  it("prefers winner/team Final over 3rd-place loser match in same round", () => {
    const fixtures = [
      { stage: 2, round: 4, matchOrder: 1, matchId: 20, team1Type: "loser", team2Type: "loser" },
      { stage: 2, round: 4, matchOrder: 2, matchId: 21, team1Type: "winner", team2Type: "winner" },
    ];
    expect(pickFinalFixture(fixtures)?.matchId).toBe(21);
  });
});

describe("computeTournamentStandings multi-stage", () => {
  const stages = [
    { stageOrder: 1, name: "League", format: "round_robin" },
    { stageOrder: 2, name: "Knockout", format: "knockout" },
  ];
  const teams = [
    { name: "Amar & Adnan" },
    { name: "Binay & Karan" },
    { name: "Rachit & Rajas" },
    { name: "Rohit & Aniket" },
  ];

  it("crowns Final winner, not SF1 winner", () => {
    const fixtures = [
      {
        stage: 1, round: 1, matchOrder: 1, matchId: 1,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Rachit & Rajas" },
      },
      {
        stage: 2, round: 1, matchOrder: 1, matchId: 2,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Rachit & Rajas" },
      },
      {
        stage: 2, round: 1, matchOrder: 2, matchId: 3,
        team1Type: "team", team1Ref: { name: "Binay & Karan" },
        team2Type: "team", team2Ref: { name: "Rohit & Aniket" },
      },
      {
        stage: 2, round: 2, matchOrder: 1, matchId: 4,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Binay & Karan" },
      },
    ];
    const matches = [
      {
        id: 1, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Rachit & Rajas" } },
        scores: { completedGames: [{ A: 15, B: 9 }] },
      },
      {
        id: 2, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Rachit & Rajas" } },
        scores: { completedGames: [{ A: 11, B: 6 }] },
      },
      {
        id: 3, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Binay & Karan" }, B: { name: "Rohit & Aniket" } },
        scores: { completedGames: [{ A: 11, B: 6 }] },
      },
      {
        id: 4, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Binay & Karan" } },
        scores: { completedGames: [{ A: 11, B: 8 }, { A: 11, B: 9 }] },
      },
    ];

    const rows = computeTournamentStandings({ teams, stages, matches, fixtures });
    expect(rows[0].team).toBe("Amar & Adnan");
    expect(rows[0].placement).toBe("champion");
    expect(rows[1].team).toBe("Binay & Karan");
    expect(rows[1].placement).toBe("runner_up");
  });

  it("excludes knockout scores from league PF/PA/Pts", () => {
    const fixtures = [
      {
        stage: 1, round: 1, matchOrder: 1, matchId: 1,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Rachit & Rajas" },
      },
      {
        stage: 2, round: 1, matchOrder: 1, matchId: 2,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Rachit & Rajas" },
      },
      {
        stage: 2, round: 2, matchOrder: 1, matchId: 3,
        team1Type: "team", team1Ref: { name: "Amar & Adnan" },
        team2Type: "team", team2Ref: { name: "Binay & Karan" },
      },
    ];
    const matches = [
      {
        id: 1, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Rachit & Rajas" } },
        scores: { completedGames: [{ A: 15, B: 9 }] },
      },
      {
        id: 2, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Rachit & Rajas" } },
        scores: { completedGames: [{ A: 11, B: 6 }] },
      },
      {
        id: 3, status: "completed", winnerTeam: "A",
        teams: { A: { name: "Amar & Adnan" }, B: { name: "Binay & Karan" } },
        scores: { completedGames: [{ A: 11, B: 8 }, { A: 11, B: 9 }] },
      },
    ];

    const rows = computeTournamentStandings({ teams, stages, matches, fixtures });
    const champ = rows.find((r) => r.team === "Amar & Adnan")!;
    // League only: 15 PF, 9 PA, 3 pts — KO 11+11 and 11+8+11+9 must not inflate
    expect(champ.played).toBe(1);
    expect(champ.points).toBe(3);
    expect(champ.pointsFor).toBe(15);
    expect(champ.pointsAgainst).toBe(9);
    expect(champ.pointDiff).toBe(6);
  });
});
