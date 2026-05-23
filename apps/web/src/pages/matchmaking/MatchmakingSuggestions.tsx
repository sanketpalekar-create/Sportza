import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useMatchmakingSuggestions,
  useMySkillRatings,
  usePlayerNetwork,
  useSearchUsers,
  useSports,
} from "@sportza/api-client";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import PeerInviteSheet from "../../components/PeerInviteSheet";

function ratingTier(rating: number) {
  if (rating >= 1400) return { label: "Elite", color: "#A855F7" };
  if (rating >= 1200) return { label: "Advanced", color: "#3B82F6" };
  if (rating >= 1000) return { label: "Intermediate", color: "#22C55E" };
  return { label: "Beginner", color: "#F59E0B" };
}

function confidenceLabel(confidence?: string) {
  switch (confidence) {
    case "master": return "Master";
    case "expert": return "Expert";
    case "advanced": return "Advanced";
    case "established": return "Established";
    case "developing": return "Developing";
    case "beginner": return "Beginner";
    case "unranked": return "Unranked";
    case "high": return "Established";
    case "medium": return "Developing";
    case "provisional": return "Beginner";
    default: return "Unranked";
  }
}

function ratingMeta(rating: { rating: number; confidence?: string }) {
  const confidence = confidenceLabel(rating.confidence);
  if (confidence === "Unranked") {
    return { label: "Unranked", color: "#94A3B8" };
  }
  return ratingTier(rating.rating);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatMatchCount(matchesPlayed?: number) {
  const total = matchesPlayed ?? 0;
  return `${total} match${total === 1 ? "" : "es"}`;
}

function SportChoiceCard({
  rating,
  onClick,
}: {
  rating: any;
  onClick: () => void;
}) {
  const tier = ratingMeta(rating);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5"
      style={{
        borderRadius: "20px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-white truncate" style={{ fontSize: "18px", fontWeight: "700" }}>
              {rating.sport?.displayName ?? rating.sport?.name}
            </span>
            <span
              className="px-2 py-0.5"
              style={{
                borderRadius: "999px",
                backgroundColor: `${tier.color}20`,
                fontSize: "11px",
                fontWeight: "700",
                color: tier.color,
              }}
            >
              {tier.label}
            </span>
          </div>
          <span className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {confidenceLabel(rating.confidence)} · {formatMatchCount(rating.matchesPlayed)}
          </span>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-white" style={{ fontSize: "30px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            {rating.rating}
          </div>
          <span className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "600" }}>
            Sportza Rating
          </span>
        </div>
      </div>
    </button>
  );
}

function CompactRatingBadge({ rating }: { rating: any }) {
  const tier = ratingMeta(rating);

  return (
    <div
      className="p-4 mb-5"
      style={{
        borderRadius: "18px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                backgroundColor: tier.color,
              }}
            />
            <span className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
              Your Sportza Rating
            </span>
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {confidenceLabel(rating.confidence)} · {formatMatchCount(rating.matchesPlayed)}
          </p>
        </div>

        <div className="text-right">
          <div className="text-white" style={{ fontSize: "30px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            {rating.rating}
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
            {tier.label}
          </p>
        </div>
      </div>
    </div>
  );
}

function OpenPlayCard({ op, onClick }: { op: any; onClick: () => void }) {
  const spotsLeft = op.maxPlayers - (op.players?.length ?? 0);
  const tier =
    op.skillRatingMin && op.skillRatingMax
      ? ratingTier(Math.round((op.skillRatingMin + op.skillRatingMax) / 2))
      : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
              {op.title ?? `${op.sport} Open Play`}
            </span>
            {tier && (
              <span
                className="px-2 py-0.5"
                style={{
                  borderRadius: "999px",
                  backgroundColor: `${tier.color}18`,
                  fontSize: "10px",
                  fontWeight: "700",
                  color: tier.color,
                }}
              >
                Sportza {op.skillRatingMin}–{op.skillRatingMax}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#94A3B8]" style={{ fontSize: "13px" }}>
            {op.venue?.name && (
              <span className="flex items-center gap-1">
                <MapPin style={{ width: "12px", height: "12px" }} />
                {op.venue.name}
              </span>
            )}
            {op.bookingDate && (
              <span className="flex items-center gap-1">
                <Clock style={{ width: "12px", height: "12px" }} />
                {formatDate(op.bookingDate)}
                {op.startTime && ` · ${op.startTime}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div
            className="flex items-center gap-1 px-2.5 py-1"
            style={{
              borderRadius: "999px",
              backgroundColor:
                spotsLeft <= 3 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
              fontSize: "12px",
              fontWeight: "700",
              color: spotsLeft <= 3 ? "#EF4444" : "#22C55E",
            }}
          >
            <Users style={{ width: "11px", height: "11px" }} />
            {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
          </div>

          {op.pricePerPlayer > 0 ? (
            <span className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "700" }}>
              ₹{op.pricePerPlayer}
            </span>
          ) : (
            <span className="text-[#22C55E]" style={{ fontSize: "12px", fontWeight: "600" }}>
              Free
            </span>
          )}

          <ChevronRight style={{ width: "16px", height: "16px", color: "#475569" }} />
        </div>
      </div>
    </button>
  );
}

function PlayerDiscoveryCard({
  player,
  onOpenProfile,
  onInvite,
}: {
  player: {
    userId: number;
    user: { name?: string; location?: { city?: string | null } | null };
    rating: number;
    sourceLabel: string;
  };
  onOpenProfile: () => void;
  onInvite: () => void;
}) {
  const tier = ratingTier(player.rating);
  const initial = player.user?.name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div
      className="p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <button onClick={onOpenProfile} className="flex flex-1 items-start gap-3 text-left min-w-0">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{
              width: "42px",
              height: "42px",
              backgroundColor: `${tier.color}22`,
              fontSize: "16px",
              fontWeight: "700",
              color: tier.color,
            }}
          >
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white truncate" style={{ fontSize: "15px", fontWeight: "700" }}>
                {player.user?.name ?? "Player"}
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
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
              Sportza Rating {player.rating}
            </p>
            <p className="text-[#475569]" style={{ fontSize: "11px" }}>
              {player.sourceLabel}
              {player.user?.location?.city ? ` · ${player.user.location.city}` : ""}
            </p>
          </div>
        </button>

        <button
          onClick={onInvite}
          className="px-3 py-2 flex-shrink-0"
          style={{
            borderRadius: "12px",
            backgroundColor: "#3B82F6",
            color: "#fff",
            fontSize: "12px",
            fontWeight: "700",
          }}
        >
          Invite
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="flex flex-col items-center text-center p-8"
      style={{
        borderRadius: "20px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "16px",
          backgroundColor: "rgba(255,255,255,0.05)",
        }}
      >
        <Users style={{ width: "28px", height: "28px", color: "#3B82F6" }} />
      </div>
      <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
        {title}
      </p>
      <p className="text-[#64748B] mb-4" style={{ fontSize: "13px", lineHeight: "1.5" }}>
        {subtitle}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5"
          style={{
            borderRadius: "12px",
            backgroundColor: "#3B82F6",
            color: "#fff",
            fontSize: "14px",
            fontWeight: "700",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function SearchPlayersSheet({
  sportName,
  onClose,
  onOpenProfile,
}: {
  sportName: string;
  onClose: () => void;
  onOpenProfile: (userId: number, hint?: { name?: string; location?: { city?: string } }) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const { data: searchRes, isLoading } = useSearchUsers(trimmedQuery);
  const results = ((searchRes as any)?.users ?? []) as any[];

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="absolute bottom-[88px] left-0 right-0 mx-auto flex w-full max-w-md flex-col px-4 pt-4"
        style={{
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          backgroundColor: "#0F172A",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "min(70vh, calc(100dvh - 112px))",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-white" style={{ fontSize: "18px", fontWeight: "700" }}>
              Search players
            </h2>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
              Find by name, phone, or email for {sportName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              backgroundColor: "#1E293B",
            }}
          >
            <X style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
          </button>
        </div>

        <div
          className="flex items-center gap-3 px-4 mb-4"
          style={{
            height: "48px",
            borderRadius: "14px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Search style={{ width: "16px", height: "16px", color: "#64748B", flexShrink: 0 }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or email"
            className="flex-1 bg-transparent outline-none text-white placeholder-[#64748B]"
            style={{ fontSize: "14px" }}
          />
        </div>

        <div className="space-y-3 overflow-y-auto pb-6">
          {trimmedQuery.length < 2 ? (
            <div
              className="p-4 text-center"
              style={{
                borderRadius: "16px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                Start typing at least 2 characters.
              </p>
            </div>
          ) : isLoading ? (
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 animate-pulse"
                style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
              />
            ))
          ) : results.length > 0 ? (
            results.map((user) => (
              <button
                key={user.id}
                onClick={() => onOpenProfile(user.id, { name: user.name, location: (user as any).location })}
                className="w-full text-left p-4"
                style={{
                  borderRadius: "16px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white truncate" style={{ fontSize: "15px", fontWeight: "700" }}>
                      {user.name ?? "Player"}
                    </p>
                    <p className="text-[#64748B] truncate" style={{ fontSize: "12px" }}>
                      {user.phone || user.email || "Open profile"}
                    </p>
                    {(user.email && user.phone) && (
                      <p className="text-[#475569] truncate" style={{ fontSize: "11px" }}>
                        {user.email}
                      </p>
                    )}
                  </div>
                  <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "700" }}>
                    View
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div
              className="p-4 text-center"
              style={{
                borderRadius: "16px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                No players matched that search.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MatchmakingSuggestions() {
  const navigate = useNavigate();
  const [selectedSportName, setSelectedSportName] = useState<string | null>(null);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<{
    id: number;
    name?: string;
    sportId?: number | null;
  } | null>(null);

  const { data: ratingsRes, isLoading: isRatingsLoading } = useMySkillRatings();
  const { data: sportsRes } = useSports();
  const { data: networkRes } = usePlayerNetwork();
  const { data: suggestionsRes, isLoading, refetch } = useMatchmakingSuggestions(
    selectedSportName ? { sport: selectedSportName } : undefined
  );

  const allSports = ((sportsRes as any)?.data ?? (sportsRes as any) ?? []) as any[];
  const myRatings = (((ratingsRes as any)?.data ?? []) as any[]).filter(
    (rating) => (rating.formatName ?? "overall") === "overall"
  );
  const suggestions = (suggestionsRes as any)?.data;
  const network = (networkRes as any)?.data;

  const sportChoices = useMemo(() => {
    const ratingBySportName = new Map<string, any>();
    myRatings.forEach((rating) => {
      if (rating.sport?.name) {
        ratingBySportName.set(rating.sport.name, rating);
      }
    });

    const merged = allSports.map((sport) => {
      const existing = ratingBySportName.get(sport.name);
      return existing ?? {
        sport,
        rating: 1000,
        confidence: "unranked",
        matchesPlayed: 0,
        formatName: "overall",
      };
    });

    const existingOnly = myRatings.filter(
      (rating) => rating.sport?.name && !allSports.some((sport) => sport.name === rating.sport?.name)
    );

    return [...merged, ...existingOnly].sort((a, b) => {
      const aPlayed = (a.matchesPlayed ?? 0) > 0 ? 1 : 0;
      const bPlayed = (b.matchesPlayed ?? 0) > 0 ? 1 : 0;
      if (aPlayed !== bPlayed) return bPlayed - aPlayed;
      if (aPlayed === 1 && bPlayed === 1) return (b.rating ?? 0) - (a.rating ?? 0);
      return String(a.sport?.displayName ?? a.sport?.name ?? "").localeCompare(
        String(b.sport?.displayName ?? b.sport?.name ?? "")
      );
    });
  }, [allSports, myRatings]);

  const selectedRating =
    sportChoices.find((rating) => rating.sport?.name === selectedSportName) ?? null;
  const openPlays: any[] = selectedSportName ? suggestions?.openPlays ?? [] : [];
  const peerPlayers: any[] = selectedSportName
    ? (Object.values(suggestions?.peers ?? {}).flat() as any[])
    : [];

  const recentlyPlayed = useMemo(() => {
    if (!selectedSportName) return [];

    const players = ((network?.recentlyPlayedWith ?? []) as any[])
      .map((player) => {
        const match = (player.sportRatings ?? []).find(
          (rating: any) => rating.sport?.name === selectedSportName
        );
        if (!match) return null;

        return {
          userId: player.userId,
          user: player.user,
          rating: match.rating,
          sportId: match.sport?.id,
          sourceLabel: "Recently played",
        };
      })
      .filter(Boolean);

    const seen = new Set<number>();
    return players.filter((player: any) => {
      if (seen.has(player.userId)) return false;
      seen.add(player.userId);
      return true;
    });
  }, [network, selectedSportName]);

  const playerOptions = useMemo(() => {
    if (!selectedSportName) return [];

    const recentIds = new Set<number>(recentlyPlayed.map((player: any) => player.userId));
    const frequentOpponents = (network?.frequentOpponents ?? []) as any[];
    const venueConnections = (network?.venueConnections ?? []) as any[];
    const nearbyPlayers = (network?.nearbyPlayers ?? []) as any[];

    const normalizedPeers = peerPlayers.map((peer) => ({
      userId: peer.userId,
      user: peer.user,
      rating: peer.rating,
      sportId: peer.sport?.id,
      sourceLabel: "Best match",
    }));

    const normalizedOpponents = frequentOpponents
      .map((player: any) => {
        const match = (player.sportRatings ?? []).find(
          (rating: any) => rating.sport?.name === selectedSportName
        );
        if (!match) return null;
        return {
          userId: player.userId,
          user: player.user,
          rating: match.rating,
          sportId: match.sport?.id,
          sourceLabel: "Frequent opponent",
        };
      })
      .filter(Boolean);

    const normalizedVenue = venueConnections.flatMap((group: any) =>
      (group.players ?? [])
        .map((player: any) => {
          const match = (player.sportRatings ?? []).find(
            (rating: any) => rating.sport?.name === selectedSportName
          );
          if (!match) return null;
          return {
            userId: player.userId,
            user: player.user,
            rating: match.rating,
            sportId: match.sport?.id,
            sourceLabel: group.venue?.name ? `Same venue · ${group.venue.name}` : "Same venue",
          };
        })
        .filter(Boolean)
    );

    const normalizedNearby = nearbyPlayers
      .map((player: any) => {
        const match = (player.sportRatings ?? []).find(
          (rating: any) => rating.sport?.name === selectedSportName
        );
        if (!match) return null;
        return {
          userId: player.userId,
          user: player.user,
          rating: match.rating,
          sportId: match.sport?.id,
          sourceLabel: "Nearby",
        };
      })
      .filter(Boolean);

    const merged = [...normalizedPeers, ...normalizedOpponents, ...normalizedVenue, ...normalizedNearby];
    const seen = new Set<number>();

    return merged.filter((player: any) => {
      if (!player || recentIds.has(player.userId) || seen.has(player.userId)) return false;
      seen.add(player.userId);
      return true;
    });
  }, [network, peerPlayers, recentlyPlayed, selectedSportName]);

  const handleSelectSport = (sportName?: string) => {
    if (!sportName) return;
    setSelectedSportName(sportName);
    setShowPlayers(false);
    setShowSearch(false);
  };

  const handleOpenPlayerProfile = (userId: number, playerHint?: { name?: string; location?: { city?: string } }) => {
    setShowSearch(false);
    navigate(`/players/${userId}`, {
      state: {
        name: playerHint?.name,
        location: playerHint?.location,
        sourceLabel: "Search",
        selectedSport: selectedSportName,
      },
    });
  };

  if (selectedSportName) {
    return (
      <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                setSelectedSportName(null);
                setShowPlayers(false);
                setShowSearch(false);
              }}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "#1E293B",
              }}
            >
              <ArrowLeft style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
            </button>

            <div className="min-w-0">
              <h1 className="text-white truncate" style={{ fontSize: "24px", fontWeight: "800" }}>
                {selectedRating?.sport?.displayName ?? selectedSportName}
              </h1>
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                Find open games for this sport
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/matchmaking/invites")}
              className="px-3 py-2"
              style={{
                borderRadius: "12px",
                backgroundColor: "#1E293B",
                color: "#94A3B8",
                fontSize: "12px",
                fontWeight: "700",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Invites & Peers
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "#1E293B",
              }}
            >
              <RefreshCw style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
            </button>
          </div>
        </div>

        {selectedRating && <CompactRatingBadge rating={selectedRating} />}

        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.05em" }}>
            OPEN GAMES
          </p>
          {openPlays.length > 0 && (
            <button
              onClick={() => navigate("/open-plays/create", { state: { sportName: selectedSportName } })}
              className="px-3 py-2"
              style={{
                borderRadius: "12px",
                backgroundColor: "rgba(59,130,246,0.14)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#3B82F6",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              Host Session
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse"
                style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
              />
            ))}
          </div>
        ) : openPlays.length === 0 ? (
          <EmptyState
            title="No open games right now"
            subtitle="Nothing is available for this sport at the moment."
            action={{
              label: "Create a Game",
              onClick: () => navigate("/open-plays/create", { state: { sportName: selectedSportName } }),
            }}
          />
        ) : (
          <div className="space-y-3">
            {openPlays.map((op: any) => (
              <OpenPlayCard
                key={op.id}
                op={op}
                onClick={() => navigate(`/open-plays/${op.id}`)}
              />
            ))}
          </div>
        )}

        {recentlyPlayed.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.05em" }}>
                RECENTLY PLAYED
              </p>
              <span className="text-[#64748B]" style={{ fontSize: "12px" }}>
                People you already know
              </span>
            </div>
            <div className="space-y-3">
              {recentlyPlayed.slice(0, 3).map((player: any) => (
                <PlayerDiscoveryCard
                  key={player.userId}
                  player={player}
                  onOpenProfile={() =>
                    navigate(`/players/${player.userId}`, {
                      state: {
                        name: player.user?.name,
                        location: player.user?.location,
                        sourceLabel: "Recently played",
                        selectedSport: selectedSportName,
                      },
                    })
                  }
                  onInvite={() =>
                    setInviteTarget({
                      id: player.userId,
                      name: player.user?.name,
                      sportId: player.sportId,
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(`/training?sport=${encodeURIComponent(selectedSportName)}`)}
            className="text-[#64748B]"
            style={{ fontSize: "13px", fontWeight: "600" }}
          >
            Browse Training Sessions
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSearch(true)}
              className="text-[#94A3B8]"
              style={{ fontSize: "13px", fontWeight: "600" }}
            >
              Search Players
            </button>
            <button
              onClick={() => setShowPlayers((value) => !value)}
              className="text-[#3B82F6]"
              style={{ fontSize: "13px", fontWeight: "600" }}
            >
              {showPlayers ? "Hide Players" : "Find Players"}
            </button>
          </div>
        </div>

        {showPlayers && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.05em" }}>
                DISCOVER PLAYERS
              </p>
              <span className="text-[#64748B]" style={{ fontSize: "12px" }}>
                Peers, venues, nearby
              </span>
            </div>

            {playerOptions.length > 0 ? (
              <div className="space-y-3">
                {playerOptions.slice(0, 8).map((player: any) => (
                  <PlayerDiscoveryCard
                    key={player.userId}
                    player={player}
                    onOpenProfile={() =>
                      navigate(`/players/${player.userId}`, {
                        state: {
                          name: player.user?.name,
                          location: player.user?.location,
                          sourceLabel: "Discover players",
                          selectedSport: selectedSportName,
                        },
                      })
                    }
                    onInvite={() =>
                      setInviteTarget({
                        id: player.userId,
                        name: player.user?.name,
                        sportId: player.sportId,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div
                className="p-4 text-center"
                style={{
                  borderRadius: "16px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                  No additional players found for this sport yet.
                </p>
              </div>
            )}
          </div>
        )}

        {showSearch && (
          <SearchPlayersSheet
            sportName={selectedRating?.sport?.displayName ?? selectedSportName}
            onClose={() => setShowSearch(false)}
            onOpenProfile={handleOpenPlayerProfile}
          />
        )}

        {inviteTarget && (
          <PeerInviteSheet
            receiverId={inviteTarget.id}
            receiverName={inviteTarget.name}
            defaultSportId={inviteTarget.sportId ?? selectedRating?.sport?.id ?? null}
            onClose={() => setInviteTarget(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white mb-1" style={{ fontSize: "26px", fontWeight: "800" }}>
            Find a Game
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Rated sports first, everything else stays available as Unranked
          </p>
        </div>
        <button
          onClick={() => navigate("/matchmaking/invites")}
          className="px-3 py-2"
          style={{
            borderRadius: "12px",
            backgroundColor: "#1E293B",
            color: "#94A3B8",
            fontSize: "12px",
            fontWeight: "700",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Invites & Peers
        </button>
      </div>

      {isRatingsLoading && sportChoices.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse"
              style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}
            />
          ))}
        </div>
      ) : sportChoices.length > 0 ? (
        <div className="space-y-3">
          {sportChoices.map((rating: any) => (
            <SportChoiceCard
              key={rating.sport?.id ?? rating.sport?.name}
              rating={rating}
              onClick={() => handleSelectSport(rating.sport?.name)}
            />
          ))}
        </div>
      ) : (
        <div
          className="p-5 flex items-start gap-3"
          style={{
            borderRadius: "20px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Star style={{ width: "20px", height: "20px", color: "#3B82F6", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
              Your ratings are getting ready
            </p>
            <p className="text-[#64748B]" style={{ fontSize: "13px", lineHeight: "1.5" }}>
              Active sports will appear here as soon as they load.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
