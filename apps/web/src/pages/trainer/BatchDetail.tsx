import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useBatch, useBatchAnnouncements, usePostBatchAnnouncement, useBatchPayments,
  useGenerateSessions, useBatchReviews, useSubmitBatchReview,
  useUpdateMemberStatus, useAddBatchMember,
} from "@sportza/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft, Users, Calendar, DollarSign, Megaphone, CheckCircle2, XCircle, Clock,
  ClipboardList, Star, ChevronDown, UserPlus, X, ExternalLink,
} from "lucide-react";
import { PROGRESS_KEYS, PROGRESS_LABELS, parseRatings, type SwotBlock, type ProgressKey } from "../../lib/progressDimensions";
import { format, subMonths } from "date-fns";

const announcementSchema = z.object({ message: z.string().min(1, "Required").max(2000) });
type AnnouncementForm = z.infer<typeof announcementSchema>;

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:   { color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  left:     { color: "#64748B", bg: "rgba(100,116,139,0.12)" },
  pending:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
};

const TABS = [
  { id: "students" as const,     label: "Students",      icon: Users         },
  { id: "sessions" as const,     label: "Sessions",      icon: Calendar      },
  { id: "payments" as const,     label: "Payments",      icon: DollarSign    },
  { id: "reviews" as const,      label: "Reviews",       icon: ClipboardList },
  { id: "announcements" as const,label: "Announcements", icon: Megaphone     },
];

const now = new Date();
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(now, i);
  return { label: format(d, "MMMM yyyy"), year: d.getFullYear(), month: d.getMonth() + 1 };
});

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const batchId = id ? parseInt(id, 10) : 0;

  const { data: response, isLoading, isError } = useBatch(batchId);
  const batch: any = (response as any)?.data;
  const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("students");

  const { data: annRes } = useBatchAnnouncements(batchId);
  const announcements: any[] = (annRes as any)?.data ?? (Array.isArray(annRes) ? annRes : []);

  const postAnnouncement = usePostBatchAnnouncement();
  const generateSessions = useGenerateSessions();
  const updateMember = useUpdateMemberStatus();
  const addMember = useAddBatchMember();

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addIdentifier, setAddIdentifier] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
  });

  const memberships: any[] = batch?.memberships ?? [];
  const sessions: any[]    = batch?.sessions    ?? [];

  const { data: paymentsRes } = useBatchPayments(batchId);
  const batchPayments: any[] = (paymentsRes as any)?.data ?? [];

  // Monthly reviews state
  const [reviewMonthIdx, setReviewMonthIdx] = useState(0);
  const reviewMo = MONTH_OPTIONS[reviewMonthIdx];
  const { data: reviewsRes, isLoading: reviewsLoading } = useBatchReviews(batchId);
  const existingReviews: any[] = (reviewsRes as any)?.data ?? (Array.isArray(reviewsRes) ? reviewsRes : []);
  const submitReview = useSubmitBatchReview();
  const [ratings, setRatings] = useState<Record<number, Partial<Record<ProgressKey, number>>>>({});
  const [swotByPlayer, setSwotByPlayer] = useState<Record<number, SwotBlock>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [swotOpen, setSwotOpen] = useState<Record<number, boolean>>({});

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "10px",
    backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff", fontSize: "14px", outline: "none",
  };

  if (isError || (!isLoading && !batch)) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-4">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-4 text-[#EF4444]" style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}>
          Batch not found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="min-w-0">
          {isLoading ? (
            <div className="animate-pulse h-6 w-40 rounded" style={{ backgroundColor: "#1E293B" }} />
          ) : (
            <>
              <h1 className="text-white truncate" style={{ fontSize: "20px", fontWeight: "800" }}>{batch?.name}</h1>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{batch?.sport} · {batch?.capacity} max players</p>
            </>
          )}
        </div>
      </div>

      {/* Batch meta */}
      {!isLoading && batch && (
        <div className="px-4 mb-4">
          <div className="p-4 flex flex-wrap gap-3" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            {[
              { label: "Students",  value: memberships.length },
              { label: "Sessions",  value: sessions.length    },
              { label: "Capacity",  value: batch.capacity ?? "—" },
              { label: "Venue",     value: batch.venue?.name ?? "—" },
            ].map((m) => (
              <div key={m.label} className="flex-1 min-w-[80px]">
                <div className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{m.value}</div>
                <div className="text-[#64748B]" style={{ fontSize: "11px" }}>{m.label}</div>
              </div>
            ))}
            {batch.skillRatingMin != null && batch.skillRatingMax != null && (
              <div className="w-full mt-1 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1"
                  style={{ borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#3B82F6" }}>
                    Skill Rating: {batch.skillRatingMin}–{batch.skillRatingMax}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 flex-shrink-0"
              style={{
                borderRadius: "10px", fontSize: "13px", fontWeight: active ? "700" : "500",
                backgroundColor: active ? "#3B82F6" : "#1E293B",
                color: active ? "#fff" : "#64748B",
                border: active ? "none" : "1px solid rgba(255,255,255,0.06)",
              }}>
              <tab.icon style={{ width: "14px", height: "14px" }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 max-w-md mx-auto">
        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="space-y-3">

            {/* Add Student form */}
            {showAddStudent ? (
              <div className="p-4 space-y-3" style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Add Student</p>
                  <button onClick={() => { setShowAddStudent(false); setAddIdentifier(""); setAddError(null); setAddSuccess(null); }}>
                    <X style={{ width: "18px", height: "18px", color: "#64748B" }} />
                  </button>
                </div>
                <input
                  value={addIdentifier}
                  onChange={(e) => { setAddIdentifier(e.target.value); setAddError(null); setAddSuccess(null); }}
                  placeholder="Phone number or email address"
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: "10px", boxSizing: "border-box",
                    backgroundColor: "#0F172A", border: `1px solid ${addError ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: "#fff", fontSize: "14px", outline: "none",
                  }}
                />
                {addError && <p style={{ fontSize: "12px", color: "#EF4444" }}>{addError}</p>}
                {addSuccess && <p style={{ fontSize: "12px", color: "#22C55E" }}>{addSuccess}</p>}
                <button
                  disabled={addMember.isPending || !addIdentifier.trim()}
                  onClick={() => {
                    setAddError(null);
                    setAddSuccess(null);
                    addMember.mutate(
                      { batchId, identifier: addIdentifier.trim() },
                      {
                        onSuccess: (res: any) => {
                          const name = res?.data?.player?.name ?? res?.data?.player?.email ?? "Student";
                          setAddSuccess(`${name} added successfully!`);
                          setAddIdentifier("");
                          queryClient.invalidateQueries({ queryKey: ["batches", batchId] });
                        },
                        onError: (err: any) => {
                          setAddError(err?.response?.data?.message ?? err?.message ?? "Could not find that user. Check the phone or email.");
                        },
                      }
                    );
                  }}
                  style={{
                    width: "100%", padding: "11px", borderRadius: "10px", fontSize: "14px", fontWeight: "700",
                    border: "none", cursor: addMember.isPending || !addIdentifier.trim() ? "not-allowed" : "pointer",
                    background: addMember.isPending || !addIdentifier.trim()
                      ? "#0F172A"
                      : "linear-gradient(135deg,#22C55E,#16A34A)",
                    color: addMember.isPending || !addIdentifier.trim() ? "#475569" : "#fff",
                  }}
                >
                  {addMember.isPending ? "Adding…" : "Add to Batch"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowAddStudent(true); setAddError(null); setAddSuccess(null); }}
                className="w-full flex items-center justify-center gap-2 py-3"
                style={{
                  borderRadius: "12px", fontSize: "14px", fontWeight: "700",
                  backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  color: "#22C55E", cursor: "pointer",
                }}
              >
                <UserPlus style={{ width: "16px", height: "16px" }} />
                Add Student
              </button>
            )}

            {memberships.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Users style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 8px" }} />
                <p className="text-[#64748B]">No students enrolled yet.</p>
              </div>
            ) : memberships.map((m: any, i: number) => {
              const sc = STATUS_COLOR[m.status ?? "pending"] ?? STATUS_COLOR.pending;
              const isPending = m.status === "pending";
              const isBusy = updateMember.isPending && (updateMember.variables as any)?.memberId === m.id;
              return (
                <div key={m.id ?? i} className="p-4 space-y-3"
                  style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                  {/* Member row */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center flex-shrink-0"
                      style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#334155", fontSize: "16px", fontWeight: "700", color: "#fff" }}>
                      {(m.player?.name ?? m.player?.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "600" }}>
                        {m.player?.name ?? m.player?.email ?? "Unknown"}
                      </p>
                      <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                        {m.player?.email ?? ""}
                      </p>
                    </div>
                    <div className="px-2 py-1" style={{ borderRadius: "6px", backgroundColor: sc.bg, fontSize: "11px", fontWeight: "700", color: sc.color }}>
                      {(m.status ?? "pending").toUpperCase()}
                    </div>
                  </div>
                  {/* Approve / Reject for pending members */}
                  {isPending && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={isBusy}
                        onClick={() => updateMember.mutate(
                          { batchId, memberId: m.id, status: "active" },
                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batches", batchId] }) }
                        )}
                        style={{
                          padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          border: "none", cursor: isBusy ? "not-allowed" : "pointer",
                          backgroundColor: "rgba(34,197,94,0.12)", color: "#22C55E",
                        }}
                      >
                        {isBusy ? "…" : "✓ Approve"}
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => updateMember.mutate(
                          { batchId, memberId: m.id, status: "rejected" },
                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batches", batchId] }) }
                        )}
                        style={{
                          padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          border: "none", cursor: isBusy ? "not-allowed" : "pointer",
                          backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444",
                        }}
                      >
                        {isBusy ? "…" : "✕ Reject"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <div className="p-8 text-center space-y-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <Calendar style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto" }} />
                <p className="text-[#64748B]" style={{ fontSize: "14px" }}>No sessions scheduled yet.</p>
                {generateSessions.isError && (
                  <p className="text-[#EF4444]" style={{ fontSize: "12px" }}>
                    Generation failed. Make sure the batch has a valid schedule set.
                  </p>
                )}
                <button
                  onClick={() =>
                    generateSessions.mutate(
                      { batchId, weeks: 8 },
                      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batches", batchId] }) }
                    )
                  }
                  disabled={generateSessions.isPending}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#fff",
                    background: generateSessions.isPending
                      ? "#1E293B"
                      : "linear-gradient(135deg,#22C55E,#16A34A)",
                    border: "none",
                    cursor: generateSessions.isPending ? "not-allowed" : "pointer",
                    width: "100%",
                  }}
                >
                  {generateSessions.isPending ? "Generating…" : "Generate Schedule (8 weeks)"}
                </button>
              </div>
            ) : sessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-4"
                style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                <div>
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
                    {s.date ? format(new Date(s.date), "dd MMM yyyy") : "—"}
                  </p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    {s.startTime ?? "—"} – {s.endTime ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1"
                  style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.12)" }}>
                  <Users style={{ width: "12px", height: "12px", color: "#3B82F6" }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#3B82F6" }}>
                    {s.attendance?.length ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-2">
            {batchPayments.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#64748B]">No payment records for this batch.</p>
              </div>
            ) : batchPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-4"
                style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                <div>
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                    ₹{(p.amount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    {p.player?.name ?? p.studentName ?? "Student"}
                    {p.createdAt ? " · " + format(new Date(p.createdAt), "dd MMM") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.status === "paid" ? (
                    <CheckCircle2 style={{ width: "16px", height: "16px", color: "#22C55E" }} />
                  ) : p.status === "failed" ? (
                    <XCircle style={{ width: "16px", height: "16px", color: "#EF4444" }} />
                  ) : (
                    <Clock style={{ width: "16px", height: "16px", color: "#F59E0B" }} />
                  )}
                  <span style={{ fontSize: "12px", fontWeight: "700",
                    color: p.status === "paid" ? "#22C55E" : p.status === "failed" ? "#EF4444" : "#F59E0B" }}>
                    {(p.status ?? "pending").toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Monthly Reviews Tab */}
        {activeTab === "reviews" && (
          <div className="space-y-4">
            {/* Month selector */}
            <div className="relative">
              <select
                value={reviewMonthIdx}
                onChange={(e) => setReviewMonthIdx(parseInt(e.target.value, 10))}
                style={{
                  width: "100%", padding: "12px 36px 12px 14px",
                  borderRadius: "12px", backgroundColor: "#1E293B",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  color: "#F1F5F9", fontSize: "14px", outline: "none",
                  appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                }}
              >
                {MONTH_OPTIONS.map((m, i) => (
                  <option key={i} value={i}>{m.label}</option>
                ))}
              </select>
              <ChevronDown style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#475569", pointerEvents: "none" }} />
            </div>

            {memberships.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#64748B]">No students enrolled yet.</p>
              </div>
            ) : memberships.map((m: any) => {
              const player = m.player;
              const playerId: number = player?.id;
              if (!playerId) return null;

              const existing = existingReviews.find(
                (r: any) => r.playerId === playerId && r.year === reviewMo.year && r.month === reviewMo.month
              );
              const parsedExisting = existing ? parseRatings(existing.ratings) : {};
              const playerRatings = ratings[playerId] ?? {};
              const playerComment = comments[playerId] ?? "";
              const swot = swotByPlayer[playerId] ?? parsedExisting.swot ?? {};

              const handleRating = (paramKey: ProgressKey, val: number) => {
                setRatings((prev) => ({ ...prev, [playerId]: { ...(prev[playerId] ?? {}), [paramKey]: val } }));
              };

              const handleSubmitPlayer = () => {
                const sw =
                  swot.strengths || swot.weaknesses || swot.opportunities || swot.threats
                    ? {
                        strengths: swot.strengths,
                        weaknesses: swot.weaknesses,
                        opportunities: swot.opportunities,
                        threats: swot.threats,
                      }
                    : undefined;
                const merged: Record<string, unknown> = { ...parsedExisting, ...playerRatings };
                if (sw) merged.swot = sw;
                submitReview.mutate({
                  batchId,
                  playerId,
                  year: reviewMo.year,
                  month: reviewMo.month,
                  ratings: merged,
                  comment: playerComment || undefined,
                });
              };

              return (
                <div key={playerId} className="p-5 space-y-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                  {/* Player header */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center flex-shrink-0"
                      style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#334155", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                      {(player?.name ?? player?.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>{player?.name ?? player?.email ?? "Unknown"}</p>
                      {existing && <p className="text-[#22C55E]" style={{ fontSize: "11px" }}>Review submitted</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/trainer/batches/${batchId}/progress/${playerId}`)}
                      className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0"
                      style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.12)", color: "#3B82F6", fontSize: "11px", fontWeight: "700" }}
                    >
                      Card <ExternalLink style={{ width: "12px", height: "12px" }} />
                    </button>
                  </div>

                  {/* Five dimensions (1–5) */}
                  {reviewsLoading ? (
                    <div className="animate-pulse h-20 rounded-xl" style={{ backgroundColor: "#0F172A" }} />
                  ) : (
                    PROGRESS_KEYS.map((key) => {
                      const current = playerRatings[key] ?? parsedExisting[key] ?? 0;
                      return (
                        <div key={key}>
                          <p className="text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "600" }}>{PROGRESS_LABELS[key]}</p>
                          <div className="flex gap-2 flex-wrap">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => handleRating(key, v)}
                                style={{
                                  width: "36px", height: "36px", borderRadius: "8px",
                                  fontSize: "14px", fontWeight: "700",
                                  backgroundColor: current >= v ? "rgba(245,158,11,0.2)" : "#0F172A",
                                  color: current >= v ? "#F59E0B" : "#475569",
                                  border: current >= v ? "1.5px solid #F59E0B" : "1.5px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                {v}
                              </button>
                            ))}
                            <Star style={{ width: "16px", height: "16px", color: "#F59E0B", alignSelf: "center", marginLeft: "4px" }} />
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* SWOT — collapsible */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => setSwotOpen((prev) => ({ ...prev, [playerId]: !prev[playerId] }))}
                      className="flex items-center justify-between w-full pt-3 pb-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "13px", fontWeight: "700" }}>SWOT</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B",
                          padding: "2px 7px", borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.06)" }}>
                          optional
                        </span>
                      </div>
                      <span style={{ fontSize: "18px", color: "#64748B", lineHeight: 1 }}>
                        {swotOpen[playerId] ? "−" : "+"}
                      </span>
                    </button>

                    {swotOpen[playerId] && (
                      <div className="space-y-2 pb-1">
                        {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((field) => (
                          <div key={field}>
                            <p className="text-[#64748B] mb-1" style={{ fontSize: "11px", fontWeight: "600", textTransform: "capitalize" }}>{field}</p>
                            <textarea
                              value={swot[field] ?? ""}
                              onChange={(e) =>
                                setSwotByPlayer((prev) => ({
                                  ...prev,
                                  [playerId]: { ...swot, [field]: e.target.value },
                                }))
                              }
                              rows={2}
                              placeholder={`${field}…`}
                              style={{
                                width: "100%", padding: "10px 12px", borderRadius: "10px",
                                backgroundColor: "#0F172A", border: "1.5px solid rgba(255,255,255,0.08)",
                                color: "#fff", fontSize: "13px", outline: "none", resize: "none",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "600" }}>Comment (optional)</p>
                    <textarea
                      value={playerComment || existing?.comment || ""}
                      onChange={(e) => setComments((prev) => ({ ...prev, [playerId]: e.target.value }))}
                      placeholder="Notes on progress…"
                      rows={2}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: "10px",
                        backgroundColor: "#0F172A", border: "1.5px solid rgba(255,255,255,0.08)",
                        color: "#fff", fontSize: "13px", outline: "none", resize: "none",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSubmitPlayer}
                    disabled={submitReview.isPending}
                    className="w-full py-3"
                    style={{
                      borderRadius: "10px",
                      background: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
                      fontSize: "13px", fontWeight: "700", color: "#fff",
                      opacity: submitReview.isPending ? 0.7 : 1,
                    }}
                  >
                    {submitReview.isPending ? "Submitting…" : existing ? "Update Review" : "Submit Review"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === "announcements" && (
          <div className="space-y-4">
            {/* Post form */}
            <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
              <p className="text-white mb-3" style={{ fontSize: "14px", fontWeight: "700" }}>Post Announcement</p>
              <form onSubmit={handleSubmit((d) => postAnnouncement.mutate(
                { batchId, message: d.message },
                { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["batches", batchId] }); reset(); } }
              ))} className="space-y-3">
                <textarea {...register("message")} rows={3}
                  placeholder="Share an update with your students…"
                  style={{ ...inputSt, resize: "none", width: "100%" }} />
                {errors.message && <p className="text-[#EF4444]" style={{ fontSize: "11px" }}>{errors.message.message}</p>}
                <button type="submit" disabled={postAnnouncement.isPending}
                  className="w-full py-3"
                  style={{ borderRadius: "10px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                  {postAnnouncement.isPending ? "Posting…" : "Post Announcement"}
                </button>
              </form>
            </div>

            {/* List */}
            {announcements.length === 0 ? (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#64748B]">No announcements yet.</p>
              </div>
            ) : announcements.map((a: any) => (
              <div key={a.id} className="p-4" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                <p className="text-white mb-1" style={{ fontSize: "14px", lineHeight: "1.5" }}>{a.message}</p>
                <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                  {a.trainer?.name ?? "Coach"}
                  {a.createdAt ? " · " + format(new Date(a.createdAt), "dd MMM yyyy HH:mm") : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
