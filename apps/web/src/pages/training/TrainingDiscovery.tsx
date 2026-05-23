/**
 * Training Discovery — Commitment Layer
 *
 * Key insight: "Training is commitment-based, not instant like booking"
 * → Focus on trust (coach profile, ratings) + structure (schedule clarity)
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, MapPin, Star, Users, Clock, ChevronRight,
  Dumbbell, X, SlidersHorizontal,
} from "lucide-react";
import { useTrainingDiscovery, useSports } from "@sportza/api-client";
import { useRole } from "../../context/RoleContext";
import { SportRulebook } from "../../components/SportRulebook";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScheduleObject = { weekdays?: string | string[]; days?: string | string[]; startTime?: string; endTime?: string };

type Batch = {
  id: number;
  name?: string;
  sport?: string;
  skillLevel?: string;
  timing?: string;
  trainer?: { id?: number; name?: string; rating?: number };
  trainerRating?: number;
  memberCount?: number;
  maxStudents?: number;
  venue?: { location?: { city?: string | null } | null; name?: string };
  sessions?: unknown[];
  sportFees?: Record<string, number>;
  schedule?: string | ScheduleObject;
  daysPerWeek?: number;
  sessionDuration?: number;
};

function formatSchedule(schedule: string | ScheduleObject | undefined, fallback?: string): string {
  if (!schedule) return fallback ?? "";
  if (typeof schedule === "string") return schedule;
  const rawDays = schedule.weekdays ?? schedule.days;
  const days = Array.isArray(rawDays)
    ? rawDays.join(", ")
    : String(rawDays ?? "");
  const time =
    schedule.startTime && schedule.endTime
      ? `${schedule.startTime} – ${schedule.endTime}`
      : schedule.startTime ?? schedule.endTime ?? "";
  return [days, time].filter(Boolean).join(" · ") || (fallback ?? "Scheduled");
}

type LevelFilter  = "all" | "beginner" | "intermediate" | "advanced";
type TimingFilter = "all" | "morning" | "evening" | "weekend";

// ─── Emoji map ────────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", swimming: "🏊",
  pickleball: "🏓",
};
function sportEmoji(name: string) { return SPORT_EMOJI[name?.toLowerCase()] ?? "🏋️"; }

// ─── Level colors ─────────────────────────────────────────────────────────────
const LEVEL_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  beginner:     { color: "#22C55E", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  intermediate: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  advanced:     { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
};
function levelStyle(l?: string) {
  return LEVEL_STYLE[l?.toLowerCase() ?? ""] ?? { color: "#94A3B8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BatchSkeleton() {
  return (
    <div className="animate-pulse p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
      <div className="flex gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#111827]" />
        <div className="flex-1">
          <div className="h-5 w-2/3 rounded-lg bg-[#111827] mb-2" />
          <div className="h-4 w-1/3 rounded-lg bg-[#111827]" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded-lg bg-[#111827]" />
        <div className="h-4 w-3/4 rounded-lg bg-[#111827]" />
      </div>
      <div className="h-11 rounded-xl bg-[#111827] mt-4" />
    </div>
  );
}

// ─── Batch card ───────────────────────────────────────────────────────────────
function BatchCard({ batch }: { batch: Batch }) {
  const navigate = useNavigate();
  const fees  = batch.sportFees ?? {};
  const price = (() => {
    const raw = Object.values(fees)[0];
    if (typeof raw === "number") return raw;
    if (typeof raw === "object" && raw !== null) {
      const inner = Object.values(raw as Record<string, unknown>).find((v) => typeof v === "number");
      return (inner as number) ?? null;
    }
    return null;
  })();
  const seats    = batch.maxStudents != null && batch.memberCount != null
    ? batch.maxStudents - batch.memberCount
    : null;
  const rating   = batch.trainerRating ?? batch.trainer?.rating;
  const lvl      = levelStyle(batch.skillLevel);
  const sessions = Array.isArray(batch.sessions) ? batch.sessions.length : 0;

  return (
    <button
      onClick={() => navigate(`/training/${batch.id}`)}
      className="w-full text-left transition-all duration-200 active:scale-[0.98] p-4"
      style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-4">
        {/* Sport icon */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: "52px", height: "52px", borderRadius: "16px",
            backgroundColor: "#111827", fontSize: "24px",
          }}
        >
          {sportEmoji(batch.sport ?? "")}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white truncate" style={{ fontSize: "16px", fontWeight: "700" }}>
            {batch.name ?? `${batch.sport} Training`}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Star style={{ width: "12px", height: "12px", color: "#F59E0B", fill: "#F59E0B" }} />
            <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              {rating ? rating.toFixed(1) : "New"} ·{" "}
            </span>
            {batch.trainer?.id ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/trainers/${batch.trainer!.id}`); }}
                className="text-[#60A5FA]"
                style={{ fontSize: "13px", fontWeight: "600" }}
              >
                {batch.trainer.name ?? "Coach"}
              </button>
            ) : (
              <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                {batch.trainer?.name ?? "Coach"}
              </span>
            )}
          </div>
        </div>
        {/* Level badge */}
        {batch.skillLevel && (
          <div
            className="shrink-0 px-2.5 py-1"
            style={{ borderRadius: "999px", backgroundColor: lvl.bg, border: `1px solid ${lvl.border}` }}
          >
            <span style={{ fontSize: "11px", fontWeight: "700", color: lvl.color, textTransform: "capitalize" }}>
              {batch.skillLevel}
            </span>
          </div>
        )}
      </div>

      {/* Details row */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {batch.venue?.location?.city && (
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <MapPin style={{ width: "13px", height: "13px", flexShrink: 0 }} />
            <span className="truncate" style={{ fontSize: "13px" }}>{batch.venue.location.city}</span>
          </div>
        )}
        {(batch.schedule || batch.daysPerWeek) && (
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <Clock style={{ width: "13px", height: "13px", flexShrink: 0 }} />
            <span className="truncate" style={{ fontSize: "13px" }}>
              {formatSchedule(batch.schedule, batch.daysPerWeek ? `${batch.daysPerWeek}x / week` : undefined)}
            </span>
          </div>
        )}
        {sessions > 0 && (
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <Dumbbell style={{ width: "13px", height: "13px", flexShrink: 0 }} />
            <span style={{ fontSize: "13px" }}>{sessions} sessions</span>
          </div>
        )}
        {batch.memberCount != null && (
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <Users style={{ width: "13px", height: "13px", flexShrink: 0 }} />
            <span style={{ fontSize: "13px" }}>{batch.memberCount} enrolled</span>
          </div>
        )}
      </div>

      {/* Bottom: price + seats + CTA */}
      <div className="flex items-center justify-between">
        <div>
          {price ? (
            <>
              <span className="text-[#3B82F6]" style={{ fontSize: "20px", fontWeight: "800" }}>₹{price}</span>
              <span className="text-[#64748B]" style={{ fontSize: "12px" }}>/session</span>
            </>
          ) : (
            <span className="text-[#64748B]" style={{ fontSize: "14px" }}>Price on request</span>
          )}
          {seats != null && seats > 0 && (
            <p className="text-[#22C55E]" style={{ fontSize: "11px", fontWeight: "600", marginTop: "2px" }}>
              {seats} seat{seats !== 1 ? "s" : ""} available
            </p>
          )}
          {seats === 0 && (
            <p className="text-[#EF4444]" style={{ fontSize: "11px", fontWeight: "600", marginTop: "2px" }}>
              Batch full
            </p>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{
            borderRadius: "12px",
            background: "linear-gradient(135deg,#3B82F6,#6366F1)",
            fontSize: "14px",
            fontWeight: "700",
            color: "#FFFFFF",
          }}
        >
          View <ChevronRight style={{ width: "15px", height: "15px" }} />
        </div>
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TrainingDiscovery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeRole, availableRoles, switchRole } = useRole();
  const initialSportFilter = searchParams.get("sport") ?? "";
  const [sportFilter, setSportFilter]   = useState(initialSportFilter);
  const [levelFilter, setLevelFilter]   = useState<LevelFilter>("all");
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [searchText, setSearchText]     = useState("");
  const [showFilters, setShowFilters]   = useState(false);

  const { data: sportsRes } = useSports();
  const sports = ((sportsRes as any)?.data ?? (sportsRes as any) ?? []) as Array<{ name: string; displayName: string }>;

  const { data: discoveryRes, isLoading, isError } = useTrainingDiscovery({
    sport: sportFilter || undefined,
  });
  const allBatches: Batch[] = (discoveryRes as any)?.data ?? (discoveryRes as any) ?? [];

  // Client-side filters
  const filtered = useMemo(() => {
    let list = [...allBatches];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((b) =>
        (b.name ?? "").toLowerCase().includes(q) ||
        (b.trainer?.name ?? "").toLowerCase().includes(q) ||
        (b.venue?.location?.city ?? "").toLowerCase().includes(q)
      );
    }
    if (levelFilter !== "all") {
      list = list.filter((b) => b.skillLevel?.toLowerCase() === levelFilter);
    }
    if (timingFilter === "morning") {
      list = list.filter((b) => /morning|am|6|7|8|9/i.test(formatSchedule(b.schedule, b.timing)));
    }
    if (timingFilter === "evening") {
      list = list.filter((b) => /evening|pm|5|6|7/i.test(formatSchedule(b.schedule, b.timing)));
    }
    if (timingFilter === "weekend") {
      list = list.filter((b) => /sat|sun|weekend/i.test(formatSchedule(b.schedule, b.timing)));
    }
    return list;
  }, [allBatches, searchText, levelFilter, timingFilter]);

  const hasFilters = !!sportFilter || levelFilter !== "all" || timingFilter !== "all" || !!searchText;

  const LEVELS: { key: LevelFilter; label: string }[] = [
    { key: "all",          label: "All Levels" },
    { key: "beginner",     label: "Beginner"   },
    { key: "intermediate", label: "Intermediate"},
    { key: "advanced",     label: "Advanced"   },
  ];
  const TIMINGS: { key: TimingFilter; label: string }[] = [
    { key: "all",     label: "Any Time" },
    { key: "morning", label: "Morning"  },
    { key: "evening", label: "Evening"  },
    { key: "weekend", label: "Weekend"  },
  ];

  useEffect(() => {
    const sportFromQuery = searchParams.get("sport") ?? "";
    if (sportFromQuery !== sportFilter) {
      setSportFilter(sportFromQuery);
    }
  }, [searchParams, sportFilter]);

  const updateSportFilter = (nextSport: string) => {
    setSportFilter(nextSport);
    const nextParams = new URLSearchParams(searchParams);
    if (nextSport) {
      nextParams.set("sport", nextSport);
    } else {
      nextParams.delete("sport");
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#0F172A]">
        {/* Title */}
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <div>
            <h1 className="text-white" style={{ fontSize: "28px", fontWeight: "700" }}>Training</h1>
            <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              {allBatches.length > 0 ? `${allBatches.length} batches available` : "Find your coach"}
            </p>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderRadius: "12px",
              backgroundColor: showFilters ? "#3B82F6" : "#1E293B",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "13px",
              fontWeight: "600",
              color: showFilters ? "#FFFFFF" : "#94A3B8",
            }}
          >
            <SlidersHorizontal style={{ width: "14px", height: "14px" }} />
            Filters
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-3">
          <div
            className="flex items-center gap-3 px-4"
            style={{ height: "48px", borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Search style={{ width: "18px", height: "18px", color: "#64748B", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by sport, coach, city..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 bg-transparent outline-none text-white placeholder-[#64748B]"
              style={{ fontSize: "15px" }}
            />
            {searchText && (
              <button onClick={() => setSearchText("")}>
                <X style={{ width: "16px", height: "16px", color: "#64748B" }} />
              </button>
            )}
          </div>
        </div>

        {/* Sport pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => updateSportFilter("")}
            className="shrink-0 px-4 py-2"
            style={{ borderRadius: "999px", fontSize: "13px", fontWeight: "600",
              backgroundColor: !sportFilter ? "#3B82F6" : "#1E293B",
              color: !sportFilter ? "#FFFFFF" : "#94A3B8" }}
          >
            All
          </button>
          {sports.map((s: any) => (
            <div key={s.name} className="relative shrink-0 flex items-center">
              <button
                onClick={() => updateSportFilter(sportFilter === s.name ? "" : s.name)}
                className="px-4 py-2 whitespace-nowrap"
                style={{ borderRadius: "999px", fontSize: "13px", fontWeight: "600",
                  backgroundColor: sportFilter === s.name ? "#3B82F6" : "#1E293B",
                  color: sportFilter === s.name ? "#FFFFFF" : "#94A3B8" }}
              >
                {sportEmoji(s.name)} {s.displayName}
              </button>
              <span className="absolute -top-1.5 -right-1.5 z-10">
                <SportRulebook sport={s} />
              </span>
            </div>
          ))}
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div className="px-4 pb-4 space-y-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {/* Level */}
            <div>
              <p className="text-[#64748B] mb-2" style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>Skill Level</p>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setLevelFilter(l.key)}
                    className="px-3 py-1.5"
                    style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                      backgroundColor: levelFilter === l.key ? "#3B82F6" : "#111827",
                      color: levelFilter === l.key ? "#FFFFFF" : "#64748B" }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Timing */}
            <div>
              <p className="text-[#64748B] mb-2" style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>Timing</p>
              <div className="flex gap-2 flex-wrap">
                {TIMINGS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTimingFilter(t.key)}
                    className="px-3 py-1.5"
                    style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                      backgroundColor: timingFilter === t.key ? "#3B82F6" : "#111827",
                      color: timingFilter === t.key ? "#FFFFFF" : "#64748B" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-3">
        {/* Contextual prompt for players who can become coaches */}
        {activeRole === "player" && availableRoles.includes("coach") && (
          <div className="flex items-center gap-3 p-3 mb-4"
            style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <Dumbbell style={{ width: "15px", height: "15px", color: "#22C55E", flexShrink: 0 }} />
            <p className="flex-1 text-[#94A3B8]" style={{ fontSize: "12px" }}>
              Want to <span style={{ color: "#22C55E", fontWeight: "700" }}>coach students</span>? Switch to Coach mode to create batches.
            </p>
            <button onClick={() => { switchRole("coach"); navigate("/trainer"); }}
              className="flex items-center gap-0.5 flex-shrink-0"
              style={{ fontSize: "12px", fontWeight: "700", color: "#22C55E" }}>
              Switch <ChevronRight style={{ width: "12px", height: "12px" }} />
            </button>
          </div>
        )}

        {/* Filter chip */}
        {hasFilters && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Filters active</span>
            <button
              onClick={() => { updateSportFilter(""); setLevelFilter("all"); setTimingFilter("all"); setSearchText(""); }}
              className="flex items-center gap-1 px-3 py-1"
              style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.15)", fontSize: "12px", color: "#EF4444", fontWeight: "600" }}
            >
              <X style={{ width: "12px", height: "12px" }} /> Clear
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <BatchSkeleton key={i} />)}
          </div>
        )}

        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>Failed to load training batches</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 text-white"
              style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <span className="text-5xl block mb-3">🔍</span>
            <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "600" }}>No batches found</h2>
            <p className="text-[#94A3B8] mb-6" style={{ fontSize: "14px" }}>
              {hasFilters ? "Try adjusting your filters." : "No training batches available yet."}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSportFilter(""); setLevelFilter("all"); setTimingFilter("all"); setSearchText(""); }}
                className="px-6 py-2 text-white"
                style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((b) => <BatchCard key={b.id} batch={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}
