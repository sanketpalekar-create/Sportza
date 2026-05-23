type TeamMap = Record<string, { players?: number[] } | number[] | unknown>;

export function matchOutcome(match: any, userId: number): "win" | "loss" | "draw" | "unknown" {
  const teams = match.teams as TeamMap | null;
  if (!teams || !userId) return "unknown";

  // teams shape: { teamA: { players: number[] }, teamB: { players: number[] } }
  const getPlayers = (side: unknown): number[] => {
    if (!side) return [];
    if (Array.isArray(side)) return side as number[];
    if (typeof side === "object") {
      const s = side as Record<string, unknown>;
      if (Array.isArray(s.players)) return s.players as number[];
    }
    return [];
  };

  const onA = getPlayers(teams.teamA).includes(userId);
  const onB = getPlayers(teams.teamB).includes(userId);
  if (!onA && !onB) return "unknown";

  const winner = match.winnerTeam as string | null | undefined;
  if (!winner) return "draw";
  return (onA && winner === "A") || (onB && winner === "B") ? "win" : "loss";
}
