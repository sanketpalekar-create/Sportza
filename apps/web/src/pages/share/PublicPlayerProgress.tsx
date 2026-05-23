import { useSearchParams } from "react-router-dom";
import { usePublicPlayerProgress } from "@sportza/api-client";
import { format } from "date-fns";
import ProgressRadarChart from "../../components/trainer/ProgressRadarChart";
import { parseRatings, PROGRESS_LABELS, type ProgressKey } from "../../lib/progressDimensions";

export default function PublicPlayerProgress() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { data, isLoading, isError } = usePublicPlayerProgress(token);

  const payload = (data as any)?.data;
  const reviews: any[] = payload?.reviews ?? [];
  const latest = reviews[0];
  const previous = reviews[1];
  const latestPayload = parseRatings(latest?.ratings);
  const prevPayload = previous ? parseRatings(previous.ratings) : null;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-[#EF4444]">
        Missing share link. Ask your coach for a new link.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-pulse h-40 w-full max-w-md rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
      </div>
    );
  }

  if (isError || !payload) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center text-[#EF4444]">
        This link is invalid or has expired.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-24">
      <div className="px-4 pt-10 pb-6 max-w-lg mx-auto text-center">
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
          Sportza · Player progress
        </p>
        <h1 className="text-white mt-1" style={{ fontSize: "22px", fontWeight: "800" }}>
          {payload.player?.name ?? "Player"}
        </h1>
        <p className="text-[#94A3B8] mt-1" style={{ fontSize: "14px" }}>
          {payload.batch?.name} · {payload.batch?.sport ?? "Training"}
        </p>
        {payload.trainer?.name && (
          <p className="text-[#64748B] mt-2" style={{ fontSize: "12px" }}>
            Coach: {payload.trainer.name}
          </p>
        )}
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          {latest ? (
            <p className="text-[#94A3B8] mb-3" style={{ fontSize: "12px" }}>
              {format(new Date(latest.year, latest.month - 1, 1), "MMMM yyyy")}
            </p>
          ) : (
            <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
              No ratings published yet.
            </p>
          )}
          <ProgressRadarChart payload={latestPayload} comparePayload={prevPayload} />
        </div>

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

        {(Object.keys(PROGRESS_LABELS) as ProgressKey[]).map((k) => {
          const cur = latestPayload[k] ?? 0;
          const pr = prevPayload?.[k] ?? 0;
          if (!cur && !pr) return null;
          return (
            <div key={k} className="flex items-center justify-between px-4 py-2">
              <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                {PROGRESS_LABELS[k]}
              </span>
              <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>
                {cur}
                {pr ? ` (prev ${pr})` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
