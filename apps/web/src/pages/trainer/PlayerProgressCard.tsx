import { useParams, useNavigate } from "react-router-dom";
import { useBatch, useBatchReviews, useCreateProgressShareLink } from "@sportza/api-client";
import { ChevronLeft, Share2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import ProgressRadarChart from "../../components/trainer/ProgressRadarChart";
import { parseRatings, PROGRESS_LABELS, type ProgressKey } from "../../lib/progressDimensions";

function TrendArrow({ cur, prev }: { cur: number; prev: number }) {
  if (cur === prev) return <Minus style={{ width: "14px", color: "#64748B" }} />;
  if (cur > prev) return <TrendingUp style={{ width: "14px", color: "#22C55E" }} />;
  return <TrendingDown style={{ width: "14px", color: "#EF4444" }} />;
}

export default function PlayerProgressCard() {
  const { batchId: bid, playerId: pid } = useParams<{ batchId: string; playerId: string }>();
  const navigate = useNavigate();
  const batchId = bid ? parseInt(bid, 10) : 0;
  const playerId = pid ? parseInt(pid, 10) : 0;

  const { data: batchRes, isLoading: batchLoading } = useBatch(batchId);
  const batch: any = (batchRes as any)?.data;
  const { data: reviewsRes, isLoading: revLoading } = useBatchReviews(batchId);
  const allReviews: any[] = (reviewsRes as any)?.data ?? [];

  const playerReviews = allReviews
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const player = batch?.memberships?.find((m: any) => m.player?.id === playerId)?.player;

  const share = useCreateProgressShareLink();

  const latest = playerReviews[0];
  const previous = playerReviews[1];
  const latestPayload = parseRatings(latest?.ratings);
  const prevPayload = previous ? parseRatings(previous.ratings) : null;

  const handleShare = () => {
    share.mutate(
      { batchId, playerId },
      {
        onSuccess: (body: any) => {
          const url = body?.data?.shareUrl ?? "";
          if (url && navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(url);
            alert("Share link copied to clipboard.");
          }
        },
      }
    );
  };

  if (!batchId || !playerId) {
    return (
      <div className="min-h-screen bg-[#0F172A] p-4 text-[#EF4444]">Invalid link.</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-white truncate" style={{ fontSize: "20px", fontWeight: "800" }}>
            Progress card
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {batchLoading ? "…" : batch?.name} · {player?.name ?? "Student"}
          </p>
        </div>
        <button
          onClick={handleShare}
          disabled={share.isPending}
          className="flex items-center gap-1.5 px-3 py-2"
          style={{
            borderRadius: "10px",
            backgroundColor: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#22C55E",
            fontSize: "12px",
            fontWeight: "700",
          }}
        >
          <Share2 style={{ width: "14px", height: "14px" }} />
          Share
        </button>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        {revLoading || batchLoading ? (
          <div className="animate-pulse h-64 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ) : (
          <>
            <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
              {latest ? (
                <p className="text-[#94A3B8] mb-3" style={{ fontSize: "12px" }}>
                  {format(new Date(latest.year, latest.month - 1, 1), "MMMM yyyy")}
                </p>
              ) : (
                <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
                  No monthly reviews yet. Add ratings in the batch Reviews tab.
                </p>
              )}
              <ProgressRadarChart payload={latestPayload} comparePayload={prevPayload} />
            </div>

            {latest && previous && prevPayload && (
              <div className="p-4 space-y-2" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-white mb-2" style={{ fontSize: "14px", fontWeight: "700" }}>
                  Month-over-month
                </p>
                {(Object.keys(PROGRESS_LABELS) as ProgressKey[]).map((k) => {
                  const cur = latestPayload[k] ?? 0;
                  const pr = prevPayload[k] ?? 0;
                  if (!cur && !pr) return null;
                  return (
                    <div key={k} className="flex items-center justify-between py-1.5">
                      <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                        {PROGRESS_LABELS[k]}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>
                          {cur || "—"}
                        </span>
                        <TrendArrow cur={cur} prev={pr} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {latestPayload.swot && (
              <div className="p-4 space-y-3" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                  SWOT snapshot
                </p>
                {(
                  [
                    ["Strengths", latestPayload.swot.strengths],
                    ["Weaknesses", latestPayload.swot.weaknesses],
                    ["Opportunities", latestPayload.swot.opportunities],
                    ["Threats", latestPayload.swot.threats],
                  ] as const
                ).map(([title, text]) =>
                  text ? (
                    <div key={title}>
                      <p className="text-[#64748B] mb-1" style={{ fontSize: "11px", fontWeight: "600" }}>
                        {title}
                      </p>
                      <p className="text-white" style={{ fontSize: "13px", lineHeight: 1.5 }}>
                        {text}
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {latest?.comment && (
              <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#64748B] mb-1" style={{ fontSize: "11px", fontWeight: "600" }}>
                  Coach notes
                </p>
                <p className="text-white" style={{ fontSize: "14px", lineHeight: 1.5 }}>
                  {latest.comment}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
