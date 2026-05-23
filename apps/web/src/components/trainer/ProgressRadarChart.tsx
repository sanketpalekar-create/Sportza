import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import { PROGRESS_KEYS, PROGRESS_LABELS, type ProgressRatingsPayload, radarValues } from "../../lib/progressDimensions";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function ProgressRadarChart({
  payload,
  comparePayload,
}: {
  payload: ProgressRatingsPayload;
  comparePayload?: ProgressRatingsPayload | null;
}) {
  const primary = radarValues(payload);
  const hasData = primary.some((v) => v > 0);
  const labels = PROGRESS_KEYS.map((k) => PROGRESS_LABELS[k]);

  const data = {
    labels,
    datasets: [
      {
        label: "This period",
        data: primary.map((v) => (v > 0 ? v : 0)),
        backgroundColor: "rgba(59,130,246,0.25)",
        borderColor: "rgba(59,130,246,0.9)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59,130,246,1)",
      },
      ...(comparePayload && radarValues(comparePayload).some((v) => v > 0)
        ? [
            {
              label: "Previous",
              data: radarValues(comparePayload).map((v) => (v > 0 ? v : 0)),
              backgroundColor: "rgba(148,163,184,0.12)",
              borderColor: "rgba(148,163,184,0.7)",
              borderWidth: 1,
              pointBackgroundColor: "rgba(148,163,184,0.8)",
            },
          ]
        : []),
    ],
  };

  if (!hasData) {
    return (
      <div className="py-8 text-center text-[#64748B]" style={{ fontSize: "13px" }}>
        No skill ratings for this month yet.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto" style={{ height: "280px" }}>
      <Radar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: 0,
              max: 5,
              ticks: { stepSize: 1, color: "#64748B", backdropColor: "transparent" },
              grid: { color: "rgba(255,255,255,0.06)" },
              angleLines: { color: "rgba(255,255,255,0.08)" },
              pointLabels: { color: "#94A3B8", font: { size: 11 } },
            },
          },
          plugins: {
            legend: { labels: { color: "#94A3B8" } },
          },
        }}
      />
    </div>
  );
}
