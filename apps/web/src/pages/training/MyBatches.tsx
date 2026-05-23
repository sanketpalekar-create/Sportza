/**
 * My Batches — Player Retention Layer
 *
 * Key insight: "Users return for consistency"
 * → Show: active batches, next session time, attendance progress
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight, Dumbbell, Calendar, Clock, MapPin, Star, Users, AlertCircle } from "lucide-react";
import { useMyBatches } from "@sportza/api-client";
import { format, parseISO, isAfter } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScheduleObject = { days?: string | string[]; startTime?: string; endTime?: string };

type Batch = {
  id: number;
  name?: string;
  sport?: string;
  skillLevel?: string;
  schedule?: string | ScheduleObject;
  daysPerWeek?: number;
  startDate?: string;
  endDate?: string;
  memberCount?: number;
  maxStudents?: number;
  attendedSessions?: number;
  totalSessions?: number;
  nextSession?: string;
  trainerRating?: number;
  trainer?: { id?: number; name?: string };
  venue?: { name?: string; location?: { city?: string | null } | null };
  sportFees?: Record<string, number>;
  status?: string;
};

// ─── Schedule formatter ───────────────────────────────────────────────────────
function formatSchedule(schedule: string | ScheduleObject | undefined): string {
  if (!schedule) return "Schedule TBD";
  if (typeof schedule === "string") return schedule;
  const days = Array.isArray(schedule.days)
    ? schedule.days.join(", ")
    : (schedule.days ?? "");
  const time =
    schedule.startTime && schedule.endTime
      ? `${schedule.startTime} – ${schedule.endTime}`
      : schedule.startTime ?? schedule.endTime ?? "";
  return [days, time].filter(Boolean).join(" · ") || "Schedule TBD";
}

// ─── Emoji + colors ───────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};
const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#EF4444",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BatchSkeleton() {
  return (
    <div className="animate-pulse p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
      <div className="flex gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#111827]" />
        <div className="flex-1">
          <div className="h-5 w-2/3 rounded bg-[#111827] mb-2" />
          <div className="h-4 w-1/2 rounded bg-[#111827]" />
        </div>
      </div>
      <div className="h-3 rounded-full bg-[#111827] mb-4" />
      <div className="h-12 rounded-xl bg-[#111827]" />
    </div>
  );
}

// ─── Batch card ───────────────────────────────────────────────────────────────
function BatchCard({ batch }: { batch: Batch }) {
  const navigate = useNavigate();
  const attended = batch.attendedSessions ?? 0;
  const total    = batch.totalSessions ?? 0;
  const pct      = total > 0 ? Math.round((attended / total) * 100) : 0;
  const lvlColor = LEVEL_COLOR[batch.skillLevel?.toLowerCase() ?? ""] ?? "#94A3B8";
  const isActive = !batch.status || batch.status === "active" || batch.status === "ongoing";

  let nextLabel = "Schedule TBD";
  if (batch.nextSession) {
    try {
      const d = parseISO(batch.nextSession);
      nextLabel = isAfter(d, new Date())
        ? `Next: ${format(d, "EEE, MMM d · h:mm a")}`
        : `Last: ${format(d, "MMM d")}`;
    } catch { /* ignore */ }
  } else if (batch.schedule) {
    nextLabel = formatSchedule(batch.schedule);
  }

  return (
    <button
      onClick={() => navigate(`/training/${batch.id}`)}
      className="w-full text-left transition-all active:scale-[0.98] p-4"
      style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: "50px", height: "50px", borderRadius: "16px", backgroundColor: "#111827", fontSize: "22px" }}
        >
          {SPORT_EMOJI[batch.sport?.toLowerCase() ?? ""] ?? "🏋️"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white truncate" style={{ fontSize: "16px", fontWeight: "700" }}>
            {batch.name ?? `${batch.sport} Training`}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              {batch.trainer?.name ?? "Coach"}
            </span>
            {batch.skillLevel && (
              <span style={{ fontSize: "11px", fontWeight: "700", color: lvlColor, textTransform: "capitalize" }}>
                · {batch.skillLevel}
              </span>
            )}
          </div>
        </div>
        <div
          className="shrink-0 px-2 py-1"
          style={{
            borderRadius: "999px",
            backgroundColor: isActive ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.1)",
            border: `1px solid ${isActive ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.2)"}`,
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: "700", color: isActive ? "#22C55E" : "#94A3B8" }}>
            {isActive ? "ACTIVE" : (batch.status ?? "ACTIVE").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Attendance progress */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between mb-1.5">
            <span className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "600" }}>
              ATTENDANCE
            </span>
            <span className="text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: "600" }}>
              {attended}/{total} sessions · {pct}%
            </span>
          </div>
          <div style={{ height: "5px", borderRadius: "999px", backgroundColor: "#111827", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: "999px",
                background: pct >= 80 ? "linear-gradient(90deg,#22C55E,#16A34A)" : "linear-gradient(90deg,#3B82F6,#6366F1)",
                transition: "width 0.6s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Next session + venue */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderRadius: "12px", backgroundColor: "#111827" }}
      >
        <div className="flex items-center gap-2 text-[#94A3B8]">
          <Clock style={{ width: "14px", height: "14px", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", fontWeight: "500" }}>{nextLabel}</span>
        </div>
        <ChevronRight style={{ width: "16px", height: "16px", color: "#475569" }} />
      </div>

      {batch.venue?.location?.city && (
        <div className="flex items-center gap-1.5 mt-2 text-[#64748B]">
          <MapPin style={{ width: "12px", height: "12px" }} />
          <span style={{ fontSize: "12px" }}>{batch.venue.location.city}</span>
        </div>
      )}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MyBatches() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyBatches();

  // API returns membership rows: { id, status, batch: { id, name, sport, trainer, venue, ... } }
  const memberships: any[] = (data as any)?.data ?? (data as any) ?? [];
  const allBatches: Batch[] = memberships.map((m: any) => ({
    ...(m.batch ?? m),
    status: m.status,           // membership status (active / pending / left)
    membershipId: m.id,
  }));

  const active = allBatches.filter((b) => b.status === "active" || b.status === "ongoing");
  const pending = allBatches.filter((b) => b.status === "pending");
  const past   = allBatches.filter((b) => b.status === "completed" || b.status === "ended" || b.status === "left");

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* ── Header ── */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-white mb-1" style={{ fontSize: "28px", fontWeight: "700" }}>My Training</h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Track your enrolled batches</p>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Summary chips ── */}
        {!isLoading && allBatches.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Active",   value: active.length,    color: "#22C55E" },
              { label: "Pending",  value: pending.length,   color: "#F59E0B" },
              { label: "Total",    value: allBatches.length, color: "#3B82F6" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-3"
                style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <span style={{ fontSize: "22px", fontWeight: "800", color: s.color }}>{s.value}</span>
                <span className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "500" }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <BatchSkeleton key={i} />)}
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <AlertCircle style={{ width: "40px", height: "40px", color: "#64748B", margin: "0 auto 12px" }} />
            <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>Failed to load batches</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 text-white"
              style={{ borderRadius: "12px", backgroundColor: "#3B82F6", fontSize: "14px", fontWeight: "600" }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && !isError && allBatches.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Dumbbell style={{ width: "48px", height: "48px", color: "#64748B", margin: "0 auto 16px" }} />
            <h2 className="text-white mb-2" style={{ fontSize: "20px", fontWeight: "700" }}>No batches yet</h2>
            <p className="text-[#94A3B8] mb-6" style={{ fontSize: "14px" }}>
              Enroll in a training batch to start tracking your progress
            </p>
            <button
              onClick={() => navigate("/training")}
              className="px-8 py-3.5 text-white"
              style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "16px", fontWeight: "700" }}
            >
              Find Training
            </button>
          </div>
        )}

        {/* ── Pending requests ── */}
        {pending.length > 0 && (
          <div>
            <p className="text-[#64748B] mb-3" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Awaiting Approval
            </p>
            <div className="space-y-4">
              {pending.map((b) => (
                <div key={b.id} style={{ position: "relative" }}>
                  <BatchCard batch={b} />
                  <div
                    className="flex items-center gap-2 px-3 py-2 mt-1"
                    style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    <Clock style={{ width: "13px", height: "13px", color: "#F59E0B", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: "600" }}>
                      Join request sent — waiting for coach approval
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Active batches ── */}
        {active.length > 0 && (
          <div>
            <p className="text-[#64748B] mb-3" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Active Batches
            </p>
            <div className="space-y-4">
              {active.map((b) => <BatchCard key={b.id} batch={b} />)}
            </div>
          </div>
        )}

        {/* ── Past batches ── */}
        {past.length > 0 && (
          <div>
            <p className="text-[#64748B] mb-3 mt-6" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Completed
            </p>
            <div className="space-y-4" style={{ opacity: 0.7 }}>
              {past.map((b) => <BatchCard key={b.id} batch={b} />)}
            </div>
          </div>
        )}

        {/* ── Discover more ── */}
        {!isLoading && (
          <button
            onClick={() => navigate("/training")}
            className="w-full flex items-center justify-center gap-2 py-4 text-[#3B82F6]"
            style={{
              borderRadius: "16px",
              backgroundColor: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            <Dumbbell style={{ width: "17px", height: "17px" }} />
            Discover More Training
          </button>
        )}
      </div>
    </div>
  );
}
