/**
 * Booking Detail (Owner) — Venue-owner view of a single booking with action controls
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Calendar, Clock, MapPin, User,
  IndianRupee, CheckCircle2, XCircle, AlertCircle, Info, Users, X, Check,
} from "lucide-react";
import { useBooking, useOwnerCancelBooking, useOwnerConfirmBooking } from "@sportza/api-client";
import { format } from "date-fns";

function statusConfig(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed")  return { label: "Confirmed",  color: "#22C55E", bg: "rgba(34,197,94,0.1)",   icon: CheckCircle2 };
  if (s === "fully_paid") return { label: "Fully paid", color: "#22C55E", bg: "rgba(34,197,94,0.1)",   icon: CheckCircle2 };
  if (s === "completed")  return { label: "Completed",  color: "#94A3B8", bg: "rgba(148,163,184,0.1)", icon: CheckCircle2 };
  if (s === "cancelled_conflict")
                          return { label: "Conflict · refunded", color: "#F97316", bg: "rgba(249,115,22,0.12)", icon: AlertCircle };
  if (s === "cancelled_user")
                          return { label: "User cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.1)", icon: XCircle };
  if (s === "cancelled")  return { label: "Cancelled",  color: "#EF4444", bg: "rgba(239,68,68,0.1)",   icon: XCircle };
  if (s === "pending_open_play")
                          return { label: "Pending",      color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  icon: AlertCircle };
  if (s === "pending")    return { label: "Pending",    color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  icon: AlertCircle };
  return                         { label: status,       color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  icon: AlertCircle };
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: "600", color: valueColor ?? "#F1F5F9" }}>{value}</span>
    </div>
  );
}

export default function VenueBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = id ? parseInt(id, 10) : 0;

  const { data: res, isLoading, isError, refetch } = useBooking(bookingId);
  const booking: any = (res as any)?.data ?? (res as any)?.booking ?? res;

  const ownerCancel  = useOwnerCancelBooking();
  const ownerConfirm = useOwnerConfirmBooking();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (isError || (!isLoading && !booking)) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-6">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-6 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <p className="text-[#EF4444]">Booking not found or you don't have access.</p>
        </div>
      </div>
    );
  }

  const totalAmount   = booking?.totalAmount ?? 0;
  const commissionPct = (booking?.platformCommissionPercent ?? 10) / 100;
  const commission    = totalAmount * commissionPct;
  const venueNet      = booking?.venueNetAmount ?? (totalAmount - commission);

  const isPending    = ["pending", "pending_open_play"].includes(booking?.status ?? "");
  const isCancelled  = (booking?.status ?? "").startsWith("cancelled");
  const canCancel    = !isCancelled && booking?.status !== "completed";
  const canConfirm   = isPending;

  const handleOwnerCancel = () => {
    ownerCancel.mutate(
      { bookingId, reason: cancelReason },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setActionMsg("Booking cancelled. Refund will be processed if applicable.");
          refetch();
        },
      }
    );
  };

  const handleOwnerConfirm = () => {
    ownerConfirm.mutate(bookingId, {
      onSuccess: () => {
        setActionMsg("Booking confirmed.");
        refetch();
      },
    });
  };

  const cfg = statusConfig(booking?.status ?? "");
  const StatusIcon = cfg.icon;

  const addOns: any[] =
    booking?.addOnPurchases ?? booking?.addOns ?? booking?.add_ons ?? [];
  const splitDetails = booking?.splitDetails;
  const isSplitLike = booking?.bookingType === "split" || booking?.bookingType === "open_play";
  const paidAmt = booking?.paidAmount ?? 0;
  const totalAmt = booking?.totalAmount ?? 0;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => navigate("/venue-owner/bookings")}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse h-6 w-40 rounded" style={{ backgroundColor: "#1E293B" }} />
          ) : (
            <>
              <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>
                Booking #{booking?.id}
              </h1>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Owner view</p>
            </>
          )}
        </div>
        {!isLoading && booking && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0"
            style={{ borderRadius: "8px", backgroundColor: cfg.bg }}
          >
            <StatusIcon style={{ width: "12px", height: "12px", color: cfg.color }} />
            <span style={{ fontSize: "11px", fontWeight: "700", color: cfg.color }}>{cfg.label.toUpperCase()}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-36 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-4 max-w-md mx-auto">
          {/* Booking info */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-1" style={{ fontSize: "15px", fontWeight: "700" }}>Booking Details</p>
            <Row label="Sport"    value={booking?.sport ?? "—"} />
            <Row label="Type"     value={booking?.bookingType === "split" ? "Split pay" : booking?.bookingType === "open_play" ? "Open play" : booking?.bookingType ?? "Solo"} />
            <Row label="Facility" value={booking?.facilityName ?? booking?.facility?.name ?? "—"} />
            <Row label="Venue"    value={booking?.venue?.name ?? "—"} />
            <div className="flex items-center gap-1.5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Calendar style={{ width: "14px", height: "14px", color: "#64748B" }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "13px", flex: 1 }}>Date</span>
              <span className="text-[#F1F5F9]" style={{ fontSize: "14px", fontWeight: "600" }}>
                {booking?.bookingDate ? format(new Date(booking.bookingDate), "dd MMM yyyy") : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Clock style={{ width: "14px", height: "14px", color: "#64748B" }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "13px", flex: 1 }}>Time</span>
              <span className="text-[#F1F5F9]" style={{ fontSize: "14px", fontWeight: "600" }}>
                {booking?.startTime ?? "—"} – {booking?.endTime ?? "—"}
              </span>
            </div>
          </div>

          {booking?.status?.toLowerCase() === "cancelled_conflict" && (
            <div
              className="flex items-start gap-3 p-4"
              style={{ borderRadius: "14px", backgroundColor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}
            >
              <AlertCircle style={{ width: "18px", height: "18px", color: "#F97316", flexShrink: 0 }} />
              <p className="text-[#94A3B8]" style={{ fontSize: "12px", lineHeight: "1.6" }}>
                This booking lost a slot competition: another group reached confirmation first (or paid threshold first).
                Players are refunded automatically per policy. No action required from the venue.
              </p>
            </div>
          )}

          {/* Customer */}
          {booking?.user && (
            <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
              <div className="flex items-center gap-2 mb-3">
                <User style={{ width: "16px", height: "16px", color: "#3B82F6" }} />
                <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Customer</p>
              </div>
              <Row label="Name"  value={booking.user.name  ?? "—"} />
              <Row label="Phone" value={booking.user.phone ?? booking.user.email ?? "—"} />
            </div>
          )}

          {/* Revenue breakdown */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee style={{ width: "16px", height: "16px", color: "#22C55E" }} />
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Revenue</p>
            </div>
            <Row label="Total Amount"       value={`₹${totalAmount.toLocaleString()}`} />
            <Row label="Platform Commission" value={`– ₹${commission.toLocaleString()}`} valueColor="#EF4444" />
            <div className="flex justify-between items-center pt-3">
              <span className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Venue Net</span>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#22C55E" }}>
                ₹{venueNet.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment status */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "700" }}>Payment Status</p>
            <Row label="Status"  value={booking?.paymentStatus ?? booking?.payment_status ?? "—"} />
            <Row label="Mode"    value={booking?.paymentMode   ?? booking?.payment_mode   ?? "—"} />
          </div>

          {/* Add-ons */}
          {addOns.length > 0 && (
            <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
              <p className="text-white mb-3" style={{ fontSize: "15px", fontWeight: "700" }}>Add-ons</p>
              {addOns.map((a: any, i: number) => (
                <Row key={i} label={a.name ?? a.type ?? `Add-on ${i + 1}`} value={`₹${(a.price ?? 0).toLocaleString()}`} />
              ))}
            </div>
          )}

          {/* Action message */}
          {actionMsg && (
            <div className="flex items-center gap-2 p-3" style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <CheckCircle2 style={{ width: "16px", height: "16px", color: "#22C55E", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "#22C55E" }}>{actionMsg}</p>
            </div>
          )}

          {/* Owner actions */}
          {(canConfirm || canCancel) && !actionMsg && (
            <div className="space-y-2">
              {canConfirm && (
                <button
                  onClick={handleOwnerConfirm}
                  disabled={ownerConfirm.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3.5"
                  style={{
                    borderRadius: "14px",
                    background: "linear-gradient(135deg,#22C55E,#16A34A)",
                    fontSize: "15px", fontWeight: "700", color: "#fff",
                    opacity: ownerConfirm.isPending ? 0.7 : 1,
                  }}
                >
                  <Check style={{ width: "16px", height: "16px" }} />
                  {ownerConfirm.isPending ? "Confirming…" : "Force Confirm Booking"}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setCancelOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5"
                  style={{
                    borderRadius: "14px",
                    backgroundColor: "rgba(239,68,68,0.1)",
                    border: "1.5px solid rgba(239,68,68,0.3)",
                    fontSize: "15px", fontWeight: "700", color: "#EF4444",
                  }}
                >
                  <XCircle style={{ width: "16px", height: "16px" }} />
                  Cancel Booking
                </button>
              )}
            </div>
          )}

          {/* Info note */}
          <div
            className="flex items-start gap-3 p-4"
            style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
          >
            <Info style={{ width: "16px", height: "16px", color: "#3B82F6", flexShrink: 0, marginTop: "1px" }} />
            <p className="text-[#94A3B8]" style={{ fontSize: "12px", lineHeight: "1.6" }}>
              Owner actions: force-confirm a pending booking or cancel on behalf of the venue.
              Payment/refunds are processed automatically per policy.
            </p>
          </div>

          {/* Location shortcut */}
          {(booking?.venue?.city || booking?.venue?.address) && (
            <div className="flex items-center gap-2 p-4" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
              <MapPin style={{ width: "16px", height: "16px", color: "#F59E0B" }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                {[booking?.venue?.address, booking?.venue?.city].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cancel reason sheet */}
      {cancelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setCancelOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{
              maxHeight: "90dvh",
              borderRadius: "24px 24px 0 0",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.08)",
              maxWidth: "480px",
              margin: "0 auto",
            }}
          >
            <div className="flex items-center justify-between px-4 pt-5 pb-4 flex-shrink-0">
              <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>Cancel Booking</span>
              <button onClick={() => setCancelOpen(false)} style={{ padding: "6px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)" }}>
                <X style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
              </button>
            </div>
            <div className="px-4 overflow-y-auto flex-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <p className="text-[#94A3B8] mb-3" style={{ fontSize: "13px" }}>
                Provide an optional reason so the player is informed.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Maintenance, double booking, event conflict…"
                rows={3}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  backgroundColor: "#0F172A",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  color: "#F1F5F9",
                  fontSize: "14px",
                  padding: "12px",
                  outline: "none",
                  resize: "none",
                }}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setCancelOpen(false)}
                  className="flex-1 py-3"
                  style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleOwnerCancel}
                  disabled={ownerCancel.isPending}
                  className="flex-1 py-3"
                  style={{
                    borderRadius: "12px",
                    background: "linear-gradient(135deg,#EF4444,#DC2626)",
                    fontSize: "14px", fontWeight: "700", color: "#fff",
                    opacity: ownerCancel.isPending ? 0.7 : 1,
                  }}
                >
                  {ownerCancel.isPending ? "Cancelling…" : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
