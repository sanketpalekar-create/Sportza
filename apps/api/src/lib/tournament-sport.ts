import prisma from "./prisma";

export type ResolvedSport = {
  id: number;
  name: string;
  displayName: string;
};

/** Build name variants for matching Sport.name / displayName (MySQL has no insensitive equals). */
export function sportNameVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const underscored = lower.replace(/[\s-]+/g, "_");
  const spaced = lower.replace(/[_-]+/g, " ");
  const dashed = lower.replace(/[\s_]+/g, "-");
  const collapsed = lower.replace(/[\s_-]+/g, "");
  return [...new Set([trimmed, lower, underscored, spaced, dashed, collapsed])];
}

/**
 * Resolve a Sport by optional sportId, then by name / displayName variants.
 * Prefer sportId when present; fall back to string matching for legacy tournaments.
 */
export async function resolveTournamentSport(opts: {
  sportId?: number | null;
  sport?: string | null;
}): Promise<ResolvedSport | null> {
  if (opts.sportId != null && Number.isInteger(opts.sportId) && opts.sportId > 0) {
    const byId = await prisma.sport.findUnique({
      where: { id: opts.sportId },
      select: { id: true, name: true, displayName: true },
    });
    if (byId) return byId;
  }

  const raw = opts.sport?.trim();
  if (!raw) return null;

  const variants = sportNameVariants(raw);
  const sport = await prisma.sport.findFirst({
    where: {
      OR: [
        { name: { in: variants } },
        { displayName: { in: variants } },
      ],
    },
    select: { id: true, name: true, displayName: true },
  });
  return sport;
}
