/**
 * Instant Book — multi-slot, multi-court flow (≤ 4 taps)
 *
 * Step 1  Pick sport
 * Step 2  Pick venue → expand → select courts + toggle time slots
 * Step 3  Confirm & Pay (summary + payment method + pay CTA)
 * Step 4  Success (booking IDs + post-booking CTAs)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserLocation } from "../../context/LocationContext";
import { format, addDays } from "date-fns";
import {
  ArrowLeft, MapPin, Star, Check, ChevronRight,
  Clock, Share2, Trophy, ShoppingCart, X, Users, Calendar, Zap, UserPlus, Timer,
} from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";
import {
  useSports,
  useNearbyVenues,
  useVenueSlots,
  useBatchBooking,
  useCreateSplitBooking,
  useHoldSlot,
  useReleaseHold,
} from "@sportza/api-client";
import { useRazorpayCheckout } from "../../hooks/useRazorpayCheckout";

const HOLD_TTL_SECONDS = 5 * 60; // 5 minutes

// ── ICS calendar helper ───────────────────────────────────────────────────────
function downloadICS(params: {
  date: string;     // yyyy-MM-dd
  start: string;    // HH:mm
  end: string;      // HH:mm
  venue: string;
  sport: string;
}) {
  const ds = params.date.replace(/-/g, "");
  const ts = params.start.replace(":", "") + "00";
  const te = params.end.replace(":", "") + "00";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sportza//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${params.sport} at ${params.venue}`,
    `DTSTART:${ds}T${ts}`,
    `DTEND:${ds}T${te}`,
    `DESCRIPTION:Booked via Sportza`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sportza-booking.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Sport        = { id: number; name: string; displayName?: string };
type Venue        = { id: number; name: string; location?: { city?: string | null } | null; rating?: number; pricePerHour?: number; defaultPricePerHour?: number };
type RawSlot      = { startTime: string; endTime: string; price: number; available: boolean };
type FacilityData = { facilityId: number; facilityName: string; surfaceType?: string; slots: RawSlot[] };

type Selection = {
  facilityId: number;
  facilityName: string;
  venueId: number;
  startTime: string;
  endTime: string;
  price: number;
  holdId?: number;
  holdExpiresAt?: number; // epoch ms
};

type Step = "sport" | "venues" | "confirm" | "success";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", tennis: "🎾", padel: "🎾", football: "⚽", cricket: "🏏",
  basketball: "🏀", squash: "🎾", volleyball: "🏐", tabletennis: "🏓",
  "table tennis": "🏓", pickleball: "🏓",
};
const sportEmoji = (n: string) => SPORT_EMOJI[n.toLowerCase()] ?? "🏅";

function selKey(s: Selection) {
  return `${s.facilityId}::${s.startTime}`;
}

// ─── Hold countdown component ─────────────────────────────────────────────────
function HoldCountdown({ expiresAt }: { expiresAt: number }) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setSecsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return (
    <span style={{ fontSize: "9px", color: secsLeft < 60 ? "#EF4444" : "#86EFAC", fontWeight: "700" }}>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ─── Multi-select slot picker ─────────────────────────────────────────────────
function VenueSlotPicker({
  venue,
  sport,
  dateStr,
  selections,
  onToggle,
  onConfirm,
}: {
  venue: Venue;
  sport: string;
  dateStr: string;
  selections: Selection[];
  onToggle: (sel: Selection, holdResult?: { id: number; expiresAt: string }) => void;
  onConfirm: () => void;
}) {
  const { data, isLoading } = useVenueSlots(venue.id, { date: dateStr, sport });
  const holdSlot = useHoldSlot();
  const releaseHold = useReleaseHold();
  const facilities: FacilityData[] =
    (data as any)?.facilities ?? (data as any)?.data?.facilities ?? [];

  const [activeFacilityId, setActiveFacilityId] = useState<number | null>(null);

  useEffect(() => {
    if (facilities.length > 0 && activeFacilityId === null) {
      setActiveFacilityId(facilities[0].facilityId);
    }
  }, [facilities.length]);

  const activeFacility = facilities.find((f) => f.facilityId === activeFacilityId);
  const availableSlots = activeFacility?.slots.filter((s) => s.available) ?? [];

  const handleToggle = useCallback(
    async (sel: Selection) => {
      const isSelected = selections.some((s) => selKey(s) === selKey(sel));
      if (isSelected) {
        // Release hold if one exists
        const existing = selections.find((s) => selKey(s) === selKey(sel));
        if (existing?.holdId) {
          releaseHold.mutate(existing.holdId);
        }
        onToggle(sel);
      } else {
        // Acquire hold before selecting — if hold fails the slot is already contested
        try {
          const res = await holdSlot.mutateAsync({
            facilityId: sel.facilityId,
            venueId: venue.id,
            date: dateStr,
            startTime: sel.startTime,
            endTime: sel.endTime,
          });
          onToggle(sel, res.hold);
        } catch {
          // Hold failed — slot is contested; do not add to selection
        }
      }
    },
    [selections, dateStr, venue.id, holdSlot, releaseHold, onToggle]
  );

  // Count selections scoped to this venue's facilities
  const venueFacilityIds = new Set(facilities.map((f) => f.facilityId));
  const venueSelections = selections.filter((s) => venueFacilityIds.has(s.facilityId));
  const total = venueSelections.reduce((sum, s) => sum + s.price, 0);

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-[#111827] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <p className="mt-3 text-center text-[#64748B] text-sm py-4">
        No facilities available for this day
      </p>
    );
  }

  return (
    <div className="mt-3">
      {/* Court tabs */}
      {facilities.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
          {facilities.map((f) => {
            const courtSelCount = selections.filter((s) => s.facilityId === f.facilityId).length;
            const isActive = f.facilityId === activeFacilityId;
            return (
              <button
                key={f.facilityId}
                onClick={() => setActiveFacilityId(f.facilityId)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 transition-all"
                style={{
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor: isActive ? "#3B82F6" : "#111827",
                  color: isActive ? "#FFFFFF" : "#94A3B8",
                  border: isActive ? "none" : "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                {f.facilityName}
                {courtSelCount > 0 && (
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: "16px", height: "16px", borderRadius: "50%",
                      backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "#3B82F6",
                      fontSize: "10px", fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    {courtSelCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Slot grid */}
      {availableSlots.length === 0 ? (
        <p className="text-center text-[#64748B] text-sm py-4">No slots available</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {availableSlots.map((slot) => {
            const sel: Selection = {
              facilityId: activeFacility!.facilityId,
              facilityName: activeFacility!.facilityName,
              venueId: venue.id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              price: slot.price,
            };
            const existing = selections.find((s) => selKey(s) === selKey(sel));
            const isSelected = !!existing;
            return (
              <button
                key={`${activeFacility!.facilityId}-${slot.startTime}`}
                onClick={() => handleToggle(sel)}
                disabled={holdSlot.isPending}
                className="flex flex-col items-start p-3 transition-all active:scale-95 relative"
                style={{
                  borderRadius: "12px",
                  backgroundColor: isSelected ? "#3B82F6" : "#111827",
                  border: isSelected ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {isSelected && (
                  <span
                    className="absolute top-2 right-2 flex items-center gap-0.5"
                  >
                    {existing.holdExpiresAt && (
                      <HoldCountdown expiresAt={existing.holdExpiresAt} />
                    )}
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: "16px", height: "16px", borderRadius: "50%",
                        backgroundColor: "rgba(255,255,255,0.25)",
                      }}
                    >
                      <Check style={{ width: "10px", height: "10px", color: "#fff" }} strokeWidth={3} />
                    </span>
                  </span>
                )}
                <div className="flex items-center gap-1 mb-1">
                  <Clock style={{ width: "11px", height: "11px", color: isSelected ? "#fff" : "#94A3B8" }} />
                  <span
                    className="font-semibold"
                    style={{ fontSize: "12px", color: isSelected ? "#fff" : "#E2E8F0" }}
                  >
                    {slot.startTime}–{slot.endTime}
                  </span>
                </div>
                <span
                  className="font-bold mt-0.5"
                  style={{ fontSize: "15px", color: isSelected ? "#fff" : "#3B82F6" }}
                >
                  ₹{slot.price}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Cart bar — shows when slots are selected for this venue */}
      {venueSelections.length > 0 && (
        <button
          onClick={onConfirm}
          className="w-full mt-4 flex items-center justify-between px-4 transition-all active:scale-[0.98]"
          style={{
            height: "52px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart style={{ width: "16px", height: "16px", color: "#fff" }} />
            <span className="text-white font-semibold" style={{ fontSize: "14px" }}>
              {venueSelections.length} slot{venueSelections.length > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold" style={{ fontSize: "16px" }}>
              ₹{total.toLocaleString("en-IN")}
            </span>
            <ChevronRight style={{ width: "18px", height: "18px", color: "#fff" }} />
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function InstantBook() {
  const navigate = useNavigate();
  const userLoc = useUserLocation();

  const [step, setStep] = useState<Step>("sport");
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [expandedVenueId, setExpandedVenueId] = useState<number | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [bookingIds, setBookingIds] = useState<number[]>([]);

  const today    = new Date();
  const dateObj  = addDays(today, dayOffset);
  const dateStr  = format(dateObj, "yyyy-MM-dd");
  const dateLabel = dayOffset === 0 ? "Today" : "Tomorrow";

  const { data: sportsRes } = useSports();
  const _rawSports: Sport[] = (sportsRes as any)?.data ?? (sportsRes as any) ?? [];
  // Guarantee padel appears even when the live DB has not been backfilled yet
  const sports: Sport[] = _rawSports.some((s) => s.name.toLowerCase() === "padel")
    ? _rawSports
    : [..._rawSports, { id: 0 as any, name: "padel", displayName: "Padel" } as Sport].sort(
        (a, b) => ((a as any).displayName ?? a.name).localeCompare((b as any).displayName ?? b.name),
      );

  const hasCoords = userLoc.lat != null && userLoc.lng != null;
  const { data: venuesRes, isLoading: venuesLoading } = useNearbyVenues(
    hasCoords
      ? { lat: userLoc.lat!, lng: userLoc.lng!, radius: 15, sport: selectedSport?.name, city: userLoc.city ?? undefined, state: userLoc.state ?? undefined }
      : (userLoc.city || userLoc.state)
        ? { city: userLoc.city ?? undefined, state: userLoc.state ?? undefined, sport: selectedSport?.name }
        : { sport: selectedSport?.name },
  );
  const venues: Venue[] = (venuesRes as any)?.data ?? (venuesRes as any) ?? [];

  const batchBooking = useBatchBooking();
  const createSplitBooking = useCreateSplitBooking();
  const razorpayCheckout = useRazorpayCheckout();
  const [payError, setPayError] = useState<string | null>(null);

  // Split payment state
  const [paymentMode, setPaymentMode] = useState<"full" | "split">("full");
  const [splitCount, setSplitCount] = useState(2);
  const [splitShareLink, setSplitShareLink] = useState<string | null>(null);
  const [conflictSuggestions, setConflictSuggestions] = useState<Array<{ startTime: string; endTime: string }>>([]);

  const grandTotal = selections.reduce((sum, s) => sum + s.price, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSportTap = (sport: Sport) => {
    setSelectedSport(sport);
    setSelections([]);
    setExpandedVenueId(null);
    setStep("venues");
  };

  const handleVenueTap = (venue: Venue) => {
    if (expandedVenueId === venue.id) {
      setExpandedVenueId(null);
    } else {
      setExpandedVenueId(venue.id);
      setSelectedVenue(venue);
    }
  };

  const releaseHoldMutation = useReleaseHold();

  // Keep a ref in sync with the latest selections so the unmount cleanup
  // always sees the current holds, not a stale closure snapshot.
  const selectionsRef = useRef(selections);
  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  // Release all holds when navigating away from confirm/success
  useEffect(() => {
    return () => {
      selectionsRef.current.forEach((s) => {
        if (s.holdId) releaseHoldMutation.mutate(s.holdId);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSlot = (
    sel: Selection,
    holdResult?: { id: number; expiresAt: string }
  ) => {
    setSelections((prev) => {
      const key = selKey(sel);
      const exists = prev.some((s) => selKey(s) === key);
      if (exists) {
        return prev.filter((s) => selKey(s) !== key);
      }
      const enriched: Selection = holdResult
        ? { ...sel, holdId: holdResult.id, holdExpiresAt: new Date(holdResult.expiresAt).getTime() }
        : sel;
      const next = [...prev, enriched];
      // Split is only available for single-slot bookings
      if (next.length > 1) setPaymentMode("full");
      return next;
    });
  };

  const handleConfirm = (venue: Venue) => {
    setSelectedVenue(venue);
    setStep("confirm");
  };

  const handlePayFull = async () => {
    if (!selectedVenue || selections.length === 0) return;
    setPayError(null);
    setConflictSuggestions([]);
    try {
      const res = await batchBooking.mutateAsync({
        venueId: selectedVenue.id,
        sport: selectedSport!.name,
        date: dateStr,
        items: selections.map((s) => ({
          facilityId: s.facilityId,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
      const batchData = (res as any)?.data;
      const createdIds: number[] = (batchData?.bookings ?? []).map((b: any) => b.id as number);
      const groupId: string | undefined = batchData?.groupId;

      if (grandTotal > 0) {
        await razorpayCheckout({
          amount: grandTotal,
          description: `${selections.length} slot${selections.length > 1 ? "s" : ""} at ${selectedVenue.name}`,
          groupId,
          bookingId: groupId ? undefined : createdIds[0],
          onSuccess: (paidIds) => {
            setBookingIds(paidIds.length > 0 ? paidIds : createdIds);
            setSplitShareLink(null);
            setStep("success");
          },
          onFailure: (reason) => {
            setPayError(reason === "Payment cancelled" ? null : reason);
          },
        });
      } else {
        setBookingIds(createdIds);
        setSplitShareLink(null);
        setStep("success");
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setPayError("That slot is taken. Try one of these:");
        setConflictSuggestions(data.suggestions);
      }
      // other errors handled via global interceptor
    }
  };

  const handlePaySplit = async () => {
    if (!selectedVenue || selections.length === 0) return;
    setPayError(null);
    const sel = selections[0];
    try {
      const res = await createSplitBooking.mutateAsync({
        venueId: selectedVenue.id,
        sport: selectedSport!.name,
        bookingDate: dateStr,
        facilityId: sel.facilityId,
        startTime: sel.startTime,
        endTime: sel.endTime,
        splitCount,
      });
      const bookingData = (res as any)?.data;
      const bookingId: number = bookingData?.id;
      const perPerson: number = bookingData?.splitDetails?.perPersonAmount ?? Math.ceil(grandTotal / splitCount);
      setBookingIds(bookingId ? [bookingId] : []);

      if (perPerson > 0 && bookingId) {
        await razorpayCheckout({
          amount: perPerson,
          description: `Your share — ${sel.facilityName} at ${selectedVenue.name}`,
          bookingId,
          onSuccess: () => {
            setSplitShareLink(`${window.location.origin}/bookings/${bookingId}`);
            setStep("success");
          },
          onFailure: (reason) => {
            setPayError(reason === "Payment cancelled" ? null : reason);
          },
        });
      } else {
        setSplitShareLink(null);
        setStep("success");
      }
    } catch {
      // handled via interceptor
    }
  };

  const handleBack = () => {
    if (step === "venues") { setStep("sport"); setExpandedVenueId(null); }
    else if (step === "confirm") { setStep("venues"); }
    else navigate(-1);
  };

  const resetAll = () => {
    setStep("sport");
    setSelectedSport(null);
    setExpandedVenueId(null);
    setSelectedVenue(null);
    setSelections([]);
    setBookingIds([]);
    setDayOffset(0);
    setPaymentMode("full");
    setSplitCount(2);
    setSplitShareLink(null);
    setPayError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F172A] pb-32">
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-[#0F172A] flex items-center gap-3 px-4"
        style={{ height: "56px" }}
      >
        {step !== "success" && (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 transition-colors hover:bg-[#1E293B]"
            style={{ borderRadius: "12px" }}
          >
            <ArrowLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
        )}
        <h1 className="text-white flex-1" style={{ fontSize: "18px", fontWeight: "600" }}>
          {step === "sport"         && "Instant Book"}
          {step === "venues"        && `${selectedSport?.displayName ?? selectedSport?.name} — ${dateLabel}`}
          {step === "confirm"       && "Confirm & Pay"}
          {step === "success"       && "Booking Confirmed!"}
        </h1>
        {/* Selection count badge in header on venues step */}
        {step === "venues" && selections.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              borderRadius: "999px",
              backgroundColor: "rgba(59,130,246,0.2)",
              border: "1px solid rgba(59,130,246,0.4)",
            }}
          >
            <ShoppingCart style={{ width: "13px", height: "13px", color: "#3B82F6" }} />
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#3B82F6" }}>
              {selections.length}
            </span>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4">

        {/* ══════════ STEP 1 — SPORT ══════════ */}
        {step === "sport" && (
          <div className="pt-4">
            <p className="text-[#94A3B8] mb-6" style={{ fontSize: "14px" }}>
              Which sport are you playing today?
            </p>
            {sports.length === 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-[#1E293B] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sports.map((s) => (
                  <div key={s.id} className="relative">
                    <button
                      onClick={() => handleSportTap(s)}
                      className="w-full flex flex-col items-center gap-2 py-6 transition-all duration-200 active:scale-95"
                      style={{
                        borderRadius: "16px",
                        backgroundColor: "#1E293B",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span style={{ fontSize: "36px" }}>{sportEmoji(s.name)}</span>
                      <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
                        {s.displayName ?? s.name}
                      </span>
                    </button>
                    <span className="absolute top-2 right-2 z-10">
                      <SportRulebook sport={s} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ STEP 2 — VENUES ══════════ */}
        {step === "venues" && (
          <div className="pt-2">
            {/* Today / Tomorrow */}
            <div
              className="flex gap-1 p-1 mb-4"
              style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}
            >
              {["Today", "Tomorrow"].map((label, idx) => (
                <button
                  key={label}
                  onClick={() => { setDayOffset(idx); setExpandedVenueId(null); }}
                  className="flex-1 py-2 transition-all"
                  style={{
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600",
                    backgroundColor: dayOffset === idx ? "#3B82F6" : "transparent",
                    color: dayOffset === idx ? "#FFFFFF" : "#94A3B8",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Selection hint */}
            <p className="text-[#64748B] mb-3" style={{ fontSize: "12px" }}>
              Tap a venue to expand courts. Select one or more time slots — then tap <strong className="text-[#94A3B8]">Book</strong>.
            </p>

            {/* Inline cart summary bar — appears below the hint, scrolls with page */}
            {selections.length > 0 && (
              <button
                onClick={() => setStep("confirm")}
                className="w-full flex items-center justify-between px-4 mb-4 transition-all active:scale-[0.98]"
                style={{
                  height: "52px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart style={{ width: "16px", height: "16px", color: "#fff" }} />
                  <span className="text-white font-semibold" style={{ fontSize: "14px" }}>
                    {selections.length} slot{selections.length > 1 ? "s" : ""} in cart
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold" style={{ fontSize: "16px" }}>
                    ₹{grandTotal.toLocaleString("en-IN")}
                  </span>
                  <ChevronRight style={{ width: "18px", height: "18px", color: "#fff" }} />
                </div>
              </button>
            )}

            {venuesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-[#1E293B] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : venues.length === 0 ? (
              <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
                  No venues found nearby for {selectedSport?.displayName ?? selectedSport?.name}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {venues.map((venue) => {
                  const isExpanded = expandedVenueId === venue.id;
                  return (
                    <div
                      key={venue.id}
                      style={{
                        borderRadius: "16px",
                        backgroundColor: "#1E293B",
                        border: isExpanded
                          ? "1px solid rgba(59,130,246,0.4)"
                          : "1px solid rgba(255,255,255,0.05)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Venue header row */}
                      <button
                        onClick={() => handleVenueTap(venue)}
                        className="w-full p-4 text-left flex items-center justify-between transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white mb-1 truncate" style={{ fontSize: "16px", fontWeight: "600" }}>
                            {venue.name}
                          </h3>
                          <div className="flex items-center gap-3">
                            {venue.location?.city && (
                              <div className="flex items-center gap-1 text-[#94A3B8]" style={{ fontSize: "12px" }}>
                                <MapPin style={{ width: "12px", height: "12px" }} />
                                <span>{venue.location.city}</span>
                              </div>
                            )}
                            {venue.rating && (
                              <div className="flex items-center gap-1">
                                <Star style={{ width: "12px", height: "12px", color: "#F59E0B", fill: "#F59E0B" }} />
                                <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>{venue.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-3 shrink-0">
                          {(venue.defaultPricePerHour ?? venue.pricePerHour) && (
                            <div className="text-right">
                              <div className="text-[#3B82F6]" style={{ fontSize: "16px", fontWeight: "700" }}>
                                ₹{venue.defaultPricePerHour ?? venue.pricePerHour}
                              </div>
                              <div className="text-[#64748B]" style={{ fontSize: "10px" }}>/ hr</div>
                            </div>
                          )}
                          <ChevronRight
                            style={{
                              width: "18px", height: "18px", color: "#94A3B8",
                              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                            }}
                          />
                        </div>
                      </button>

                      {/* Inline slot picker */}
                      {isExpanded && (
                        <div
                          className="px-4 pb-4"
                          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <p className="text-[#94A3B8] mt-3 mb-2" style={{ fontSize: "12px" }}>
                            {format(dateObj, "EEE, MMM d")} — select courts &amp; slots
                          </p>
                          <VenueSlotPicker
                            venue={venue}
                            sport={selectedSport?.name ?? ""}
                            dateStr={dateStr}
                            selections={selections}
                            onToggle={handleToggleSlot}
                            onConfirm={() => handleConfirm(venue)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ══════════ STEP 3 — CONFIRM & PAY (merged) ══════════ */}
        {step === "confirm" && selectedVenue && selections.length > 0 && (
          <div className="pt-4 space-y-4">
            {/* ── Booking summary ── */}
            <div
              className="p-5"
              style={{
                borderRadius: "16px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white" style={{ fontSize: "18px", fontWeight: "700" }}>
                  Booking Summary
                </h2>
                <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                  {format(dateObj, "EEE, MMM d")}
                </span>
              </div>

              {[
                { label: "Venue", value: selectedVenue.name },
                { label: "Sport", value: selectedSport?.displayName ?? selectedSport?.name ?? "" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{label}</span>
                  <span className="text-white" style={{ fontSize: "13px", fontWeight: "500" }}>{value}</span>
                </div>
              ))}

              <div className="mt-3 space-y-1">
                <p className="text-[#64748B] mb-2" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Slots ({selections.length})
                </p>
                {selections.map((sel, i) => (
                  <div
                    key={`${sel.facilityId}-${sel.startTime}-${i}`}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div>
                      <p className="text-white" style={{ fontSize: "13px", fontWeight: "500" }}>
                        {sel.facilityName}
                      </p>
                      <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                        {sel.startTime}–{sel.endTime}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#3B82F6]" style={{ fontSize: "14px", fontWeight: "600" }}>
                        ₹{sel.price}
                      </span>
                      <button
                        onClick={() => {
                          handleToggleSlot(sel);
                          if (selections.length === 1) setStep("venues");
                        }}
                        className="p-1"
                        style={{ borderRadius: "6px", backgroundColor: "rgba(239,68,68,0.12)" }}
                      >
                        <X style={{ width: "12px", height: "12px", color: "#EF4444" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-white" style={{ fontSize: "16px", fontWeight: "600" }}>Total</span>
                <span className="text-[#3B82F6]" style={{ fontSize: "24px", fontWeight: "700" }}>
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* ── Payment method selection ── */}
            <div>
              <p className="text-[#94A3B8] mb-3" style={{ fontSize: "13px", fontWeight: "600" }}>
                Payment method
              </p>

              <button
                onClick={() => setPaymentMode("full")}
                className="w-full p-4 flex items-center gap-4 transition-all mb-2"
                style={{
                  borderRadius: "16px",
                  backgroundColor: paymentMode === "full" ? "rgba(59,130,246,0.1)" : "#1E293B",
                  border: paymentMode === "full" ? "2px solid #3B82F6" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(59,130,246,0.15)" }}
                >
                  <Zap style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Pay in Full</p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    ₹{grandTotal.toLocaleString("en-IN")} now · Instant confirmation
                  </p>
                </div>
                {paymentMode === "full" && (
                  <Check style={{ width: "18px", height: "18px", color: "#3B82F6" }} strokeWidth={3} />
                )}
              </button>

              <button
                onClick={() => selections.length === 1 && setPaymentMode("split")}
                disabled={selections.length > 1}
                className="w-full p-4 flex items-center gap-4 transition-all"
                style={{
                  borderRadius: "16px",
                  backgroundColor: paymentMode === "split" ? "rgba(59,130,246,0.1)" : "#1E293B",
                  border: paymentMode === "split" ? "2px solid #3B82F6" : "1px solid rgba(255,255,255,0.06)",
                  opacity: selections.length > 1 ? 0.45 : 1,
                  cursor: selections.length > 1 ? "not-allowed" : "pointer",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)" }}
                >
                  <Users style={{ width: "18px", height: "18px", color: "#22C55E" }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Split with Friends</p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    {selections.length > 1
                      ? "Select a single slot to use split payment"
                      : "Share a link for others to pay their share"}
                  </p>
                </div>
                {paymentMode === "split" && (
                  <Check style={{ width: "18px", height: "18px", color: "#3B82F6" }} strokeWidth={3} />
                )}
              </button>
            </div>

            {/* Split count picker */}
            {paymentMode === "split" && (
              <div
                className="p-4"
                style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-[#94A3B8] mb-3" style={{ fontSize: "14px", fontWeight: "600" }}>
                  How many players are splitting?
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSplitCount((c) => Math.max(2, c - 1))}
                    disabled={splitCount <= 2}
                    className="flex items-center justify-center"
                    style={{
                      width: "40px", height: "40px", borderRadius: "50%",
                      backgroundColor: splitCount <= 2 ? "#111827" : "#1E293B",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "20px", color: splitCount <= 2 ? "#475569" : "#fff",
                    }}
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-white" style={{ fontSize: "28px", fontWeight: "700" }}>{splitCount}</p>
                    <p className="text-[#64748B]" style={{ fontSize: "12px" }}>players</p>
                  </div>
                  <button
                    onClick={() => setSplitCount((c) => Math.min(22, c + 1))}
                    disabled={splitCount >= 22}
                    className="flex items-center justify-center"
                    style={{
                      width: "40px", height: "40px", borderRadius: "50%",
                      backgroundColor: splitCount >= 22 ? "#111827" : "#1E293B",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "20px", color: splitCount >= 22 ? "#475569" : "#fff",
                    }}
                  >
                    +
                  </button>
                </div>
                <div
                  className="mt-3 p-3 text-center"
                  style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <p className="text-[#22C55E]" style={{ fontSize: "16px", fontWeight: "700" }}>
                    ₹{Math.ceil(grandTotal / splitCount).toLocaleString("en-IN")} / person
                  </p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    You pay your share now · others pay via shared link
                  </p>
                </div>
              </div>
            )}

            {/* ── Pay CTA ── */}
            <button
              onClick={paymentMode === "full" ? handlePayFull : handlePaySplit}
              disabled={batchBooking.isPending || createSplitBooking.isPending}
              className="w-full text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{
                height: "56px", borderRadius: "16px",
                background:
                  batchBooking.isPending || createSplitBooking.isPending
                    ? "#1E3A5F"
                    : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                fontSize: "18px", fontWeight: "700",
              }}
            >
              {batchBooking.isPending || createSplitBooking.isPending ? (
                <>
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  <span style={{ fontSize: "15px" }}>Processing…</span>
                </>
              ) : paymentMode === "full" ? (
                <>Pay ₹{grandTotal.toLocaleString("en-IN")}</>
              ) : (
                <>Pay my share — ₹{Math.ceil(grandTotal / splitCount).toLocaleString("en-IN")}</>
              )}
            </button>

            {payError && (
              <div>
                <p className="text-center text-[#EF4444] mb-2" style={{ fontSize: "13px" }}>
                  {payError}
                </p>
                {conflictSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {conflictSuggestions.map((s) => (
                      <button
                        key={s.startTime}
                        onClick={() => {
                          // Pre-select the suggested slot for the same facility as the first selection
                          if (selections.length > 0) {
                            const first = selections[0];
                            const suggested = { ...first, startTime: s.startTime, endTime: s.endTime, holdId: undefined, holdExpiresAt: undefined };
                            setSelections([suggested]);
                            setPayError(null);
                            setConflictSuggestions([]);
                          }
                        }}
                        className="px-3 py-1.5"
                        style={{
                          borderRadius: "999px",
                          backgroundColor: "rgba(59,130,246,0.15)",
                          border: "1.5px solid rgba(59,130,246,0.3)",
                          fontSize: "12px", fontWeight: "600", color: "#3B82F6",
                        }}
                      >
                        Try {s.startTime}–{s.endTime} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-[#64748B]" style={{ fontSize: "12px" }}>
              By paying you agree to our booking terms
            </p>
          </div>
        )}

        {/* ══════════ STEP 5 — SUCCESS ══════════ */}
        {step === "success" && (
          <div className="pt-12 text-center">
            <div
              className="mx-auto mb-6 flex items-center justify-center"
              style={{
                width: "88px", height: "88px", borderRadius: "50%",
                background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
              }}
            >
              <Check style={{ width: "44px", height: "44px", color: "#FFFFFF" }} strokeWidth={3} />
            </div>

            <h2 className="text-white mb-2" style={{ fontSize: "28px", fontWeight: "700" }}>
              You're booked! 🎉
            </h2>
            <p className="text-[#94A3B8] mb-1" style={{ fontSize: "14px" }}>
              {selectedVenue?.name}
            </p>
            <p className="text-[#64748B] mb-6" style={{ fontSize: "13px" }}>
              {format(dateObj, "EEE, MMM d")}
            </p>

            {/* Booking IDs pill list */}
            <div className="space-y-2 mb-8 text-left">
              {selections.map((sel, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <div className="flex items-center gap-2">
                    <Check style={{ width: "14px", height: "14px", color: "#22C55E" }} />
                    <span style={{ fontSize: "13px", color: "#E2E8F0" }}>
                      {sel.facilityName} · {sel.startTime}–{sel.endTime}
                    </span>
                  </div>
                  {bookingIds[i] && (
                    <span style={{ fontSize: "11px", color: "#22C55E", fontWeight: "600" }}>
                      #{bookingIds[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Split share link panel */}
            {splitShareLink && (
              <div
                className="p-4 mb-2"
                style={{ borderRadius: "14px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                <p className="text-[#22C55E] mb-2" style={{ fontSize: "14px", fontWeight: "700" }}>
                  Share with your friends to collect their share
                </p>
                <div
                  className="flex items-center gap-2 p-3"
                  style={{ borderRadius: "10px", backgroundColor: "#0F172A" }}
                >
                  <span className="flex-1 text-[#94A3B8] truncate" style={{ fontSize: "12px" }}>
                    {splitShareLink}
                  </span>
                  <button
                    onClick={async () => {
                      if (navigator.share) {
                        await navigator.share({ title: "Sportza — Pay your share", url: splitShareLink });
                      } else {
                        await navigator.clipboard.writeText(splitShareLink);
                        alert("Link copied!");
                      }
                    }}
                    className="shrink-0"
                  >
                    <Share2 style={{ width: "16px", height: "16px", color: "#22C55E" }} />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => bookingIds[0] && navigate(`/bookings/${bookingIds[0]}`)}
                className="w-full text-white flex items-center justify-center"
                style={{
                  height: "52px", borderRadius: "14px",
                  backgroundColor: "#3B82F6",
                  fontSize: "16px", fontWeight: "600",
                }}
              >
                View Booking
              </button>

              <button
                onClick={async () => {
                  const bookingUrl = `${window.location.origin}/bookings/${bookingIds[0] ?? ""}`;
                  const text = `Join me for ${selectedSport?.displayName ?? selectedSport?.name ?? "a game"} at ${selectedVenue?.name ?? "the venue"} on ${format(dateObj, "EEE, MMM d")}! ${bookingUrl}`;
                  if (navigator.share) {
                    await navigator.share({ title: "Join my game on Sportza", text, url: bookingUrl });
                  } else {
                    await navigator.clipboard.writeText(text);
                    alert("Invite link copied!");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  height: "52px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  fontSize: "16px", fontWeight: "600", color: "#FFFFFF",
                }}
              >
                <UserPlus style={{ width: "18px", height: "18px" }} />
                Invite Players
              </button>

              {/* Create Open Play CTA */}
              <button
                onClick={() =>
                  navigate("/open-plays/create", {
                    state: { bookingId: bookingIds[0], sport: selectedSport?.name },
                  })
                }
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  height: "52px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
                  fontSize: "16px", fontWeight: "600", color: "#FFFFFF",
                }}
              >
                <Users style={{ width: "18px", height: "18px" }} />
                Create Open Play
              </button>

              {/* BRD: Add to Calendar CTA */}
              <button
                onClick={() => {
                  const sel = selections[0];
                  if (!sel) return;
                  downloadICS({
                    date: dateStr,
                    start: sel.startTime,
                    end: sel.endTime,
                    venue: selectedVenue?.name ?? "Venue",
                    sport: selectedSport?.displayName ?? selectedSport?.name ?? "Sport",
                  });
                }}
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  height: "52px", borderRadius: "14px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "16px", fontWeight: "600", color: "#FFFFFF",
                }}
              >
                <Calendar style={{ width: "18px", height: "18px" }} />
                Add to Calendar
              </button>

              <button
                onClick={async () => {
                  const text = `Booked ${selections.length} slot${selections.length > 1 ? "s" : ""} at ${selectedVenue?.name ?? "the venue"} — ${dateLabel}`;
                  if (navigator.share) { await navigator.share({ title: "Sportza Booking", text }); }
                  else { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
                }}
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  height: "52px", borderRadius: "14px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "16px", fontWeight: "600", color: "#FFFFFF",
                }}
              >
                <Share2 style={{ width: "18px", height: "18px" }} />
                Share with Friends
              </button>

              <button
                onClick={() => navigate("/matches/create", { state: { sport: selectedSport?.name } })}
                className="w-full flex items-center justify-center gap-2 transition-colors"
                style={{
                  height: "52px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #EF4444, #DC2626)",
                  fontSize: "16px", fontWeight: "600", color: "#FFFFFF",
                }}
              >
                <Trophy style={{ width: "18px", height: "18px" }} />
                Score a Match
              </button>

              <button
                onClick={resetAll}
                className="w-full text-[#94A3B8] transition-colors"
                style={{ fontSize: "14px", fontWeight: "500", paddingTop: "8px" }}
              >
                Book another slot
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
