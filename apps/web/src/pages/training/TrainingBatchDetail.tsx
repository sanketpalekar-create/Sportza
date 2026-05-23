/**
 * Training Batch Detail — Trust + Structure Layer
 *
 * Key insight: "Training is commitment-based"
 * → Show: coach credibility, clear schedule, what's included, seat urgency
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Star, MapPin, Calendar, Clock, Users,
  CheckCircle2, Dumbbell, ChevronRight, AlertCircle, Zap,
} from "lucide-react";
import { useBatch, useJoinBatch, useCurrentUser, useRateBatch } from "@sportza/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type Session = { day?: string; time?: string; duration?: number };
type Batch = {
  id: number;
  name?: string;
  sport?: string;
  skillLevel?: string;
  description?: string;
  schedule?: string;
  daysPerWeek?: number;
  sessionDuration?: number;
  startDate?: string;
  endDate?: string;
  memberCount?: number;
  maxStudents?: number;
  sportFees?: Record<string, number>;
  trainer?: { id?: number; name?: string; rating?: number; bio?: string; experience?: number };
  trainerRating?: number;
  venue?: { name?: string; location?: { city?: string | null; address?: string | null } | null };
  sessions?: Session[];
  facilities?: string[];
  includes?: string[];
};

// ─── Emojis ───────────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};
function sportEmoji(name: string) { return SPORT_EMOJI[name?.toLowerCase()] ?? "🏋️"; }

const LEVEL_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  beginner:     { color: "#22C55E", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  intermediate: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  advanced:     { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
};

const DEFAULT_INCLUDES = [
  "Professional coaching", "Skill assessment", "Progress tracking",
  "Group sessions", "Training equipment access",
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse px-4 pt-4 space-y-4">
      <div className="h-40 rounded-2xl bg-[#1E293B]" />
      <div className="h-32 rounded-2xl bg-[#1E293B]" />
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
    </div>
  );
}

// ─── Info chip ────────────────────────────────────────────────────────────────
function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderRadius: "12px", backgroundColor: "#111827" }}>
      <span className="text-[#64748B]">{icon}</span>
      <span className="text-[#94A3B8] whitespace-nowrap" style={{ fontSize: "13px", fontWeight: "500" }}>{label}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TrainingBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const batchId = id ? parseInt(id, 10) : 0;

  const [joinResult, setJoinResult] = useState<"active" | "pending" | null>(null);
  const [starHover, setStarHover] = useState(0);
  const [starSelected, setStarSelected] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewDone, setReviewDone] = useState(false);

  const { data: res, isLoading, isError } = useBatch(batchId);
  const { data: meRes } = useCurrentUser();
  const joinMutation = useJoinBatch();
  const rateMutation = useRateBatch();

  const batch = (res as any)?.data as Batch | undefined;
  const myId: number | undefined = (meRes as any)?.user?.id;
  const myMembership = batch && myId
    ? (batch as any).memberships?.find((m: any) => m.playerId === myId)
    : null;
  const isActiveMember  = myMembership?.status === "active";
  const isPendingMember = myMembership?.status === "pending";

  const price = (() => {
    if (!batch?.sportFees) return null;
    const raw = Object.values(batch.sportFees as Record<string, unknown>)[0];
    if (typeof raw === "number") return raw;
    if (typeof raw === "object" && raw !== null) {
      const inner = Object.values(raw as Record<string, unknown>).find((v) => typeof v === "number");
      return (inner as number) ?? null;
    }
    return null;
  })();
  const rating   = batch?.trainerRating ?? batch?.trainer?.rating;
  const seats    = batch?.maxStudents != null && batch?.memberCount != null
    ? batch.maxStudents - batch.memberCount : null;
  const urgency  = seats != null && seats > 0 && seats <= 5;
  const isFull   = seats === 0;
  const lvl      = LEVEL_STYLE[batch?.skillLevel?.toLowerCase() ?? ""];
  const includes = batch?.includes ?? DEFAULT_INCLUDES;

  async function handleEnroll() {
    if (!batch) return;
    if (!myId) {
      navigate("/login");
      return;
    }
    try {
      const res: any = await joinMutation.mutateAsync(batch.id);
      const status = res?.data?.status ?? "active";
      setJoinResult(status === "pending" ? "pending" : "active");
    } catch { /* handled by mutation state */ }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A]">
        <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
        </div>
        <Skeleton />
      </div>
    );
  }

  if (isError || !batch) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle style={{ width: "48px", height: "48px", color: "#64748B", margin: "0 auto 16px" }} />
          <h2 className="text-white mb-4" style={{ fontSize: "18px", fontWeight: "700" }}>Batch not found</h2>
          <button onClick={() => navigate("/training")} className="px-6 py-3 text-white"
            style={{ borderRadius: "14px", backgroundColor: "#3B82F6", fontSize: "15px", fontWeight: "600" }}>
            Browse Training
          </button>
        </div>
      </div>
    );
  }

  if (joinResult === "active") {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}
        >
          <CheckCircle2 style={{ width: "40px", height: "40px", color: "#22C55E" }} />
        </div>
        <h2 className="text-white mb-2" style={{ fontSize: "26px", fontWeight: "800" }}>You're Enrolled! 🎉</h2>
        <p className="text-[#94A3B8] mb-2" style={{ fontSize: "15px" }}>{batch.name ?? batch.sport} Training</p>
        <p className="text-[#64748B] mb-10" style={{ fontSize: "14px" }}>
          with {batch.trainer?.name ?? "your coach"}
        </p>
        <button onClick={() => navigate("/my-batches")} className="w-full max-w-xs py-4 text-white mb-3"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "16px", fontWeight: "700" }}>
          View My Batches
        </button>
        <button onClick={() => navigate("/training")} className="w-full max-w-xs py-4"
          style={{ borderRadius: "16px", backgroundColor: "#1E293B", fontSize: "15px", fontWeight: "600", color: "#94A3B8" }}>
          Browse More
        </button>
      </div>
    );
  }

  if (joinResult === "pending") {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.4)" }}
        >
          <AlertCircle style={{ width: "40px", height: "40px", color: "#F59E0B" }} />
        </div>
        <h2 className="text-white mb-2" style={{ fontSize: "26px", fontWeight: "800" }}>Request Sent!</h2>
        <p className="text-[#94A3B8] mb-2" style={{ fontSize: "15px" }}>{batch.name ?? batch.sport} Training</p>
        <p className="text-[#64748B] mb-4" style={{ fontSize: "14px" }}>
          with {batch.trainer?.name ?? "your coach"}
        </p>
        <div className="w-full max-w-xs px-4 py-3 mb-10"
          style={{ borderRadius: "14px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <p style={{ fontSize: "13px", color: "#F59E0B", lineHeight: "1.5" }}>
            This batch requires coach approval. You'll be notified once the coach reviews your request.
          </p>
        </div>
        <button onClick={() => navigate("/my-batches")} className="w-full max-w-xs py-4 text-white mb-3"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,#F59E0B,#D97706)", fontSize: "16px", fontWeight: "700" }}>
          View My Batches
        </button>
        <button onClick={() => navigate("/training")} className="w-full max-w-xs py-4"
          style={{ borderRadius: "16px", backgroundColor: "#1E293B", fontSize: "15px", fontWeight: "600", color: "#94A3B8" }}>
          Browse More
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-36">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span className="text-white flex-1 truncate" style={{ fontSize: "17px", fontWeight: "600" }}>
          {batch.name ?? "Batch Details"}
        </span>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Hero card ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-start gap-4 mb-4">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: "60px", height: "60px", borderRadius: "18px", backgroundColor: "#111827", fontSize: "28px" }}
            >
              {sportEmoji(batch.sport ?? "")}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white mb-1" style={{ fontSize: "20px", fontWeight: "800", lineHeight: "130%" }}>
                {batch.name ?? `${batch.sport} Training`}
              </h1>
              <div className="flex flex-wrap gap-2">
                {batch.sport && (
                  <div className="px-2.5 py-1" style={{ borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                    <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>{batch.sport}</span>
                  </div>
                )}
                {lvl && batch.skillLevel && (
                  <div className="px-2.5 py-1" style={{ borderRadius: "999px", backgroundColor: lvl.bg, border: `1px solid ${lvl.border}` }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: lvl.color, textTransform: "capitalize" }}>
                      {batch.skillLevel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick info chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {batch.schedule && <Chip icon={<Clock style={{ width: "14px", height: "14px" }} />} label={typeof batch.schedule === "string" ? batch.schedule : (() => { const s = batch.schedule as any; const parts: string[] = []; if (s.weekdays) parts.push(Array.isArray(s.weekdays) ? s.weekdays.join(", ") : String(s.weekdays)); if (s.startTime) parts.push(s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime); return parts.join(" · ") || "Scheduled"; })()} />}
            {batch.daysPerWeek && <Chip icon={<Calendar style={{ width: "14px", height: "14px" }} />} label={`${batch.daysPerWeek}x / week`} />}
            {batch.venue?.location?.city && <Chip icon={<MapPin style={{ width: "14px", height: "14px" }} />} label={batch.venue.location.city} />}
            {batch.memberCount != null && <Chip icon={<Users style={{ width: "14px", height: "14px" }} />} label={`${batch.memberCount} enrolled`} />}
          </div>
        </div>

        {/* ── Seat urgency ── */}
        {urgency && (
          <div className="flex items-center gap-3 px-4 py-3"
            style={{ borderRadius: "16px", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Zap style={{ width: "18px", height: "18px", color: "#F59E0B", flexShrink: 0 }} />
            <div>
              <p className="text-[#F59E0B]" style={{ fontSize: "14px", fontWeight: "700" }}>
                Only {seats} seat{seats !== 1 ? "s" : ""} left!
              </p>
              <p className="text-[#92400E]" style={{ fontSize: "12px" }}>Enroll before the batch fills up</p>
            </div>
          </div>
        )}

        {/* ── Coach profile ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <h2 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Your Coach</h2>
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 flex items-center justify-center text-white shrink-0"
              style={{ borderRadius: "50%", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "20px", fontWeight: "700" }}
            >
              {(batch.trainer?.name ?? "C")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>
                {batch.trainer?.name ?? "Professional Coach"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} style={{
                      width: "13px", height: "13px",
                      color: i < Math.round(rating ?? 0) ? "#F59E0B" : "#1E293B",
                      fill: i < Math.round(rating ?? 0) ? "#F59E0B" : "#1E293B",
                    }} />
                  ))}
                </div>
                <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                  {rating ? rating.toFixed(1) : "New coach"}
                </span>
              </div>
              {batch.trainer?.experience && (
                <p className="text-[#64748B] mt-1" style={{ fontSize: "12px" }}>
                  {batch.trainer.experience} years experience
                </p>
              )}
            </div>
          </div>
          {batch.trainer?.bio && (
            <p className="text-[#94A3B8] mt-4" style={{ fontSize: "14px", lineHeight: "1.65" }}>
              {batch.trainer.bio}
            </p>
          )}
        </div>

        {/* ── Schedule ── */}
        {(batch.sessions && batch.sessions.length > 0) && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Schedule</h2>
            <div className="space-y-3">
              {batch.sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{s.day ?? `Session ${i + 1}`}</span>
                  <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
                    {s.time ?? "—"}{s.duration ? ` · ${s.duration}min` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Description ── */}
        {batch.description && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-3" style={{ fontSize: "16px", fontWeight: "700" }}>About</h2>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.65" }}>{batch.description}</p>
          </div>
        )}

        {/* ── What's included ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <h2 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>What's Included</h2>
          <div className="space-y-3">
            {includes.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 style={{ width: "17px", height: "17px", color: "#22C55E", flexShrink: 0 }} />
                <span className="text-[#E2E8F0]" style={{ fontSize: "14px" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Student review (active members only) ── */}
        {isActiveMember && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Rate this Batch</h2>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "12px" }}>Only enrolled students can post a review</p>
            {reviewDone ? (
              <div className="flex items-center gap-2 py-3 justify-center">
                <CheckCircle2 style={{ width: "18px", height: "18px", color: "#22C55E" }} />
                <span className="text-[#22C55E]" style={{ fontSize: "14px", fontWeight: "700" }}>Review submitted!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Star selector */}
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setStarHover(s)}
                      onMouseLeave={() => setStarHover(0)}
                      onClick={() => setStarSelected(s)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                    >
                      <Star
                        style={{
                          width: "28px", height: "28px",
                          color: s <= (starHover || starSelected) ? "#F59E0B" : "#334155",
                          fill:  s <= (starHover || starSelected) ? "#F59E0B" : "#334155",
                          transition: "color 0.1s",
                        }}
                      />
                    </button>
                  ))}
                  {starSelected > 0 && (
                    <span className="text-[#F59E0B] self-center ml-1" style={{ fontSize: "13px", fontWeight: "700" }}>
                      {["", "Poor", "Fair", "Good", "Great", "Excellent"][starSelected]}
                    </span>
                  )}
                </div>
                {/* Comment */}
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience (optional)…"
                  rows={3}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: "10px", boxSizing: "border-box",
                    backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff", fontSize: "14px", outline: "none", resize: "none",
                  }}
                />
                {rateMutation.isError && (
                  <p style={{ fontSize: "12px", color: "#EF4444" }}>
                    {(rateMutation.error as any)?.response?.data?.message ?? "Failed to submit review"}
                  </p>
                )}
                <button
                  disabled={starSelected === 0 || rateMutation.isPending}
                  onClick={() =>
                    rateMutation.mutate(
                      { batchId, rating: starSelected, comment: reviewComment || undefined },
                      { onSuccess: () => setReviewDone(true) }
                    )
                  }
                  style={{
                    width: "100%", padding: "11px", borderRadius: "10px",
                    fontSize: "14px", fontWeight: "700", border: "none",
                    cursor: starSelected === 0 || rateMutation.isPending ? "not-allowed" : "pointer",
                    background: starSelected === 0 || rateMutation.isPending
                      ? "#0F172A" : "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: starSelected === 0 ? "#475569" : "#fff",
                  }}
                >
                  {rateMutation.isPending ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Venue ── */}
        {batch.venue && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-3" style={{ fontSize: "16px", fontWeight: "700" }}>Venue</h2>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 flex items-center justify-center text-[#3B82F6]"
                style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.1)", flexShrink: 0 }}>
                <MapPin style={{ width: "17px", height: "17px" }} />
              </div>
              <div>
                <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{batch.venue.name}</p>
                {batch.venue.location?.address && (
                  <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: "13px" }}>{batch.venue.location.address}</p>
                )}
                {batch.venue.location?.city && (
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{batch.venue.location.city}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top, #0F172A 70%, transparent)" }}
      >
        <div className="max-w-md mx-auto">
          {/* Price strip */}
          {price && (
            <div className="flex items-center justify-between mb-3 px-4 py-3"
              style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Price per session</p>
                <p className="text-[#3B82F6]" style={{ fontSize: "22px", fontWeight: "800" }}>₹{price}</p>
              </div>
              {seats != null && (
                <div className="text-right">
                  <p style={{ fontSize: "12px", color: seats === 0 ? "#EF4444" : seats <= 5 ? "#F59E0B" : "#22C55E", fontWeight: "600" }}>
                    {seats === 0 ? "Batch Full" : `${seats} seats left`}
                  </p>
                  <p className="text-[#64748B]" style={{ fontSize: "11px" }}>of {batch.maxStudents}</p>
                </div>
              )}
            </div>
          )}
          {isActiveMember ? (
            <button
              disabled
              className="w-full py-4"
              style={{
                borderRadius: "16px", fontSize: "17px", fontWeight: "700",
                background: "rgba(34,197,94,0.12)", color: "#22C55E",
                border: "1px solid rgba(34,197,94,0.3)", cursor: "not-allowed",
              }}
            >
              ✓ Already Enrolled
            </button>
          ) : isPendingMember ? (
            <button
              disabled
              className="w-full py-4"
              style={{
                borderRadius: "16px", fontSize: "17px", fontWeight: "700",
                background: "rgba(245,158,11,0.12)", color: "#F59E0B",
                border: "1px solid rgba(245,158,11,0.3)", cursor: "not-allowed",
              }}
            >
              Request Pending — Awaiting Approval
            </button>
          ) : (
            <>
              <button
                onClick={handleEnroll}
                disabled={isFull || joinMutation.isPending}
                className="w-full py-4 text-white"
                style={{
                  borderRadius: "16px",
                  background: isFull ? "#1E293B" : "linear-gradient(135deg,#3B82F6,#6366F1)",
                  fontSize: "17px", fontWeight: "700",
                  color: isFull ? "#64748B" : "#FFFFFF",
                  opacity: joinMutation.isPending ? 0.7 : 1,
                }}
              >
                {joinMutation.isPending ? "Enrolling…" : isFull ? "Batch Full" : "Enroll Now →"}
              </button>
              {joinMutation.isError && (
                <p className="text-center text-[#EF4444] mt-2" style={{ fontSize: "13px" }}>
                  {(joinMutation.error as any)?.response?.data?.message ?? "Enrollment failed. Please try again."}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
