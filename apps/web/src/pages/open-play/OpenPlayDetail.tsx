/**
 * Open Play Detail — Social / Community Layer
 *
 * Key insight: "Users hesitate due to uncertainty of players"
 * → Solve via: player visibility, skill transparency, urgency signals
 *
 * Join flow:
 *   Free session  → POST /join → green "You're in!" confirmation
 *   Paid session  → POST /join → Razorpay modal → payment confirmation screen
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapEmbed from "../../components/MapEmbed";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Settings,
  CheckCircle2,
  UserPlus,
  Trophy,
  Zap,
  Info,
  XCircle,
  CreditCard,
  LogIn,
  Lock,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useOpenPlay, useJoinOpenPlay, useLeaveOpenPlay, useCurrentUser } from "@sportza/api-client";
import { useRazorpayCheckout } from "../../hooks/useRazorpayCheckout";
import { format } from "date-fns";

// ─── Sport emoji ──────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", pickleball: "🏓",
};

// ─── Skill level colors ───────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  beginner:     { color: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
  intermediate: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  advanced:     { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  pro:          { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.3)"  },
};
function levelStyle(level?: string) {
  return LEVEL_COLORS[level?.toLowerCase() ?? ""] ?? { color: "#94A3B8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse px-4 pt-4 space-y-4">
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
      <div className="h-36 rounded-2xl bg-[#1E293B]" />
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
    </div>
  );
}

// ─── Player avatar ────────────────────────────────────────────────────────────
function PlayerAvatar({
  name,
  avatar,
  isHost,
}: {
  name: string;
  avatar?: string | null;
  isHost: boolean;
}) {
  const initials = name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex items-center justify-center text-white"
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          backgroundColor: isHost ? "#3B82F6" : "#1E293B",
          border: isHost ? "2px solid #3B82F6" : "2px solid rgba(255,255,255,0.1)",
          fontSize: "15px",
          fontWeight: "700",
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          initials || "?"
        )}
        {isHost && (
          <div
            className="absolute -bottom-1 -right-1 flex items-center justify-center"
            style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#F59E0B" }}
          >
            <Trophy style={{ width: "9px", height: "9px", color: "#000" }} />
          </div>
        )}
      </div>
      <span className="text-[#94A3B8] text-center" style={{ fontSize: "10px", fontWeight: "500", maxWidth: "44px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {isHost ? "Host" : name.split(" ")[0]}
      </span>
    </div>
  );
}

// ─── Empty slot ───────────────────────────────────────────────────────────────
function EmptySlot() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex items-center justify-center"
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          backgroundColor: "#111827",
          border: "2px dashed rgba(255,255,255,0.1)",
        }}
      >
        <UserPlus style={{ width: "16px", height: "16px", color: "#374151" }} />
      </div>
      <span className="text-[#374151]" style={{ fontSize: "10px" }}>Open</span>
    </div>
  );
}

// ─── Payment confirmation overlay ─────────────────────────────────────────────
function PaymentConfirmation({
  sport,
  title,
  amount,
  venueName,
  onDone,
}: {
  sport: string;
  title: string;
  amount: number;
  venueName: string;
  onDone: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#0F172A" }}
    >
      {/* Animated checkmark ring */}
      <div
        className="flex items-center justify-center mb-8"
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
          border: "2px solid rgba(34,197,94,0.4)",
        }}
      >
        <CheckCircle2 style={{ width: "52px", height: "52px", color: "#22C55E" }} />
      </div>

      <h1 className="text-white text-center mb-2" style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
        Payment confirmed!
      </h1>
      <p className="text-[#94A3B8] text-center mb-8" style={{ fontSize: "15px", lineHeight: "1.6" }}>
        You're in the session. Your spot is secured.
      </p>

      {/* Summary card */}
      <div
        className="w-full max-w-sm p-5 mb-8 space-y-3"
        style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Session</span>
          <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{title}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Sport</span>
          <span className="text-white" style={{ fontSize: "14px", fontWeight: "600", textTransform: "capitalize" }}>{sport}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Venue</span>
          <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{venueName}</span>
        </div>
        <div
          className="flex items-center justify-between pt-3 mt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[#64748B]" style={{ fontSize: "13px" }}>Amount paid</span>
          <span className="text-[#22C55E]" style={{ fontSize: "20px", fontWeight: "800" }}>₹{amount}</span>
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full max-w-sm py-4 text-white"
        style={{
          borderRadius: "16px",
          background: "linear-gradient(135deg,#3B82F6,#6366F1)",
          fontSize: "17px",
          fontWeight: "700",
        }}
      >
        View Session
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OpenPlayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useOpenPlay(Number(id));
  const { data: userRes } = useCurrentUser();
  const joinMutation  = useJoinOpenPlay();
  const leaveMutation = useLeaveOpenPlay();
  const razorpayCheckout = useRazorpayCheckout();

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  // Optimistic state — null means "use server data"
  const [optimisticJoined, setOptimisticJoined] = useState<boolean | null>(null);
  const [optimisticPlayers, setOptimisticPlayers] = useState<any[] | null>(null);
  // Payment confirmation overlay state
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  // Reset optimistic state when navigating to a different session
  useEffect(() => {
    setOptimisticJoined(null);
    setOptimisticPlayers(null);
    setShowPaymentConfirm(false);
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const openPlay = (data as any)?.data ?? (data as any);
  const currentUser = (userRes as any)?.user ?? (userRes as any)?.data?.user;
  const currentUserId: number | undefined = currentUser?.id;
  const isAuthenticated = !!currentUserId;

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

  if (!openPlay) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center">
        <div>
          <Users style={{ width: "48px", height: "48px", color: "#64748B", margin: "0 auto 16px" }} />
          <h2 className="text-white mb-4" style={{ fontSize: "18px", fontWeight: "700" }}>Session not found</h2>
          <button onClick={() => navigate("/open-plays")} className="px-6 py-3 text-white"
            style={{ borderRadius: "14px", backgroundColor: "#3B82F6", fontSize: "15px", fontWeight: "600" }}>
            Browse Sessions
          </button>
        </div>
      </div>
    );
  }

  // Payment confirmation screen (shown after Razorpay success)
  if (showPaymentConfirm && openPlay.pricePerPlayer > 0) {
    return (
      <PaymentConfirmation
        sport={openPlay.sport ?? ""}
        title={openPlay.title ?? `${openPlay.sport} Open Play`}
        amount={openPlay.pricePerPlayer}
        venueName={openPlay.venue?.name ?? openPlay.facilityName ?? "Venue"}
        onDone={() => {
          setShowPaymentConfirm(false);
          refetch();
        }}
      />
    );
  }

  const serverPlayers = (openPlay.players ?? []) as any[];
  const players      = optimisticPlayers ?? serverPlayers;
  const maxPlayers   = openPlay.maxPlayers ?? 10;
  const minimumPlayers = openPlay.minimumPlayers ?? 2;
  const spotsLeft    = maxPlayers - players.length;
  const fillPercent  = Math.min((players.length / maxPlayers) * 100, 100);
  const minFillPercent = Math.min((players.length / minimumPlayers) * 100, 100);
  const serverHasJoined = !!currentUserId && serverPlayers.some((p: any) => p.userId === currentUserId);
  const hasJoined    = optimisticJoined !== null ? optimisticJoined : serverHasJoined;
  const isCreator    = !!currentUserId && openPlay.createdById === currentUserId;
  const isFull       = spotsLeft <= 0;
  const urgency      = spotsLeft > 0 && spotsLeft <= 3;
  const isOpen       = openPlay.status === "open";
  const isPaidSession = openPlay.pricePerPlayer != null && openPlay.pricePerPlayer > 0;
  const isPricingLocked = !!openPlay.pricingLockedAt;
  const joinDeadline = openPlay.joinDeadlineAt ? new Date(openPlay.joinDeadlineAt) : null;
  const isViable = players.length >= minimumPlayers;
  // Price range (before lock)
  const totalVenueCost = openPlay.booking?.totalAmount ?? 0;
  const priceRangeLow = totalVenueCost > 0 ? Math.round(totalVenueCost / maxPlayers) : openPlay.pricePerPlayer ?? 0;
  const priceRangeHigh = totalVenueCost > 0 ? Math.round(totalVenueCost / minimumPlayers) : openPlay.pricePerPlayer ?? 0;

  const sportEmoji = SPORT_EMOJI[openPlay.sport?.toLowerCase()] ?? "🏅";
  const lvl = levelStyle(openPlay.skillLevel);

  const bookingDate = openPlay.bookingDate
    ? (() => { try { return new Date(openPlay.bookingDate); } catch { return null; } })()
    : null;

  // Build all slots (filled + empty)
  const allSlots = Array.from({ length: maxPlayers }, (_, i) => players[i] ?? null);

  // ── Join handler ────────────────────────────────────────────────────────────
  function handleJoin() {
    if (!isAuthenticated) {
      navigate("/login", { state: { returnTo: `/open-plays/${id}` } });
      return;
    }

    // Optimistically add the current user to the list immediately
    const optimisticMe = {
      userId: currentUserId,
      user: { id: currentUserId, name: currentUser?.name ?? "You", avatar: currentUser?.avatar ?? null },
    };
    setOptimisticJoined(true);
    setOptimisticPlayers([...players, optimisticMe]);

    joinMutation.mutate(openPlay.id, {
      onSuccess: async (result: any) => {
        const joinData = result?.data ?? result;

        if (joinData?.requiresPayment && joinData?.bookingId) {
          // Paid session — trigger Razorpay modal
          setPaymentPending(true);
          await razorpayCheckout({
            amount: joinData.amount ?? openPlay.pricePerPlayer,
            bookingId: joinData.bookingId,
            description: `${openPlay.sport} Open Play — ${openPlay.venue?.name ?? openPlay.facilityName ?? "Venue"}`,
            prefillName: currentUser?.name,
            prefillEmail: currentUser?.email,
            onSuccess: () => {
              setPaymentPending(false);
              setOptimisticJoined(null);
              setOptimisticPlayers(null);
              setShowPaymentConfirm(true);
            },
            onFailure: (reason) => {
              // Player was added to session but payment was not completed yet
              setPaymentPending(false);
              setOptimisticJoined(null);
              setOptimisticPlayers(null);
              if (reason !== "Payment cancelled") {
                setToast({ type: "error", msg: reason ?? "Payment failed. You can complete payment from Bookings." });
              } else {
                setToast({ type: "error", msg: "Payment cancelled. Complete payment to secure your spot." });
              }
              refetch();
            },
          });
        } else {
          // Free session — show immediate confirmation
          setToast({ type: "success", msg: "You're in! See you on the court 🎉" });
          refetch().then(() => {
            setOptimisticJoined(null);
            setOptimisticPlayers(null);
          });
        }
      },
      onError: (err: any) => {
        // Rollback optimistic update
        setOptimisticJoined(null);
        setOptimisticPlayers(null);
        const msg = err?.response?.data?.message ?? "Failed to join session";
        setToast({ type: "error", msg });
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-36">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span className="text-white flex-1 truncate" style={{ fontSize: "17px", fontWeight: "600" }}>
          {openPlay.title ?? `${openPlay.sport} Open Play`}
        </span>
        {isCreator && (
          <button
            onClick={() => navigate(`/open-plays/${id}/manage`)}
            className="p-2"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B" }}
          >
            <Settings style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
          </button>
        )}
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Hero card ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          {/* Sport + Status row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "28px" }}>{sportEmoji}</span>
              <div>
                <p className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>
                  {openPlay.sport}
                </p>
                {(openPlay.formatName || openPlay.playersPerTeam) && (
                  <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                    {openPlay.formatName ?? `${openPlay.playersPerTeam}v${openPlay.playersPerTeam}`}
                  </p>
                )}
              </div>
            </div>
            <div
              className="px-3 py-1.5"
              style={{
                borderRadius: "999px",
                backgroundColor: isOpen ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: isOpen ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: "700", color: isOpen ? "#22C55E" : "#EF4444" }}>
                {openPlay.status
                  ? openPlay.status.charAt(0).toUpperCase() + openPlay.status.slice(1)
                  : "Open"}
              </span>
            </div>
          </div>

          {/* Skill level + rating range */}
          <div className="flex flex-wrap gap-2 mb-4">
            {openPlay.skillLevel && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1"
                style={{ borderRadius: "999px", backgroundColor: lvl.bg, border: `1px solid ${lvl.border}` }}
              >
                <Zap style={{ width: "12px", height: "12px", color: lvl.color }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: lvl.color, textTransform: "capitalize" }}>
                  {openPlay.skillLevel}
                </span>
              </div>
            )}
            {openPlay.skillRatingMin != null && openPlay.skillRatingMax != null && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1"
                style={{ borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <Zap style={{ width: "12px", height: "12px", color: "#3B82F6" }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#3B82F6" }}>
                  Rating {openPlay.skillRatingMin}–{openPlay.skillRatingMax}
                </span>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-2.5">
            {bookingDate && (
              <div className="flex items-center gap-3 text-[#94A3B8]">
                <Calendar style={{ width: "15px", height: "15px", flexShrink: 0 }} />
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  {format(bookingDate, "EEEE, MMMM d, yyyy")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[#94A3B8]">
              <Clock style={{ width: "15px", height: "15px", flexShrink: 0 }} />
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                {openPlay.startTime} – {openPlay.endTime}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[#94A3B8]">
              <MapPin style={{ width: "15px", height: "15px", flexShrink: 0 }} />
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                {openPlay.venue?.name ?? openPlay.facilityName ?? "Venue TBD"}
              </span>
            </div>
          </div>

          <MapEmbed
            lat={openPlay.venue?.location?.lat}
            lng={openPlay.venue?.location?.lng}
            label={openPlay.venue?.name ?? openPlay.facilityName}
            height="160px"
            className="mt-3"
          />

          {/* Price */}
          {openPlay.pricePerPlayer != null && (
            <div
              className="mt-4 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {isPricingLocked ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Lock style={{ width: "13px", height: "13px", color: "#22C55E" }} />
                    <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Final price/player</span>
                  </div>
                  <span style={{ fontSize: "22px", fontWeight: "800", color: "#22C55E" }}>
                    ₹{openPlay.finalPricePerPlayer ?? openPlay.pricePerPlayer}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp style={{ width: "13px", height: "13px", color: "#3B82F6" }} />
                    <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Estimated price</span>
                  </div>
                  <div className="text-right">
                    <span style={{ fontSize: "18px", fontWeight: "800", color: isPaidSession ? "#3B82F6" : "#22C55E" }}>
                      {isPaidSession
                        ? (priceRangeHigh > priceRangeLow
                            ? `₹${priceRangeLow}–₹${priceRangeHigh}`
                            : `₹${priceRangeLow}`)
                        : "Free"}
                    </span>
                    {isPaidSession && priceRangeHigh > priceRangeLow && (
                      <p className="text-[#64748B]" style={{ fontSize: "10px" }}>
                        depends on players who join
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Urgency chip ── */}
        {urgency && isOpen && (
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderRadius: "16px",
              backgroundColor: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <AlertTriangle style={{ width: "18px", height: "18px", color: "#F59E0B", flexShrink: 0 }} />
            <div>
              <p className="text-[#F59E0B]" style={{ fontSize: "14px", fontWeight: "700" }}>
                Only {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left!
              </p>
              <p className="text-[#92400E]" style={{ fontSize: "12px" }}>
                This session is filling up fast
              </p>
            </div>
          </div>
        )}

        {/* ── Viability / Minimum Players Card ── */}
        {isPaidSession && (
          <div
            className="p-4 space-y-3"
            style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users style={{ width: "15px", height: "15px", color: isViable ? "#22C55E" : "#F59E0B" }} />
                <span className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Session Viability</span>
              </div>
              {isViable ? (
                <span
                  className="px-2 py-0.5"
                  style={{ borderRadius: "999px", backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", fontSize: "11px", fontWeight: "700", color: "#22C55E" }}
                >
                  Confirmed ✓
                </span>
              ) : (
                <span
                  className="px-2 py-0.5"
                  style={{ borderRadius: "999px", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", fontSize: "11px", fontWeight: "700", color: "#F59E0B" }}
                >
                  {minimumPlayers - players.length} more needed
                </span>
              )}
            </div>

            {/* Progress toward minimum */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[#64748B]" style={{ fontSize: "11px" }}>
                  {players.length} of {minimumPlayers} minimum players
                </span>
                <span className="text-[#64748B]" style={{ fontSize: "11px" }}>
                  {Math.round(minFillPercent)}%
                </span>
              </div>
              <div style={{ height: "6px", borderRadius: "999px", backgroundColor: "#111827", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${minFillPercent}%`,
                    borderRadius: "999px",
                    background: isViable
                      ? "linear-gradient(90deg,#22C55E,#16A34A)"
                      : "linear-gradient(90deg,#F59E0B,#D97706)",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>

            {!isViable && (
              <p className="text-[#64748B]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
                If {minimumPlayers} players don't join before the deadline, the session auto-cancels and all payments are fully refunded to Sportza Wallet.
              </p>
            )}

            {/* Deadline */}
            {joinDeadline && (
              <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <Timer style={{ width: "13px", height: "13px", color: "#64748B", flexShrink: 0 }} />
                <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                  Join by {format(joinDeadline, "EEE, d MMM 'at' h:mm a")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Players ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Players</h2>
            </div>
            <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
              {players.length} / {maxPlayers} joined
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mb-5 overflow-hidden"
            style={{ height: "6px", borderRadius: "999px", backgroundColor: "#111827" }}
          >
            <div
              style={{
                height: "100%",
                width: `${fillPercent}%`,
                borderRadius: "999px",
                background: fillPercent >= 80
                  ? "linear-gradient(90deg,#F59E0B,#EF4444)"
                  : "linear-gradient(90deg,#3B82F6,#22C55E)",
                transition: "width 0.5s ease",
              }}
            />
          </div>

          {/* Social proof */}
          {players.length > 0 && (
            <p className="text-[#94A3B8] mb-4" style={{ fontSize: "13px" }}>
              <span className="text-white font-semibold">{players.length} player{players.length !== 1 ? "s" : ""}</span> already in — join them!
            </p>
          )}

          {/* Avatar grid */}
          <div className="flex flex-wrap gap-3">
            {allSlots.map((player, i) =>
              player ? (
                <PlayerAvatar
                  key={player.id ?? i}
                  name={player.user?.name ?? `Player ${i + 1}`}
                  avatar={player.user?.avatar}
                  isHost={player.userId === openPlay.createdById}
                />
              ) : (
                <EmptySlot key={`empty-${i}`} />
              )
            )}
          </div>
        </div>

        {/* ── Rules / notes ── */}
        {(openPlay.notes || openPlay.description) && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-2 mb-3">
              <Info style={{ width: "17px", height: "17px", color: "#94A3B8" }} />
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Rules & Notes</h2>
            </div>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.65" }}>
              {openPlay.notes ?? openPlay.description}
            </p>
          </div>
        )}

        {/* ── Host info ── */}
        {openPlay.host ?? openPlay.createdBy ? (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-3" style={{ fontSize: "16px", fontWeight: "700" }}>Host</h2>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 flex items-center justify-center text-white"
                style={{ borderRadius: "50%", backgroundColor: "#3B82F6", fontSize: "16px", fontWeight: "700" }}
              >
                {((openPlay.host?.name ?? openPlay.createdBy?.name ?? "H") as string)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                  {openPlay.host?.name ?? openPlay.createdBy?.name ?? "Host"}
                </p>
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 mt-1"
                  style={{ borderRadius: "999px", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
                >
                  <Trophy style={{ width: "10px", height: "10px", color: "#F59E0B" }} />
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#F59E0B" }}>Organiser</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className="fixed top-4 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 max-w-md mx-auto"
          style={{
            borderRadius: "14px",
            backgroundColor: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            backdropFilter: "blur(12px)",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 style={{ width: "18px", height: "18px", color: "#22C55E", flexShrink: 0 }} />
          ) : (
            <XCircle style={{ width: "18px", height: "18px", color: "#EF4444", flexShrink: 0 }} />
          )}
          <span style={{ fontSize: "14px", fontWeight: "600", color: toast.type === "success" ? "#22C55E" : "#EF4444" }}>
            {toast.msg}
          </span>
        </div>
      )}

      {/* ── Sticky CTA ── */}
      {!isCreator && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top, #0F172A 70%, transparent)" }}
        >
          <div className="max-w-md mx-auto">
            {!isAuthenticated ? (
              /* Not logged in */
              <button
                onClick={() => navigate("/login", { state: { returnTo: `/open-plays/${id}` } })}
                className="w-full py-4 flex items-center justify-center gap-2 text-white"
                style={{
                  borderRadius: "16px",
                  background: "linear-gradient(135deg,#3B82F6,#6366F1)",
                  fontSize: "17px",
                  fontWeight: "700",
                }}
              >
                <LogIn style={{ width: "20px", height: "20px" }} />
                Sign in to Join
              </button>
            ) : hasJoined ? (
              /* Already joined */
              <>
                <div
                  className="flex items-center justify-center gap-2 mb-3 py-3"
                  style={{
                    borderRadius: "14px",
                    backgroundColor: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.2)",
                  }}
                >
                  <CheckCircle2 style={{ width: "16px", height: "16px", color: "#22C55E" }} />
                  <span className="text-[#22C55E]" style={{ fontSize: "14px", fontWeight: "600" }}>
                    You're in! See you on the court.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setOptimisticJoined(false);
                    setOptimisticPlayers(players.filter((p: any) => p.userId !== currentUserId));
                    leaveMutation.mutate(openPlay.id, {
                      onSuccess: () => {
                        setToast({ type: "success", msg: "You've left the session" });
                        refetch().then(() => {
                          setOptimisticJoined(null);
                          setOptimisticPlayers(null);
                        });
                      },
                      onError: (err: any) => {
                        setOptimisticJoined(null);
                        setOptimisticPlayers(null);
                        setToast({ type: "error", msg: err?.response?.data?.message ?? "Failed to leave session" });
                      },
                    });
                  }}
                  disabled={leaveMutation.isPending}
                  className="w-full py-4"
                  style={{
                    borderRadius: "16px",
                    backgroundColor: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#EF4444",
                    opacity: leaveMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {leaveMutation.isPending ? "Leaving…" : "Leave Session"}
                </button>
              </>
            ) : (
              /* Not joined yet */
              <button
                onClick={handleJoin}
                disabled={isFull || !isOpen || joinMutation.isPending || paymentPending}
                className="w-full py-4 flex items-center justify-center gap-2 text-white"
                style={{
                  borderRadius: "16px",
                  background: isFull || !isOpen
                    ? "#1E293B"
                    : "linear-gradient(135deg,#3B82F6,#6366F1)",
                  fontSize: "17px",
                  fontWeight: "700",
                  color: isFull || !isOpen ? "#64748B" : "#FFFFFF",
                  opacity: joinMutation.isPending || paymentPending ? 0.7 : 1,
                }}
              >
                {paymentPending ? (
                  <>
                    <CreditCard style={{ width: "20px", height: "20px" }} />
                    Processing payment…
                  </>
                ) : joinMutation.isPending ? (
                  "Joining…"
                ) : isFull ? (
                  "Session Full"
                ) : !isOpen ? (
                  "Session Closed"
                ) : isPaidSession ? (
                  <>
                    <CreditCard style={{ width: "20px", height: "20px" }} />
                    {isPricingLocked
                      ? `Join & Pay ₹${openPlay.finalPricePerPlayer ?? openPlay.pricePerPlayer}`
                      : `Join — ₹${priceRangeLow}${priceRangeHigh > priceRangeLow ? `–₹${priceRangeHigh}` : ""}`}
                  </>
                ) : (
                  "Join Session — Free"
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
