/**
 * Venue Calendar — Owner's timeline view of all courts for a selected day
 * Columns = facilities, Rows = 1-hour bands (06:00–23:00)
 * Tap available slot → block or add walk-in
 * Tap booked slot → navigate to booking detail
 * Tap blocked slot → unblock
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, subDays } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, X, Lock, Unlock,
  CheckCircle2, AlertCircle, XCircle, Clock, User, Phone, IndianRupee,
} from "lucide-react";
import {
  useMyVenues,
  useVenueSlots,
  useOwnerBlockedSlots,
  useBlockSlot,
  useUnblockSlot,
  useVenueFacilities,
  useCreateManualBooking,
} from "@sportza/api-client";

// ─── Constants ────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00–22:00

// ─── Slot status colors ───────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  available:   { bg: "rgba(34,197,94,0.12)",  text: "#22C55E", label: "Free" },
  booked:      { bg: "rgba(59,130,246,0.2)",  text: "#3B82F6", label: "Confirmed" },
  high_demand: { bg: "rgba(245,158,11,0.18)", text: "#F59E0B", label: "Pending" },
  blocked:     { bg: "rgba(100,116,139,0.2)", text: "#64748B", label: "Blocked" },
  past:        { bg: "rgba(30,41,59,0.5)",    text: "#334155", label: "Past" },
};

type SlotData = {
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
  status: string;
  bookingId?: number;
  slotId?: number;
};

type FacilityColumn = {
  facilityId: number;
  facilityName: string;
  slots: SlotData[];
};

// ─── Action Sheet ─────────────────────────────────────────────────────────────
function ActionSheet({
  slot,
  facilityId,
  facilityName,
  venueId,
  date,
  onClose,
}: {
  slot: SlotData;
  facilityId: number;
  facilityName: string;
  venueId: number;
  date: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const blockSlot  = useBlockSlot();
  const unblockSlot = useUnblockSlot();
  const createManual = useCreateManualBooking();
  const { data: facilitiesRes } = useVenueFacilities(venueId);
  const facilities: Array<{ id: number; name?: string }> = (facilitiesRes as any)?.data ?? [];

  const [mode, setMode] = useState<"menu" | "walkin" | "block">("menu");
  const [blockReason, setBlockReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sport, setSport] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);

  const inputSt: React.CSSProperties = {
    width: "100%", height: "44px", borderRadius: "10px",
    backgroundColor: "#0F172A", border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#F1F5F9", fontSize: "14px", paddingLeft: "12px", outline: "none",
  };
  const selectSt: React.CSSProperties = { ...inputSt, appearance: "none" };
  const labelSt: React.CSSProperties = { fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "4px", display: "block", textTransform: "uppercase" };

  if (done) {
    return (
      <SheetWrap title="Done" onClose={onClose}>
        <div className="text-center py-8">
          <CheckCircle2 style={{ width: "48px", height: "48px", color: "#22C55E", margin: "0 auto 12px" }} />
          <p className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Action completed</p>
          <button onClick={onClose} className="px-6 py-3" style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "14px", fontWeight: "700", color: "#fff" }}>Close</button>
        </div>
      </SheetWrap>
    );
  }

  // Booked — navigate to booking
  if (slot.status === "booked" || slot.status === "high_demand") {
    return (
      <SheetWrap title={`${slot.startTime}–${slot.endTime}`} onClose={onClose}>
        <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>
          {STATUS_STYLE[slot.status]?.label ?? slot.status} slot on {facilityName}
        </p>
        <button
          onClick={() => { if (slot.bookingId) navigate(`/venue-owner/bookings/${slot.bookingId}`); onClose(); }}
          className="w-full py-3 flex items-center justify-center gap-2"
          style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
        >
          View Booking
        </button>
      </SheetWrap>
    );
  }

  // Blocked — offer to unblock
  if (slot.status === "blocked") {
    return (
      <SheetWrap title="Unblock slot?" onClose={onClose}>
        <p className="text-[#94A3B8] mb-4" style={{ fontSize: "14px" }}>
          {slot.startTime}–{slot.endTime} on {facilityName} is currently blocked.
        </p>
        <button
          onClick={() => {
            if (slot.slotId) unblockSlot.mutate({ slotId: slot.slotId, venueId }, { onSuccess: () => { setDone(true); } });
          }}
          disabled={unblockSlot.isPending}
          className="w-full py-3 flex items-center justify-center gap-2"
          style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.3)", fontSize: "14px", fontWeight: "700", color: "#22C55E" }}
        >
          <Unlock style={{ width: "16px", height: "16px" }} />
          {unblockSlot.isPending ? "Unblocking…" : "Unblock Slot"}
        </button>
      </SheetWrap>
    );
  }

  // Available — menu
  if (mode === "menu") {
    return (
      <SheetWrap title={`${slot.startTime}–${slot.endTime} · ${facilityName}`} onClose={onClose}>
        <div className="space-y-3 py-2">
          <button
            onClick={() => setMode("walkin")}
            className="w-full flex items-center gap-3 p-4"
            style={{ borderRadius: "14px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.12)" }}>
              <User style={{ width: "20px", height: "20px", color: "#F59E0B" }} />
            </div>
            <div className="text-left">
              <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Add Walk-in</p>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Record a cash / UPI booking</p>
            </div>
          </button>

          <button
            onClick={() => setMode("block")}
            className="w-full flex items-center gap-3 p-4"
            style={{ borderRadius: "14px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(100,116,139,0.12)" }}>
              <Lock style={{ width: "20px", height: "20px", color: "#64748B" }} />
            </div>
            <div className="text-left">
              <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Block Slot</p>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Reserve for maintenance or private use</p>
            </div>
          </button>
        </div>
      </SheetWrap>
    );
  }

  if (mode === "block") {
    return (
      <SheetWrap title="Block Slot" onClose={onClose}>
        <label style={labelSt}>Reason (optional)</label>
        <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="e.g. Maintenance" style={{ ...inputSt, marginBottom: "16px" }} />
        <div className="flex gap-3">
          <button onClick={() => setMode("menu")} className="flex-1 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>Back</button>
          <button
            onClick={() => blockSlot.mutate({ venueId, facilityId, date, startTime: slot.startTime, endTime: slot.endTime, reason: blockReason || undefined }, { onSuccess: () => setDone(true) })}
            disabled={blockSlot.isPending}
            className="flex-1 py-3"
            style={{ borderRadius: "12px", background: "linear-gradient(135deg,#64748B,#475569)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: blockSlot.isPending ? 0.7 : 1 }}
          >
            {blockSlot.isPending ? "Blocking…" : "Block Slot"}
          </button>
        </div>
      </SheetWrap>
    );
  }

  // Walk-in form
  return (
    <SheetWrap title="Walk-in Booking" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label style={labelSt}>Customer Name *</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Player name" style={inputSt} />
        </div>
        <div>
          <label style={labelSt}><Phone style={{ width: "10px", height: "10px", display: "inline", marginRight: "4px" }} />Phone</label>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+91…" style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>Sport *</label>
          <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Tennis" style={inputSt} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label style={labelSt}>Payment</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "upi" | "card")} style={selectSt}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label style={labelSt}><IndianRupee style={{ width: "10px", height: "10px", display: "inline" }} /> Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={inputSt} />
          </div>
        </div>
        {createManual.isError && <p style={{ fontSize: "12px", color: "#EF4444" }}>Conflict detected. This slot may be taken.</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={() => setMode("menu")} className="flex-1 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>Back</button>
          <button
            onClick={() => createManual.mutate({ venueId, facilityId, date, startTime: slot.startTime, endTime: slot.endTime, sport, customerName, customerPhone: customerPhone || undefined, paymentMethod, amount: amount ? parseFloat(amount) : undefined }, { onSuccess: () => setDone(true) })}
            disabled={createManual.isPending || !customerName || !sport}
            className="flex-1 py-3"
            style={{ borderRadius: "12px", background: "linear-gradient(135deg,#F59E0B,#D97706)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: createManual.isPending || !customerName || !sport ? 0.6 : 1 }}
          >
            {createManual.isPending ? "Saving…" : "Record Walk-in"}
          </button>
        </div>
      </div>
    </SheetWrap>
  );
}

function SheetWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
          <span className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>{title}</span>
          <button onClick={onClose} style={{ padding: "6px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <X style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
export default function VenueCalendar() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [venueId, setVenueId] = useState<number | null>(null);
  const [actionSlot, setActionSlot] = useState<{ slot: SlotData; facilityId: number; facilityName: string } | null>(null);

  const { data: venuesRes } = useMyVenues();
  const venues: Array<{ id: number; name?: string }> = (venuesRes as any)?.data ?? [];
  const activeVenueId = venueId ?? venues[0]?.id ?? null;

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: slotsRes, isLoading } = useVenueSlots(activeVenueId ?? 0, { date: dateStr });
  const { data: blocksRes } = useOwnerBlockedSlots(activeVenueId ?? 0, dateStr);

  const facilities: FacilityColumn[] = (slotsRes as any)?.facilities ?? [];
  const blocks: Array<{ id: number; facilityId: number; startTime: string; endTime: string }> =
    (blocksRes as any)?.blocks ?? [];

  // Merge blocked slot data into facility slot columns
  const enrichedFacilities: FacilityColumn[] = facilities.map((f) => ({
    ...f,
    slots: f.slots.map((s) => {
      const matchingBlock = blocks.find(
        (b) =>
          b.facilityId === f.facilityId &&
          new Date(b.startTime).getUTCHours() === parseInt(s.startTime.split(":")[0], 10)
      );
      if (matchingBlock) {
        return { ...s, status: "blocked", available: false, slotId: matchingBlock.id };
      }
      return s;
    }),
  }));

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#0F172A] px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate("/venue-owner/bookings")}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft style={{ width: "14px", height: "14px", color: "#94A3B8" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Bookings</span>
          </button>
          <h1 className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>Calendar View</h1>
          {venues.length > 1 ? (
            <select
              value={activeVenueId ?? ""}
              onChange={(e) => setVenueId(Number(e.target.value))}
              style={{ backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#F1F5F9", fontSize: "12px", padding: "6px 8px", outline: "none" }}
            >
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name ?? `Venue ${v.id}`}</option>)}
            </select>
          ) : <div />}
        </div>

        {/* Date strip */}
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedDate((d) => subDays(d, 1))} className="p-2" style={{ borderRadius: "8px", backgroundColor: "#1E293B" }}>
            <ChevronLeft style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
          </button>
          <div className="text-center">
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{format(selectedDate, "EEEE, d MMMM")}</p>
          </div>
          <button onClick={() => setSelectedDate((d) => addDays(d, 1))} className="p-2" style={{ borderRadius: "8px", backgroundColor: "#1E293B" }}>
            <ChevronRight style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-3 overflow-x-auto scrollbar-hide pb-1">
          {Object.entries(STATUS_STYLE).filter(([k]) => k !== "past").map(([key, style]) => (
            <div key={key} className="flex items-center gap-1.5 flex-shrink-0">
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: style.bg, border: `1px solid ${style.text}` }} />
              <span style={{ fontSize: "11px", color: "#64748B" }}>{style.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="px-4 pt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 rounded-xl" style={{ backgroundColor: "#1E293B" }} />
          ))}
        </div>
      ) : enrichedFacilities.length === 0 ? (
        <div className="px-4 pt-12 text-center">
          <Clock style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
          <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>No facilities found</p>
          <p className="text-[#64748B] mb-5" style={{ fontSize: "14px" }}>Add facilities to see the calendar</p>
          <button
            onClick={() => navigate("/venue-owner/facilities")}
            className="px-5 py-3"
            style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
          >
            Set Up Facilities
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ minHeight: "400px" }}>
          <div style={{ minWidth: `${enrichedFacilities.length * 140 + 52}px` }}>
            {/* Column headers */}
            <div className="flex" style={{ paddingLeft: "52px" }}>
              {enrichedFacilities.map((f) => (
                <div
                  key={f.facilityId}
                  className="flex-shrink-0 text-center px-1 py-2"
                  style={{ width: "140px", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase" }}
                >
                  {f.facilityName}
                </div>
              ))}
            </div>

            {/* Time rows */}
            {HOURS.map((hour) => {
              const timeLabel = `${String(hour).padStart(2, "0")}:00`;
              return (
                <div key={hour} className="flex items-stretch" style={{ minHeight: "48px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {/* Time label */}
                  <div
                    className="flex-shrink-0 flex items-center justify-end pr-2"
                    style={{ width: "52px", fontSize: "11px", color: "#475569" }}
                  >
                    {timeLabel}
                  </div>

                  {/* Facility cells */}
                  {enrichedFacilities.map((f) => {
                    const slot = f.slots.find((s) => s.startTime === timeLabel);
                    if (!slot) {
                      return <div key={f.facilityId} style={{ width: "140px", flexShrink: 0 }} />;
                    }
                    const style = STATUS_STYLE[slot.status] ?? STATUS_STYLE.available;
                    const isInteractive = slot.status !== "past";

                    return (
                      <button
                        key={f.facilityId}
                        onClick={() => {
                          if (isInteractive) {
                            setActionSlot({ slot, facilityId: f.facilityId, facilityName: f.facilityName });
                          }
                        }}
                        disabled={!isInteractive}
                        className="flex-shrink-0 mx-0.5 my-0.5 flex flex-col items-start justify-center px-2 transition-opacity"
                        style={{
                          width: "139px",
                          borderRadius: "8px",
                          backgroundColor: style.bg,
                          border: `1px solid ${style.text}22`,
                          minHeight: "46px",
                          cursor: isInteractive ? "pointer" : "default",
                          opacity: slot.status === "past" ? 0.4 : 1,
                        }}
                      >
                        <span style={{ fontSize: "10px", fontWeight: "700", color: style.text }}>
                          {style.label}
                        </span>
                        {slot.status === "available" && (
                          <span style={{ fontSize: "10px", color: style.text, opacity: 0.7 }}>
                            ₹{slot.price}
                          </span>
                        )}
                        {slot.status === "blocked" && (
                          <Lock style={{ width: "10px", height: "10px", color: style.text, opacity: 0.7 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action sheet ── */}
      {actionSlot && activeVenueId && (
        <ActionSheet
          slot={actionSlot.slot}
          facilityId={actionSlot.facilityId}
          facilityName={actionSlot.facilityName}
          venueId={activeVenueId}
          date={dateStr}
          onClose={() => setActionSlot(null)}
        />
      )}
    </div>
  );
}
