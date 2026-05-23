/**
 * Venue Detail — Decision Layer
 *
 * Key product principle: "Decision friction comes from uncertainty"
 * → Solve via: real images, clear pricing, live availability
 * Multi-slot + multi-court booking: tap to add to cart, pay in one go.
 */
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapEmbed from "../../components/MapEmbed";
import {
  ChevronLeft,
  MapPin,
  Star,
  Clock,
  CheckCircle2,
  ChevronRight,
  Zap,
  Car,
  Lightbulb,
  Shirt,
  Droplets,
  Lock,
  Wifi,
  ShoppingCart,
  X,
  Trash2,
} from "lucide-react";
import {
  useVenue,
  useVenueReviews,
  useVenueSlots,
  useBatchBooking,
  useOpenPlays,
} from "@sportza/api-client";
import { useRazorpayCheckout } from "../../hooks/useRazorpayCheckout";
import { format, addDays, startOfDay, isSameDay } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Venue = {
  id: number;
  name: string;
  location?: { city?: string | null; address?: string | null; state?: string | null; lat?: number | null; lng?: number | null } | null;
  description?: string | null;
  sports?: string[] | Record<string, unknown> | null;
  defaultPricePerHour?: number | null;
  pricePerHour?: number | null;
  images?: string[] | null;
  rating?: number | null;
  avgRating?: number | null;
  amenities?: string[] | null;
  openHours?: string | null;
  dbFacilities?: Array<{ id?: number; name: string; surfaceType?: string | null; sports?: string[] | null }>;
  sportFacilities?: Array<{ name: string; surfaceType?: string | null }>;
  sportRates?: Array<{ sport?: string; rate?: number }>;
};
type Review = {
  id: number;
  rating: number;
  review?: string | null;
  user?: { name?: string | null };
  createdAt?: string;
};
type Slot = { startTime: string; endTime: string; price: number; available: boolean };
type FacilitySlot = { facilityId: number; facilityName: string; slots: Slot[] };

// A cart item = one slot in one court
type CartItem = {
  key: string;           // `${facilityId}-${startTime}`
  slot: Slot;
  facility: FacilitySlot;
};

// ─── Amenity icon map ─────────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, React.ReactNode> = {
  parking:   <Car style={{ width: "16px", height: "16px" }} />,
  lights:    <Lightbulb style={{ width: "16px", height: "16px" }} />,
  washroom:  <Droplets style={{ width: "16px", height: "16px" }} />,
  locker:    <Lock style={{ width: "16px", height: "16px" }} />,
  wifi:      <Wifi style={{ width: "16px", height: "16px" }} />,
  equipment: <Shirt style={{ width: "16px", height: "16px" }} />,
};
function amenityIcon(label: string) {
  return AMENITY_ICONS[label.toLowerCase().trim()] ?? <CheckCircle2 style={{ width: "16px", height: "16px" }} />;
}

const DEFAULT_AMENITIES = ["Lights", "Parking", "Washroom", "Equipment"];

function buildDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

// ─── Slot button — supports multi-select ─────────────────────────────────────
function SlotButton({
  slot,
  selected,
  onClick,
}: {
  slot: Slot;
  selected: boolean;
  onClick: () => void;
}) {
  const [h, m] = slot.startTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const label = `${displayH}:${String(m).padStart(2, "0")} ${period}`;

  if (!slot.available) {
    return (
      <div
        className="flex flex-col items-center justify-center py-3"
        style={{ borderRadius: "12px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.04)", opacity: 0.4 }}
      >
        <span className="text-[#64748B]" style={{ fontSize: "13px", fontWeight: "600" }}>{label}</span>
        <span className="text-[#64748B]" style={{ fontSize: "11px" }}>Booked</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center py-3 transition-all active:scale-95"
      style={{
        borderRadius: "12px",
        backgroundColor: selected ? "#3B82F6" : "rgba(34,197,94,0.1)",
        border: selected ? "2px solid #3B82F6" : "1px solid rgba(34,197,94,0.3)",
      }}
    >
      {selected && (
        <div
          className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center"
          style={{ borderRadius: "50%", backgroundColor: "#22C55E" }}
        >
          <CheckCircle2 style={{ width: "10px", height: "10px", color: "#fff" }} />
        </div>
      )}
      <span className={selected ? "text-white" : "text-[#22C55E]"} style={{ fontSize: "13px", fontWeight: "700" }}>
        {label}
      </span>
      <span className={selected ? "text-white/80" : "text-[#22C55E]/70"} style={{ fontSize: "11px", fontWeight: "500" }}>
        ₹{slot.price}
      </span>
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function VenueDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div style={{ height: "280px", backgroundColor: "#111827" }} />
      <div className="px-4 pt-5 space-y-4">
        <div className="h-7 w-3/4 rounded-lg bg-[#1E293B]" />
        <div className="h-4 w-1/2 rounded-lg bg-[#1E293B]" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-20 rounded-full bg-[#1E293B]" />)}
        </div>
        <div className="h-40 rounded-2xl bg-[#1E293B]" />
        <div className="h-48 rounded-2xl bg-[#1E293B]" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venueId = id ? parseInt(id, 10) : 0;

  // UI state
  const [imgIdx, setImgIdx]               = useState(0);
  const [selectedDate, setSelectedDate]   = useState<Date>(startOfDay(new Date()));
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [showCart, setShowCart]           = useState(false);
  const [bookingDone, setBookingDone]     = useState(false);
  const [bookedItems, setBookedItems]     = useState<CartItem[]>([]);
  const [createdBookingIds, setCreatedBookingIds] = useState<number[]>([]);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  // Data
  const { data: venueRes, isLoading: venueLoading, isError: venueError } = useVenue(venueId);
  const { data: reviewsRes, isLoading: reviewsLoading } = useVenueReviews(venueId);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: slotsRes, isLoading: slotsLoading } = useVenueSlots(venueId, {
    date: dateStr,
    sport: selectedSport || undefined,
  });
  const batchBookMutation = useBatchBooking();
  const razorpayCheckout = useRazorpayCheckout();
  const [payError, setPayError] = useState<string | null>(null);
  const { data: openPlaysRes } = useOpenPlays({ venueId, status: "open" } as any);

  const venue      = (venueRes as any)?.data as Venue | undefined;
  const reviews    = ((reviewsRes as any)?.data ?? []) as Review[];
  const avgRating  = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : (venue?.rating ?? venue?.avgRating ?? 0);
  const facilities = ((slotsRes as any)?.facilities ?? (slotsRes as any)?.data?.facilities ?? []) as FacilitySlot[];

  const sports = venue?.sports
    ? Array.isArray(venue.sports)
      ? (venue.sports as string[])
      : Object.keys(venue.sports as Record<string, unknown>)
    : [];
  const amenities = venue?.amenities && venue.amenities.length > 0 ? venue.amenities : DEFAULT_AMENITIES;
  const images = venue?.images && venue.images.length > 0
    ? venue.images
    : ["https://images.unsplash.com/photo-1483721310020-03333e577078?w=800&q=80"];
  const price = venue?.defaultPricePerHour ?? venue?.pricePerHour;
  const days = buildDays();

  // Cart helpers
  const cartKeys = new Set(cart.map((c) => c.key));
  const grandTotal = cart.reduce((sum, c) => sum + c.slot.price, 0);

  function toggleSlot(slot: Slot, facility: FacilitySlot) {
    const key = `${facility.facilityId}-${slot.startTime}`;
    setCart((prev) =>
      prev.some((c) => c.key === key)
        ? prev.filter((c) => c.key !== key)
        : [...prev, { key, slot, facility }]
    );
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleConfirmBook() {
    if (!venue || cart.length === 0) return;
    const sport = selectedSport || (sports[0] ?? "");
    setPayError(null);
    try {
      const result = await batchBookMutation.mutateAsync({
        venueId: venue.id,
        sport,
        date: dateStr,
        items: cart.map((item) => ({
          facilityId: item.facility.facilityId,
          startTime: item.slot.startTime,
          endTime: item.slot.endTime,
        })),
      });

      // Capture created booking IDs and groupId for payment
      const batchData = (result as any)?.data ?? result;
      const ids: number[] = [];
      const groupId: string | undefined = (batchData as any)?.groupId;
      const bookings: any[] = Array.isArray((batchData as any)?.bookings)
        ? (batchData as any).bookings
        : Array.isArray(batchData)
        ? batchData
        : [];
      bookings.forEach((b: any) => { if (b?.id) ids.push(b.id); });
      if (!groupId && (batchData as any)?.id) ids.push((batchData as any).id);

      if (grandTotal > 0) {
        await razorpayCheckout({
          amount: grandTotal,
          description: `${cart.length} slot${cart.length > 1 ? "s" : ""} at ${venue.name}`,
          groupId,
          bookingId: groupId ? undefined : ids[0],
          onSuccess: (paidIds) => {
            setCreatedBookingIds(paidIds.length > 0 ? paidIds : ids);
            setBookedItems([...cart]);
            setCart([]);
            setShowCart(false);
            setBookingDone(true);
          },
          onFailure: (reason) => {
            if (reason !== "Payment cancelled") setPayError(reason);
          },
        });
      } else {
        setCreatedBookingIds(ids);
        setBookedItems([...cart]);
        setCart([]);
        setShowCart(false);
        setBookingDone(true);
      }
    } catch {
      // booking creation errors are shown via batchBookMutation.isError
    }
  }

  // ── Loading ──
  if (venueLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A]">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 bg-[#0F172A]" style={{ height: "56px" }}>
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
        </div>
        <VenueDetailSkeleton />
      </div>
    );
  }

  // ── Error / not found ──
  if (venueError || !venue) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
        <div className="text-center">
          <span className="text-5xl block mb-4">🏟️</span>
          <h2 className="text-white mb-2" style={{ fontSize: "20px", fontWeight: "700" }}>Venue not found</h2>
          <button onClick={() => navigate("/venues")} className="px-6 py-3 text-white mt-4"
            style={{ borderRadius: "14px", backgroundColor: "#3B82F6", fontSize: "15px", fontWeight: "600" }}>
            Browse Venues
          </button>
        </div>
      </div>
    );
  }

  // ── Booking success ──
  if (bookingDone) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}
        >
          <CheckCircle2 style={{ width: "40px", height: "40px", color: "#22C55E" }} />
        </div>
        <h2 className="text-white mb-2" style={{ fontSize: "26px", fontWeight: "800" }}>You're Booked! 🎉</h2>
        <p className="text-[#94A3B8] mb-4" style={{ fontSize: "15px" }}>{venue.name}</p>

        {/* Booked slots list */}
        <div className="w-full max-w-xs mb-8 space-y-2">
          {bookedItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderRadius: "12px", backgroundColor: "#1E293B" }}
            >
              <div className="text-left">
                <p className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>
                  {item.facility.facilityName}
                </p>
                <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                  {format(selectedDate, "EEE, MMM d")} · {item.slot.startTime} – {item.slot.endTime}
                </p>
              </div>
              <span className="text-[#3B82F6]" style={{ fontSize: "14px", fontWeight: "700" }}>
                ₹{item.slot.price}
              </span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2">
            <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Total paid</span>
            <span className="text-[#22C55E]" style={{ fontSize: "15px", fontWeight: "800" }}>
              ₹{bookedItems.reduce((s, i) => s + i.slot.price, 0)}
            </span>
          </div>
        </div>

        {createdBookingIds.length === 1 ? (
          <button onClick={() => navigate(`/bookings/${createdBookingIds[0]}`)} className="w-full max-w-xs py-4 text-white mb-3"
            style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "16px", fontWeight: "700" }}>
            View Booking
          </button>
        ) : (
          <button onClick={() => navigate("/bookings")} className="w-full max-w-xs py-4 text-white mb-3"
            style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "16px", fontWeight: "700" }}>
            View My Bookings
          </button>
        )}
        <button onClick={() => { setBookingDone(false); setBookedItems([]); setCreatedBookingIds([]); }} className="w-full max-w-xs py-4"
          style={{ borderRadius: "16px", backgroundColor: "#1E293B", fontSize: "15px", fontWeight: "600", color: "#94A3B8" }}>
          Book More Slots
        </button>
      </div>
    );
  }

  // ── Cart sheet ──
  if (showCart) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
          <button onClick={() => setShowCart(false)} className="p-2 -ml-2">
            <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
          </button>
          <span className="text-white flex-1" style={{ fontSize: "17px", fontWeight: "600" }}>
            Your Cart ({cart.length} slot{cart.length !== 1 ? "s" : ""})
          </span>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="p-2">
              <Trash2 style={{ width: "18px", height: "18px", color: "#64748B" }} />
            </button>
          )}
        </div>

        <div className="flex-1 px-4 overflow-y-auto pb-40">
          {/* Venue + date */}
          <div className="mb-4 p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{venue.name}</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
              {format(selectedDate, "EEEE, MMMM d, yyyy")} · {selectedSport || sports[0] || "All courts"}
            </p>
          </div>

          {/* Cart items */}
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-4"
                style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <div>
                  <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                    {item.slot.startTime} – {item.slot.endTime}
                  </p>
                  <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                    {item.facility.facilityName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#3B82F6]" style={{ fontSize: "16px", fontWeight: "800" }}>
                    ₹{item.slot.price}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.key)}
                    className="p-1.5"
                    style={{ borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.1)" }}
                  >
                    <X style={{ width: "14px", height: "14px", color: "#EF4444" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total breakdown */}
          {(() => {
            const gstAmt  = +(grandTotal * 0.18).toFixed(0);
            const totalWithGst = grandTotal + gstAmt;
            return (
              <div className="mt-4" style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div className="flex justify-between px-4 pt-4 pb-2">
                  <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>Subtotal ({cart.length} slot{cart.length !== 1 ? "s" : ""})</span>
                  <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>₹{grandTotal}</span>
                </div>
                <div className="flex justify-between px-4 pb-2">
                  <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>GST (18%)</span>
                  <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>₹{gstAmt}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(59,130,246,0.2)" }}>
                  <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Grand Total</p>
                  <span className="text-[#3B82F6]" style={{ fontSize: "24px", fontWeight: "800" }}>₹{totalWithGst}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Confirm button */}
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top, #0F172A 70%, transparent)" }}>
          <div className="max-w-md mx-auto">
            <button
              onClick={handleConfirmBook}
              disabled={batchBookMutation.isPending || cart.length === 0}
              className="w-full py-4 text-white"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(135deg,#3B82F6,#6366F1)",
                fontSize: "17px",
                fontWeight: "700",
                opacity: batchBookMutation.isPending || cart.length === 0 ? 0.7 : 1,
              }}
            >
              {batchBookMutation.isPending
                ? "Creating booking..."
                : grandTotal > 0
                ? `Confirm & Pay ₹${grandTotal + +(grandTotal * 0.18).toFixed(0)}`
                : "Confirm Booking"}
            </button>
            {batchBookMutation.isError && (
              <p className="text-center text-red-400 mt-2" style={{ fontSize: "13px" }}>
                Booking failed. Please try again.
              </p>
            )}
            {payError && (
              <p className="text-center text-red-400 mt-2" style={{ fontSize: "13px" }}>
                {payError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main venue detail view ──
  return (
    <div className="min-h-screen bg-[#0F172A] pb-36">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ height: "56px", background: "linear-gradient(to bottom, #0F172A 70%, transparent)" }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 transition-colors" style={{ borderRadius: "10px" }}>
          <ChevronLeft style={{ width: "22px", height: "22px", color: "#FFFFFF" }} />
        </button>
        <span className="text-white flex-1 truncate" style={{ fontSize: "17px", fontWeight: "600" }}>
          {venue.name}
        </span>
        {/* Cart icon in header */}
        {cart.length > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="relative p-2"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B" }}
          >
            <ShoppingCart style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
            <div
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center"
              style={{ borderRadius: "50%", backgroundColor: "#3B82F6" }}
            >
              <span className="text-white" style={{ fontSize: "10px", fontWeight: "800" }}>
                {cart.length}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── Image Carousel ── */}
      <div className="relative" style={{ height: "280px", marginTop: "-56px" }}>
        <img
          src={images[imgIdx]}
          alt={venue.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1483721310020-03333e577078?w=800&q=80";
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0F172A 0%, transparent 50%)" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              style={{ borderRadius: "50%" }}>
              <ChevronLeft style={{ width: "18px", height: "18px", color: "white" }} />
            </button>
            <button onClick={() => setImgIdx((i) => (i + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              style={{ borderRadius: "50%" }}>
              <ChevronRight style={{ width: "18px", height: "18px", color: "white" }} />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  style={{
                    width: i === imgIdx ? "20px" : "6px",
                    height: "6px",
                    borderRadius: "999px",
                    backgroundColor: i === imgIdx ? "#3B82F6" : "rgba(255,255,255,0.4)",
                    transition: "width 0.2s",
                  }} />
              ))}
            </div>
          </>
        )}
        {avgRating > 0 && (
          <div className="absolute top-16 right-4 flex items-center gap-1.5 px-3 py-1.5"
            style={{ borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
            <Star style={{ width: "13px", height: "13px", color: "#F59E0B", fill: "#F59E0B" }} />
            <span className="text-white" style={{ fontSize: "13px", fontWeight: "700" }}>
              {typeof avgRating === "number" ? avgRating.toFixed(1) : avgRating}
            </span>
            {reviews.length > 0 && (
              <span className="text-white/60" style={{ fontSize: "12px" }}>({reviews.length})</span>
            )}
          </div>
        )}
      </div>

      {/* ── Venue Info ── */}
      <div className="px-4 pt-2">
        <h1 className="text-white mb-1.5" style={{ fontSize: "26px", fontWeight: "800", lineHeight: "130%" }}>
          {venue.name}
        </h1>
        {(venue.location?.city || venue.location?.address) && (
          <div className="flex items-center gap-2 mb-3 text-[#94A3B8]" style={{ fontSize: "14px" }}>
            <MapPin style={{ width: "14px", height: "14px", flexShrink: 0 }} />
            <span>{[venue.location?.city, venue.location?.address].filter(Boolean).join(", ")}</span>
          </div>
        )}
        <MapEmbed
          lat={venue.location?.lat}
          lng={venue.location?.lng}
          label={venue.name}
          height="200px"
          className="mb-4"
        />

        <div className="flex gap-3 mb-6 overflow-x-auto scrollbar-hide pb-1">
          {price && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
              <span className="text-[#3B82F6]" style={{ fontSize: "20px", fontWeight: "800" }}>₹{price}</span>
              <span className="text-[#64748B]" style={{ fontSize: "13px" }}>/hr</span>
            </div>
          )}
          {venue.openHours && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
              <Clock style={{ width: "15px", height: "15px", color: "#94A3B8" }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "500" }}>{venue.openHours}</span>
            </div>
          )}
        </div>

        {/* Sport pills */}
        {sports.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => { setSelectedSport(""); setCart([]); }}
              className="shrink-0 px-4 py-2"
              style={{ borderRadius: "999px", fontSize: "13px", fontWeight: "600",
                backgroundColor: !selectedSport ? "#3B82F6" : "#1E293B",
                color: !selectedSport ? "#FFFFFF" : "#94A3B8" }}>
              All
            </button>
            {sports.map((s) => (
              <button key={s} onClick={() => { setSelectedSport(s === selectedSport ? "" : s); setCart([]); }}
                className="shrink-0 px-4 py-2 whitespace-nowrap"
                style={{ borderRadius: "999px", fontSize: "13px", fontWeight: "600",
                  backgroundColor: selectedSport === s ? "#3B82F6" : "#1E293B",
                  color: selectedSport === s ? "#FFFFFF" : "#94A3B8" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Availability Section ── */}
        <div className="mb-6 overflow-hidden" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
                <span className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Check Availability</span>
              </div>
              {cart.length > 0 && (
                <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>
                  {cart.length} selected
                </span>
              )}
            </div>

            {/* Date selector */}
            <div ref={dateScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {days.map((day) => {
                const isToday    = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setSelectedDate(day); setCart([]); }}
                    className="shrink-0 flex flex-col items-center py-3 transition-all"
                    style={{
                      width: "54px",
                      borderRadius: "14px",
                      backgroundColor: isSelected ? "#3B82F6" : "#111827",
                      border: isSelected ? "none" : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: "600", color: isSelected ? "rgba(255,255,255,0.8)" : "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {isToday ? "Today" : format(day, "EEE")}
                    </span>
                    <span style={{ fontSize: "20px", fontWeight: "800", color: isSelected ? "#FFFFFF" : "#94A3B8", lineHeight: "1.3" }}>
                      {format(day, "d")}
                    </span>
                    <span style={{ fontSize: "10px", color: isSelected ? "rgba(255,255,255,0.7)" : "#64748B" }}>
                      {format(day, "MMM")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots grid */}
          <div className="px-4 pb-4">
            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: "#111827" }} />
                ))}
              </div>
            ) : facilities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
                  No slots available for {format(selectedDate, "MMM d")}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {facilities.map((facility) => (
                  <div key={facility.facilityId}>
                    <p className="text-[#64748B] mb-2"
                      style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {facility.facilityName}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {facility.slots.map((slot) => {
                        const key = `${facility.facilityId}-${slot.startTime}`;
                        return (
                          <SlotButton
                            key={key}
                            slot={slot}
                            selected={cartKeys.has(key)}
                            onClick={() => toggleSlot(slot, facility)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Amenities ── */}
        <div className="mb-6 p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <h2 className="text-white mb-4" style={{ fontSize: "17px", fontWeight: "700" }}>Amenities</h2>
          <div className="grid grid-cols-2 gap-3">
            {amenities.map((a) => (
              <div key={a} className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center text-[#3B82F6]"
                  style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.12)" }}>
                  {amenityIcon(a)}
                </div>
                <span className="text-[#E2E8F0]" style={{ fontSize: "14px", fontWeight: "500" }}>{a}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── About ── */}
        {venue.description && (
          <div className="mb-6 p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-3" style={{ fontSize: "17px", fontWeight: "700" }}>About</h2>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.65" }}>{venue.description}</p>
          </div>
        )}

        {/* ── Pricing ── */}
        {venue.sportRates && venue.sportRates.length > 0 && (
          <div className="mb-6 p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <h2 className="text-white mb-4" style={{ fontSize: "17px", fontWeight: "700" }}>Pricing</h2>
            <div className="space-y-3">
              {venue.sportRates.map((r, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{r.sport ?? "General"}</span>
                  <span className="text-[#3B82F6]" style={{ fontSize: "16px", fontWeight: "700" }}>₹{r.rate ?? price}/hr</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Open Play Sessions ── */}
        {(() => {
          const openPlays: any[] = Array.isArray((openPlaysRes as any)?.data) ? (openPlaysRes as any).data : [];
          if (openPlays.length === 0) return null;
          return (
            <div className="mb-6 p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "18px" }}>🏃</span>
                  <span className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Open Play Sessions</span>
                </div>
                <button onClick={() => navigate("/open-plays")} className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {openPlays.slice(0, 3).map((op: any) => {
                  const pCount = op._count?.players ?? 0;
                  const maxP = op.maxPlayers ?? 10;
                  const dateLabel = op.bookingDate ? format(new Date(op.bookingDate), "MMM d") : "—";
                  return (
                    <button key={op.id} onClick={() => navigate(`/open-plays/${op.id}`)}
                      className="w-full flex items-center gap-3 p-3 text-left transition-all active:scale-[0.98]"
                      style={{ borderRadius: "14px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center justify-center shrink-0"
                        style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "20px" }}>
                        {op.sport === "football" ? "⚽" : op.sport === "cricket" ? "🏏" : op.sport === "badminton" ? "🏸" : op.sport === "tennis" ? "🎾" : op.sport === "padel" ? "🎾" : op.sport === "basketball" ? "🏀" : op.sport === "pickleball" ? "🏓" : "🎯"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "600" }}>
                          {op.title ?? `${op.sport} Open Play`}
                        </p>
                        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                          {dateLabel} · {op.startTime ?? "—"} · {pCount}/{maxP} players
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[#3B82F6]" style={{ fontSize: "14px", fontWeight: "700" }}>
                          {op.pricePerPlayer > 0 ? `₹${op.pricePerPlayer}` : "Free"}
                        </p>
                        {op.skillLevel && (
                          <p className="text-[#94A3B8]" style={{ fontSize: "10px", textTransform: "capitalize" }}>{op.skillLevel}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Reviews ── */}
        <div className="mb-6 p-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>Reviews</h2>
            {avgRating > 0 && (
              <div className="flex items-center gap-1.5">
                <Star style={{ width: "16px", height: "16px", color: "#F59E0B", fill: "#F59E0B" }} />
                <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>{typeof avgRating === "number" ? avgRating.toFixed(1) : avgRating}</span>
                <span className="text-[#64748B]" style={{ fontSize: "13px" }}>/ 5</span>
              </div>
            )}
          </div>
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 w-1/3 rounded bg-[#111827]" />
                  <div className="h-3 w-full rounded bg-[#111827]" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-[#64748B] text-center py-4" style={{ fontSize: "14px" }}>No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: "#3B82F6", fontSize: "13px", fontWeight: "700" }}>
                        {(r.user?.name ?? "A").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{r.user?.name ?? "Anonymous"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} style={{ width: "12px", height: "12px", color: i < r.rating ? "#F59E0B" : "#1E293B", fill: i < r.rating ? "#F59E0B" : "#1E293B" }} />
                      ))}
                    </div>
                  </div>
                  {r.review && <p className="text-[#94A3B8]" style={{ fontSize: "13px", lineHeight: "1.6" }}>{r.review}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky CTA bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top, #0F172A 70%, transparent)" }}>
        <div className="max-w-md mx-auto">
          {cart.length > 0 ? (
            /* Cart bar */
            <button
              onClick={() => setShowCart(true)}
              className="w-full flex items-center justify-between px-5 py-4 text-white"
              style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7" style={{ borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <ShoppingCart style={{ width: "15px", height: "15px" }} />
                </div>
                <div className="text-left">
                  <p style={{ fontSize: "13px", fontWeight: "600", opacity: 0.85 }}>
                    {cart.length} slot{cart.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p style={{ fontSize: "20px", fontWeight: "800" }}>₹{grandTotal}</p>
                <p style={{ fontSize: "11px", opacity: 0.8 }}>Tap to review →</p>
              </div>
            </button>
          ) : (
            /* Default CTA */
            <button
              onClick={() => dateScrollRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="w-full py-4 text-white"
              style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "17px", fontWeight: "700" }}
            >
              Select Slots to Book
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
