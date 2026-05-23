/**
 * Booking Detail — Post-Booking Experience
 *
 * Key insight: "After booking = anxiety phase"
 * → Reduce uncertainty via: clear details, easy access, strong confirmation
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapEmbed from "../../components/MapEmbed";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Share2,
  CalendarPlus,
  Navigation,
  Hash,
  Layers,
  RefreshCw,
  RotateCcw,
  Trophy,
  Download,
  Users,
} from "lucide-react";
import {
  useBooking,
  useCancelBooking,
  useCurrentUser,
  type BookingRecord,
  type BookingSplitParticipant,
} from "@sportza/api-client";
import { useRazorpayCheckout } from "../../hooks/useRazorpayCheckout";
import { format, parseISO } from "date-fns";

// ─── Status config ─────────────────────────────────────────────────────────────
type StatusInfo = { label: string; color: string; bg: string; border: string; icon: React.ReactNode };
function getStatusInfo(status: string): StatusInfo {
  const s = status?.toLowerCase();
  if (s === "confirmed")
    return { label: "Confirmed", color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", icon: <CheckCircle2 style={{ width: "20px", height: "20px" }} /> };
  if (s === "fully_paid")
    return { label: "Fully paid", color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", icon: <CheckCircle2 style={{ width: "20px", height: "20px" }} /> };
  if (s === "completed")
    return { label: "Completed", color: "#94A3B8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)", icon: <CheckCircle2 style={{ width: "20px", height: "20px" }} /> };
  if (s === "cancelled_conflict")
    return {
      label: "Slot lost · refunded",
      color: "#F97316",
      bg: "rgba(249,115,22,0.1)",
      border: "rgba(249,115,22,0.35)",
      icon: <AlertCircle style={{ width: "20px", height: "20px" }} />,
    };
  if (s === "cancelled_user")
    return { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: <XCircle style={{ width: "20px", height: "20px" }} /> };
  if (s === "cancelled")
    return { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: <XCircle style={{ width: "20px", height: "20px" }} /> };
  if (s === "pending_open_play")
    return { label: "Pending", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", icon: <Timer style={{ width: "20px", height: "20px" }} /> };
  if (s === "pending")
    return { label: "Pending", color: "#3B82F6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", icon: <Timer style={{ width: "20px", height: "20px" }} /> };
  return { label: "Upcoming", color: "#3B82F6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", icon: <Timer style={{ width: "20px", height: "20px" }} /> };
}

function getPaymentColor(status?: string | null) {
  if (status === "completed" || status === "paid") return "#22C55E";
  if (status === "refunded") return "#F59E0B";
  if (status === "refund_processing" || status === "processing") return "#3B82F6";
  if (status === "failed") return "#EF4444";
  return "#94A3B8";
}

function getPaymentLabel(status?: string | null) {
  if (status === "completed" || status === "paid") return "Paid ✓";
  if (status === "refunded") return "Refunded";
  if (status === "refund_processing" || status === "processing") return "Processing…";
  if (status === "failed") return "Failed";
  if (status === "pending") return "Pending";
  return status ?? "—";
}

// ─── Cancel Confirmation Modal ────────────────────────────────────────────────
function CancelModal({
  booking,
  onConfirm,
  onClose,
  isPending,
}: {
  booking: BookingRecord;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const refundAmount = booking.paidAmount ?? booking.totalAmount;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.3)" }}
        >
          <XCircle style={{ width: "28px", height: "28px", color: "#EF4444" }} />
        </div>

        <h2 className="text-white text-center mb-2" style={{ fontSize: "20px", fontWeight: "800" }}>
          Cancel Booking?
        </h2>
        <p className="text-[#94A3B8] text-center mb-6" style={{ fontSize: "14px", lineHeight: "1.6" }}>
          This action cannot be undone. Your slot will be released.
        </p>

        {/* Refund info */}
        {refundAmount > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 mb-6"
            style={{ borderRadius: "14px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <RotateCcw style={{ width: "16px", height: "16px", color: "#22C55E" }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>Estimated refund</span>
            </div>
            <span className="text-[#22C55E]" style={{ fontSize: "18px", fontWeight: "800" }}>
              ₹{refundAmount.toFixed(0)}
            </span>
          </div>
        )}

        <p className="text-[#64748B] text-center mb-5" style={{ fontSize: "12px" }}>
          Refunds are processed within 5–7 business days
        </p>

        <div className="space-y-3">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="w-full py-4"
            style={{
              borderRadius: "16px",
              backgroundColor: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              fontSize: "16px",
              fontWeight: "700",
              color: "#EF4444",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Cancelling…" : "Yes, Cancel Booking"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-4"
            style={{
              borderRadius: "16px",
              backgroundColor: "#111827",
              fontSize: "15px",
              fontWeight: "600",
              color: "#94A3B8",
            }}
          >
            Keep Booking
          </button>
        </div>
      </div>
    </>
  );
}

function getDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse px-4 pt-4 space-y-4">
      <div className="h-40 rounded-2xl bg-[#1E293B]" />
      <div className="h-48 rounded-2xl bg-[#1E293B]" />
      <div className="h-32 rounded-2xl bg-[#1E293B]" />
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="w-9 h-9 flex items-center justify-center text-[#94A3B8]" style={{ borderRadius: "10px", backgroundColor: "#111827" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        <div className="text-white mt-0.5" style={{ fontSize: "15px", fontWeight: "600" }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = id ? parseInt(id, 10) : 0;
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data, isLoading, isError } = useBooking(bookingId);
  const { data: meRes } = useCurrentUser();
  const cancelMutation = useCancelBooking();
  const razorpayCheckout = useRazorpayCheckout();
  const [payError, setPayError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const booking = data?.data;
  const myUserId: number | undefined =
    (meRes as any)?.user?.id ?? (meRes as any)?.data?.user?.id ?? (meRes as any)?.data?.id;

  const splitDetails = booking?.splitDetails;
  const isSplitLike =
    booking?.bookingType === "split" || booking?.bookingType === "open_play";
  const myPendingShare =
    isSplitLike && myUserId != null && splitDetails?.participants
      ? splitDetails.participants.find((p: BookingSplitParticipant) => p.userId === myUserId && p.status === "pending")
      : undefined;
  const showPayButton =
    !!booking &&
    !["cancelled", "cancelled_user", "cancelled_conflict", "completed"].includes(booking.status?.toLowerCase()) &&
    (isSplitLike ? !!myPendingShare : booking.paymentStatus === "pending");
  const payNowAmount = isSplitLike && myPendingShare
    ? myPendingShare.amount
    : booking?.totalAmount ?? 0;

  const isCancellable =
    booking &&
    !["cancelled", "cancelled_user", "cancelled_conflict", "completed"].includes(
      booking.status?.toLowerCase()
    );

  const statusInfo = booking ? getStatusInfo(booking.status) : null;

  const date = booking?.bookingDate
    ? (() => { try { return parseISO(booking.bookingDate); } catch { return new Date(booking.bookingDate); } })()
    : null;

  // ── Google Calendar URL ──
  function buildCalendarUrl() {
    if (!booking || !date) return "#";
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    const start = new Date(date);
    start.setHours(sh, sm, 0);
    const end = new Date(date);
    end.setHours(eh, em, 0);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const title = encodeURIComponent(`${booking.venue?.name ?? "Court"} — ${booking.sport ?? "Sports"} booking`);
    const loc   = encodeURIComponent(booking.venue?.location?.address ?? booking.venue?.location?.city ?? "");
    return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${fmt(start)}/${fmt(end)}&location=${loc}`;
  }

  // ── Pay Now (for pending bookings) ──
  async function handlePayNow() {
    if (!booking) return;
    setPayError(null);
    setPayLoading(true);
    try {
      await razorpayCheckout({
        amount: payNowAmount,
        description: isSplitLike && myPendingShare
          ? `Your share — ${booking.venue?.name ?? "venue"}`
          : `Booking at ${booking.venue?.name ?? "venue"}`,
        bookingId: booking.id,
        groupId: (booking as any).groupId ?? undefined,
        onSuccess: () => {
          // Reload page data after payment
          window.location.reload();
        },
        onFailure: (reason) => {
          if (reason !== "Payment cancelled") setPayError(reason);
        },
      });
    } finally {
      setPayLoading(false);
    }
  }

  // ── Directions ──
  function openDirections() {
    const addr = [booking?.venue?.location?.address, booking?.venue?.location?.city].filter(Boolean).join(", ");
    if (!addr) return;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`, "_blank");
  }

  // ── Share ──
  async function handleShare() {
    if (!booking) return;
    const text = `My ${booking.sport ?? "sports"} booking at ${booking.venue?.name ?? "the venue"} on ${date ? format(date, "MMM d") : ""} — ${booking.startTime}`;
    if (navigator.share) {
      await navigator.share({ title: "Sportza Booking", text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  // ── Receipt ──
  function handleDownloadReceipt() {
    if (!booking || !date) return;
    const lines = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "           SPORTZA RECEIPT        ",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Booking ID : SRTZA-${String(booking.id).padStart(6, "0")}`,
      `Venue      : ${booking.venue?.name ?? "—"}`,
      `Date       : ${format(date, "EEEE, MMMM d, yyyy")}`,
      `Time       : ${booking.startTime} – ${booking.endTime}`,
      booking.facilityName ? `Court      : ${booking.facilityName}` : null,
      booking.sport       ? `Sport      : ${booking.sport}` : null,
      "────────────────────────────────",
      booking.subtotal    != null ? `Subtotal   : ₹${booking.subtotal.toFixed(0)}` : null,
      booking.gstAmount   != null && booking.gstAmount > 0 ? `GST        : ₹${booking.gstAmount.toFixed(0)}` : null,
      `Total      : ₹${booking.totalAmount?.toFixed(0) ?? "—"}`,
      `Payment    : ${getPaymentLabel(booking.paymentStatus)}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "Thank you for playing with Sportza!",
    ].filter(Boolean).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `sportza-receipt-${booking.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Cancel ──
  async function handleCancel() {
    if (!isCancellable) return;
    try {
      await cancelMutation.mutateAsync(bookingId);
      setShowCancelModal(false);
      navigate("/bookings");
    } catch { /* handled by mutation state */ }
  }

  // ── Error ──
  if (isError) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle style={{ width: "48px", height: "48px", color: "#64748B", margin: "0 auto 16px" }} />
          <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "700" }}>Booking not found</h2>
          <button onClick={() => navigate("/bookings")} className="px-6 py-3 text-white mt-4"
            style={{ borderRadius: "14px", backgroundColor: "#3B82F6", fontSize: "15px", fontWeight: "600" }}>
            My Bookings
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (isLoading || !booking) {
    return (
      <div className="min-h-screen bg-[#0F172A]">
        <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
          <span className="text-white" style={{ fontSize: "17px", fontWeight: "600" }}>Booking</span>
        </div>
        <Skeleton />
      </div>
    );
  }

  const duration = getDuration(booking.startTime, booking.endTime);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-36">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span className="text-white flex-1 truncate" style={{ fontSize: "17px", fontWeight: "600" }}>
          Booking #{booking.id}
        </span>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Status hero card ── */}
        <div
          className="p-5"
          style={{
            borderRadius: "20px",
            backgroundColor: "#1E293B",
            border: `1px solid ${statusInfo!.border}`,
          }}
        >
          {/* Status pill */}
          <div className="flex items-center justify-between mb-5">
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{
                borderRadius: "999px",
                backgroundColor: statusInfo!.bg,
                border: `1px solid ${statusInfo!.border}`,
                color: statusInfo!.color,
              }}
            >
              {statusInfo!.icon}
              <span style={{ fontSize: "13px", fontWeight: "700" }}>{statusInfo!.label}</span>
            </div>
            <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
              #{booking.id}
            </span>
          </div>

          {/* Venue name + sport */}
          <h1 className="text-white mb-1" style={{ fontSize: "22px", fontWeight: "800", lineHeight: "130%" }}>
            {booking.venue?.name ?? "Venue"}
          </h1>
          {booking.sport && (
            <div
              className="inline-flex px-3 py-1 mb-4"
              style={{ borderRadius: "999px", backgroundColor: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}
            >
              <span className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>
                {booking.sport}
              </span>
            </div>
          )}

          {/* Amount summary */}
          <div className="pt-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {isSplitLike && splitDetails ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>Collected</span>
                  <span className="text-white" style={{ fontSize: "26px", fontWeight: "800" }}>
                    ₹{(booking.paidAmount ?? 0).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]" style={{ fontSize: "12px" }}>Booking total</span>
                  <span className="text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "600" }}>
                    ₹{booking.totalAmount?.toFixed(0) ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]" style={{ fontSize: "12px" }}>Still outstanding</span>
                  <span className="text-[#F59E0B]" style={{ fontSize: "13px", fontWeight: "700" }}>
                    ₹{splitDetails.pendingAmount.toFixed(0)}
                  </span>
                </div>
                <p className="text-[#64748B]" style={{ fontSize: "11px", lineHeight: "1.45", paddingTop: "4px" }}>
                  {splitDetails.thresholdMet
                    ? "50% threshold met — slot is eligible to confirm (first booking wins if multiple compete)."
                    : `Need ₹${splitDetails.amountNeededForConfirm.toFixed(0)} more collected to reach 50% and confirm this booking.`}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
                  {booking.paymentStatus === "completed" || booking.paymentStatus === "paid" ? "Total paid" : "Amount due"}
                </span>
                <span className="text-white" style={{ fontSize: "26px", fontWeight: "800" }}>
                  ₹
                  {booking.paymentStatus === "completed" || booking.paymentStatus === "paid"
                    ? (booking.paidAmount ?? booking.totalAmount)?.toFixed(0) ?? "—"
                    : booking.totalAmount?.toFixed(0) ?? "—"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Split / open-play payers ── */}
        {isSplitLike && splitDetails && splitDetails.participants.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users style={{ width: "18px", height: "18px", color: "#22C55E" }} />
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
                Who paid
              </h2>
            </div>
            <div className="mb-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, splitDetails.paidPercentOfTotal)}%`,
                  background: "linear-gradient(90deg, #22C55E, #16A34A)",
                }}
              />
            </div>
            <div className="flex justify-between text-[#64748B] mb-3" style={{ fontSize: "11px" }}>
              <span>{splitDetails.paidCount} paid</span>
              <span>{splitDetails.joinedCount} joined</span>
              <span>50% at ₹{splitDetails.confirmThresholdAmount.toFixed(0)}</span>
            </div>
            <ul className="space-y-2">
              {splitDetails.participants.map((p: BookingSplitParticipant) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between py-2 px-3"
                  style={{ borderRadius: "12px", backgroundColor: "#111827" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate" style={{ fontSize: "13px", fontWeight: "600" }}>
                      {p.name ?? `User #${p.userId}`}
                      {myUserId === p.userId ? (
                        <span className="text-[#3B82F6] ml-1" style={{ fontSize: "11px" }}>
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                      ₹{p.amount.toFixed(0)} ·{" "}
                      {p.status === "paid"
                        ? "Paid"
                        : p.status === "pending"
                          ? "Pending"
                          : p.status === "cancelled"
                            ? "Left / cancelled"
                            : p.status}
                    </p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5"
                    style={{
                      borderRadius: "8px",
                      fontSize: "10px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color:
                        p.status === "paid"
                          ? "#22C55E"
                          : p.status === "pending"
                            ? "#F59E0B"
                            : "#94A3B8",
                      backgroundColor:
                        p.status === "paid"
                          ? "rgba(34,197,94,0.12)"
                          : p.status === "pending"
                            ? "rgba(245,158,11,0.12)"
                            : "rgba(148,163,184,0.1)",
                    }}
                  >
                    {p.status === "paid" ? "Paid" : p.status === "pending" ? "Due" : p.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Slot info ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <h2 className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Slot Details</h2>

          {date && (
            <InfoRow
              icon={<Calendar style={{ width: "18px", height: "18px" }} />}
              label="Date"
              value={format(date, "EEEE, MMMM d, yyyy")}
            />
          )}
          <InfoRow
            icon={<Clock style={{ width: "18px", height: "18px" }} />}
            label="Time"
            value={`${booking.startTime} – ${booking.endTime}`}
          />
          <InfoRow
            icon={<Timer style={{ width: "18px", height: "18px" }} />}
            label="Duration"
            value={duration}
          />
          {booking.facilityName && (
            <InfoRow
              icon={<Layers style={{ width: "18px", height: "18px" }} />}
              label="Court / Facility"
              value={booking.facilityName}
            />
          )}
          <div className="py-3" style={{ borderBottom: "none" }}>
            <InfoRow
              icon={<Hash style={{ width: "18px", height: "18px" }} />}
              label="Booking ID"
              value={
                <span className="font-mono text-[#94A3B8]" style={{ fontSize: "14px" }}>
                  SRTZA-{String(booking.id).padStart(6, "0")}
                </span>
              }
            />
          </div>
        </div>

        {/* ── Venue snapshot ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <h2 className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Venue</h2>
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-10 h-10 flex items-center justify-center text-[#3B82F6] shrink-0"
              style={{ borderRadius: "12px", backgroundColor: "rgba(59,130,246,0.1)" }}
            >
              <MapPin style={{ width: "18px", height: "18px" }} />
            </div>
            <div>
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                {booking.venue?.name}
              </p>
              {booking.venue?.location?.address && (
                <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: "13px" }}>
                  {booking.venue.location.address}
                </p>
              )}
              {booking.venue?.location?.city && (
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                  {booking.venue.location.city}
                </p>
              )}
            </div>
          </div>

          {/* Embedded map or tappable fallback */}
          <MapEmbed
            lat={booking.venue?.location?.lat}
            lng={booking.venue?.location?.lng}
            label={booking.venue?.name}
            height="160px"
            className="mb-4"
          />

          <button
            onClick={openDirections}
            className="w-full flex items-center justify-center gap-2 py-3 text-[#3B82F6] transition-colors"
            style={{
              borderRadius: "14px",
              backgroundColor: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              fontSize: "15px",
              fontWeight: "700",
            }}
          >
            <Navigation style={{ width: "16px", height: "16px" }} />
            Get Directions
          </button>
        </div>

        {/* ── Payment summary ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
            <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Payment</h2>
          </div>

          <div className="space-y-3">
            {booking.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>Subtotal</span>
                <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>₹{booking.subtotal.toFixed(0)}</span>
              </div>
            )}
            {booking.gstAmount != null && booking.gstAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>GST</span>
                <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>₹{booking.gstAmount.toFixed(0)}</span>
              </div>
            )}
            <div
              className="flex justify-between pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Total</span>
              <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>₹{booking.totalAmount?.toFixed(0)}</span>
            </div>

            {/* Payment status pill */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Payment status</span>
              <div
                className="flex items-center gap-1.5 px-3 py-1"
                style={{
                  borderRadius: "999px",
                  backgroundColor: `${getPaymentColor(booking.paymentStatus)}20`,
                  border: `1px solid ${getPaymentColor(booking.paymentStatus)}50`,
                }}
              >
                {(booking.paymentStatus === "refund_processing" || booking.paymentStatus === "processing") && (
                  <RefreshCw style={{ width: "11px", height: "11px", color: getPaymentColor(booking.paymentStatus) }} className="animate-spin" />
                )}
                <span style={{ fontSize: "12px", fontWeight: "700", color: getPaymentColor(booking.paymentStatus) }}>
                  {getPaymentLabel(booking.paymentStatus)}
                </span>
              </div>
            </div>

            {/* Refund note */}
            {(booking.paymentStatus === "refunded" || booking.paymentStatus === "refund_processing") && (
              <div
                className="flex items-start gap-2 p-3 mt-2"
                style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
              >
                <RotateCcw style={{ width: "14px", height: "14px", color: "#22C55E", flexShrink: 0, marginTop: "1px" }} />
                <p className="text-[#94A3B8]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
                  {booking.paymentStatus === "refunded"
                    ? `₹${(booking.paidAmount ?? booking.totalAmount).toFixed(0)} has been refunded to your original payment method.`
                    : "Refund is being processed. This typically takes 5–7 business days."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky actions ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top, #0F172A 70%, transparent)" }}
      >
        <div className="max-w-md mx-auto">
          {/* Pay Now — shown for pending-payment bookings */}
          {showPayButton && (
            <div className="mb-3">
              {payError && (
                <p className="text-[#EF4444] text-center mb-2" style={{ fontSize: "12px" }}>
                  {payError}
                </p>
              )}
              <button
                onClick={handlePayNow}
                disabled={payLoading}
                className="w-full flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  height: "52px",
                  borderRadius: "14px",
                  background: payLoading
                    ? "#1E3A5F"
                    : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  fontSize: "16px",
                  fontWeight: "700",
                }}
              >
                {payLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    <span style={{ fontSize: "14px" }}>Opening payment…</span>
                  </>
                ) : (
                  <>
                    <CreditCard style={{ width: "18px", height: "18px" }} />
                    {isSplitLike && myPendingShare
                      ? `Pay my share ₹${payNowAmount.toLocaleString("en-IN")}`
                      : `Pay Now ₹${payNowAmount.toLocaleString("en-IN")}`}
                  </>
                )}
              </button>
            </div>
          )}

          {/* All actions in one uniform grid — same height for all buttons */}
          <div className={`grid gap-3 ${booking.status?.toLowerCase() === "confirmed" ? "grid-cols-3" : booking.status?.toLowerCase() === "completed" ? "grid-cols-3" : "grid-cols-2"}`}>
            {booking.status?.toLowerCase() === "confirmed" && (
              <button
                onClick={() => navigate("/matches/create", { state: { sport: booking.sport, venueName: booking.venue?.name } })}
                className="flex flex-col items-center justify-center gap-1 py-3"
                style={{
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #EF4444, #DC2626)",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                <Trophy style={{ width: "18px", height: "18px" }} />
                Score
              </button>
            )}

            <button
              onClick={handleShare}
              className="flex flex-col items-center justify-center gap-1 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#FFFFFF",
              }}
            >
              <Share2 style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
              Share
            </button>
            <a
              href={buildCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              <CalendarPlus style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
              Add to Cal
            </a>
            {booking.status?.toLowerCase() === "completed" && (
              <button
                onClick={handleDownloadReceipt}
                className="flex flex-col items-center justify-center gap-1 py-3"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                <Download style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
                Receipt
              </button>
            )}
          </div>

          {/* Cancel (only if cancellable) */}
          {isCancellable && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3.5"
              style={{
                borderRadius: "14px",
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                fontSize: "15px",
                fontWeight: "700",
                color: "#EF4444",
              }}
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      {/* ── Cancel modal ── */}
      {showCancelModal && booking && (
        <CancelModal
          booking={booking}
          onConfirm={handleCancel}
          onClose={() => setShowCancelModal(false)}
          isPending={cancelMutation.isPending}
        />
      )}
    </div>
  );
}
