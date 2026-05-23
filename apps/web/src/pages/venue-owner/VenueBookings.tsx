/**
 * Venue Bookings — Manage all bookings for owned venues
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar, Clock, MapPin, ChevronRight,
  Search, CheckCircle2, XCircle, AlertCircle, Timer, Info,
  Plus, X, User, Phone, IndianRupee, LayoutGrid,
} from "lucide-react";
import {
  useVenueOwnerBookings,
  useMyVenues,
  useVenueFacilities,
  useCreateManualBooking,
} from "@sportza/api-client";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Booking = {
  id: number;
  status: string;
  bookingType?: string | null;
  paidAmount?: number | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  sport?: string | null;
  facilityName?: string | null;
  user?: { name?: string | null; phone?: string | null } | null;
  venue?: { name?: string | null } | null;
};

// ─── Status config ────────────────────────────────────────────────────────────
function statusConfig(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed")  return { label: "Confirmed",  color: "#22C55E", bg: "rgba(34,197,94,0.1)",   icon: CheckCircle2 };
  if (s === "fully_paid") return { label: "Fully paid", color: "#22C55E", bg: "rgba(34,197,94,0.1)",   icon: CheckCircle2 };
  if (s === "pending_open_play")
                          return { label: "Pending",      color: "#F59E0B", bg: "rgba(245,158,11,0.1)", icon: AlertCircle  };
  if (s === "pending")    return { label: "Pending",    color: "#F59E0B", bg: "rgba(245,158,11,0.1)", icon: AlertCircle  };
  if (s === "cancelled_conflict")
                          return { label: "Conflict · refunded", color: "#F97316", bg: "rgba(249,115,22,0.12)", icon: AlertCircle };
  if (s === "cancelled_user")
                          return { label: "User cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.1)", icon: XCircle };
  if (s === "cancelled")  return { label: "Cancelled",  color: "#EF4444", bg: "rgba(239,68,68,0.1)",   icon: XCircle      };
  if (s === "completed")  return { label: "Completed",  color: "#94A3B8", bg: "rgba(148,163,184,0.08)", icon: CheckCircle2 };
  return                         { label: status,       color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  icon: Timer        };
}

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  padel: "🎾", basketball: "🏀", volleyball: "🏐", swimming: "🏊", pickleball: "🏓",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-2" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="h-4 rounded w-3/4" style={{ backgroundColor: "#334155" }} />
      <div className="h-3 rounded w-1/2" style={{ backgroundColor: "#334155" }} />
      <div className="h-3 rounded w-2/3" style={{ backgroundColor: "#334155" }} />
    </div>
  );
}

// ─── Booking card ─────────────────────────────────────────────────────────────
function BookingCard({ booking }: { booking: Booking }) {
  const navigate = useNavigate();
  const cfg = statusConfig(booking.status);
  const StatusIcon = cfg.icon;
  const sport  = booking.sport?.toLowerCase() ?? "";
  const emoji  = SPORT_EMOJI[sport] ?? "🎯";
  const isSplitLike = booking.bookingType === "split" || booking.bookingType === "open_play";
  const paid = booking.paidAmount ?? 0;
  const total = booking.totalAmount ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <button
      onClick={() => navigate(`/venue-owner/bookings/${booking.id}`)}
      className="w-full p-4 text-left hover:bg-white/5 transition-colors"
      style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Row 1: sport + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "20px" }}>{emoji}</span>
          <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
            {booking.sport ?? "Sport"} · {booking.facilityName ?? "Court"}
          </span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5"
          style={{ borderRadius: "999px", backgroundColor: cfg.bg }}
        >
          <StatusIcon style={{ width: "11px", height: "11px", color: cfg.color }} />
          <span style={{ fontSize: "11px", fontWeight: "700", color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Row 2: player name */}
      <p className="text-[#94A3B8] mb-2" style={{ fontSize: "13px" }}>
        Player: {booking.user?.name ?? "Unknown"}
        {booking.user?.phone ? ` · ${booking.user.phone}` : ""}
      </p>

      {/* Row 3: date / time / amount */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[#64748B]">
          <Calendar style={{ width: "13px", height: "13px" }} />
          <span style={{ fontSize: "12px" }}>
            {booking.bookingDate ? format(new Date(booking.bookingDate), "dd MMM") : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748B]">
          <Clock style={{ width: "13px", height: "13px" }} />
          <span style={{ fontSize: "12px" }}>{booking.startTime} – {booking.endTime}</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
            ₹{booking.totalAmount?.toFixed(0) ?? "—"}
          </div>
          {isSplitLike && (
            <div className="text-[#64748B]" style={{ fontSize: "10px", marginTop: "2px" }}>
              Collected ₹{paid.toFixed(0)} ({pct}%){pct < 50 ? " · under 50%" : " · 50%+"}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { id: "all",       label: "All"       },
  { id: "confirmed", label: "Confirmed" },
  { id: "pending",   label: "Pending"   },
  { id: "cancelled", label: "Cancelled" },
  { id: "completed", label: "Completed" },
] as const;

export default function VenueBookings() {
  const navigate = useNavigate();
  const now = new Date();
  const [searchParams] = useSearchParams();
  const venueIdParam = searchParams.get("venueId");
  const venueNameParam = searchParams.get("venueName");

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText,   setSearchText]   = useState("");
  const [dateFrom, setDateFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));

  const dateRangeInvalid = dateFrom > dateTo;

  const { data: res, isLoading, isError } = useVenueOwnerBookings({
    startDate: dateRangeInvalid ? dateTo : dateFrom,
    endDate:   dateRangeInvalid ? dateFrom : dateTo,
    status:    statusFilter === "all" ? undefined : statusFilter,
    limit:     100,
    ...(venueIdParam ? { venueId: Number(venueIdParam) } : {}),
  });

  const allBookings: Booking[] = (res as any)?.data ?? (res as any) ?? [];

  const filtered = searchText
    ? allBookings.filter((b) =>
        b.user?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        b.sport?.toLowerCase().includes(searchText.toLowerCase()) ||
        b.facilityName?.toLowerCase().includes(searchText.toLowerCase()) ||
        String(b.id).includes(searchText)
      )
    : allBookings;

  const total   = filtered.length;
  const revenue = filtered
    .filter((b) => ["confirmed", "completed", "fully_paid"].includes(b.status))
    .reduce((s, b) => s + (b.totalAmount ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    backgroundColor: "#111827",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    color: "#F1F5F9",
    fontSize: "14px",
    padding: "10px 12px",
    outline: "none",
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#0F172A]">
        <div className="px-4 pt-6 pb-3 flex items-start justify-between">
          <div>
            <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Bookings</h1>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
              {isLoading ? "Loading…" : `${total} booking${total !== 1 ? "s" : ""} · ₹${revenue.toLocaleString()} confirmed revenue`}
            </p>
          </div>
          <button
            onClick={() => navigate("/venue-owner/calendar")}
            className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <LayoutGrid style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#3B82F6" }}>Calendar</span>
          </button>
        </div>
          {venueNameParam && (
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 self-start" style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "inline-flex" }}>
              <MapPin style={{ width: "11px", height: "11px", color: "#3B82F6", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#3B82F6" }}>{venueNameParam}</span>
            </div>
          )}

        {/* Search */}
        <div className="px-4 mb-3 relative">
          <Search style={{ position: "absolute", left: "28px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#475569" }} />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search player, sport, court…"
            style={{ ...inputStyle, width: "100%", paddingLeft: "40px" }}
          />
        </div>

        {/* Date range */}
        <div className="px-4 mb-1 flex gap-2">
          <div className="relative flex-1">
            <Calendar style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#475569" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputStyle, width: "100%", paddingLeft: "32px", borderColor: dateRangeInvalid ? "rgba(239,68,68,0.5)" : undefined }} />
          </div>
          <span className="text-[#475569] self-center">–</span>
          <div className="relative flex-1">
            <Calendar style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#475569" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inputStyle, width: "100%", paddingLeft: "32px", borderColor: dateRangeInvalid ? "rgba(239,68,68,0.5)" : undefined }} />
          </div>
        </div>
        {dateRangeInvalid && (
          <div className="px-4 mb-2 flex items-center gap-1.5">
            <Info style={{ width: "12px", height: "12px", color: "#F59E0B", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#F59E0B" }}>Start date is after end date — showing reversed range</span>
          </div>
        )}
        {searchText && allBookings.length >= 100 && (
          <div className="px-4 mb-2 flex items-center gap-1.5">
            <Info style={{ width: "12px", height: "12px", color: "#64748B", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#64748B" }}>Search covers the 100 most recent bookings in this range</span>
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-2 px-4 pt-1 pb-3 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className="flex-shrink-0 px-3 py-1.5"
                style={{
                  borderRadius: "999px",
                  backgroundColor: isActive ? "#3B82F6" : "rgba(255,255,255,0.06)",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: isActive ? "#fff" : "#64748B",
                  border: isActive ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 space-y-3 max-w-md mx-auto">
        {isLoading && [1, 2, 3, 4].map((i) => <BookingSkeleton key={i} />)}

        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <XCircle style={{ width: "32px", height: "32px", color: "#EF4444", margin: "0 auto 12px" }} />
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Failed to load bookings</p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Calendar style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No bookings found</p>
            <p className="text-[#64748B]" style={{ fontSize: "14px" }}>Try adjusting filters or date range</p>
          </div>
        )}

        {!isLoading && !isError && filtered.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>

      {/* ── Walk-in FAB ── */}
      <button
        onClick={() => setWalkInOpen(true)}
        className="fixed z-30 flex items-center gap-2 px-4 py-3"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 80px)",
          right: "20px",
          borderRadius: "999px",
          background: "linear-gradient(135deg,#F59E0B,#D97706)",
          fontSize: "14px", fontWeight: "700", color: "#fff",
          boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
        }}
      >
        <Plus style={{ width: "18px", height: "18px" }} />
        Walk-in
      </button>

      {/* ── Walk-in booking sheet ── */}
      {walkInOpen && (
        <WalkInBookingSheet onClose={() => setWalkInOpen(false)} />
      )}
    </div>
  );
}

// ─── Walk-in Booking Sheet ────────────────────────────────────────────────────
function WalkInBookingSheet({ onClose }: { onClose: () => void }) {
  const { data: venuesRes } = useMyVenues();
  const venues: Array<{ id: number; name?: string }> = (venuesRes as any)?.data ?? [];

  const [venueId, setVenueId] = useState<number>(venues[0]?.id ?? 0);
  const { data: facilitiesRes } = useVenueFacilities(venueId || null);
  const facilities: Array<{ id: number; name?: string }> = (facilitiesRes as any)?.data ?? [];

  const [facilityId, setFacilityId] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [sport, setSport] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);

  const createManual = useCreateManualBooking();

  const inputSt: React.CSSProperties = {
    width: "100%", height: "44px", borderRadius: "10px",
    backgroundColor: "#0F172A", border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#F1F5F9", fontSize: "14px", paddingLeft: "12px", outline: "none",
  };
  const selectSt: React.CSSProperties = { ...inputSt, appearance: "none" };

  const handleSubmit = () => {
    if (!venueId || !facilityId || !date || !startTime || !endTime || !sport || !customerName) return;
    createManual.mutate(
      {
        venueId,
        facilityId,
        date,
        startTime,
        endTime,
        sport,
        customerName,
        customerPhone: customerPhone || undefined,
        paymentMethod,
        amount: amount ? parseFloat(amount) : undefined,
      },
      {
        onSuccess: () => setSuccess(true),
      }
    );
  };

  const labelSt: React.CSSProperties = { fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "4px", display: "block", textTransform: "uppercase" };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
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
          <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>Add Walk-in Booking</span>
          <button onClick={onClose} style={{ padding: "6px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <X style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
          {success ? (
            <div className="text-center py-10">
              <CheckCircle2 style={{ width: "48px", height: "48px", color: "#22C55E", margin: "0 auto 12px" }} />
              <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>Walk-in recorded!</p>
              <p className="text-[#64748B] mb-6" style={{ fontSize: "14px" }}>Slot is blocked and revenue tracked.</p>
              <button onClick={onClose} className="px-6 py-3" style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Venue */}
              {venues.length > 1 && (
                <div>
                  <label style={labelSt}>Venue</label>
                  <select value={venueId} onChange={(e) => { setVenueId(Number(e.target.value)); setFacilityId(0); }} style={selectSt}>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name ?? `Venue ${v.id}`}</option>)}
                  </select>
                </div>
              )}

              {/* Facility */}
              <div>
                <label style={labelSt}>Court / Facility</label>
                <select value={facilityId} onChange={(e) => setFacilityId(Number(e.target.value))} style={selectSt}>
                  <option value={0}>Select facility…</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name ?? `Facility ${f.id}`}</option>)}
                </select>
              </div>

              {/* Date + times */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <label style={labelSt}>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Start</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>End</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Sport</label>
                  <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Tennis" style={inputSt} />
                </div>
              </div>

              {/* Customer */}
              <div>
                <label style={labelSt}><User style={{ width: "10px", height: "10px", display: "inline", marginRight: "4px" }} />Customer Name *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in player name" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}><Phone style={{ width: "10px", height: "10px", display: "inline", marginRight: "4px" }} />Phone (optional)</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+91 9876543210" style={inputSt} />
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={labelSt}>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "upi" | "card")} style={selectSt}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label style={labelSt}><IndianRupee style={{ width: "10px", height: "10px", display: "inline", marginRight: "4px" }} />Amount</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={inputSt} />
                </div>
              </div>

              {createManual.isError && (
                <p style={{ fontSize: "13px", color: "#EF4444" }}>Failed to record booking. Check for conflicts.</p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createManual.isPending || !facilityId || !customerName || !sport}
                  className="flex-1 py-3"
                  style={{
                    borderRadius: "12px",
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    fontSize: "14px", fontWeight: "700", color: "#fff",
                    opacity: createManual.isPending || !facilityId || !customerName || !sport ? 0.6 : 1,
                  }}
                >
                  {createManual.isPending ? "Recording…" : "Record Walk-in"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
