import { useParams, useNavigate } from "react-router-dom";
import { useTournament } from "@sportza/api-client";
import { ChevronLeft, Printer, Trophy, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { getPlayerStatValue, getSportPlayerStatSchema } from "../../lib/tournament-player-stats";

// Flatten scoring-engine state to {a, b}
function flatScore(scores: any): { a: string; b: string } | null {
  if (!scores || typeof scores !== "object") return null;
  if (typeof scores.A === "number" && typeof scores.B === "number")
    return { a: String(scores.A), b: String(scores.B) };
  if (scores.scores) return flatScore(scores.scores);
  if (scores.setsWon?.A !== undefined)
    return { a: String(scores.setsWon.A ?? 0), b: String(scores.setsWon.B ?? 0) };
  if (scores.gamesWon?.A !== undefined)
    return { a: String(scores.gamesWon.A ?? 0), b: String(scores.gamesWon.B ?? 0) };
  if (typeof scores.team1 === "number" && typeof scores.team2 === "number")
    return { a: String(scores.team1), b: String(scores.team2) };
  const nums = Object.values(scores).filter((v) => typeof v === "number") as number[];
  if (nums.length >= 2) return { a: String(nums[0]), b: String(nums[1]) };
  return null;
}

export default function MatchSumula() {
  const { id, fixtureId } = useParams<{ id: string; fixtureId: string }>();
  const navigate           = useNavigate();
  const tournamentId       = id ? parseInt(id, 10) : 0;
  const fixId              = fixtureId ? parseInt(fixtureId, 10) : 0;

  const { data: tourRes, isLoading } = useTournament(tournamentId);

  const tournament: any = (tourRes as any)?.data ?? tourRes;
  const fixtures: any[] = tournament?.fixtures ?? [];
  const players: any[]  = Array.isArray(tournament?.players) ? tournament.players : [];
  const fixture         = fixtures.find((f: any) => f.id === fixId);
  const match           = fixture?.match;

  const t1Name  = fixture?.team1Ref?.name ?? "Team A";
  const t2Name  = fixture?.team2Ref?.name ?? "Team B";
  const score   = flatScore(match?.scores);
  const statSchema = getSportPlayerStatSchema(tournament?.sport);

  const t1Players = players.filter((p: any) => p.teamName === t1Name);
  const t2Players = players.filter((p: any) => p.teamName === t2Name);

  // Determine winner
  const scoreA = score ? parseInt(score.a) : null;
  const scoreB = score ? parseInt(score.b) : null;
  const winner = match?.winnerTeam === "A" ? t1Name
    : match?.winnerTeam === "B" ? t2Name
    : (scoreA !== null && scoreB !== null && scoreA > scoreB) ? t1Name
    : (scoreA !== null && scoreB !== null && scoreB > scoreA) ? t2Name
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-pulse text-[#64748B]" style={{ fontSize: "14px" }}>Loading match sheet…</div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-4">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-4 text-[#EF4444]" style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}>
          Match not found.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-page { background: #fff !important; color: #000 !important; }
          .print-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
          .print-table-header { background: #f1f5f9 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-[#0F172A] pb-28 print-page">

        {/* Navigation (hidden on print) */}
        <div className="no-print flex items-center gap-3 px-4 pt-8 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
          >
            <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
          </button>
          <div className="flex-1">
            <h1 className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>Match Sheet</h1>
            <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Súmula da Partida</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 active:scale-95 transition-transform"
            style={{ borderRadius: "10px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "13px", fontWeight: "700", color: "#fff" }}
          >
            <Printer style={{ width: "15px", height: "15px" }} />
            Print
          </button>
        </div>

        <div className="px-4 max-w-md mx-auto space-y-4">

          {/* Header / Tournament info */}
          <div className="p-5 text-center print-card" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center justify-center mb-2" style={{ fontSize: "28px" }}>🏆</div>
            <p className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>{tournament?.name}</p>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{tournament?.sport}</p>

            <div className="flex flex-wrap justify-center gap-4 mt-3">
              {match?.matchDate && (
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <Calendar style={{ width: "13px", height: "13px" }} />
                  <span style={{ fontSize: "12px" }}>{format(new Date(match.matchDate), "dd MMM yyyy · HH:mm")}</span>
                </div>
              )}
              {tournament?.venue?.name && (
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <MapPin style={{ width: "13px", height: "13px" }} />
                  <span style={{ fontSize: "12px" }}>{tournament.venue.name}</span>
                </div>
              )}
            </div>

            {/* Stage / round label */}
            {match?.formatName && (
              <p className="text-[#475569] mt-2" style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {match.formatName}
              </p>
            )}
          </div>

          {/* Scoreboard */}
          <div className="p-5 print-card" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-3">
              {/* Team A */}
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center mb-2"
                  style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", fontSize: "20px", fontWeight: "800", color: "#fff", margin: "0 auto" }}>
                  {t1Name[0]?.toUpperCase()}
                </div>
                <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>{t1Name}</p>
                {winner === t1Name && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <Trophy style={{ width: "12px", height: "12px", color: "#F59E0B" }} />
                    <span style={{ fontSize: "10px", color: "#F59E0B", fontWeight: "700" }}>WINNER</span>
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="text-center flex-shrink-0 px-4">
                {score ? (
                  <p className="text-white" style={{ fontSize: "40px", fontWeight: "900", letterSpacing: "-1px" }}>
                    {score.a}<span style={{ color: "#334155", padding: "0 8px" }}>:</span>{score.b}
                  </p>
                ) : (
                  <p className="text-[#475569]" style={{ fontSize: "28px", fontWeight: "700" }}>vs</p>
                )}
                <p className="text-[#475569]" style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
                  {match?.status === "completed" ? "FINAL" : (match?.status ?? "SCHEDULED").replace("_", " ").toUpperCase()}
                </p>
              </div>

              {/* Team B */}
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center mb-2"
                  style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg,#DC2626,#EF4444)", fontSize: "20px", fontWeight: "800", color: "#fff", margin: "0 auto" }}>
                  {t2Name[0]?.toUpperCase()}
                </div>
                <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>{t2Name}</p>
                {winner === t2Name && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <Trophy style={{ width: "12px", height: "12px", color: "#F59E0B" }} />
                    <span style={{ fontSize: "10px", color: "#F59E0B", fontWeight: "700" }}>WINNER</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Player Rosters */}
          {(t1Players.length > 0 || t2Players.length > 0) && (
            <div className="print-card" style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
              <div className="px-4 py-3 flex items-center gap-2 print-table-header"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Player Rosters</p>
              </div>

              <div className="grid grid-cols-2 gap-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {/* Team A column */}
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="px-3 py-2" style={{ backgroundColor: "rgba(59,130,246,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6" }}>{t1Name}</p>
                  </div>
                  {t1Players.length === 0 ? (
                    <p className="px-3 py-3 text-[#475569]" style={{ fontSize: "11px" }}>No players listed</p>
                  ) : (
                    t1Players.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2"
                        style={{ borderBottom: i < t1Players.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        {p.jerseyNo != null && (
                          <span style={{ width: "20px", fontSize: "10px", color: "#475569", fontWeight: "700", textAlign: "center", flexShrink: 0 }}>
                            {p.jerseyNo}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate" style={{ fontSize: "11px", fontWeight: "600" }}>{p.playerName}</p>
                        </div>
                        {getPlayerStatValue(p, statSchema.fields[0]?.key ?? "goals") > 0 && (
                          <span style={{ fontSize: "9px", color: "#F59E0B", fontWeight: "700", flexShrink: 0 }}>
                            {getPlayerStatValue(p, statSchema.fields[0]?.key ?? "goals")}
                            {statSchema.fields[0]?.shortLabel ?? "G"}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Team B column */}
                <div>
                  <div className="px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#EF4444" }}>{t2Name}</p>
                  </div>
                  {t2Players.length === 0 ? (
                    <p className="px-3 py-3 text-[#475569]" style={{ fontSize: "11px" }}>No players listed</p>
                  ) : (
                    t2Players.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2"
                        style={{ borderBottom: i < t2Players.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        {p.jerseyNo != null && (
                          <span style={{ width: "20px", fontSize: "10px", color: "#475569", fontWeight: "700", textAlign: "center", flexShrink: 0 }}>
                            {p.jerseyNo}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate" style={{ fontSize: "11px", fontWeight: "600" }}>{p.playerName}</p>
                        </div>
                        {getPlayerStatValue(p, statSchema.fields[0]?.key ?? "goals") > 0 && (
                          <span style={{ fontSize: "9px", color: "#F59E0B", fontWeight: "700", flexShrink: 0 }}>
                            {getPlayerStatValue(p, statSchema.fields[0]?.key ?? "goals")}
                            {statSchema.fields[0]?.shortLabel ?? "G"}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Match Details */}
          {match && (
            <div className="p-4 print-card" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
              <p className="text-white mb-3" style={{ fontSize: "14px", fontWeight: "700" }}>Match Details</p>
              <div className="space-y-2">
                {[
                  { label: "Sport",      value: tournament?.sport },
                  { label: "Format",     value: match.formatName },
                  { label: "Match Type", value: match.matchType?.replace("_", " ") },
                  { label: "Date",       value: match.matchDate ? format(new Date(match.matchDate), "dd MMM yyyy · HH:mm") : null },
                  { label: "Venue",      value: tournament?.venue?.name },
                  { label: "Status",     value: match.status?.replace("_", " ").toUpperCase() },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{row.label}</span>
                    <span style={{ fontSize: "12px", color: "#E2E8F0", fontWeight: "600" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature lines (print only) */}
          <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", height: "32px", marginBottom: "6px" }} />
                <p style={{ fontSize: "10px", color: "#475569", textAlign: "center" }}>Captain — {t1Name}</p>
              </div>
              <div>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", height: "32px", marginBottom: "6px" }} />
                <p style={{ fontSize: "10px", color: "#475569", textAlign: "center" }}>Captain — {t2Name}</p>
              </div>
            </div>
            <div style={{ marginTop: "24px" }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", height: "32px", marginBottom: "6px" }} />
              <p style={{ fontSize: "10px", color: "#475569", textAlign: "center" }}>Referee / Organizer</p>
            </div>
          </div>

          {/* Powered by */}
          <p className="text-center text-[#334155]" style={{ fontSize: "10px", paddingTop: "8px" }}>
            Generated by Sportza · {format(new Date(), "dd MMM yyyy")}
          </p>

        </div>
      </div>
    </>
  );
}
