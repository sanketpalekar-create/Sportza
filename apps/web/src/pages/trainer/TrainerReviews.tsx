import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useTrainerReviews } from "@sportza/api-client";
import { ChevronLeft, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";

type Review = {
  id: number;
  rating: number;
  review?: string | null;
  user?: { name?: string | null };
  createdAt?: string;
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} style={{ width: "12px", height: "12px",
          color: i <= Math.round(rating) ? "#F59E0B" : "#334155",
          fill: i <= Math.round(rating) ? "#F59E0B" : "none" }} />
      ))}
    </div>
  );
}

export default function TrainerReviews() {
  const navigate = useNavigate();
  const { data: userRes } = useCurrentUser();
  const user = (userRes as any)?.user ?? (userRes as any)?.data;
  const trainerId: number = user?.id ?? 0;

  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");

  const { data: reviewsRes, isLoading } = useTrainerReviews(trainerId);

  const reviewsData = reviewsRes?.data ?? reviewsRes?.reviews ?? [];
  const reviews: Review[] = Array.isArray(reviewsData) ? reviewsData : [];

  const filtered = ratingFilter === "all"
    ? reviews
    : reviews.filter((r) => Math.floor(r.rating) === ratingFilter);

  const avg = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const dist = useMemo(() => {
    const d: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => { const k = Math.floor(r.rating); if (d[k] !== undefined) d[k]++; });
    return d;
  }, [reviews]);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Reviews</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{reviews.length} total review{reviews.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* Rating summary card */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <div className="text-white" style={{ fontSize: "48px", fontWeight: "800", lineHeight: 1 }}>{avg}</div>
              <div className="flex items-center justify-center gap-0.5 my-1">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} style={{ width: "14px", height: "14px",
                    color: i <= Math.round(avg) ? "#F59E0B" : "#334155",
                    fill: i <= Math.round(avg) ? "#F59E0B" : "none" }} />
                ))}
              </div>
              <div className="text-[#64748B]" style={{ fontSize: "12px" }}>{reviews.length} ratings</div>
            </div>
            <div className="flex-1">
              {[5,4,3,2,1].map((star) => {
                const count = dist[star] ?? 0;
                const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                return (
                  <button key={star} onClick={() => setRatingFilter(ratingFilter === star ? "all" : star)}
                    className="w-full flex items-center gap-2 mb-1.5">
                    <span className="text-[#64748B] flex-shrink-0" style={{ fontSize: "11px", width: "8px" }}>{star}</span>
                    <div className="flex-1 rounded-full" style={{ height: "6px", backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <div className="rounded-full" style={{
                        width: `${pct}%`, height: "6px",
                        backgroundColor: ratingFilter === star ? "#F59E0B" : "#475569",
                      }} />
                    </div>
                    <span className="text-[#64748B] flex-shrink-0" style={{ fontSize: "11px", width: "20px", textAlign: "right" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => setRatingFilter("all")}
              className="flex-shrink-0 px-3 py-1.5"
              style={{ borderRadius: "8px", fontSize: "12px", fontWeight: ratingFilter === "all" ? "700" : "500",
                backgroundColor: ratingFilter === "all" ? "#F59E0B" : "rgba(255,255,255,0.06)",
                color: ratingFilter === "all" ? "#000" : "#94A3B8" }}>
              All
            </button>
            {[5,4,3,2,1].map((s) => (
              <button key={s} onClick={() => setRatingFilter(ratingFilter === s ? "all" : s)}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5"
                style={{ borderRadius: "8px", fontSize: "12px", fontWeight: ratingFilter === s ? "700" : "500",
                  backgroundColor: ratingFilter === s ? "#F59E0B" : "rgba(255,255,255,0.06)",
                  color: ratingFilter === s ? "#000" : "#94A3B8" }}>
                <Star style={{ width: "10px", height: "10px", fill: "currentColor" }} />
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Reviews */}
        {isLoading && [1,2,3].map((i) => (
          <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <MessageSquare style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 8px" }} />
            <p className="text-[#64748B]">No reviews yet.</p>
          </div>
        )}

        {!isLoading && filtered.map((r) => (
          <div key={r.id} className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <div className="flex items-start gap-3 mb-2">
              <div className="flex items-center justify-center flex-shrink-0"
                style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#334155",
                  fontSize: "16px", fontWeight: "700", color: "#fff" }}>
                {(r.user?.name ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                    {r.user?.name ?? "Anonymous"}
                  </p>
                  {r.createdAt && (
                    <p className="text-[#475569]" style={{ fontSize: "11px" }}>
                      {format(new Date(r.createdAt), "dd MMM yyyy")}
                    </p>
                  )}
                </div>
                <StarRow rating={r.rating} />
              </div>
            </div>
            {r.review && (
              <p className="text-[#94A3B8] mt-1" style={{ fontSize: "13px", lineHeight: "1.6" }}>{r.review}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
