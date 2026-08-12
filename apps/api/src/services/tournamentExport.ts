import ExcelJS from "exceljs";
import prisma from "../lib/prisma";
import { NotFoundError } from "../lib/errors";
import {
  computeTournamentStandings,
  extractAccumulatedPoints,
  flatEngineScore,
} from "../lib/tournament-standings";
import {
  getPlayerStatValue,
  getSportPlayerStatSchema,
  normalizePlayerStats,
} from "../lib/tournament-player-stats";

export function formatScoreDetail(scores: unknown): {
  displayA: string;
  displayB: string;
  setDetail: string;
  pointsForA: string;
  pointsForB: string;
} {
  const s = scores && typeof scores === "object" ? (scores as Record<string, any>) : null;
  const nested: Record<string, any> | null =
    s?.scores && typeof s.scores === "object" ? (s.scores as Record<string, any>) : s;

  // 1. Per-game breakdown from completedGames / completedSets
  const games = (nested?.completedGames ?? nested?.completedSets) as
    Array<{ A?: number; B?: number }> | undefined;
  const setDetail =
    Array.isArray(games) && games.length > 0
      ? games
          .map((g, i) => `Game ${i + 1}: ${g.A ?? "-"}-${g.B ?? "-"}`)
          .join(", ")
      : "";

  // 2. Accumulated points (sum of completedGames) — most accurate for multi-game
  const accum = extractAccumulatedPoints(scores);
  const hasAccum = accum != null && (accum.a !== 0 || accum.b !== 0);

  // 3. currentGame fallback — when match was ended manually before maybeEndGame fired
  //    (completedGames empty but currentGame has real points)
  const cg = nested?.currentGame as { A?: number; B?: number } | undefined;
  const hasCurrentGame =
    !hasAccum &&
    cg != null &&
    ((cg.A ?? 0) !== 0 || (cg.B ?? 0) !== 0);

  // 4. Last resort: gamesWon / flat score (e.g. simple sport)
  const flat = !hasAccum && !hasCurrentGame ? flatEngineScore(scores) : null;

  let displayA = "";
  let displayB = "";
  if (hasAccum) {
    displayA = String(accum!.a);
    displayB = String(accum!.b);
  } else if (hasCurrentGame) {
    displayA = String(cg!.A ?? 0);
    displayB = String(cg!.B ?? 0);
  } else if (flat != null) {
    displayA = String(flat.a);
    displayB = String(flat.b);
  }

  return { displayA, displayB, setDetail, pointsForA: displayA, pointsForB: displayB };
}

function teamRefLabel(ref: unknown): string {
  if (!ref || typeof ref !== "object") return "TBD";
  const r = ref as Record<string, unknown>;
  if (r.bye) return "BYE";
  if (r.winnerOf != null || r.loserOf != null || r.tbd) return "TBD";
  return String(r.name ?? "TBD");
}

function matchTeamNames(match: Record<string, unknown>): { teamA: string; teamB: string } {
  const teams = (match.teams as Record<string, unknown>) ?? {};
  const teamA =
    (teams.A as { name?: string })?.name ??
    (typeof teams.A === "string" ? teams.A : null) ??
    (teams.team1 as { name?: string })?.name ??
    "";
  const teamB =
    (teams.B as { name?: string })?.name ??
    (typeof teams.B === "string" ? teams.B : null) ??
    (teams.team2 as { name?: string })?.name ??
    "";
  return { teamA, teamB };
}

function matchWinnerName(match: Record<string, unknown>): string {
  const { teamA, teamB } = matchTeamNames(match);
  if (match.winnerTeam === "A") return teamA;
  if (match.winnerTeam === "B") return teamB;
  const flat = flatEngineScore(match.scores);
  if (flat && flat.a > flat.b) return teamA;
  if (flat && flat.b > flat.a) return teamB;
  return "";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export function tournamentExportFilename(tournament: { id: number; name: string }): string {
  const slug = slugify(tournament.name) || `tournament-${tournament.id}`;
  return `sportza-${slug}-${formatDate(new Date())}.xlsx`;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, colCount: number) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  for (let c = 1; c <= colCount; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (let c = 1; c <= colCount; c++) {
    const col = sheet.getColumn(c);
    col.width = Math.min(32, Math.max(10, (col.header as string)?.length ?? 10) + 2);
  }
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row.map((v) => (v === null || v === undefined ? "" : v)));
  }
  styleHeaderRow(sheet, headers.length);
  return sheet;
}

export async function buildTournamentWorkbook(tournamentId: number): Promise<ExcelJS.Workbook> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      venue: true,
      fixtures: { include: { match: true } },
      matches: true,
    },
  });
  if (!tournament) throw new NotFoundError("Tournament");

  const teams = (tournament.teams as Array<Record<string, unknown>>) ?? [];
  const stages = (tournament.stages as Array<Record<string, unknown>>) ?? [];
  const fixtures = [...tournament.fixtures].sort((a, b) => {
    const sa = a.stage ?? 0;
    const sb = b.stage ?? 0;
    if (sa !== sb) return sa - sb;
    if (a.round !== b.round) return a.round - b.round;
    const ga = a.groupIndex ?? 0;
    const gb = b.groupIndex ?? 0;
    if (ga !== gb) return ga - gb;
    return a.matchOrder - b.matchOrder;
  });

  const completedMatches = tournament.matches.filter((m) => m.status === "completed");
  const standings = computeTournamentStandings({
    teams,
    stages,
    matches: completedMatches as Array<Record<string, unknown>>,
    fixtures: fixtures as Array<Record<string, unknown>>,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sportza";
  workbook.created = new Date();

  const stagesSummary =
    stages.length > 0
      ? stages
          .map((s, i) => {
            const order = (s.stageOrder as number) ?? i + 1;
            const stageName = (s.name as string) ?? `Stage ${order}`;
            const fmt = (s.format as string) ?? "";
            return `${order}. ${stageName} (${fmt})`;
          })
          .join("; ")
      : tournament.format;

  addSheet(workbook, "Summary", ["Field", "Value"], [
    ["Tournament", tournament.name],
    ["Sport", tournament.sport],
    ["Format", tournament.format],
    ["Status", tournament.status],
    ["Stages", stagesSummary],
    ["Start date", tournament.startDate ? formatDate(tournament.startDate) : ""],
    ["End date", tournament.endDate ? formatDate(tournament.endDate) : ""],
    ["Venue", tournament.venue?.name ?? ""],
    ["Teams", teams.length],
    ["Fixtures", fixtures.length],
    ["Matches played", completedMatches.length],
  ]);

  addSheet(
    workbook,
    "Rounds",
    [
      "Fixture ID",
      "Stage",
      "Round",
      "Group",
      "Match order",
      "Team 1",
      "Team 2",
      "Fixture status",
      "Match ID",
      "Bye",
      "TBD",
    ],
    fixtures.map((f) => {
      const t1 = f.team1Ref as Record<string, unknown>;
      const t2 = f.team2Ref as Record<string, unknown>;
      const isBye = f.status === "bye" || t1?.bye || t2?.bye;
      const isTbd =
        !isBye &&
        (!t1?.name ||
          !t2?.name ||
          t1?.winnerOf != null ||
          t2?.winnerOf != null ||
          t1?.tbd ||
          t2?.tbd);
      return [
        f.id,
        f.stage ?? "",
        f.round,
        f.groupIndex ?? "",
        f.matchOrder,
        teamRefLabel(f.team1Ref),
        teamRefLabel(f.team2Ref),
        f.status,
        f.matchId ?? "",
        isBye ? "Yes" : "",
        isTbd ? "Yes" : "",
      ];
    })
  );

  const fixtureByMatchId = new Map<number, (typeof fixtures)[0]>();
  for (const f of fixtures) {
    if (f.matchId) fixtureByMatchId.set(f.matchId, f);
  }

  const matchRows: (string | number)[][] = [];
  const seenMatchIds = new Set<number>();

  for (const f of fixtures) {
    const m = f.match;
    if (!m) continue;
    seenMatchIds.add(m.id);
    const { teamA, teamB } = matchTeamNames(m as unknown as Record<string, unknown>);
    matchRows.push([
      m.id,
      f.id,
      f.stage ?? "",
      f.round,
      formatDateTime(new Date(m.matchDate)),
      m.sportName,
      m.formatName,
      m.status,
      teamA || teamRefLabel(f.team1Ref),
      teamB || teamRefLabel(f.team2Ref),
      matchWinnerName(m as unknown as Record<string, unknown>),
      m.loggingMode,
    ]);
  }

  for (const m of tournament.matches) {
    if (seenMatchIds.has(m.id)) continue;
    const { teamA, teamB } = matchTeamNames(m as unknown as Record<string, unknown>);
    matchRows.push([
      m.id,
      "",
      "",
      "",
      formatDateTime(new Date(m.matchDate)),
      m.sportName,
      m.formatName,
      m.status,
      teamA,
      teamB,
      matchWinnerName(m as unknown as Record<string, unknown>),
      m.loggingMode,
    ]);
  }

  addSheet(
    workbook,
    "Matches",
    [
      "Match ID",
      "Fixture ID",
      "Stage",
      "Round",
      "Date",
      "Sport",
      "Format",
      "Status",
      "Team A",
      "Team B",
      "Winner",
      "Logging mode",
    ],
    matchRows
  );

  const scoreRows: (string | number)[][] = [];
  for (const m of tournament.matches) {
    const detail = formatScoreDetail(m.scores);
    scoreRows.push([
      m.id,
      m.scoreType,
      detail.displayA,
      detail.displayB,
      detail.pointsForA,
      detail.pointsForB,
      detail.setDetail,
      m.status,
      m.winnerTeam ?? "",
    ]);
  }

  addSheet(
    workbook,
    "Scores",
    [
      "Match ID",
      "Score type",
      "Display score A",
      "Display score B",
      "Points for A",
      "Points for B",
      "Game scores",
      "Match status",
      "Winner side",
    ],
    scoreRows
  );

  addSheet(
    workbook,
    "Standings",
    ["Rank", "Team", "Played", "W", "D", "L", "Points", "PF", "PA", "Diff", "Placement"],
    standings.map((s, i) => [
      i + 1,
      s.team,
      s.played,
      s.won,
      s.drawn,
      s.lost,
      s.points,
      s.pointsFor,
      s.pointsAgainst,
      s.pointDiff,
      s.placement ?? "",
    ])
  );

  const schema = getSportPlayerStatSchema(tournament.sport);
  const players = ((tournament.players as Array<Record<string, unknown>>) ?? []).map((p) => {
    const stats = normalizePlayerStats(p, tournament.sport);
    return { ...p, stats };
  });

  const playerHeaders = ["Team", "Player", "Jersey", ...schema.fields.map((f) => f.fullLabel)];
  addSheet(
    workbook,
    "Players",
    playerHeaders,
    players.map((p) => [
      String(p.teamName ?? ""),
      String(p.playerName ?? ""),
      p.jerseyNo ?? "",
      ...schema.fields.map((f) => getPlayerStatValue(p, f.key)),
    ])
  );

  return workbook;
}
