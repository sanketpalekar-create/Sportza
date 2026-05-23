export type SportStatField = {
  key: string;
  shortLabel: string;
  fullLabel: string;
};

export type SportPlayerStatSchema = {
  sectionTitle: string;
  fields: SportStatField[];
};

const DEFAULT_SCHEMA: SportPlayerStatSchema = {
  sectionTitle: "Top Scorers",
  fields: [
    { key: "goals", shortLabel: "G", fullLabel: "Goals" },
    { key: "assists", shortLabel: "A", fullLabel: "Assists" },
    { key: "points", shortLabel: "Pts", fullLabel: "Points" },
  ],
};

const SPORT_SCHEMAS: Record<string, SportPlayerStatSchema> = {
  football: DEFAULT_SCHEMA,
  soccer: DEFAULT_SCHEMA,
  futsal: DEFAULT_SCHEMA,
  pickleball: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "putaways", shortLabel: "PW", fullLabel: "Putaways" },
      { key: "setups", shortLabel: "SU", fullLabel: "Setups" },
      { key: "aces", shortLabel: "AC", fullLabel: "Aces" },
    ],
  },
  basketball: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "points", shortLabel: "PTS", fullLabel: "Points" },
      { key: "rebounds", shortLabel: "REB", fullLabel: "Rebounds" },
      { key: "assists", shortLabel: "AST", fullLabel: "Assists" },
    ],
  },
  volleyball: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "kills", shortLabel: "K", fullLabel: "Kills" },
      { key: "aces", shortLabel: "AC", fullLabel: "Aces" },
      { key: "digs", shortLabel: "DG", fullLabel: "Digs" },
    ],
  },
  badminton: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "winners", shortLabel: "W", fullLabel: "Winners" },
      { key: "aces", shortLabel: "AC", fullLabel: "Aces" },
      { key: "rallyWins", shortLabel: "RW", fullLabel: "Rally Wins" },
    ],
  },
  tennis: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "winners", shortLabel: "W", fullLabel: "Winners" },
      { key: "aces", shortLabel: "AC", fullLabel: "Aces" },
      { key: "rallyWins", shortLabel: "RW", fullLabel: "Rally Wins" },
    ],
  },
  padel: {
    sectionTitle: "Top Performers",
    fields: [
      { key: "winners", shortLabel: "W", fullLabel: "Winners" },
      { key: "aces", shortLabel: "AC", fullLabel: "Aces" },
      { key: "rallyWins", shortLabel: "RW", fullLabel: "Rally Wins" },
    ],
  },
};

export function normalizeSportName(sport: string | null | undefined): string {
  const raw = String(sport ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "pickle ball" || raw === "pickle-ball") return "pickleball";
  if (raw === "association football") return "football";
  return raw.replace(/\s+/g, "_").replace(/-/g, "_");
}

export function getSportPlayerStatSchema(sport: string | null | undefined): SportPlayerStatSchema {
  const normalized = normalizeSportName(sport);
  const compact = normalized.replace(/_/g, "");
  return SPORT_SCHEMAS[normalized] ?? SPORT_SCHEMAS[compact] ?? DEFAULT_SCHEMA;
}

export function createEmptyStatsForSport(sport: string | null | undefined): Record<string, number> {
  const schema = getSportPlayerStatSchema(sport);
  const stats: Record<string, number> = {};
  for (const field of schema.fields) stats[field.key] = 0;
  return stats;
}

export function getPlayerStatValue(player: any, key: string): number {
  if (typeof player?.stats?.[key] === "number") return player.stats[key];
  if (typeof player?.[key] === "number") return player[key];
  if (key === "goals" && typeof player?.goals === "number") return player.goals;
  if (key === "assists" && typeof player?.assists === "number") return player.assists;
  if (key === "points" && typeof player?.points === "number") return player.points;
  return 0;
}

export function normalizePlayerStats(player: any, sport: string | null | undefined): Record<string, number> {
  const schema = getSportPlayerStatSchema(sport);
  const normalized: Record<string, number> = {};
  for (const field of schema.fields) {
    normalized[field.key] = getPlayerStatValue(player, field.key);
  }
  return normalized;
}
