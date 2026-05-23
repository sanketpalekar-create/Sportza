import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBookings } from "@sportza/api-client";
import { format } from "date-fns";

type Booking = {
  id: number;
  status: string;
  totalAmount?: number;
  bookingDate: string;
  startTime?: string;
  endTime?: string;
  sport?: string;
  court?: string;
  facility?: string;
  venue?: { id?: number; name?: string; location?: { city?: string | null } | null };
};

const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", football: "⚽", cricket: "🏏", tennis: "🎾", padel: "🎾",
  basketball: "🏀", volleyball: "🏐", hockey: "🏑", swimming: "🏊",
  pickleball: "🏓",
};
function sportEmoji(s?: string) {
  return SPORT_EMOJI[(s ?? "").toLowerCase()] ?? "🏟";
}

const SPORT_COLOR: Record<string, string> = {
  badminton: "#3B82F6", football: "#22C55E", cricket: "#8B5CF6",
  tennis: "#F59E0B", padel: "#F59E0B", basketball: "#F97316", volleyball: "#06B6D4",
  pickleball: "#14B8A6",
};
function sportColor(s?: string) {
  return SPORT_COLOR[(s ?? "").toLowerCase()] ?? "#3B82F6";
}

function statusMeta(status: string): { label: string; bg: string; color: string } {
  const s = status?.toLowerCase();
  if (s === "confirmed")  return { label: "Confirmed", bg: "rgba(34,197,94,0.15)",   color: "#22C55E" };
  if (s === "pending")    return { label: "Pending",   bg: "rgba(245,158,11,0.15)",  color: "#F59E0B" };
  if (s?.startsWith("cancelled")) return { label: "Cancelled", bg: "rgba(239,68,68,0.15)", color: "#EF4444" };
  return                          { label: "Completed", bg: "rgba(148,163,184,0.12)", color: "#94A3B8" };
}

function isUpcoming(b: Booking) {
  const s = b.status?.toLowerCase();
  if (s === "cancelled" || s === "cancelled_user" || s === "cancelled_conflict") return false;
  try { return new Date(b.bookingDate) >= new Date(); } catch { return false; }
}

function isPast(b: Booking) {
  const s = b.status?.toLowerCase();
  if (s === "cancelled" || s === "cancelled_user" || s === "cancelled_conflict") return false;
  try { return new Date(b.bookingDate) < new Date(); } catch { return false; }
}

export default function BookingHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  const { data: allRes, isLoading } = useBookings({ page: 1, limit: 30 } as any);

  const allBookings: Booking[] = Array.isArray(allRes?.data)
    ? (allRes.data as Booking[])
    : Array.isArray(allRes) ? (allRes as Booking[]) : [];

  const upcoming = allBookings.filter(isUpcoming);
  const past     = allBookings.filter(isPast);
  const list     = tab === "upcoming" ? upcoming : past;

  if (isLoading) {
    return (
      <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-3">
        <div className="h-8 w-40 bg-[#1E293B] rounded-xl animate-pulse" />
        <div className="h-12 bg-[#1E293B] rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-[#1E293B] rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto">

      {/* ── Header ── */}
      <h1 className="text-white mb-4" style={{ fontSize: "24px", fontWeight: "800" }}>
        My Bookings
      </h1>

      {/* ── Tab toggle ── */}
      <div className="flex gap-1 p-1 mb-5"
        style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}>
        {(["upcoming", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 transition-all duration-200"
            style={{
              borderRadius: "9px",
              border: "none",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              backgroundColor: tab === t ? "#3B82F6" : "transparent",
              color: tab === t ? "#fff" : "#64748B",
            }}>
            {t === "upcoming"
              ? `Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}`
              : `History${past.length ? ` (${past.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── Booking cards ── */}
      {list.length === 0 ? (
        <div className="p-12 text-center"
          style={{ borderRadius: "18px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-5xl block mb-4">📅</span>
          <h2 className="text-white mb-2" style={{ fontSize: "17px", fontWeight: "600" }}>
            {tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
          </h2>
          <p className="text-[#94A3B8] mb-5" style={{ fontSize: "13px" }}>
            {tab === "upcoming" ? "Book a court to get started" : "Your completed games will appear here"}
          </p>
          {tab === "upcoming" && (
            <button onClick={() => navigate("/book")}
              className="text-white px-6"
              style={{ height: "44px", borderRadius: "12px", fontSize: "14px", fontWeight: "600", backgroundColor: "#3B82F6", border: "none", cursor: "pointer" }}>
              Book a Venue
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const sport  = b.sport ?? b.facility ?? "";
            const color  = sportColor(sport);
            const emoji  = sportEmoji(sport);
            const meta   = statusMeta(b.status);
            const isPastCard = isPast(b);

            return (
              <div key={b.id}
                className="p-4"
                style={{
                  borderRadius: "18px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                  opacity: isPastCard ? 0.75 : 1,
                }}>

                {/* Top row: emoji icon + sport/venue + status badge */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "46px", height: "46px", borderRadius: "13px", backgroundColor: `${color}25`, fontSize: "22px" }}>
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                        {sport || "Booking"}
                      </p>
                      <span style={{
                        backgroundColor: meta.bg, color: meta.color,
                        fontSize: "9px", fontWeight: "700", borderRadius: "999px",
                        padding: "3px 8px", letterSpacing: "0.03em", whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        {meta.label.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[#64748B] truncate" style={{ fontSize: "11px" }}>
                      📍 {b.venue?.name ?? "Venue"}
                    </p>
                  </div>
                </div>

                {/* Date & time — same row with emoji icons */}
                <div className="flex items-center gap-4 mb-3" style={{ fontSize: "11px", color: "#94A3B8" }}>
                  <span>
                    📅 {b.bookingDate ? format(new Date(b.bookingDate), "MMM d") : "—"}
                  </span>
                  {b.startTime && (
                    <span>
                      🕐 {b.startTime}{b.endTime ? `–${b.endTime}` : ""}
                    </span>
                  )}
                </div>

                {/* Bottom row: price + actions */}
                <div className="flex items-center justify-between pt-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>
                    {b.totalAmount != null ? `₹${b.totalAmount}` : b.court ? b.court : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {isPastCard ? (
                      <button onClick={() => navigate("/book")}
                        style={{ padding: "6px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "#94A3B8", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                        Rebook
                      </button>
                    ) : (
                      <>
                        <button onClick={() => navigate(`/bookings/${b.id}`)}
                          style={{ padding: "6px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "#94A3B8", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                          Manage
                        </button>
                        <button onClick={() => navigate(`/bookings/${b.id}`)}
                          style={{ padding: "6px 14px", borderRadius: "10px", border: "none", backgroundColor: "#3B82F6", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                          View
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
