/**
 * Resolve which scoring engine key to use for a match (stored scoreType vs sport vs format).
 */
export function resolveMatchScoreType(match: {
  scoreType?: string;
  sportName?: string;
  formatName?: string;
} | null | undefined): string {
  const raw = String(match?.scoreType ?? "").toLowerCase().trim();
  if (raw === "pickleball_service" || raw === "pickleball_rally") return raw;

  const sportKey = String(match?.sportName ?? "").toLowerCase().trim();
  if (sportKey === "pickleball") {
    const fmt = String(match?.formatName ?? "").toLowerCase();
    if (fmt.includes("service")) return "pickleball_service";
    if (raw === "pickleball") return "pickleball_rally";
    return "pickleball_rally";
  }

  if (sportKey === "padel") return raw || "padel";

  return raw || sportKey || "simple";
}
