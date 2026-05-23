/**
 * TrainerProfile — Player-facing trainer detail page
 *
 * BRD: "Trainer Detail — Bio, sports (all offered), city, batches;
 *       Ratings & reviews block; View batches; Write review only if ≥1 month in batch"
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Star, MapPin, Award, Dumbbell,
  MessageSquare, ChevronRight, Building2,
} from "lucide-react";
import { useTrainer, useTrainerReviews } from "@sportza/api-client";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@sportza/api-client";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type TrainerData = {
  id: number;
  bio?: string | null;
  yearsExperience?: number;
  sports?: string[] | null;
  certifications?: Record<string, unknown> | null;
  achievements?: Record<string, unknown> | null;
  rating?: number;
  reviewCount?: number;
  user: { id: number; name?: string | null; avatar?: string | null; location?: { city?: string | null } | null };
  venues?: Array<{ id: number; venueId: number; venue: { id: number; name: string; location?: { address?: string | null; city?: string | null } | null } }>;
};

type Review = {
  id: number;
  rating: number;
  review?: string | null;
  createdAt: string;
  user: { id: number; name?: string | null; avatar?: string | null };
};

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", swimming: "🏊",
  pickleball: "🏓",
};
const sportEmoji = (n: string) => SPORT_EMOJI[n?.toLowerCase()] ?? "🏋️";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{
            width: "14px", height: "14px",
            color: "#F59E0B",
            fill: i <= Math.round(rating) ? "#F59E0B" : "transparent",
          }}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div
      className="p-4"
      style={{
        borderRadius: "14px", backgroundColor: "#0F172A",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#1E293B", fontSize: "16px" }}
        >
          {review.user.avatar ? (
            <img src={review.user.avatar} alt={review.user.name ?? "User"} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          ) : "👤"}
        </div>
        <div className="flex-1">
          <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
            {review.user.name ?? "Player"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRow rating={review.rating} />
            <span className="text-[#64748B]" style={{ fontSize: "12px" }}>
              {format(new Date(review.createdAt), "MMM yyyy")}
            </span>
          </div>
        </div>
      </div>
      {review.review && (
        <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
          {review.review}
        </p>
      )}
    </div>
  );
}

// ─── Write Review Panel ───────────────────────────────────────────────────────
function WriteReview({ trainerId, onSuccess }: { trainerId: number; onSuccess: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: { rating: number; review?: string }) =>
      apiClient.post(`/trainers/${trainerId}/reviews`, data).then((r) => r.data),
    onSuccess: () => {
      setRating(0); setText(""); setError(null);
      onSuccess();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? "Could not submit review. Check eligibility.");
    },
  });

  const handleSubmit = () => {
    if (rating === 0) { setError("Please select a rating."); return; }
    setError(null);
    mutation.mutate({ rating, review: text.trim() || undefined });
  };

  return (
    <div
      className="p-4 mt-3"
      style={{
        borderRadius: "14px", backgroundColor: "#0F172A",
        border: "1px solid rgba(59,130,246,0.2)",
      }}
    >
      <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "600" }}>Write a Review</p>

      {/* Star selector */}
      <div className="flex gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
          >
            <Star
              style={{
                width: "28px", height: "28px",
                color: "#F59E0B",
                fill: i <= (hover || rating) ? "#F59E0B" : "transparent",
                transition: "fill 0.15s",
              }}
            />
          </button>
        ))}
      </div>

      <textarea
        className="w-full bg-[#1E293B] text-white rounded-xl p-3 outline-none resize-none"
        style={{ fontSize: "14px", border: "1px solid rgba(255,255,255,0.06)", minHeight: "80px" }}
        placeholder="Share your experience (optional)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
      />

      {error && (
        <p className="text-[#EF4444] mt-2" style={{ fontSize: "13px" }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={mutation.isPending}
        className="w-full mt-3 text-white flex items-center justify-center"
        style={{
          height: "44px", borderRadius: "12px",
          backgroundColor: mutation.isPending ? "#1E3A5F" : "#3B82F6",
          fontSize: "15px", fontWeight: "600",
          opacity: mutation.isPending ? 0.7 : 1,
        }}
      >
        {mutation.isPending ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TrainerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trainerId = id ? parseInt(id, 10) : 0;

  const [showWriteReview, setShowWriteReview] = useState(false);

  const { data: trainerRes, isLoading, isError } = useTrainer(trainerId);
  const trainer: TrainerData | null = (trainerRes as any)?.data ?? null;

  const { data: reviewsRes, refetch: refetchReviews } = useTrainerReviews(trainerId);
  const reviews: Review[] = (reviewsRes as any)?.data ?? [];
  const totalReviews: number = (reviewsRes as any)?.meta?.total ?? reviews.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#3B82F6] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !trainer) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[#94A3B8]" style={{ fontSize: "16px" }}>Trainer not found.</p>
        <button onClick={() => navigate(-1)} className="text-[#3B82F6]" style={{ fontSize: "14px", fontWeight: "600" }}>
          Go Back
        </button>
      </div>
    );
  }

  const sports: string[] = Array.isArray(trainer.sports) ? trainer.sports : [];
  const avgRating = trainer.rating ?? 0;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      {/* Back header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4 pt-6 pb-4"
        style={{ background: "linear-gradient(to bottom, #0F172A 85%, transparent)" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center shrink-0"
          style={{
            width: "40px", height: "40px", borderRadius: "12px",
            backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <h1 className="text-white" style={{ fontSize: "18px", fontWeight: "700" }}>Trainer Profile</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* ── Hero card ── */}
        <div
          className="p-5"
          style={{
            borderRadius: "20px", backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: "72px", height: "72px", borderRadius: "50%",
                backgroundColor: "#0F172A", fontSize: "32px", overflow: "hidden",
              }}
            >
              {trainer.user.avatar ? (
                <img
                  src={trainer.user.avatar}
                  alt={trainer.user.name ?? "Trainer"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Dumbbell style={{ width: "32px", height: "32px", color: "#3B82F6" }} />
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-white" style={{ fontSize: "22px", fontWeight: "700" }}>
                {trainer.user.name ?? "Coach"}
              </h2>
              {trainer.user.location?.city && (
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin style={{ width: "13px", height: "13px", color: "#64748B" }} />
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
                    {trainer.user.location.city}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star style={{ width: "13px", height: "13px", color: "#F59E0B", fill: "#F59E0B" }} />
                    <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                      {avgRating.toFixed(1)} ({totalReviews} reviews)
                    </span>
                  </div>
                )}
                {(trainer.yearsExperience ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Award style={{ width: "13px", height: "13px", color: "#64748B" }} />
                    <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
                      {trainer.yearsExperience}yr exp
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {trainer.bio && (
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              {trainer.bio}
            </p>
          )}
        </div>

        {/* ── Sports ── */}
        {sports.length > 0 && (
          <div
            className="p-4"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-[#64748B] mb-3" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sports Offered
            </p>
            <div className="flex flex-wrap gap-2">
              {sports.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-1.5 px-3 py-1.5"
                  style={{
                    borderRadius: "999px",
                    backgroundColor: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{sportEmoji(s)}</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#60A5FA" }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Venues ── */}
        {(trainer.venues ?? []).length > 0 && (
          <div
            className="p-4"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-[#64748B] mb-3" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Venues
            </p>
            <div className="space-y-2">
              {trainer.venues!.map((tv) => (
                <div key={tv.id} className="flex items-center gap-3">
                  <Building2 style={{ width: "16px", height: "16px", color: "#64748B", flexShrink: 0 }} />
                  <div>
                    <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
                      {tv.venue.name}
                    </p>
                    {tv.venue.location?.address && (
                      <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{tv.venue.location.address}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── View Batches CTA ── */}
        <button
          onClick={() => navigate("/training")}
          className="w-full flex items-center justify-between p-4"
          style={{
            borderRadius: "16px", backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(59,130,246,0.15)" }}
            >
              <Dumbbell style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
            </div>
            <div className="text-left">
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "600" }}>View Training Batches</p>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Browse and join available batches</p>
            </div>
          </div>
          <ChevronRight style={{ width: "18px", height: "18px", color: "#475569" }} />
        </button>

        {/* ── Reviews ── */}
        <div
          className="p-4"
          style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
                Reviews {totalReviews > 0 ? `(${totalReviews})` : ""}
              </p>
              {avgRating > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <StarRow rating={avgRating} />
                  <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    {avgRating.toFixed(1)} avg
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowWriteReview((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2"
              style={{
                borderRadius: "10px",
                backgroundColor: showWriteReview ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                border: `1px solid ${showWriteReview ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.25)"}`,
              }}
            >
              <MessageSquare style={{ width: "14px", height: "14px", color: showWriteReview ? "#EF4444" : "#3B82F6" }} />
              <span
                style={{ fontSize: "13px", fontWeight: "600", color: showWriteReview ? "#EF4444" : "#3B82F6" }}
              >
                {showWriteReview ? "Cancel" : "Write Review"}
              </span>
            </button>
          </div>

          {showWriteReview && (
            <WriteReview
              trainerId={trainerId}
              onSuccess={() => { setShowWriteReview(false); refetchReviews(); }}
            />
          )}

          {reviews.length === 0 && !showWriteReview && (
            <p className="text-[#64748B] text-center py-4" style={{ fontSize: "14px" }}>
              No reviews yet. Join a batch for 1 month to leave one.
            </p>
          )}

          <div className="space-y-3 mt-3">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
