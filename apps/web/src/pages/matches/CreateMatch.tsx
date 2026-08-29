/**
 * CreateMatch — Quick-start scoring without a court booking.
 *
 * Flow: pick sport → pick format → name your teams → scoring config → Start Scoring
 * The match is created as "scheduled", then the user is taken straight
 * to the LiveMatch page where they can hit "Start" and begin scoring.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSports, useCreateMatch, useUpdateMatchStatus, useVenues, useSearchUsers } from "@sportza/api-client";
import {
  ChevronLeft, ChevronRight, Trophy, MapPin, Calendar,
  Sword, Handshake, Loader2, Search, X, UserPlus, User,
} from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";
import { getEngine } from "../../lib/scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

type SportFormat = {
  id?: number;
  name: string;
  playersPerTeam: number;
  description?: string | null;
  config?: Record<string, unknown> | null;
};
type Sport = { id: number; name: string; displayName: string; formats?: SportFormat[] };

function resolvePickleballScoreType(format: SportFormat | null): "pickleball_rally" | "pickleball_service" {
  if (!format) return "pickleball_rally";
  const c = format.config && typeof format.config === "object" ? format.config : null;
  if (c?.scoringType === "pickleball_service") return "pickleball_service";
  if (c?.scoringType === "pickleball_rally") return "pickleball_rally";
  if ((format.name || "").toLowerCase().includes("service")) return "pickleball_service";
  return "pickleball_rally";
}

function scoringEngineKeyForSport(sport: Sport | null, format: SportFormat | null): string {
  if (!sport) return "simple";
  const slug = sport.name.toLowerCase();
  if (slug === "pickleball") return resolvePickleballScoreType(format);
  return slug;
}

/** Pickleball formats no longer offered in product (still hide if API returns legacy rows). */
function isRemovedPickleballFormat(f: SportFormat): boolean {
  const n = (f.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  return n === "mixed doubles" || n === "mixed doubles (service)";
}

/** Singles rally, singles service, doubles rally, doubles service, then any other allowed formats */
function orderPickleballFormatsForUi(formats: SportFormat[]): SportFormat[] {
  const list = formats.filter((f) => !isRemovedPickleballFormat(f));
  const find = (name: string) => list.find((x) => x.name === name);
  const orderNames = ["Singles", "Singles (service)", "Doubles", "Doubles (service)"];
  const picked: SportFormat[] = [];
  const seen = new Set<string>();
  for (const nm of orderNames) {
    const f = find(nm);
    if (f) {
      picked.push(f);
      seen.add(f.name);
    }
  }
  for (const f of list) {
    if (!seen.has(f.name)) picked.push(f);
  }
  return picked;
}

/** One line per pill: e.g. Singles (rally), Doubles (service) */
function pickleballPillLabel(f: SportFormat): string {
  const st = resolvePickleballScoreType(f);
  const raw = (f.name || "").trim();
  if (st === "pickleball_service") {
    return raw.toLowerCase().includes("service") ? raw : `${raw} (service)`;
  }
  const base = raw.replace(/\s*\(service\)\s*$/i, "").trim() || raw;
  return `${base} (rally)`;
}

function truncateForToggle(s: string, max = 20): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type Venue = { id: number; name: string; location?: { city?: string | null } | null };
type PlayerEntry = { id: number; name: string; avatar?: string | null };

// ─── Constants ───────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", volleyball: "🏐", swimming: "🏊", hockey: "🏑",
  pickleball: "🏓",
};
const sportEmoji = (name: string) => SPORT_EMOJI[name?.toLowerCase()] ?? "🎯";

// ─── Shared input style ────────────────────────────────────────────────────────

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%",
  height: "52px",
  borderRadius: "14px",
  backgroundColor: "#111827",
  border: `1.5px solid ${hasError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"}`,
  color: "#F1F5F9",
  fontSize: "15px",
  padding: "0 14px",
  outline: "none",
});

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
      <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{title}</p>
      {children}
    </div>
  );
}

// ─── Pill button ──────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children, allowWrap,
}: { active: boolean; onClick: () => void; children: React.ReactNode; allowWrap?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2 transition-all duration-150 ${allowWrap ? "whitespace-normal text-left max-w-[220px]" : "whitespace-nowrap"}`}
      style={{
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: "600",
        backgroundColor: active ? "#3B82F6" : "#111827",
        color: active ? "#FFFFFF" : "#94A3B8",
        border: active ? "none" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateMatch() {
  const navigate = useNavigate();
  const createMatch      = useCreateMatch();
  const updateStatus     = useUpdateMatchStatus();
  const { data: sportsRes } = useSports();
  const { data: venuesRes } = useVenues({ limit: 100 } as any);

  const sports: Sport[] = (sportsRes as any)?.data ?? [];
  const venues: Venue[] = (venuesRes as any)?.data ?? [];

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedSport, setSelectedSport]       = useState<Sport | null>(null);
  const [selectedFormat, setSelectedFormat]     = useState<SportFormat | null>(null);
  const [matchType, setMatchType]               = useState<"COMPETITIVE" | "FRIENDLY">("FRIENDLY");
  const [teamAName, setTeamAName]               = useState("");
  const [teamBName, setTeamBName]               = useState("");
  const [venueId, setVenueId]                   = useState<number | "">("");
  const [matchDate, setMatchDate]               = useState(() => new Date().toISOString().slice(0, 10));
  const [isStarting, setIsStarting]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [scoreConfig, setScoreConfig]           = useState<Record<string, string | number | boolean>>({});

  // ── Player selection state ─────────────────────────────────────────────────
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerEntry[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerEntry[]>([]);
  const [searchTarget, setSearchTarget] = useState<"A" | "B" | null>(null);
  const [playerSearchQ, setPlayerSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: searchRes } = useSearchUsers(playerSearchQ);
  const searchResults: PlayerEntry[] = (searchRes as any)?.users ?? [];

  // Auto-select first sport + first format on load
  useEffect(() => {
    if (sports.length > 0 && !selectedSport) {
      const s = sports[0];
      setSelectedSport(s);
      if (s.formats?.length) setSelectedFormat(s.formats[0]);
      const fmt = s.formats?.[0] ?? null;
      const engine = getEngine(scoringEngineKeyForSport(s, fmt));
      const defaults: Record<string, string | number | boolean> = {};
      engine.configOptions().forEach((opt) => { defaults[opt.key] = opt.default as string | number | boolean; });
      setScoreConfig(defaults);
    }
  }, [sports, selectedSport]);

  // Reset player selections when format changes (e.g., singles → doubles)
  useEffect(() => {
    setTeamAPlayers([]);
    setTeamBPlayers([]);
    setSearchTarget(null);
    setPlayerSearchQ("");
  }, [selectedFormat?.id]);

  // When sport changes, reset format, scoring config, and player selections
  function chooseSport(s: Sport) {
    setSelectedSport(s);
    const fmt = s.formats?.[0] ?? null;
    setSelectedFormat(fmt);
    const engine = getEngine(scoringEngineKeyForSport(s, fmt));
    const defaults: Record<string, string | number | boolean> = {};
    engine.configOptions().forEach((opt) => { defaults[opt.key] = opt.default as string | number | boolean; });
    setScoreConfig(defaults);
    setTeamAPlayers([]);
    setTeamBPlayers([]);
    setSearchTarget(null);
    setPlayerSearchQ("");
  }

  // Derived: individual vs team sport
  const playersPerTeam = selectedFormat?.playersPerTeam ?? 1;
  const isTeamSport = playersPerTeam > 1;

  // Helpers for player picker
  function openSearch(team: "A" | "B") {
    setSearchTarget(team);
    setPlayerSearchQ("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function closeSearch() {
    setSearchTarget(null);
    setPlayerSearchQ("");
  }

  function addPlayer(team: "A" | "B", player: PlayerEntry) {
    if (team === "A") {
      if (isTeamSport) {
        setTeamAPlayers((prev) => prev.find((p) => p.id === player.id) ? prev : [...prev, player].slice(0, playersPerTeam));
      } else {
        setTeamAPlayers([player]);
        setTeamAName(player.name);
      }
    } else {
      if (isTeamSport) {
        setTeamBPlayers((prev) => prev.find((p) => p.id === player.id) ? prev : [...prev, player].slice(0, playersPerTeam));
      } else {
        setTeamBPlayers([player]);
        setTeamBName(player.name);
      }
    }
    closeSearch();
  }

  function removePlayer(team: "A" | "B", id: number) {
    if (team === "A") setTeamAPlayers((prev) => prev.filter((p) => p.id !== id));
    else setTeamBPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function selectFormat(f: SportFormat) {
    setSelectedFormat(f);
    if (selectedSport?.name.toLowerCase() === "pickleball") {
      const key = resolvePickleballScoreType(f);
      const eng = getEngine(key);
      const defaults: Record<string, string | number | boolean> = {};
      eng.configOptions().forEach((opt) => {
        defaults[opt.key] = opt.default as string | number | boolean;
      });
      setScoreConfig(defaults);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleStart() {
    if (!selectedSport) { setError("Please select a sport."); return; }
    setError(null);
    setIsStarting(true);

    const teams: Record<string, unknown> = {
      A: {
        // For team sports: use typed name or "Team A" — never the player name
        // For individual sports: typed name → player name → "Team A"
        name: teamAName.trim() || (isTeamSport ? "Team A" : (teamAPlayers[0]?.name || "Team A")),
        players: teamAPlayers.map((p) => p.id),
        playerNames: teamAPlayers.map((p) => p.name),
      },
      B: {
        name: teamBName.trim() || (isTeamSport ? "Team B" : (teamBPlayers[0]?.name || "Team B")),
        players: teamBPlayers.map((p) => p.id),
        playerNames: teamBPlayers.map((p) => p.name),
      },
    };

    const sportSlug = selectedSport.name.toLowerCase();
    const scoreType = scoringEngineKeyForSport(selectedSport, selectedFormat);
    const engine = getEngine(scoreType);
    const ppt = selectedFormat?.playersPerTeam ?? 1;
    const initPayload: Record<string, unknown> = scoreType === "pickleball_service"
      ? {
          sport: "pickleball_service",
          ...scoreConfig,
          doubles: ppt >= 2,
          firstServeTeam: scoreConfig.firstServeTeam === "B" ? "B" : "A",
        }
      : scoreType === "pickleball_rally"
        ? {
            sport: "pickleball_rally",
            ...scoreConfig,
            doubles: ppt >= 2,
            firstServeTeam: scoreConfig.firstServeTeam === "B" ? "B" : "A",
          }
        : sportSlug === "pickleball"
          ? { sport: "pickleball", ...scoreConfig }
          : { sport: sportSlug, ...scoreConfig };
    const initialState = engine.init(initPayload as any);

    const payload: Record<string, unknown> = {
      sportId:        selectedSport.id,
      formatName:     selectedFormat?.name ?? "Casual",
      playersPerTeam: selectedFormat?.playersPerTeam ?? 1,
      matchDate,
      matchType,
      teams,
      scoreType,
      scores:         initialState,
    };
    if (venueId) payload.venueId = Number(venueId);

    try {
      const res = await createMatch.mutateAsync(payload);
      const matchId: number = res?.data?.id ?? res?.id;

      if (!matchId) throw new Error("Match ID not returned");

      // Immediately set status to "live" so the user lands straight into scoring.
      // replace: true so Back from LiveMatch does not return to the spent create form.
      await updateStatus.mutateAsync({ id: matchId, status: "live" });

      navigate(`/matches/${matchId}`, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Something went wrong. Please try again.");
      setIsStarting(false);
    }
  }

  const isReady = !!selectedSport;
  const busy    = isStarting || createMatch.isPending || updateStatus.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F172A] pb-72">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.07)" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Score a Game</h1>
          <p className="text-[#64748B]" style={{ fontSize: "11px" }}>No court booking needed</p>
        </div>
      </div>

      {/* ── Live preview strip ── */}
      {selectedSport && (
        <div
          className="mx-4 mb-4 px-4 py-3 flex items-center gap-3"
          style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <span style={{ fontSize: "20px" }}>{sportEmoji(selectedSport.name)}</span>
          <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
            <span className="text-white font-semibold">{selectedSport.displayName}</span>
            {selectedFormat && <> · {selectedFormat.name}</>}
            {" · "}
            {matchType === "COMPETITIVE" ? "Competitive" : "Friendly"}
          </span>
        </div>
      )}

      <div className="px-4 space-y-4 max-w-md mx-auto">

        {/* ── Sport ── */}
        <Section title="Sport">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {sports.map((s) => (
              <div key={s.id} className="relative shrink-0 flex items-center">
                <Pill active={selectedSport?.id === s.id} onClick={() => chooseSport(s)}>
                  {sportEmoji(s.name)} {s.displayName}
                </Pill>
                <span className="absolute -top-1.5 -right-1.5 z-10">
                  <SportRulebook sport={s} />
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Format ── */}
        {selectedSport && (selectedSport.formats?.length ?? 0) > 0 && (
          <Section title="Format">
            {selectedSport.name.toLowerCase() === "pickleball" ? (
              <>
                <p className="text-[#94A3B8] mb-3" style={{ fontSize: "12px", lineHeight: 1.5 }}>
                  Pick a format below, in order: <span className="text-white font-semibold">Singles (rally)</span>,{" "}
                  <span className="text-white font-semibold">Singles (service)</span>,{" "}
                  <span className="text-white font-semibold">Doubles (rally)</span>,{" "}
                  <span className="text-white font-semibold">Doubles (service)</span>.{" "}
                  <span className="text-sky-300">(rally)</span> = any team can score from their panel.{" "}
                  <span className="text-amber-300">(service)</span> = side-out scoring; doubles can configure court positions on the live screen, or skip and start without player-side tracking.
                </p>
                {(() => {
                  const ordered = orderPickleballFormatsForUi(selectedSport.formats!);
                  const hasServiceFmt = ordered.some((x) => resolvePickleballScoreType(x) === "pickleball_service");
                  return (
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {ordered.map((f) => (
                          <Pill
                            key={f.id ?? f.name}
                            active={selectedFormat?.name === f.name}
                            allowWrap
                            onClick={() => selectFormat(f)}
                          >
                            {pickleballPillLabel(f)}
                            {f.playersPerTeam > 1 && (
                              <span className="text-white/50 ml-1" style={{ fontSize: "11px" }}>
                                {f.playersPerTeam}v{f.playersPerTeam}
                              </span>
                            )}
                          </Pill>
                        ))}
                      </div>
                      {!hasServiceFmt && (
                        <p className="text-[#94A3B8] mt-3" style={{ fontSize: "12px", lineHeight: 1.5 }}>
                          Service scoring options are not available in this app right now. Choose a (rally) format above.
                        </p>
                      )}
                    </div>
                  );
                })()}
                {selectedFormat && (
                  <p className="text-[#94A3B8] mt-3 pt-3" style={{ fontSize: "12px", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-[#F59E0B] font-bold" style={{ fontSize: "10px", letterSpacing: "0.06em" }}>
                      {resolvePickleballScoreType(selectedFormat) === "pickleball_service" ? "SERVICE" : "RALLY"}
                    </span>
                    {" · "}
                    {(selectedFormat.description && String(selectedFormat.description).trim()) ||
                      (resolvePickleballScoreType(selectedFormat) === "pickleball_service"
                        ? "Side-out scoring with Server 1 / 2. Optional court setup on the live screen, or skip without player-side tracking."
                        : "Every rally awards a point to the team you tap — no serve-only scoring.")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[#94A3B8] mb-3" style={{ fontSize: "12px", lineHeight: 1.5 }}>
                  Pick a match format. All options are shown below (wraps on small screens).
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedSport.formats!.map((f) => (
                    <Pill
                      key={f.id ?? f.name}
                      active={selectedFormat?.name === f.name}
                      allowWrap
                      onClick={() => selectFormat(f)}
                    >
                      {f.name}
                      {f.playersPerTeam > 1 && (
                        <span className="text-white/50 ml-1" style={{ fontSize: "11px" }}>
                          {f.playersPerTeam}v{f.playersPerTeam}
                        </span>
                      )}
                    </Pill>
                  ))}
                </div>
                {selectedFormat && (selectedFormat.description && String(selectedFormat.description).trim()) && (
                  <p className="text-[#94A3B8] mt-3 pt-3" style={{ fontSize: "12px", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {String(selectedFormat.description).trim()}
                  </p>
                )}
              </>
            )}
          </Section>
        )}

        {/* ── Teams / Players ── */}
        <Section title={isTeamSport ? "Teams & Players" : "Players"}>

          {/* ── Player search dropdown (shared for both teams) ── */}
          {searchTarget && (
            <div
              className="p-3 space-y-2"
              style={{ borderRadius: "14px", backgroundColor: "#111827", border: "1px solid rgba(59,130,246,0.35)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[#60A5FA]" style={{ fontSize: "12px", fontWeight: "700" }}>
                  Adding to {isTeamSport ? `Team ${searchTarget}` : (searchTarget === "A" ? (teamAName.trim() || "Team A") : (teamBName.trim() || "Team B"))}
                </span>
                <button onClick={closeSearch} className="ml-auto" style={{ color: "#64748B" }}>
                  <X style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
              <div className="relative">
                <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "#64748B", pointerEvents: "none" }} />
                <input
                  ref={searchInputRef}
                  value={playerSearchQ}
                  onChange={(e) => setPlayerSearchQ(e.target.value)}
                  placeholder="Search by name or email…"
                  style={{ ...inputStyle(), paddingLeft: "36px", height: "44px" }}
                  autoComplete="off"
                />
              </div>
              {playerSearchQ.length >= 2 && (
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="text-[#475569] text-center py-3" style={{ fontSize: "13px" }}>No users found</p>
                  ) : (
                    searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addPlayer(searchTarget, u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                        style={{ borderRadius: "10px" }}
                      >
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{ width: "32px", height: "32px", borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.15)" }}
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} style={{ width: "32px", height: "32px", borderRadius: "999px", objectFit: "cover" }} />
                          ) : (
                            <User style={{ width: "15px", height: "15px", color: "#60A5FA" }} />
                          )}
                        </div>
                        <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{u.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {playerSearchQ.length > 0 && playerSearchQ.length < 2 && (
                <p className="text-[#475569] text-center" style={{ fontSize: "12px" }}>Type at least 2 characters to search</p>
              )}
            </div>
          )}

          {/* ── Individual sport: one player picker per side ── */}
          {!isTeamSport && (
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((side) => {
                const player = side === "A" ? teamAPlayers[0] : teamBPlayers[0];
                return (
                  <div key={side}>
                    <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "500" }}>
                      {side === "A" ? "Player 1" : "Player 2"}
                    </label>
                    {player ? (
                      <div
                        className="flex items-center gap-2 px-3"
                        style={{ height: "52px", borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.1)", border: "1.5px solid rgba(59,130,246,0.4)" }}
                      >
                        <div style={{ width: "28px", height: "28px", borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {player.avatar ? (
                            <img src={player.avatar} alt={player.name} style={{ width: "28px", height: "28px", borderRadius: "999px", objectFit: "cover" }} />
                          ) : (
                            <User style={{ width: "13px", height: "13px", color: "#60A5FA" }} />
                          )}
                        </div>
                        <span className="flex-1 truncate text-white" style={{ fontSize: "13px", fontWeight: "600" }}>{player.name}</span>
                        <button type="button" onClick={() => { removePlayer(side, player.id); if (side === "A") setTeamAName(""); else setTeamBName(""); }}>
                          <X style={{ width: "14px", height: "14px", color: "#64748B" }} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSearch(side)}
                        className="w-full flex items-center justify-center gap-2"
                        style={{ height: "52px", borderRadius: "14px", backgroundColor: "#111827", border: "1.5px dashed rgba(255,255,255,0.15)", color: "#64748B", fontSize: "13px", fontWeight: "600" }}
                      >
                        <UserPlus style={{ width: "15px", height: "15px" }} />
                        Select
                      </button>
                    )}
                    {/* Allow manual name if no user picked */}
                    {!player && (
                      <input
                        value={side === "A" ? teamAName : teamBName}
                        onChange={(e) => side === "A" ? setTeamAName(e.target.value) : setTeamBName(e.target.value)}
                        placeholder={side === "A" ? "or type name… (default: Team A)" : "or type name… (default: Team B)"}
                        maxLength={30}
                        style={{ ...inputStyle(), height: "40px", marginTop: "6px", fontSize: "13px" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Team sport: name + multi-player search ── */}
          {isTeamSport && (
            <div className="space-y-4">
              {(["A", "B"] as const).map((side) => {
                const players = side === "A" ? teamAPlayers : teamBPlayers;
                const name = side === "A" ? teamAName : teamBName;
                const setName = side === "A" ? setTeamAName : setTeamBName;
                const isFull = players.length >= playersPerTeam;
                return (
                  <div key={side} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: side === "A" ? "rgba(59,130,246,0.2)" : "rgba(244,63,94,0.2)", fontSize: "12px", fontWeight: "800", color: side === "A" ? "#60A5FA" : "#FB7185" }}
                      >
                        {side}
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`Team ${side} name (default: Team ${side})`}
                        maxLength={30}
                        style={{ ...inputStyle(), flex: 1, height: "44px" }}
                      />
                    </div>
                    {/* Player chips */}
                    {players.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {players.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5"
                            style={{ borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}
                          >
                            <div style={{ width: "20px", height: "20px", borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {p.avatar ? (
                                <img src={p.avatar} alt={p.name} style={{ width: "20px", height: "20px", borderRadius: "999px", objectFit: "cover" }} />
                              ) : (
                                <User style={{ width: "10px", height: "10px", color: "#60A5FA" }} />
                              )}
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "#E2E8F0" }}>{p.name}</span>
                            <button type="button" onClick={() => removePlayer(side, p.id)}>
                              <X style={{ width: "12px", height: "12px", color: "#64748B" }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add player button */}
                    {!isFull && searchTarget !== side && (
                      <button
                        type="button"
                        onClick={() => openSearch(side)}
                        className="flex items-center gap-2"
                        style={{ fontSize: "12px", fontWeight: "600", color: "#60A5FA", padding: "4px 0" }}
                      >
                        <UserPlus style={{ width: "14px", height: "14px" }} />
                        Add player {players.length > 0 ? `(${players.length}/${playersPerTeam})` : `(up to ${playersPerTeam})`}
                      </button>
                    )}
                    {isFull && (
                      <p style={{ fontSize: "12px", color: "#22C55E" }}>Team full ({playersPerTeam}/{playersPerTeam})</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[#475569]" style={{ fontSize: "12px" }}>
            {isTeamSport
              ? "Player names are optional — you can update them later."
              : "Select a registered user or type a name. Stats are tracked for registered users."}
          </p>
        </Section>

        {/* ── Scoring Config ── */}
        {selectedSport && (() => {
          const engineKey = scoringEngineKeyForSport(selectedSport, selectedFormat);
          const engine = getEngine(engineKey);
          const opts = engine.configOptions();
          if (opts.length === 0) return null;
          const scoringOpts = opts.filter(
            (opt) => !(engineKey === "pickleball_service"
              && (opt.key === "doubles" || opt.key === "firstServeTeam"))
              && !(engineKey === "pickleball_rally"
                && (opt.key === "doubles" || opt.key === "firstServeTeam")),
          );
          return (
            <Section title="Scoring Rules">
              <div className="space-y-4">
                {scoringOpts.map((opt) => (
                  <div key={opt.key}>
                    <label className="block text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {opt.label}
                    </label>
                    {opt.type === "select" && (
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {opt.options!.map((o) => {
                            const isFirstServePickleballSvc = opt.key === "firstServeTeam" && engineKey === "pickleball_service";
                            const btnLabel = isFirstServePickleballSvc && (o.value === "A" || o.value === "B")
                              ? truncateForToggle(o.value === "A" ? teamAName.trim() || "Team A" : teamBName.trim() || "Team B", 24)
                              : o.label;
                            return (
                              <button
                                key={String(o.value)}
                                type="button"
                                onClick={() => setScoreConfig((prev) => ({ ...prev, [opt.key]: o.value }))}
                                className="px-4 py-2 transition-all"
                                style={{
                                  borderRadius: "10px",
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  backgroundColor: (scoreConfig[opt.key] ?? opt.default) === o.value
                                    ? "rgba(59,130,246,0.15)"
                                    : "#111827",
                                  border: (scoreConfig[opt.key] ?? opt.default) === o.value
                                    ? "1.5px solid rgba(59,130,246,0.6)"
                                    : "1px solid rgba(255,255,255,0.07)",
                                  color: (scoreConfig[opt.key] ?? opt.default) === o.value ? "#60A5FA" : "#94A3B8",
                                }}
                              >
                                {btnLabel}
                              </button>
                            );
                          })}
                        </div>
                        {opt.key === "firstServeTeam" && engineKey === "pickleball_service" && (
                          <p className="text-[#64748B] mt-2" style={{ fontSize: "11px", lineHeight: 1.45 }}>
                            Who serves first in game 1. Later games follow standard rotation (loser of the prior game serves first).
                          </p>
                        )}
                      </div>
                    )}
                    {opt.type === "toggle" && (
                      <div className="flex gap-3">
                        {[{ value: true, label: "On" }, { value: false, label: "Off" }].map((o) => (
                          <button
                            key={String(o.value)}
                            type="button"
                            onClick={() => setScoreConfig((prev) => ({ ...prev, [opt.key]: o.value }))}
                            className="px-5 py-2 transition-all"
                            style={{
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: "600",
                              backgroundColor: (scoreConfig[opt.key] ?? opt.default) === o.value
                                ? "rgba(59,130,246,0.15)"
                                : "#111827",
                              border: (scoreConfig[opt.key] ?? opt.default) === o.value
                                ? "1.5px solid rgba(59,130,246,0.6)"
                                : "1px solid rgba(255,255,255,0.07)",
                              color: (scoreConfig[opt.key] ?? opt.default) === o.value ? "#60A5FA" : "#94A3B8",
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {opt.type === "number" && (
                      <input
                        type="number"
                        value={String(scoreConfig[opt.key] ?? opt.default)}
                        min={1}
                        onChange={(e) => setScoreConfig((prev) => ({ ...prev, [opt.key]: Number(e.target.value) }))}
                        style={inputStyle()}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Section>
          );
        })()}

        {/* ── Match type ── */}
        <Section title="Match Type">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMatchType("FRIENDLY")}
              className="flex flex-col items-center gap-2 p-4 transition-all"
              style={{
                borderRadius: "16px",
                backgroundColor: matchType === "FRIENDLY" ? "rgba(34,197,94,0.12)" : "#111827",
                border: matchType === "FRIENDLY" ? "1.5px solid rgba(34,197,94,0.5)" : "1.5px solid rgba(255,255,255,0.07)",
              }}
            >
              <Handshake style={{ width: "22px", height: "22px", color: matchType === "FRIENDLY" ? "#22C55E" : "#475569" }} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: matchType === "FRIENDLY" ? "#22C55E" : "#94A3B8" }}>
                Friendly
              </span>
              <span className="text-[#475569] text-center" style={{ fontSize: "11px" }}>Just for fun</span>
            </button>

            <button
              type="button"
              onClick={() => setMatchType("COMPETITIVE")}
              className="flex flex-col items-center gap-2 p-4 transition-all"
              style={{
                borderRadius: "16px",
                backgroundColor: matchType === "COMPETITIVE" ? "rgba(239,68,68,0.1)" : "#111827",
                border: matchType === "COMPETITIVE" ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid rgba(255,255,255,0.07)",
              }}
            >
              <Sword style={{ width: "22px", height: "22px", color: matchType === "COMPETITIVE" ? "#EF4444" : "#475569" }} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: matchType === "COMPETITIVE" ? "#EF4444" : "#94A3B8" }}>
                Competitive
              </span>
              <span className="text-[#475569] text-center" style={{ fontSize: "11px" }}>Counts for stats</span>
            </button>
          </div>
        </Section>

        {/* ── Date + Venue (optional) ── */}
        <Section title="Details (optional)">
          {/* Date */}
          <div>
            <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "500" }}>
              Date
            </label>
            <div className="relative">
              <Calendar style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "#64748B", pointerEvents: "none" }} />
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                style={{ ...inputStyle(), paddingLeft: "38px" }}
              />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "500" }}>
              Venue <span className="text-[#475569]">(optional)</span>
            </label>
            <div className="relative">
              <MapPin style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "#64748B", pointerEvents: "none" }} />
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value ? Number(e.target.value) : "")}
                style={{ ...inputStyle(), paddingLeft: "38px", appearance: "none" }}
              >
                <option value="">No specific venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.location?.city ? ` · ${v.location.city}` : ""}
                  </option>
                ))}
              </select>
              <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "15px", height: "15px", color: "#64748B", pointerEvents: "none" }} />
            </div>
          </div>
        </Section>

        {/* Error */}
        {error && (
          <div className="px-4 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <p className="text-[#EF4444]" style={{ fontSize: "14px" }}>{error}</p>
          </div>
        )}

      </div>

      {/* ── Sticky CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
        style={{
          background: "linear-gradient(to top, #0F172A 80%, transparent)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)",
        }}
      >
        <div className="max-w-md mx-auto">
          {/* Match preview */}
          {selectedSport && (
            <div
              className="flex items-center justify-between px-4 py-3 mb-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ fontSize: "16px" }}>{sportEmoji(selectedSport.name)}</span>
                <span
                  className="truncate"
                  style={{ fontSize: "13px", fontWeight: "600", color: "#E2E8F0" }}
                >
                  {teamAName.trim() || (isTeamSport ? "Team A" : (teamAPlayers[0]?.name || "Team A"))}
                  <span style={{ color: "#64748B", fontWeight: "400" }}> vs </span>
                  {teamBName.trim() || (isTeamSport ? "Team B" : (teamBPlayers[0]?.name || "Team B"))}
                </span>
              </div>
              <span
                className="ml-3 shrink-0 px-2.5 py-1"
                style={{
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: "700",
                  backgroundColor: matchType === "COMPETITIVE" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                  color: matchType === "COMPETITIVE" ? "#EF4444" : "#22C55E",
                  letterSpacing: "0.03em",
                }}
              >
                {matchType === "COMPETITIVE" ? "Competitive" : "Friendly"}
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={!isReady || busy}
            onClick={handleStart}
            className="w-full py-4 flex items-center justify-center gap-2"
            style={{
              borderRadius: "16px",
              background: (!isReady || busy) ? "#1E293B" : "linear-gradient(135deg,#EF4444,#F97316)",
              fontSize: "17px",
              fontWeight: "800",
              color: "#fff",
              opacity: (!isReady || busy) ? 0.6 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {busy ? (
              <>
                <Loader2 style={{ width: "20px", height: "20px" }} className="animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Trophy style={{ width: "20px", height: "20px" }} />
                Start Scoring
                <ChevronRight style={{ width: "20px", height: "20px" }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
