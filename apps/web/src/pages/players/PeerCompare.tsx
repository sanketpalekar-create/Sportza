import { useParams, useNavigate, useLocation } from "react-router-dom";
import { usePeerCompare } from "@sportza/api-client";
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  BarChart2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingTier(rating: number) {
  if (rating >= 1400) return { label: "Elite",        color: "#A855F7" };
  if (rating >= 1200) return { label: "Advanced",     color: "#3B82F6" };
  if (rating >= 1000) return { label: "Intermediate", color: "#22C55E" };
  return                     { label: "Beginner",      color: "#F59E0B" };
}

function confidenceLabel(c: string) {
  switch (c) {
    case "master":      return "Master";
    case "expert":      return "Expert";
    case "advanced":    return "Advanced";
    case "established": return "Established";
    case "developing":  return "Developing";
    case "beginner":    return "Beginner";
    case "unranked":    return "Unranked";
    case "high":        return "Established";
    case "medium":      return "Developing";
    case "provisional": return "Beginner";
    default:            return "Unranked";
  }
}

function getInitial(name?: string | null) {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

// ─── Avatar pill ─────────────────────────────────────────────────────────────

function Avatar({ name, color }: { name?: string | null; color: string }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "12px",
        backgroundColor: `${color}20`,
        border: `1px solid ${color}30`,
        fontSize: "18px",
        fontWeight: "800",
        color,
      }}
    >
      {getInitial(name)}
    </div>
  );
}

// ─── Sport comparison row ─────────────────────────────────────────────────────

function SportCompareRow({
  entry,
  myName,
  peerName,
}: {
  entry: { sport: any; mine?: any; theirs?: any };
  myName: string;
  peerName: string;
}) {
  const myRating = entry.mine?.rating ?? null;
  const theirRating = entry.theirs?.rating ?? null;
  const sportName = entry.sport?.displayName ?? entry.sport?.name ?? "Unknown";

  const myTier = myRating !== null ? ratingTier(myRating) : null;
  const theirTier = theirRating !== null ? ratingTier(theirRating) : null;

  const diff = myRating !== null && theirRating !== null ? myRating - theirRating : null;

  const barMax = 1800;
  const myPct = myRating !== null ? Math.round((myRating / barMax) * 100) : 0;
  const theirPct = theirRating !== null ? Math.round((theirRating / barMax) * 100) : 0;

  return (
    <div
      className="p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Sport label */}
      <div className="flex items-center gap-2 mb-3">
        <Zap style={{ width: "14px", height: "14px", color: "#64748B" }} />
        <span className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
          {sportName}
        </span>
        {diff !== null && (
          <span
            className="ml-auto flex items-center gap-1"
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: diff > 0 ? "#22C55E" : diff < 0 ? "#F59E0B" : "#64748B",
            }}
          >
            {diff > 0 ? (
              <TrendingUp style={{ width: "12px", height: "12px" }} />
            ) : diff < 0 ? (
              <TrendingDown style={{ width: "12px", height: "12px" }} />
            ) : (
              <Minus style={{ width: "12px", height: "12px" }} />
            )}
            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "Tied"}
          </span>
        )}
      </div>

      {/* Me bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: "600" }}>
            {myName}
          </span>
          <div className="flex items-center gap-1.5">
            {myTier && (
              <span style={{ fontSize: "10px", fontWeight: "700", color: myTier.color }}>
                {myTier.label}
              </span>
            )}
            <span className="text-white" style={{ fontSize: "13px", fontWeight: "800" }}>
              {myRating ?? "–"}
            </span>
          </div>
        </div>
        <div style={{ height: "6px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.06)" }}>
          {myTier && (
            <div
              style={{
                width: `${myPct}%`,
                height: "100%",
                borderRadius: "4px",
                backgroundColor: myTier.color,
                transition: "width 0.6s ease",
              }}
            />
          )}
        </div>
        {entry.mine && (
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontSize: "10px", color: "#64748B" }}>
              {confidenceLabel(entry.mine.confidence)} · {entry.mine.matchesPlayed} matches
            </span>
          </div>
        )}
      </div>

      {/* Peer bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: "600" }}>
            {peerName}
          </span>
          <div className="flex items-center gap-1.5">
            {theirTier && (
              <span style={{ fontSize: "10px", fontWeight: "700", color: theirTier.color }}>
                {theirTier.label}
              </span>
            )}
            <span className="text-white" style={{ fontSize: "13px", fontWeight: "800" }}>
              {theirRating ?? "–"}
            </span>
          </div>
        </div>
        <div style={{ height: "6px", borderRadius: "4px", backgroundColor: "rgba(255,255,255,0.06)" }}>
          {theirTier && (
            <div
              style={{
                width: `${theirPct}%`,
                height: "100%",
                borderRadius: "4px",
                backgroundColor: theirTier.color,
                opacity: 0.7,
                transition: "width 0.6s ease",
              }}
            />
          )}
        </div>
        {entry.theirs && (
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontSize: "10px", color: "#64748B" }}>
              {confidenceLabel(entry.theirs.confidence)} · {entry.theirs.matchesPlayed} matches
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PeerCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = (location.state ?? {}) as { name?: string; location?: { city?: string } };

  const peerId = id ? parseInt(id, 10) : null;
  const { data, isLoading, isError, error } = usePeerCompare(peerId);

  const me = data?.me;
  const peer = data?.peer;
  const comparison: any[] = data?.comparison ?? [];

  const myName = me?.name ?? "Me";
  const peerName = peer?.name ?? routeState.name ?? "Peer";

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#1E293B" }}
        >
          <ArrowLeft style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>
            Compare ratings
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Peer-only comparison
          </p>
        </div>
        <BarChart2 style={{ width: "22px", height: "22px", color: "#A855F7", marginLeft: "auto" }} />
      </div>

      {/* Player headers */}
      {!isLoading && !isError && (
        <div
          className="flex items-center justify-between gap-4 p-4 mb-5"
          style={{
            borderRadius: "20px",
            backgroundColor: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          <div className="flex items-center gap-3">
            <Avatar name={myName} color="#3B82F6" />
            <div>
              <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>{myName}</p>
              {(me as any)?.location?.city && (
                <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{(me as any).location.city}</p>
              )}
            </div>
          </div>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748B" }}>VS</span>
          <div className="flex items-center gap-3 flex-row-reverse">
            <Avatar name={peerName} color="#A855F7" />
            <div className="text-right">
              <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>{peerName}</p>
              {(peer as any)?.location?.city && (
                <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{(peer as any).location.city}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }} />
          ))}
        </div>
      ) : isError ? (
        <div
          className="flex flex-col items-center text-center p-8"
          style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="flex items-center justify-center mb-4"
            style={{ width: "60px", height: "60px", borderRadius: "16px", backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <Lock style={{ width: "28px", height: "28px", color: "#64748B" }} />
          </div>
          <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
            Comparison not available
          </p>
          <p className="text-[#64748B]" style={{ fontSize: "13px", lineHeight: "1.5" }}>
            {(error as any)?.response?.data?.error ??
              "Detailed comparison is only available for accepted peers."}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-5 py-2.5"
            style={{
              borderRadius: "12px",
              backgroundColor: "#3B82F6",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            Back to profile
          </button>
        </div>
      ) : comparison.length === 0 ? (
        <div
          className="p-6 text-center"
          style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Neither player has rated sport data to compare yet.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
            SPORT-BY-SPORT RATINGS
          </p>
          <div className="space-y-3">
            {comparison.map((entry: any) => (
              <SportCompareRow
                key={entry.sport?.id}
                entry={entry}
                myName={myName}
                peerName={peerName}
              />
            ))}
          </div>

          <div
            className="flex items-start gap-3 mt-5 p-4"
            style={{
              borderRadius: "14px",
              backgroundColor: "rgba(168,85,247,0.06)",
              border: "1px solid rgba(168,85,247,0.15)",
            }}
          >
            <TrendingUp style={{ width: "16px", height: "16px", color: "#A855F7", marginTop: "2px", flexShrink: 0 }} />
            <p className="text-[#64748B]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
              This comparison is only visible to you and your peer. Ratings update after every competitive match.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
