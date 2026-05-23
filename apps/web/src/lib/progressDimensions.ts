/** Five core dimensions stored in PlayerBatchReview.ratings JSON (1–5 scale). */

export const PROGRESS_KEYS = ["technical", "fitness", "gameIQ", "mental", "discipline"] as const;
export type ProgressKey = (typeof PROGRESS_KEYS)[number];

export const PROGRESS_LABELS: Record<ProgressKey, string> = {
  technical: "Technical skills",
  fitness: "Fitness",
  gameIQ: "Game IQ",
  mental: "Mental strength",
  discipline: "Discipline",
};

export type SwotBlock = {
  strengths?: string;
  weaknesses?: string;
  opportunities?: string;
  threats?: string;
};

export type ProgressRatingsPayload = Partial<Record<ProgressKey, number>> & {
  swot?: SwotBlock;
};

export function parseRatings(raw: unknown): ProgressRatingsPayload {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ProgressRatingsPayload = {};
  for (const k of PROGRESS_KEYS) {
    const v = o[k];
    if (typeof v === "number" && v >= 1 && v <= 5) out[k] = v;
  }
  const sw = o.swot;
  if (sw && typeof sw === "object") {
    const s = sw as Record<string, unknown>;
    out.swot = {
      strengths: typeof s.strengths === "string" ? s.strengths : undefined,
      weaknesses: typeof s.weaknesses === "string" ? s.weaknesses : undefined,
      opportunities: typeof s.opportunities === "string" ? s.opportunities : undefined,
      threats: typeof s.threats === "string" ? s.threats : undefined,
    };
  }
  return out;
}

export function radarValues(payload: ProgressRatingsPayload): number[] {
  return PROGRESS_KEYS.map((k) => payload[k] ?? 0);
}
