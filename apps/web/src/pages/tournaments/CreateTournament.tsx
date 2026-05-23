import { useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateTournament, useVenues, useSports, useSearchUsers, apiClient } from "@sportza/api-client";
import {
  ChevronLeft, ChevronRight, Plus, X, Trophy,
  Check, Users, Calendar, Layers, Star, UserCog,
} from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";

// ── Constants ────────────────────────────────────────────────────────────────

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

type SimpleFormat = "league" | "knockout" | "round-robin";
type StageFormat  = "round_robin" | "knockout" | "league";

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
  playersPerTeam?:  number;
}

const DEFAULT_STAGES: Stage[] = [
  { stageOrder: 1, name: "Group Stage", format: "round_robin", groupCount: 2, advancePerGroup: 2 },
  { stageOrder: 2, name: "Knockout",    format: "knockout" },
  { stageOrder: 3, name: "Final",       format: "knockout", bestOf: 3 },
];

const TOTAL_STEPS   = 4;
const STEP_LABELS   = ["Info", "Teams", "Format", "Schedule"];

// ── Smart group-count suggester ───────────────────────────────────────────────

/** Returns the ideal number of groups for a given team count.
 *  Aims for groups of 4; falls back to 3, 5, 6 if evenly divisible,
 *  otherwise rounds to nearest group-of-4. */
function suggestGroupCount(teamCount: number): number {
  for (const size of [4, 3, 5, 6]) {
    if (teamCount % size === 0) return teamCount / size;
  }
  return Math.max(2, Math.round(teamCount / 4));
}

// ── Style helpers ─────────────────────────────────────────────────────────────

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
      {children}
    </label>
  );
}

// ── Format descriptor cards ───────────────────────────────────────────────────

const SIMPLE_FORMATS: { value: SimpleFormat; label: string; sub: string; emoji: string }[] = [
  { value: "league",      label: "League",       sub: "Every team plays each other; points table decides winner", emoji: "📊" },
  { value: "knockout",    label: "Knockout",     sub: "Single elimination bracket — lose once and you're out",    emoji: "⚔️" },
  { value: "round-robin", label: "Round Robin",  sub: "All-vs-all; most wins advance to a final",                emoji: "🔄" },
];

// ── Main component ────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  padel: "🎾", basketball: "🏀", volleyball: "🏐", hockey: "🏑", pickleball: "🏓",
  swimming: "🏊", squash: "🎾", default: "🎯",
};
const sportEmoji = (name: string) => SPORT_EMOJI[name.toLowerCase()] ?? SPORT_EMOJI.default;

export default function CreateTournament() {
  const navigate         = useNavigate();
  const createTournament = useCreateTournament();
  const { data: venuesRes, isError: venuesError } = useVenues({ limit: 100 });
  const { data: sportsRes } = useSports();
  const venues: any[] = Array.isArray((venuesRes as any)?.data)
    ? (venuesRes as any).data
    : Array.isArray(venuesRes) ? (venuesRes as any[]) : [];
  const apiSports: Array<{ id: number; name: string; displayName: string; rulebookTitle?: string | null; rulebookLines?: string[] | null }> =
    Array.isArray((sportsRes as any)?.data) ? (sportsRes as any).data : [];

  // Ensure padel always appears whether it comes from the API or the hardcoded fallback
  const PADEL_ENTRY = { id: 0, name: "padel", displayName: "Padel", rulebookTitle: null, rulebookLines: null };
  const sportsList: Array<{ id: number | string; name: string; displayName: string; rulebookTitle?: string | null; rulebookLines?: string[] | null }> =
    apiSports.length > 0
      ? (apiSports.some((s) => s.name.toLowerCase() === "padel")
          ? apiSports
          : [...apiSports, PADEL_ENTRY].sort((a, b) => a.displayName.localeCompare(b.displayName)))
      : SPORT_OPTIONS.map((s) => ({
          id: s.name,
          name: s.name.toLowerCase(),
          displayName: s.name,
          rulebookTitle: null,
          rulebookLines: null,
        }));

  const [step, setStep] = useState(1);

  // Step 1 — Info
  const [name,        setName]        = useState("");
  const [sport,       setSport]       = useState("");
  const [description, setDescription] = useState("");

  // Step 2 — Format
  const [isMultiStage,          setIsMultiStage]          = useState(false);
  const [simpleFormat,          setSimpleFormat]          = useState<SimpleFormat>("league");
  const [simpleScoringSystem,   setSimpleScoringSystem]   = useState<"rally" | "service" | undefined>(undefined);
  const [simpleTargetScore,     setSimpleTargetScore]     = useState<number | undefined>(undefined);
  const [simpleBestOf,          setSimpleBestOf]          = useState<number | undefined>(undefined);
  const [simplePlayersPerTeam,  setSimplePlayersPerTeam]  = useState<number | undefined>(undefined);
  const [stages,                setStages]                = useState<Stage[]>(DEFAULT_STAGES);

  // Step 3 — Teams
  const [teams,     setTeams]     = useState<string[]>([]);
  const [teamInput, setTeamInput] = useState("");
  const [maxTeams,  setMaxTeams]  = useState<number | "">("");

  // Step 4 — Schedule
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [venueId,   setVenueId]   = useState<number | "">("");
  // Sponsors
  const [sponsors,      setSponsors]      = useState<{ name: string; logoUrl: string; tier: string }[]>([]);
  const [sponsorName,   setSponsorName]   = useState("");
  const [sponsorLogo,   setSponsorLogo]   = useState("");
  const [sponsorTier,   setSponsorTier]   = useState("main");

  // Step 5 — Co-organizers (pending, applied after creation)
  const [coOrgSearch,   setCoOrgSearch]   = useState("");
  const [pendingCoOrgs, setPendingCoOrgs] = useState<{ userId: number; name: string; email: string; role: "manager" | "scorer" }[]>([]);

  const { data: coOrgSearchRes } = useSearchUsers(coOrgSearch);
  const coOrgSearchResults: any[] = (coOrgSearchRes as any)?.users ?? [];

  const [submitError, setSubmitError] = useState("");

  // ── Teams helpers ───────────────────────────────────────────────────────────

  function addTeam() {
    const t = teamInput.trim();
    if (!t || teams.includes(t)) return;
    if (maxTeams !== "" && teams.length >= maxTeams) return;
    setTeams(prev => [...prev, t]);
    setTeamInput("");
  }

  function removeTeam(i: number) {
    setTeams(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Stage helpers ───────────────────────────────────────────────────────────

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

  // ── Validation ──────────────────────────────────────────────────────────────

  function canProceed() {
    if (step === 1) return name.trim().length > 0 && sport.length > 0;
    return true;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit() {
    setSubmitError("");
    const payload: Record<string, unknown> = {
      name:        name.trim(),
      sport,
      format:      isMultiStage ? "league" : simpleFormat,
      description: description.trim() || undefined,
      maxTeams:    maxTeams || undefined,
      venueId:     venueId  || undefined,
      startDate:   startDate || undefined,
      endDate:     endDate   || undefined,
      teams:       teams.map(t => ({ name: t })),
      sponsors:    sponsors.length > 0 ? sponsors : undefined,
    };
    if (isMultiStage) {
      payload.stages = stages;
    } else if (simpleScoringSystem || simpleTargetScore || simpleBestOf) {
      payload.stages = [{
        stageOrder:   1,
        name:         SIMPLE_FORMATS.find(f => f.value === simpleFormat)?.label ?? simpleFormat,
        format:       simpleFormat === "round-robin" ? "round_robin" : simpleFormat,
        singleFormat: true,
        ...(simpleBestOf        && { bestOf:           simpleBestOf }),
        ...(simpleScoringSystem && { scoringSystem:    simpleScoringSystem }),
        ...(simpleTargetScore   && { targetScore:      simpleTargetScore }),
        ...(simplePlayersPerTeam && { playersPerTeam:  simplePlayersPerTeam }),
      }];
    }

    createTournament.mutate(payload, {
      onSuccess: async (res: any) => {
        const id = res?.data?.id ?? res?.id;
        // Add any pending co-organizers (fire-and-forget, errors are non-blocking)
        if (id && pendingCoOrgs.length > 0) {
          await Promise.allSettled(
            pendingCoOrgs.map(c =>
              apiClient.post(`/tournaments/${id}/co-organizers`, { userId: c.userId, role: c.role })
            )
          );
        }
        navigate(id ? `/tournaments/${id}` : "/tournaments");
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ??
          err?.response?.data?.errors?.[0]?.message ??
          "Failed to create tournament. Please try again.";
        setSubmitError(msg);
      },
    });
  }

  // ── Step indicator ──────────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center justify-center gap-1 px-4 mb-6">
        {STEP_LABELS.map((label, i) => {
          const num    = i + 1;
          const active = num === step;
          const done   = num < step;
          return (
            <div key={label} className="flex items-center gap-1">
              <div className="flex flex-col items-center" style={{ minWidth: "42px" }}>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    backgroundColor: done ? "#22C55E" : active ? "#F59E0B" : "#1E293B",
                    border: `2px solid ${done ? "#22C55E" : active ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                    fontSize: "10px", fontWeight: "800", color: "#fff",
                  }}
                >
                  {done ? <Check style={{ width: "13px", height: "13px" }} /> : num}
                </div>
                <span style={{
                  fontSize: "9px", marginTop: "3px", fontWeight: active ? "700" : "500",
                  color: active ? "#F59E0B" : done ? "#22C55E" : "#475569",
                }}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{
                  height: "1.5px", width: "20px", marginBottom: "16px",
                  backgroundColor: done ? "#22C55E" : "rgba(255,255,255,0.07)",
                  transition: "background-color 0.3s",
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0F172A] pb-56">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Create Tournament</h1>
          <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Step {step} of {TOTAL_STEPS}</p>
        </div>
        <div
          className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.12)", fontSize: "18px" }}
        >
          🏆
        </div>
      </div>

      <StepIndicator />

      <div className="px-4 max-w-md mx-auto space-y-4">

        {/* ── Step 1: Info ─────────────────────────────────────────── */}
        {step === 1 && (
          <div style={CARD}>
            <p className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Tournament Info</p>
            <div className="space-y-5">

              <div>
                <FieldLabel>Tournament Name *</FieldLabel>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  style={BASE_INPUT} placeholder="e.g. Pune Summer Cup 2026"
                />
              </div>

              <div>
                <FieldLabel>Sport *</FieldLabel>
                <div className="grid grid-cols-4 gap-2">
                  {sportsList.map((s: any) => (
                    <div key={s.id ?? s.name} className="relative">
                      <button
                        onClick={() => setSport(s.displayName ?? s.name)}
                        className="w-full flex flex-col items-center gap-1 py-2.5 active:scale-95 transition-transform"
                        style={{
                          borderRadius: "10px",
                          backgroundColor: sport === (s.displayName ?? s.name) ? "rgba(245,158,11,0.15)" : "#0F172A",
                          border: `2px solid ${sport === (s.displayName ?? s.name) ? "#F59E0B" : "rgba(255,255,255,0.07)"}`,
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>{sportEmoji(s.name)}</span>
                        <span style={{ fontSize: "9px", fontWeight: "600", color: sport === (s.displayName ?? s.name) ? "#F59E0B" : "#64748B" }}>
                          {s.displayName ?? s.name}
                        </span>
                      </button>
                      {(s.rulebookTitle || (Array.isArray(s.rulebookLines) && s.rulebookLines.length > 0)) && (
                        <span className="absolute -top-1.5 -right-1.5 z-10">
                          <SportRulebook sport={s} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Description (optional)</FieldLabel>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  style={{ ...BASE_INPUT, resize: "none", minHeight: "72px" }}
                  placeholder="Brief description of the tournament…"
                />
              </div>

              {/* Co-organizers — optional */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
                <div className="flex items-center gap-2 mb-1">
                  <UserCog style={{ width: "14px", height: "14px", color: "#64748B" }} />
                  <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em" }}>
                    CO-ORGANIZERS
                  </span>
                  <span style={{ fontSize: "9px", color: "#475569", fontWeight: "600", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.15)" }}>
                    OPTIONAL
                  </span>
                </div>
                <p className="text-[#475569] mb-3" style={{ fontSize: "11px" }}>
                  Add people who'll help manage this tournament. You can always do this later.
                </p>

                {/* Pending list */}
                {pendingCoOrgs.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {pendingCoOrgs.map(c => (
                      <div key={c.userId} className="flex items-center gap-2 p-2.5"
                        style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "600" }}>{c.name || c.email}</p>
                          <p className="text-[#475569] truncate" style={{ fontSize: "10px" }}>{c.email}</p>
                        </div>
                        <span style={{
                          fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px", flexShrink: 0,
                          backgroundColor: c.role === "manager" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                          color: c.role === "manager" ? "#F59E0B" : "#3B82F6",
                          border: `1px solid ${c.role === "manager" ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}`,
                        }}>
                          {c.role === "manager" ? "Manager" : "Scorer"}
                        </span>
                        <button onClick={() => setPendingCoOrgs(prev => prev.filter(p => p.userId !== c.userId))}
                          className="active:scale-90 transition-transform flex-shrink-0">
                          <X style={{ width: "13px", height: "13px", color: "#475569" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <input
                  value={coOrgSearch}
                  onChange={e => setCoOrgSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  style={BASE_INPUT}
                />

                {/* Results */}
                {coOrgSearch.length >= 2 && (
                  <div className="mt-2 space-y-1.5">
                    {coOrgSearchResults
                      .filter((u: any) => !pendingCoOrgs.some(p => p.userId === u.id))
                      .slice(0, 4)
                      .map((u: any) => (
                        <div key={u.id} className="flex items-center gap-2 p-2.5"
                          style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "600" }}>{u.name ?? u.email}</p>
                            <p className="text-[#475569] truncate" style={{ fontSize: "10px" }}>{u.email}</p>
                          </div>
                          <button
                            onClick={() => { setPendingCoOrgs(prev => [...prev, { userId: u.id, name: u.name ?? "", email: u.email, role: "manager" }]); setCoOrgSearch(""); }}
                            className="px-2 py-1 active:scale-90 transition-transform flex-shrink-0"
                            style={{ borderRadius: "5px", fontSize: "10px", fontWeight: "700", backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
                          >
                            Manager
                          </button>
                          <button
                            onClick={() => { setPendingCoOrgs(prev => [...prev, { userId: u.id, name: u.name ?? "", email: u.email, role: "scorer" }]); setCoOrgSearch(""); }}
                            className="px-2 py-1 active:scale-90 transition-transform flex-shrink-0"
                            style={{ borderRadius: "5px", fontSize: "10px", fontWeight: "700", backgroundColor: "rgba(59,130,246,0.15)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.3)" }}
                          >
                            Scorer
                          </button>
                        </div>
                      ))}
                    {coOrgSearchResults.filter((u: any) => !pendingCoOrgs.some(p => p.userId === u.id)).length === 0 && (
                      <p className="text-[#475569]" style={{ fontSize: "11px" }}>No users found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Teams ────────────────────────────────────────── */}
        {step === 2 && (
          <div style={CARD}>
            <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Add Teams</p>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "12px" }}>
              Add your teams now so the format step can suggest the right structure.
              {teams.length > 0 ? ` ${teams.length} team${teams.length !== 1 ? "s" : ""} added${maxTeams ? ` · max ${maxTeams}` : ""}.` : ""}
            </p>

            <div className="mb-4">
              <FieldLabel>Max Teams</FieldLabel>
              <input
                type="number" min={2}
                value={maxTeams}
                onChange={e => setMaxTeams(e.target.value ? parseInt(e.target.value) : "")}
                style={BASE_INPUT}
                placeholder="e.g. 8, 16, 32"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && addTeam()}
                style={{ ...BASE_INPUT, flex: 1 }}
                placeholder="Team name"
              />
              <button
                onClick={addTeam}
                className="flex items-center justify-center active:scale-90 transition-transform"
                style={{ width: "46px", height: "46px", borderRadius: "10px", backgroundColor: "#F59E0B", flexShrink: 0 }}
              >
                <Plus style={{ width: "20px", height: "20px", color: "#000" }} />
              </button>
            </div>

            {teams.length > 0 ? (
              <div className="space-y-2">
                {teams.map((t, i) => (
                  <div
                    key={t}
                    className="flex items-center justify-between p-3"
                    style={{ borderRadius: "10px", backgroundColor: "#0F172A" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(245,158,11,0.15)", fontSize: "10px", fontWeight: "800", color: "#F59E0B" }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{t}</span>
                    </div>
                    <button onClick={() => removeTeam(i)} className="active:scale-90 transition-transform">
                      <X style={{ width: "16px", height: "16px", color: "#EF4444" }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="text-center py-8"
                style={{ borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.08)" }}
              >
                <Users style={{ width: "28px", height: "28px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#475569]" style={{ fontSize: "13px", fontWeight: "600" }}>No teams added yet</p>
                <p className="text-[#334155]" style={{ fontSize: "11px", marginTop: "3px" }}>
                  You can also add teams later from the tournament page
                </p>
              </div>
            )}

            {/* Hint nudging user to continue so format can be auto-suggested */}
            {teams.length >= 2 && (
              <div
                className="mt-4 p-3 flex items-center gap-2"
                style={{ borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <Check style={{ width: "14px", height: "14px", color: "#22C55E", flexShrink: 0 }} />
                <p style={{ fontSize: "11px", color: "#22C55E", fontWeight: "600" }}>
                  {teams.length} teams ready — continue to auto-configure the format
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Format & Structure ───────────────────────────── */}
        {step === 3 && (
          <>
            {/* Toggle: single vs multi-stage */}
            <div style={CARD}>
              <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Tournament Structure</p>
              <p className="text-[#64748B] mb-4" style={{ fontSize: "12px" }}>Choose how matches are organised</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: "Single Format", sub: "One format for all matches",  val: false, emoji: "🎯" },
                  { label: "Multi-Stage",   sub: "Groups → Knockout → Final",   val: true,  emoji: "🏆" },
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => {
                      setIsMultiStage(opt.val);
                      // When switching to multi-stage, auto-fill groupCount based on current team count
                      if (opt.val && teams.length >= 2) {
                        const suggested = suggestGroupCount(teams.length);
                        setStages(prev => prev.map((s, i) =>
                          i === 0 ? { ...s, groupCount: suggested, advancePerGroup: s.advancePerGroup ?? 2 } : s
                        ));
                      }
                    }}
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

              {/* Single format picker */}
              {!isMultiStage && (
                <div className="space-y-2">
                  <FieldLabel>Format</FieldLabel>
                  {SIMPLE_FORMATS.map(fmt => (
                    <button
                      key={fmt.value} onClick={() => setSimpleFormat(fmt.value)}
                      className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition-transform"
                      style={{
                        borderRadius: "10px",
                        backgroundColor: simpleFormat === fmt.value ? "rgba(59,130,246,0.1)" : "#0F172A",
                        border: `2px solid ${simpleFormat === fmt.value ? "#3B82F6" : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>{fmt.emoji}</span>
                      <div className="flex-1">
                        <p style={{ fontSize: "13px", fontWeight: "700", color: simpleFormat === fmt.value ? "#3B82F6" : "#fff" }}>
                          {fmt.label}
                        </p>
                        <p style={{ fontSize: "11px", color: "#64748B", marginTop: "1px" }}>{fmt.sub}</p>
                      </div>
                      {simpleFormat === fmt.value && (
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#3B82F6" }}
                        >
                          <Check style={{ width: "12px", height: "12px", color: "#fff" }} />
                        </div>
                      )}
                    </button>
                  ))}

                  {/* Best Of */}
                  <div className="mt-3">
                    <FieldLabel>Best Of (optional)</FieldLabel>
                    <div className="flex gap-2">
                      {[1, 3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setSimpleBestOf(simpleBestOf === n ? undefined : n)}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                            backgroundColor: simpleBestOf === n ? "rgba(245,158,11,0.15)" : "transparent",
                            border: `1.5px solid ${simpleBestOf === n ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                            color: simpleBestOf === n ? "#F59E0B" : "#475569",
                          }}
                        >
                          Bo{n}
                        </button>
                      ))}
                    </div>
                    {simpleBestOf && (
                      <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
                        First to win {Math.ceil(simpleBestOf / 2)} game{simpleBestOf > 1 ? "s" : ""} wins the tie
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
                          onClick={() => setSimpleScoringSystem(simpleScoringSystem === sys ? undefined : sys)}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                            backgroundColor: simpleScoringSystem === sys ? "rgba(59,130,246,0.15)" : "transparent",
                            border: `1.5px solid ${simpleScoringSystem === sys ? "#3B82F6" : "rgba(255,255,255,0.1)"}`,
                            color: simpleScoringSystem === sys ? "#3B82F6" : "#475569",
                          }}
                        >
                          {sys === "rally" ? "Rally Point" : "Service Point"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Singles / Doubles — pickleball only, simple format */}
                  {sport.toLowerCase() === "pickleball" && (
                    <div className="mt-3">
                      <FieldLabel>Format (optional)</FieldLabel>
                      <div className="flex gap-2">
                        {([{ label: "Singles", v: 1 }, { label: "Doubles", v: 2 }] as const).map(({ label, v }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSimplePlayersPerTeam(simplePlayersPerTeam === v ? undefined : v)}
                            style={{
                              flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                              backgroundColor: simplePlayersPerTeam === v ? "rgba(245,158,11,0.15)" : "transparent",
                              border: `1.5px solid ${simplePlayersPerTeam === v ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                              color: simplePlayersPerTeam === v ? "#F59E0B" : "#475569",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Score */}
                  <div className="mt-3">
                    <FieldLabel>Target Score (optional)</FieldLabel>
                    <div className="flex gap-2">
                      {[11, 15, 21, 25].map(n => (
                        <button
                          key={n}
                          onClick={() => setSimpleTargetScore(simpleTargetScore === n ? undefined : n)}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                            backgroundColor: simpleTargetScore === n ? "rgba(34,197,94,0.15)" : "transparent",
                            border: `1.5px solid ${simpleTargetScore === n ? "#22C55E" : "rgba(255,255,255,0.1)"}`,
                            color: simpleTargetScore === n ? "#22C55E" : "#475569",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {simpleTargetScore && (
                      <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>Race to {simpleTargetScore}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Multi-stage builder */}
            {isMultiStage && (
              <div style={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Stages</p>
                    <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Define each phase of the tournament</p>
                  </div>
                  <button
                    onClick={addStage}
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    style={{ borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
                  >
                    <Plus style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                    <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: "600" }}>Add Stage</span>
                  </button>
                </div>

                {/* ── Live team-count context pill ── */}
                {(() => {
                  const stage1 = stages[0];
                  const gc  = stage1?.groupCount  ?? 0;
                  const apg = stage1?.advancePerGroup ?? 0;
                  const n   = teams.length;
                  const teamsPerGroup = gc > 0 ? Math.ceil(n / gc) : 0;
                  const advancing    = gc > 0 && apg > 0 ? gc * apg : 0;
                  if (n < 2 || gc < 1) return null;
                  return (
                    <div
                      className="mb-4 px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1"
                      style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}
                    >
                      <span style={{ fontSize: "11px", color: "#3B82F6", fontWeight: "700" }}>👥 {n} teams</span>
                      <ChevronRight style={{ width: "12px", height: "12px", color: "#475569" }} />
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                        {gc} group{gc !== 1 ? "s" : ""} of ~{teamsPerGroup}
                      </span>
                      {apg > 0 && (
                        <>
                          <ChevronRight style={{ width: "12px", height: "12px", color: "#475569" }} />
                          <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                            top {apg} advance = <span style={{ color: "#F59E0B", fontWeight: "700" }}>{advancing}-team knockout</span>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}

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

                      {/* Format pills */}
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

                      {/* Round Robin / League options */}
                      {(stage.format === "round_robin" || stage.format === "league") && (
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

                      {/* Best Of option — applies to all stage formats */}
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

                      {/* Singles / Doubles — only for pickleball */}
                      {sport.toLowerCase() === "pickleball" && (
                        <div className="mt-3">
                          <FieldLabel>Format (optional)</FieldLabel>
                          <div className="flex gap-2">
                            {([{ label: "Singles", v: 1 }, { label: "Doubles", v: 2 }] as const).map(({ label, v }) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => updateStage(idx, { playersPerTeam: stage.playersPerTeam === v ? undefined : v })}
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                                  backgroundColor: stage.playersPerTeam === v ? "rgba(245,158,11,0.15)" : "transparent",
                                  border: `1.5px solid ${stage.playersPerTeam === v ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                                  color: stage.playersPerTeam === v ? "#F59E0B" : "#475569",
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

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

                {/* Stage flow summary */}
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
              </div>
            )}
          </>
        )}

        {/* ── Step 4: Schedule & Review ────────────────────────────── */}
        {step === 4 && (
          <>
            <div style={CARD}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar style={{ width: "18px", height: "18px", color: "#F59E0B" }} />
                <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Schedule</p>
              </div>
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
                      No venues registered yet — you can assign one after creating a venue.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sponsors */}
            <div style={CARD}>
              <div className="flex items-center gap-2 mb-4">
                <Star style={{ width: "18px", height: "18px", color: "#F59E0B" }} />
                <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Sponsors <span style={{ fontSize: "11px", color: "#475569", fontWeight: "500" }}>(optional)</span></p>
              </div>

              {sponsors.length > 0 && (
                <div className="mb-3 space-y-2">
                  {sponsors.map((sp, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5"
                      style={{ borderRadius: "10px", backgroundColor: "#0F172A" }}>
                      <Star style={{ width: "13px", height: "13px", color: "#F59E0B", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate" style={{ fontSize: "13px", fontWeight: "600" }}>{sp.name}</p>
                        <p className="text-[#475569]" style={{ fontSize: "10px" }}>{sp.tier}</p>
                      </div>
                      <button onClick={() => setSponsors(prev => prev.filter((_, idx) => idx !== i))} className="active:scale-90 transition-transform">
                        <X style={{ width: "14px", height: "14px", color: "#EF4444" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2.5">
                <input
                  value={sponsorName}
                  onChange={e => setSponsorName(e.target.value)}
                  placeholder="Sponsor name"
                  style={BASE_INPUT}
                />
                <input
                  value={sponsorLogo}
                  onChange={e => setSponsorLogo(e.target.value)}
                  placeholder="Logo URL (optional)"
                  style={BASE_INPUT}
                />
                <select
                  value={sponsorTier}
                  onChange={e => setSponsorTier(e.target.value)}
                  style={BASE_SELECT}
                >
                  <option value="main">Main Sponsor</option>
                  <option value="co">Co-Sponsor</option>
                  <option value="associate">Associate Sponsor</option>
                </select>
                <button
                  onClick={() => {
                    if (!sponsorName.trim()) return;
                    setSponsors(prev => [...prev, { name: sponsorName.trim(), logoUrl: sponsorLogo.trim(), tier: sponsorTier }]);
                    setSponsorName(""); setSponsorLogo(""); setSponsorTier("main");
                  }}
                  disabled={!sponsorName.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 active:scale-95 transition-transform"
                  style={{
                    borderRadius: "10px",
                    backgroundColor: sponsorName.trim() ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.08)",
                    border: `1px solid ${sponsorName.trim() ? "rgba(245,158,11,0.3)" : "rgba(100,116,139,0.2)"}`,
                  }}
                >
                  <Plus style={{ width: "14px", height: "14px", color: sponsorName.trim() ? "#F59E0B" : "#475569" }} />
                  <span style={{ fontSize: "13px", fontWeight: "600", color: sponsorName.trim() ? "#F59E0B" : "#475569" }}>Add Sponsor</span>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div style={CARD}>
              <div className="flex items-center gap-2 mb-4">
                <Layers style={{ width: "18px", height: "18px", color: "#F59E0B" }} />
                <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Summary</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Name",      value: name,  icon: "🏆" },
                  { label: "Sport",     value: sport, icon: "🎯" },
                  {
                    label: "Structure",
                    value: isMultiStage
                      ? stages.map(s => s.name).join(" → ")
                      : SIMPLE_FORMATS.find(f => f.value === simpleFormat)?.label ?? simpleFormat,
                    icon: "📋",
                  },
                  { label: "Teams",    value: teams.length > 0 ? `${teams.length} teams added` : "To be added later", icon: "👥" },
                  { label: "Max Teams", value: maxTeams ? String(maxTeams) : "No limit", icon: "🔢" },
                  {
                    label: "Dates",
                    value: startDate && endDate ? `${startDate} → ${endDate}` : startDate || "Not set",
                    icon: "📅",
                  },
                  {
                    label: "Sponsors",
                    value: sponsors.length > 0 ? sponsors.map(s => s.name).join(", ") : "None",
                    icon: "⭐",
                  },
                  {
                    label: "Co-organizers",
                    value: pendingCoOrgs.length > 0
                      ? pendingCoOrgs.map(c => `${c.name || c.email} (${c.role})`).join(", ")
                      : "None",
                    icon: "🤝",
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "14px" }}>{item.icon}</span>
                      <span style={{ fontSize: "13px", color: "#64748B" }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: "13px", color: "#E2E8F0", fontWeight: "600", textAlign: "right", maxWidth: "60%" }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {submitError && (
              <p className="text-[#EF4444] text-center" style={{ fontSize: "13px" }}>{submitError}</p>
            )}
          </>
        )}
      </div>

      {/* Sticky CTA — sits above the bottom nav (z-40); use bottom-[96px] to clear it */}
      <div
        className="fixed left-0 right-0 z-50 px-4 pt-3 pb-3 max-w-md mx-auto"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
          background: "linear-gradient(to top,#0F172A 60%,transparent)",
        }}
      >
        <button
          onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleSubmit}
          disabled={!canProceed() || createTournament.isPending}
          className="w-full flex items-center justify-center gap-2 py-4 active:scale-[0.98] transition-transform"
          style={{
            borderRadius: "14px", fontSize: "16px", fontWeight: "700",
            color: !canProceed() ? "#475569" : "#fff",
            background: !canProceed() || createTournament.isPending
              ? "#1E293B"
              : "linear-gradient(135deg,#F59E0B,#D97706)",
            boxShadow: canProceed() && !createTournament.isPending
              ? "0 4px 24px rgba(245,158,11,0.35)"
              : "none",
          }}
        >
          {createTournament.isPending
            ? "Creating…"
            : step < TOTAL_STEPS
              ? (<>Continue <ChevronRight style={{ width: "20px", height: "20px" }} /></>)
              : (<>Create Tournament <Trophy style={{ width: "20px", height: "20px" }} /></>)
          }
        </button>
      </div>
    </div>
  );
}
