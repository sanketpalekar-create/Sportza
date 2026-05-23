import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTournament, useUpdateTournament, useVenues, useSports, useCurrentUser } from "@sportza/api-client";
import { ChevronLeft, Plus, X, ChevronRight, Check, Loader2 } from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";

// ── Types ─────────────────────────────────────────────────────────────────────

type StageFormat = "round_robin" | "knockout" | "league";

interface Stage {
  stageOrder:       number;
  name:             string;
  format:           StageFormat;
  groupCount?:      number;
  advancePerGroup?: number;
  bestOf?:          number;
  scoringSystem?:   "rally" | "service";
  targetScore?:     number;
  singleFormat?:    boolean;
}

// ── Style constants (match CreateTournament) ──────────────────────────────────

const BASE_INPUT: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: "10px",
  backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "15px", outline: "none", boxSizing: "border-box",
};
const BASE_SELECT: React.CSSProperties = { ...BASE_INPUT, appearance: "none" as const };
const CARD: React.CSSProperties = {
  borderRadius: "16px", backgroundColor: "#1E293B",
  border: "1px solid rgba(255,255,255,0.06)", padding: "20px",
};

const SPORT_OPTIONS = [
  { name: "Football",   emoji: "⚽" },
  { name: "Cricket",    emoji: "🏏" },
  { name: "Badminton",  emoji: "🏸" },
  { name: "Tennis",     emoji: "🎾" },
  { name: "Padel",      emoji: "🎾" },
  { name: "Basketball", emoji: "🏀" },
  { name: "Volleyball", emoji: "🏐" },
  { name: "Hockey",     emoji: "🏑" },
  { name: "Pickleball", emoji: "🏓" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
      {children}
    </label>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EditTournament() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const tournamentId = id ? parseInt(id, 10) : 0;

  const { data: tourRes, isLoading } = useTournament(tournamentId);
  const updateTournament = useUpdateTournament(tournamentId);
  const { data: venuesRes, isError: venuesError } = useVenues({ limit: 100 });
  const { data: sportsRes } = useSports();
  const { data: userRes }   = useCurrentUser({ enabled: true, retry: false });

  const tournament = (tourRes as any)?.data ?? (tourRes as any)?.tournament ?? tourRes;
  const currentUserId: number | null = (userRes as any)?.user?.id ?? (userRes as any)?.data?.id ?? null;
  const coOrgs: any[] = Array.isArray(tournament?.coOrganizers) ? tournament.coOrganizers : [];
  const myCoOrg = coOrgs.find((c: any) => c.userId === currentUserId);
  const isManager = !!(currentUserId && (tournament?.createdById === currentUserId || myCoOrg?.role === "manager"));
  const venues: any[] = Array.isArray((venuesRes as any)?.data)
    ? (venuesRes as any).data
    : Array.isArray(venuesRes) ? (venuesRes as any[]) : [];
  const apiSports: Array<{ id: number; name: string; displayName: string; rulebookTitle?: string | null; rulebookLines?: string[] | null }> =
    Array.isArray((sportsRes as any)?.data) ? (sportsRes as any).data : [];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,        setName]        = useState("");
  const [sport,       setSport]       = useState("");
  const [description, setDescription] = useState("");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [venueId,     setVenueId]     = useState<number | "">("");
  const [maxTeams,    setMaxTeams]    = useState<number | "">("");
  const [stages,      setStages]      = useState<Stage[]>([]);
  const [isMultiStage, setIsMultiStage] = useState(false);
  const [teams,       setTeams]       = useState<string[]>([]);
  const [teamInput,   setTeamInput]   = useState("");

  const [submitError, setSubmitError] = useState("");
  const [initialised, setInitialised] = useState(false);

  // Guard: redirect if user is not a manager once data loaded
  useEffect(() => {
    if (!isLoading && tournament && currentUserId !== null && !isManager) {
      navigate(`/tournaments/${tournamentId}`, { replace: true });
    }
  }, [isLoading, tournament, currentUserId, isManager, tournamentId, navigate]);

  // Pre-fill from fetched tournament once
  useEffect(() => {
    if (!tournament || initialised) return;
    setName(tournament.name ?? "");
    setSport(tournament.sport ?? "");
    setDescription(tournament.description ?? "");
    setStartDate(tournament.startDate ? tournament.startDate.slice(0, 10) : "");
    setEndDate(tournament.endDate   ? tournament.endDate.slice(0, 10)   : "");
    setVenueId(tournament.venueId ?? "");
    setMaxTeams(tournament.maxTeams ?? "");

    const existingStages: Stage[] = Array.isArray(tournament.stages) ? tournament.stages : [];
    const multi = existingStages.length > 0 && !existingStages[0]?.singleFormat;
    setIsMultiStage(multi);
    if (existingStages.length > 0) setStages(existingStages);

    setTeams(Array.isArray(tournament.teams) ? tournament.teams.map((t: any) => t.name ?? t) : []);

    setInitialised(true);
  }, [tournament, initialised]);

  // ── Stage helpers ────────────────────────────────────────────────────────────

  function updateStage(idx: number, patch: Partial<Stage>) {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function addStage() {
    const order = stages.length + 1;
    setStages(prev => [...prev, { stageOrder: order, name: `Stage ${order}`, format: "knockout" }]);
  }

  function removeStage(idx: number) {
    if (stages.length <= 1) return;
    setStages(prev =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stageOrder: i + 1 }))
    );
  }

  // ── Team helpers ─────────────────────────────────────────────────────────────

  function addTeam() {
    const t = teamInput.trim();
    if (!t || teams.includes(t)) return;
    setTeams(prev => [...prev, t]);
    setTeamInput("");
  }

  function removeTeam(i: number) {
    setTeams(prev => prev.filter((_, j) => j !== i));
  }

  function renameTeam(i: number, val: string) {
    setTeams(prev => prev.map((t, j) => j === i ? val : t));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!name.trim() || !sport) {
      setSubmitError("Name and sport are required.");
      return;
    }
    setSubmitError("");

    const payload: Record<string, unknown> = {
      name:      name.trim(),
      sport,
      description: description.trim() || undefined,
      maxTeams:  maxTeams  || undefined,
      venueId:   venueId   || undefined,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
      teams:     teams.filter(t => t.trim()).map(t => ({ name: t.trim() })),
    };

    if (isMultiStage && stages.length > 0) {
      payload.stages = stages;
    } else if (!isMultiStage && stages.length > 0) {
      // Keep the singleFormat stage with its scoring config
      payload.stages = stages;
    }

    updateTournament.mutate(payload, {
      onSuccess: () => navigate(`/tournaments/${tournamentId}`),
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ??
          err?.response?.data?.errors?.[0]?.message ??
          "Failed to save changes. Please try again.";
        setSubmitError(msg);
      },
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading || !initialised) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#F59E0B]" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0F172A] pb-32">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Edit Tournament</h1>
          <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{tournament?.name}</p>
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4">

        {/* ── Basic Info ── */}
        <div style={CARD}>
          <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Basic Info</p>
          <div className="space-y-4">
            <div>
              <FieldLabel>Tournament Name *</FieldLabel>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Cup 2026"
                style={BASE_INPUT}
              />
            </div>

            <div>
              <FieldLabel>Sport *</FieldLabel>
              {(() => {
                const SPORT_EMOJI_MAP: Record<string, string> = {
                  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
                  padel: "🎾", basketball: "🏀", volleyball: "🏐", hockey: "🏑", pickleball: "🏓",
                  swimming: "🏊", squash: "🎾", default: "🎯",
                };
                const emojiFor = (n: string) => SPORT_EMOJI_MAP[n.toLowerCase()] ?? SPORT_EMOJI_MAP.default;
                const list = apiSports.length > 0
                  ? apiSports.map(s => ({ name: s.displayName, slug: s.name, rulebook: s }))
                  : SPORT_OPTIONS.map(s => ({ name: s.name, slug: s.name.toLowerCase(), rulebook: null }));
                return (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {list.map(s => (
                      <div key={s.name} className="relative">
                        <button
                          onClick={() => setSport(s.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 active:scale-95 transition-transform"
                          style={{
                            borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                            backgroundColor: sport === s.name ? "rgba(245,158,11,0.15)" : "#0F172A",
                            border: `1.5px solid ${sport === s.name ? "#F59E0B" : "rgba(255,255,255,0.08)"}`,
                            color: sport === s.name ? "#F59E0B" : "#94A3B8",
                          }}
                        >
                          <span>{emojiFor(s.slug)}</span> {s.name}
                        </button>
                        {s.rulebook && (
                          <span className="absolute -top-1.5 -right-1.5 z-10">
                            <SportRulebook sport={s.rulebook} />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your tournament…"
                rows={3}
                style={{ ...BASE_INPUT, resize: "none" }}
              />
            </div>
          </div>
        </div>

        {/* ── Schedule ── */}
        <div style={CARD}>
          <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Schedule</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Start Date</FieldLabel>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={BASE_INPUT} />
              </div>
              <div>
                <FieldLabel>End Date</FieldLabel>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={BASE_INPUT} />
              </div>
            </div>
            <div>
              <FieldLabel>Venue (optional)</FieldLabel>
              <select
                value={venueId}
                onChange={e => setVenueId(e.target.value ? parseInt(e.target.value) : "")}
                style={BASE_SELECT}
              >
                <option value="">No specific venue</option>
                {venues.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {venues.length === 0 && !venuesError && (
                <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                  No venues registered yet.
                </p>
              )}
            </div>
            <div>
              <FieldLabel>Max Teams (optional)</FieldLabel>
              <input
                type="number" min={2}
                value={maxTeams}
                onChange={e => setMaxTeams(e.target.value ? parseInt(e.target.value) : "")}
                placeholder="e.g. 16"
                style={BASE_INPUT}
              />
            </div>
          </div>
        </div>

        {/* ── Teams ── */}
        <div style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Teams</p>
              <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "2px" }}>
                {teams.length} team{teams.length !== 1 ? "s" : ""} — tap name to rename
              </p>
            </div>
          </div>

          {/* Existing teams — editable + deletable */}
          {teams.length > 0 && (
            <div className="space-y-2 mb-4">
              {teams.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={t}
                    onChange={e => renameTeam(i, e.target.value)}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: "9px",
                      backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff", fontSize: "13px", fontWeight: "600", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => removeTeam(i)}
                    className="active:scale-90 transition-transform flex-shrink-0"
                    style={{
                      width: "34px", height: "34px", borderRadius: "8px",
                      backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X style={{ width: "14px", height: "14px", color: "#EF4444" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new team */}
          <div className="flex gap-2">
            <input
              value={teamInput}
              onChange={e => setTeamInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTeam()}
              placeholder="Add team name…"
              style={{
                flex: 1, padding: "9px 12px", borderRadius: "9px",
                backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: "13px", outline: "none",
              }}
            />
            <button
              onClick={addTeam}
              disabled={!teamInput.trim()}
              style={{
                padding: "9px 14px", borderRadius: "9px", fontSize: "12px", fontWeight: "700",
                backgroundColor: teamInput.trim() ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)",
                border: `1px solid ${teamInput.trim() ? "rgba(245,158,11,0.3)" : "rgba(100,116,139,0.2)"}`,
                color: teamInput.trim() ? "#F59E0B" : "#475569",
                flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* ── Format & Stages ── */}
        <div style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Format</p>
            {isMultiStage && (
              <button
                onClick={addStage}
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{ borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <Plus style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: "600" }}>Add Stage</span>
              </button>
            )}
          </div>

          {/* Single / Multi toggle */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Single Format", sub: "One format for all matches", val: false, emoji: "🎯" },
              { label: "Multi-Stage",   sub: "Groups → Knockout → Final",  val: true,  emoji: "🏆" },
            ].map(opt => (
              <button
                key={String(opt.val)}
                onClick={() => setIsMultiStage(opt.val)}
                className="p-4 text-left active:scale-95 transition-transform"
                style={{
                  borderRadius: "12px",
                  backgroundColor: isMultiStage === opt.val ? "rgba(245,158,11,0.12)" : "#0F172A",
                  border: `2px solid ${isMultiStage === opt.val ? "#F59E0B" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                <div style={{ fontSize: "22px", marginBottom: "6px" }}>{opt.emoji}</div>
                <p style={{ fontSize: "13px", fontWeight: "700", color: isMultiStage === opt.val ? "#F59E0B" : "#fff" }}>
                  {opt.label}
                </p>
                <p style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{opt.sub}</p>
              </button>
            ))}
          </div>

          {/* Stage cards */}
          <div className="space-y-4">
            {stages.map((stage, idx) => (
              <div
                key={idx}
                className="p-4"
                style={{ borderRadius: "12px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Stage header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#F59E0B", fontSize: "11px", fontWeight: "800", color: "#000" }}
                    >
                      {stage.stageOrder}
                    </div>
                    <input
                      value={stage.name}
                      onChange={e => updateStage(idx, { name: e.target.value })}
                      style={{ background: "none", border: "none", color: "#fff", fontSize: "14px", fontWeight: "700", outline: "none", padding: "0", flex: 1, minWidth: 0 }}
                    />
                  </div>
                  {stages.length > 1 && (
                    <button onClick={() => removeStage(idx)} className="ml-2 active:scale-90 transition-transform">
                      <X style={{ width: "16px", height: "16px", color: "#EF4444" }} />
                    </button>
                  )}
                </div>

                {/* Format pills (only for multi-stage) */}
                {isMultiStage && (
                  <div className="mb-3">
                    <FieldLabel>Format</FieldLabel>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["round_robin", "knockout", "league"] as StageFormat[]).map(f => (
                        <button
                          key={f} onClick={() => updateStage(idx, { format: f })}
                          style={{
                            padding: "7px 4px", borderRadius: "8px", fontSize: "10px", fontWeight: "700",
                            backgroundColor: stage.format === f ? "rgba(245,158,11,0.15)" : "transparent",
                            border: `1.5px solid ${stage.format === f ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                            color: stage.format === f ? "#F59E0B" : "#64748B",
                          }}
                        >
                          {f === "round_robin" ? "Round Robin" : f === "knockout" ? "Knockout" : "League"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group count / advance (round robin or league) */}
                {(stage.format === "round_robin" || stage.format === "league") && isMultiStage && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <FieldLabel>No. of Groups</FieldLabel>
                      <input
                        type="number" min={1}
                        value={stage.groupCount ?? ""}
                        onChange={e => updateStage(idx, { groupCount: e.target.value ? parseInt(e.target.value) : undefined })}
                        style={{ ...BASE_INPUT, padding: "9px 10px", fontSize: "13px" }}
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <FieldLabel>Advance / Group</FieldLabel>
                      <input
                        type="number" min={1}
                        value={stage.advancePerGroup ?? ""}
                        onChange={e => updateStage(idx, { advancePerGroup: e.target.value ? parseInt(e.target.value) : undefined })}
                        style={{ ...BASE_INPUT, padding: "9px 10px", fontSize: "13px" }}
                        placeholder="2"
                      />
                    </div>
                  </div>
                )}

                {/* Best Of */}
                <div>
                  <FieldLabel>Best Of (optional)</FieldLabel>
                  <div className="flex gap-2">
                    {[1, 3, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => updateStage(idx, { bestOf: stage.bestOf === n ? undefined : n })}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          backgroundColor: stage.bestOf === n ? "rgba(245,158,11,0.15)" : "transparent",
                          border: `1.5px solid ${stage.bestOf === n ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                          color: stage.bestOf === n ? "#F59E0B" : "#475569",
                        }}
                      >
                        Bo{n}
                      </button>
                    ))}
                  </div>
                  {stage.bestOf && (
                    <p className="text-[#64748B] mt-1.5" style={{ fontSize: "10px" }}>
                      First to win {Math.ceil(stage.bestOf / 2)} game{stage.bestOf > 1 ? "s" : ""} wins the tie
                    </p>
                  )}
                </div>

                {/* Scoring System */}
                <div className="mt-3">
                  <FieldLabel>Scoring System (optional)</FieldLabel>
                  <div className="flex gap-2">
                    {(["rally", "service"] as const).map(sys => (
                      <button
                        key={sys}
                        onClick={() => updateStage(idx, { scoringSystem: stage.scoringSystem === sys ? undefined : sys })}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          backgroundColor: stage.scoringSystem === sys ? "rgba(59,130,246,0.15)" : "transparent",
                          border: `1.5px solid ${stage.scoringSystem === sys ? "#3B82F6" : "rgba(255,255,255,0.1)"}`,
                          color: stage.scoringSystem === sys ? "#3B82F6" : "#475569",
                        }}
                      >
                        {sys === "rally" ? "Rally Point" : "Service Point"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Score */}
                <div className="mt-3">
                  <FieldLabel>Target Score (optional)</FieldLabel>
                  <div className="flex gap-2">
                    {[11, 15, 21, 25].map(n => (
                      <button
                        key={n}
                        onClick={() => updateStage(idx, { targetScore: stage.targetScore === n ? undefined : n })}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          backgroundColor: stage.targetScore === n ? "rgba(34,197,94,0.15)" : "transparent",
                          border: `1.5px solid ${stage.targetScore === n ? "#22C55E" : "rgba(255,255,255,0.1)"}`,
                          color: stage.targetScore === n ? "#22C55E" : "#475569",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {stage.targetScore && (
                    <p className="text-[#64748B] mt-1.5" style={{ fontSize: "10px" }}>
                      Race to {stage.targetScore}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stage flow summary (multi-stage) */}
          {isMultiStage && stages.length > 0 && (
            <div className="mt-4 px-3 py-3 flex items-center gap-2 overflow-x-auto" style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.06)" }}>
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2 flex-shrink-0">
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: "#F59E0B" }}>{s.name}</p>
                    <p style={{ fontSize: "9px", color: "#64748B" }}>
                      {(s.format === "round_robin"
                        ? `RR${s.groupCount ? ` (${s.groupCount} grps)` : ""}${s.bestOf ? ` Bo${s.bestOf}` : ""}`
                        : s.format === "knockout"
                          ? `KO${s.bestOf ? ` Bo${s.bestOf}` : ""}`
                          : `League${s.bestOf ? ` Bo${s.bestOf}` : ""}`)
                        + (s.targetScore ? ` · R${s.targetScore}` : "")
                        + (s.scoringSystem === "rally" ? " · RP" : s.scoringSystem === "service" ? " · SP" : "")}
                    </p>
                  </div>
                  {i < stages.length - 1 && (
                    <ChevronRight style={{ width: "14px", height: "14px", color: "#475569" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Error & Save ── */}
        {submitError && (
          <p style={{ fontSize: "13px", color: "#EF4444", textAlign: "center" }}>{submitError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={updateTournament.isPending}
          className="w-full py-4 active:scale-[0.98] transition-transform"
          style={{
            borderRadius: "14px", fontSize: "15px", fontWeight: "800", color: "#000",
            background: "linear-gradient(135deg,#F59E0B,#D97706)",
            opacity: updateTournament.isPending ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {updateTournament.isPending ? (
            <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
          ) : (
            <Check style={{ width: 18, height: 18 }} />
          )}
          {updateTournament.isPending ? "Saving…" : "Save Changes"}
        </button>

      </div>
    </div>
  );
}
