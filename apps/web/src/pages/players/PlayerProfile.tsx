import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  useCurrentUser,
  usePlayerSkillRating,
  useSendPeerRequest,
  useRespondToPeerRequest,
  usePeerRelationshipStatus,
} from "@sportza/api-client";
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  Shield,
  Users,
  UserPlus,
  Check,
  Clock,
  BarChart2,
  Mail,
} from "lucide-react";
import PeerInviteSheet from "../../components/PeerInviteSheet";

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

function confidenceColor(c: string) {
  switch (c) {
    case "master":      return "#A855F7";
    case "expert":      return "#6366F1";
    case "advanced":    return "#22C55E";
    case "established": return "#3B82F6";
    case "developing":  return "#F59E0B";
    case "beginner":    return "#F97316";
    case "unranked":    return "#64748B";
    case "high":        return "#22C55E";
    case "medium":      return "#F59E0B";
    case "provisional": return "#3B82F6";
    default:            return "#64748B";
  }
}

function getInitial(name?: string | null) {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

// ─── Sport Rating Card ────────────────────────────────────────────────────────

function SportRatingCard({ r }: { r: any }) {
  const tier = ratingTier(r.rating);
  const confColor = confidenceColor(r.confidence);
  const confLabel = confidenceLabel(r.confidence);

  return (
    <div
      className="p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: `${tier.color}18` }}
          >
            <Zap style={{ width: "20px", height: "20px", color: tier.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                {r.sport?.displayName ?? r.sport?.name}
              </span>
              <span
                className="px-1.5 py-0.5"
                style={{
                  borderRadius: "6px",
                  backgroundColor: `${tier.color}20`,
                  fontSize: "10px",
                  fontWeight: "700",
                  color: tier.color,
                }}
              >
                {tier.label}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: confColor, fontWeight: "600" }}>
              {confLabel} · {r.matchesPlayed} matches
            </span>
          </div>
        </div>
        <div
          className="text-right"
          style={{ fontSize: "28px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}
        >
          {r.rating}
        </div>
      </div>
    </div>
  );
}

// ─── Peer Action Button ────────────────────────────────────────────────────────

function PeerActionArea({
  targetUserId,
  targetName,
  onCompare,
}: {
  targetUserId: number;
  targetName: string;
  onCompare: () => void;
}) {
  const { data: statusRes, isLoading: statusLoading, refetch } = usePeerRelationshipStatus(targetUserId);
  const status: string = (statusRes as any)?.status ?? "none";
  const relationshipId: number | undefined = (statusRes as any)?.id;
  const iAmRequester: boolean = (statusRes as any)?.iAmRequester ?? false;

  const { mutate: sendRequest, isPending: sending } = useSendPeerRequest();
  const { mutate: respond, isPending: responding } = useRespondToPeerRequest();

  if (statusLoading) {
    return <div className="h-12 animate-pulse" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }} />;
  }

  if (status === "accepted") {
    return (
      <button
        onClick={onCompare}
        className="w-full py-3 flex items-center justify-center gap-2"
        style={{
          borderRadius: "14px",
          backgroundColor: "rgba(168,85,247,0.15)",
          border: "1px solid rgba(168,85,247,0.3)",
          color: "#A855F7",
          fontSize: "14px",
          fontWeight: "700",
        }}
      >
        <BarChart2 style={{ width: "16px", height: "16px" }} />
        Compare ratings &amp; stats
      </button>
    );
  }

  if (status === "pending" && !iAmRequester) {
    return (
      <button
        disabled={responding}
        onClick={() =>
          respond(
            { id: relationshipId!, action: "accept" },
            { onSuccess: () => refetch() }
          )
        }
        className="w-full py-3 flex items-center justify-center gap-2"
        style={{
          borderRadius: "14px",
          backgroundColor: "rgba(34,197,94,0.15)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "#22C55E",
          fontSize: "14px",
          fontWeight: "700",
        }}
      >
        <Check style={{ width: "16px", height: "16px" }} />
        {responding ? "Accepting…" : `Accept peer request from ${targetName}`}
      </button>
    );
  }

  if (status === "pending" && iAmRequester) {
    return (
      <div
        className="w-full py-3 flex items-center justify-center gap-2"
        style={{
          borderRadius: "14px",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#64748B",
          fontSize: "14px",
          fontWeight: "700",
        }}
      >
        <Clock style={{ width: "16px", height: "16px" }} />
        Peer request sent
      </div>
    );
  }

  return (
    <button
      disabled={sending}
      onClick={() =>
        sendRequest(
          { addresseeId: targetUserId },
          { onSuccess: () => refetch() }
        )
      }
      className="w-full py-3 flex items-center justify-center gap-2"
      style={{
        borderRadius: "14px",
        backgroundColor: "rgba(59,130,246,0.12)",
        border: "1px solid rgba(59,130,246,0.25)",
        color: "#3B82F6",
        fontSize: "14px",
        fontWeight: "700",
      }}
    >
      <UserPlus style={{ width: "16px", height: "16px" }} />
      {sending ? "Sending…" : "Connect as peers"}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = (location.state ?? {}) as {
    name?: string;
    location?: { city?: string | null };
    locationCity?: string;
    sourceLabel?: string;
    selectedSport?: string;
  };

  const userId = id ? parseInt(id, 10) : null;
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  const { data: currentUserRes } = useCurrentUser();
  const { data: ratingsRes, isLoading } = usePlayerSkillRating(userId);
  const ratings: any[] = (ratingsRes as any)?.data ?? [];
  const currentUserId = (currentUserRes as any)?.user?.id ?? null;
  const isSelf = !!userId && currentUserId === userId;
  const canInteract = !!userId && !isSelf;

  // Use route-state name until ratings load a name (ratings don't carry name, so state is the best source)
  const displayName = routeState.name ?? "Player";
  const displayCity = routeState.location?.city ?? routeState.locationCity;
  const sourceLabel = routeState.sourceLabel;

  const topRating = ratings[0];
  const topTier = topRating ? ratingTier(topRating.rating) : null;

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-white truncate" style={{ fontSize: "22px", fontWeight: "800" }}>
              {displayName}
            </h1>
            {sourceLabel && (
              <span
                className="flex-shrink-0 px-2 py-0.5"
                style={{
                  borderRadius: "8px",
                  backgroundColor: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#6366F1",
                }}
              >
                {sourceLabel}
              </span>
            )}
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            {displayCity ? `${displayCity} · Sportza Ratings` : "Sportza Ratings"}
          </p>
        </div>
      </div>

      {/* Avatar initial block */}
      {displayName !== "Player" && (
        <div className="flex items-center gap-4 mb-5">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "#3B82F620",
              border: "1px solid rgba(59,130,246,0.2)",
              fontSize: "24px",
              fontWeight: "800",
              color: "#3B82F6",
            }}
          >
            {getInitial(displayName)}
          </div>
          <div>
            <p className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>{displayName}</p>
            {displayCity && (
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{displayCity}</p>
            )}
          </div>
        </div>
      )}

      {/* Action row — only for other players */}
      {canInteract && userId && (
        <div className="flex flex-col gap-2 mb-5">
          <PeerActionArea
            targetUserId={userId}
            targetName={displayName}
            onCompare={() => navigate(`/players/${userId}/compare`, { state: routeState })}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowInviteSheet(true)}
              className="flex-1 py-3 flex items-center justify-center gap-2"
              style={{
                borderRadius: "14px",
                backgroundColor: "#3B82F6",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              <Mail style={{ width: "15px", height: "15px" }} />
              Invite to play
            </button>
            <button
              onClick={() => navigate("/matchmaking/invites")}
              className="px-4 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#1E293B",
                color: "#94A3B8",
                fontSize: "13px",
                fontWeight: "700",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              My invites
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }} />
          ))}
        </div>
      ) : ratings.length === 0 ? (
        <div
          className="flex flex-col items-center text-center p-8"
          style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="flex items-center justify-center mb-4"
            style={{ width: "60px", height: "60px", borderRadius: "16px", backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <Users style={{ width: "28px", height: "28px", color: "#64748B" }} />
          </div>
          <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
            No public ratings yet
          </p>
          <p className="text-[#64748B] mb-4" style={{ fontSize: "13px", lineHeight: "1.5" }}>
            {displayName} hasn't completed rated matches yet. You can still invite them to play or connect as peers.
          </p>
          {canInteract && (
            <button
              onClick={() => setShowInviteSheet(true)}
              className="px-6 py-2.5"
              style={{
                borderRadius: "12px",
                backgroundColor: "#3B82F6",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Invite {displayName} to play
            </button>
          )}
        </div>
      ) : (
        <>
          {topRating && topTier && (
            <div
              className="flex items-center gap-4 p-5 mb-5"
              style={{
                borderRadius: "20px",
                backgroundColor: `${topTier.color}10`,
                border: `1px solid ${topTier.color}30`,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  backgroundColor: `${topTier.color}20`,
                }}
              >
                <Shield style={{ width: "26px", height: "26px", color: topTier.color }} />
              </div>
              <div>
                <p style={{ fontSize: "12px", color: topTier.color, fontWeight: "700" }}>
                  TOP SPORTZA RATING
                </p>
                <p className="text-white" style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                  {topRating.rating}
                </p>
                <p style={{ fontSize: "13px", color: "#94A3B8" }}>
                  {topRating.sport?.displayName} · {topTier.label}
                </p>
              </div>
            </div>
          )}

          <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
            SPORTZA RATINGS
          </p>
          <div className="space-y-3">
            {ratings.map((r: any) => (
              <SportRatingCard key={r.sport?.id} r={r} />
            ))}
          </div>

          <div
            className="flex items-start gap-3 mt-5 p-4"
            style={{
              borderRadius: "14px",
              backgroundColor: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            <TrendingUp style={{ width: "16px", height: "16px", color: "#3B82F6", marginTop: "2px", flexShrink: 0 }} />
            <p className="text-[#64748B]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
              Sportza Ratings update after every competitive or tournament match. Deeper comparison is available for accepted peers.
            </p>
          </div>
        </>
      )}

      {showInviteSheet && userId && (
        <PeerInviteSheet
          receiverId={userId}
          receiverName={displayName}
          defaultSportId={topRating?.sport?.id ?? null}
          onClose={() => setShowInviteSheet(false)}
        />
      )}
    </div>
  );
}
