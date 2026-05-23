import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBookings, useVenues, useTrainerDashboard, useBatches, useCurrentUser, useTrainingDiscovery, useTournaments, useNearbyVenues, usePeerSuggestions } from "@sportza/api-client";
import { MapPin, Clock, Users, Star, ArrowRight, Zap, Dumbbell, ChevronRight, Layers, Wallet, Building2, Trophy, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRole } from "../context/RoleContext";
import { useUserLocation } from "../context/LocationContext";
import LocationSheet from "../components/LocationSheet";

// ── Time-based greeting ────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Sport emoji map ─────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  badminton: "🏸", football: "⚽", cricket: "🏏", tennis: "🎾", padel: "🎾",
  basketball: "🏀", volleyball: "🏐", hockey: "🏑", swimming: "🏊",
  pickleball: "🏓",
};
function sportEmoji(s?: string) {
  return SPORT_EMOJI[(s ?? "").toLowerCase()] ?? "🏟";
}

// ── Sport color map ────────────────────────────────────────────────────────────
const SPORT_COLOR: Record<string, string> = {
  badminton: "#3B82F6", football: "#22C55E", cricket: "#8B5CF6",
  tennis: "#F59E0B", padel: "#F59E0B", basketball: "#F97316", volleyball: "#06B6D4",
  pickleball: "#14B8A6",
};
function sportColor(s?: string) {
  return SPORT_COLOR[(s ?? "").toLowerCase()] ?? "#3B82F6";
}

// ── Tournament status styles ───────────────────────────────────────────────────
const TOURNAMENT_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  registration: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  in_progress:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  draft:        { color: "#64748B", bg: "rgba(100,116,139,0.12)" },
};

// ── Shared location pill ───────────────────────────────────────────────────────
function LocationPill({ onOpen }: { onOpen: () => void }) {
  const userLoc = useUserLocation();
  const label = userLoc.city ?? userLoc.state ?? "Set location";
  const muted = !userLoc.city && !userLoc.state;

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1 mt-1.5 active:opacity-70 transition-opacity"
      style={{ maxWidth: "200px" }}
    >
      <MapPin style={{ width: "12px", height: "12px", color: "#3B82F6", flexShrink: 0 }} />
      <span
        className="truncate"
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: muted ? "#475569" : "#E2E8F0",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {userLoc.isResolving
        ? <Loader2 style={{ width: "11px", height: "11px", color: "#475569" }} className="animate-spin flex-shrink-0" />
        : <ChevronDown style={{ width: "11px", height: "11px", color: "#475569", flexShrink: 0 }} />
      }
      {(userLoc.source === "gps" || userLoc.source === "manual") && !userLoc.isResolving && (
        <span
          style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#22C55E", flexShrink: 0, marginLeft: "1px" }}
        />
      )}
    </button>
  );
}

// ── Quick actions ──────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Instant\nBook",    emoji: "⚡", to: "/book"                  },
  { label: "Score\na Match",   emoji: "🎯", to: "/score-match"           },
  { label: "Tournament",       emoji: "🏆", to: "/tournaments"           },
  { label: "My\nBatches",      emoji: "📚", to: "/my-batches"            },
];

// ── Fallback venue images ──────────────────────────────────────────────────────
const FALLBACK_IMG = "https://images.unsplash.com/photo-1483721310020-03333e577078?w=480&q=80";
const FALLBACK_VENUES = [
  { id: "f1", name: "Elite Sports Arena", location: { city: "Koregaon Park" }, sport: "Badminton", rating: 4.8, defaultPricePerHour: 800, image: "https://images.unsplash.com/photo-1723633236252-eb7badabb34c?w=480&q=80" },
  { id: "f2", name: "Phoenix Tennis Club", location: { city: "Baner" }, sport: "Tennis", rating: 4.9, defaultPricePerHour: 1200, image: "https://images.unsplash.com/photo-1761775446030-5e1fdd4166a5?w=480&q=80" },
  { id: "f3", name: "Champions Football", location: { city: "Viman Nagar" }, sport: "Football", rating: 4.7, defaultPricePerHour: 1500, image: "https://images.unsplash.com/photo-1603508434829-7c4282d74483?w=480&q=80" },
];

// ── Coach Home ──────────────────────────────────────────────────────────────────
function CoachHome({ userName, initials }: { userName: string | null; initials: string }) {
  const navigate = useNavigate();
  const [showLocSheet, setShowLocSheet] = useState(false);
  const { data: userRes } = useCurrentUser();
  const trainerId = (userRes as any)?.user?.id;
  const { data: dashRes } = useTrainerDashboard();
  const { data: batchesRes } = useBatches({ trainerId, page: 1, limit: 3 });

  const dashboard: any = (dashRes as any)?.data;
  const batches: any[] = (batchesRes as any)?.data ?? [];

  const stats = [
    { label: "Batches",  value: dashboard?.batchCount   ?? 0, color: "#22C55E", bg: "rgba(34,197,94,0.12)",  icon: Layers  },
    { label: "Students", value: dashboard?.studentCount  ?? 0, color: "#3B82F6", bg: "rgba(59,130,246,0.12)", icon: Users   },
    { label: "Revenue",  value: `₹${(dashboard?.totalEarnings ?? 0).toLocaleString()}`, color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: Wallet },
  ];

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{getGreeting()} 👋</p>
          <h1 className="text-white mt-1" style={{ fontSize: "24px", fontWeight: "800" }}>
            {userName ?? "Coach"}
          </h1>
          <LocationPill onOpen={() => setShowLocSheet(true)} />
          <div className="mt-2 inline-flex items-center px-2 py-0.5"
            style={{ borderRadius: "6px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", color: "#22C55E", letterSpacing: "0.07em" }}>COACH MODE</span>
          </div>
        </div>
        <div className="rounded-full flex items-center justify-center text-black flex-shrink-0"
          style={{ width: "42px", height: "42px", fontSize: "16px", fontWeight: "700", background: "linear-gradient(135deg,#D97706,#F59E0B)", marginTop: "2px" }}>
          {initials}
        </div>
      </div>
      <LocationSheet open={showLocSheet} onClose={() => setShowLocSheet(false)} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="p-3 text-center" style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-white mb-0.5" style={{ fontSize: "20px", fontWeight: "800", color: s.color }}>{s.value}</div>
            <div className="text-[#64748B]" style={{ fontSize: "10px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Create Batch", sub: "New program",    to: "/trainer/batches/create", color: "#22C55E", emoji: "🏋️" },
          { label: "My Sessions",  sub: "Mark attendance", to: "/trainer/sessions",       color: "#3B82F6", emoji: "📋" },
          { label: "Earnings",     sub: "Revenue",         to: "/trainer/payments",       color: "#F59E0B", emoji: "💰" },
          { label: "Reviews",      sub: "Feedback",        to: "/trainer/reviews",        color: "#8B5CF6", emoji: "⭐" },
        ].map((a) => (
          <button key={a.label} onClick={() => navigate(a.to)} className="p-4 text-left"
            style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-center mb-2"
              style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${a.color}18`, fontSize: "18px" }}>
              {a.emoji}
            </div>
            <p className="text-white" style={{ fontSize: "13px", fontWeight: "700" }}>{a.label}</p>
            <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{a.sub}</p>
          </button>
        ))}
      </div>

      {/* Recent batches */}
      {batches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Active Batches</h2>
            <button onClick={() => navigate("/trainer/batches")} className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</button>
          </div>
          <div className="space-y-2">
            {batches.slice(0, 3).map((b: any) => (
              <button key={b.id} onClick={() => navigate(`/trainer/batches/${b.id}`)}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.1)", fontSize: "20px" }}>
                  🏋️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "600" }}>{b.name ?? "Batch"}</p>
                  <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                    {b._count?.memberships ?? 0}/{b.capacity ?? "—"} enrolled
                  </p>
                </div>
                <ChevronRight style={{ width: "16px", height: "16px", color: "#475569" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {batches.length === 0 && !dashboard?.batchCount && (
        <button onClick={() => navigate("/trainer/batches/create")} className="w-full p-6 text-center"
          style={{ borderRadius: "20px", background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(22,163,74,0.08))", border: "1px dashed rgba(34,197,94,0.4)" }}>
          <Dumbbell style={{ width: "32px", height: "32px", color: "#22C55E", margin: "0 auto 8px" }} />
          <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Create Your First Batch</p>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Start coaching students today</p>
        </button>
      )}
    </div>
  );
}

// ── Venue Owner Home ────────────────────────────────────────────────────────────
function VenueOwnerHome({ userName, initials }: { userName: string | null; initials: string }) {
  const navigate = useNavigate();
  const [showLocSheet, setShowLocSheet] = useState(false);

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{getGreeting()} 👋</p>
          <h1 className="text-white mt-1" style={{ fontSize: "24px", fontWeight: "800" }}>
            {userName ?? "Owner"}
          </h1>
          <LocationPill onOpen={() => setShowLocSheet(true)} />
          <div className="mt-2 inline-flex items-center px-2 py-0.5"
            style={{ borderRadius: "6px", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", color: "#06B6D4", letterSpacing: "0.07em" }}>VENUE OWNER MODE</span>
          </div>
        </div>
        <div className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: "42px", height: "42px", fontSize: "18px", background: "linear-gradient(135deg,#164E63,#06B6D4)", marginTop: "2px" }}>
          🏟️
        </div>
      </div>
      <LocationSheet open={showLocSheet} onClose={() => setShowLocSheet(false)} />

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Dashboard",  sub: "Revenue & stats",   to: "/venue-owner",            color: "#06B6D4", emoji: "📊" },
          { label: "Bookings",   sub: "Manage incoming",   to: "/venue-owner/bookings",   color: "#22C55E", emoji: "📅" },
          { label: "Facilities", sub: "Courts & pricing",  to: "/venue-owner/facilities", color: "#F59E0B", emoji: "🏟" },
          { label: "Payments",   sub: "Revenue overview",  to: "/venue-owner/payments",   color: "#8B5CF6", emoji: "💰" },
        ].map((a) => (
          <button key={a.label} onClick={() => navigate(a.to)} className="p-4 text-left"
            style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-center mb-2"
              style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${a.color}18`, fontSize: "18px" }}>
              {a.emoji}
            </div>
            <p className="text-white" style={{ fontSize: "13px", fontWeight: "700" }}>{a.label}</p>
            <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{a.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Player Home ─────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { activeRole } = useRole();
  const userLoc = useUserLocation();
  const [showLocSheet, setShowLocSheet] = useState(false);

  const otpUser = (() => {
    try { return JSON.parse(localStorage.getItem("sportza_user") || "null"); } catch { return null; }
  })();

  const currentUser = otpUser;
  const userName    = currentUser?.name ?? currentUser?.email?.split("@")[0] ?? null;
  const initials    = getInitials(userName);

  // Use GPS/profile lat+lng for nearby venue results when available
  const hasCoords = userLoc.lat != null && userLoc.lng != null;

  const { data: bookingsRes }    = useBookings({ page: 1, limit: 3, status: "confirmed" } as any);
  const { data: venuesRes }      = useVenues({ page: 1, limit: 5 } as any);
  const { data: nearbyVenuesRes }= useNearbyVenues(
    hasCoords
      ? { lat: userLoc.lat!, lng: userLoc.lng!, radius: 15, city: userLoc.city ?? undefined, state: userLoc.state ?? undefined }
      : (userLoc.city || userLoc.state)
        ? { city: userLoc.city ?? undefined, state: userLoc.state ?? undefined }
        : undefined
  );
  const { data: trainingRes }    = useTrainingDiscovery(
    userLoc.city ? { city: userLoc.city } : undefined
  );
  const { data: tournamentsRes } = useTournaments({ page: 1 });
  const { data: peersNearRes }   = usePeerSuggestions(
    (userLoc.city || userLoc.state) ? { city: userLoc.city ?? undefined, state: userLoc.state ?? undefined, limit: 6 } : undefined
  );

  const bookings: Array<Record<string, any>> = Array.isArray(bookingsRes?.data) ? bookingsRes.data
    : Array.isArray(bookingsRes) ? (bookingsRes as any[]) : [];

  const venues: Array<Record<string, any>> = Array.isArray(venuesRes?.data) ? venuesRes.data
    : Array.isArray(venuesRes) ? (venuesRes as any[]) : [];

  const nearbyVenuesRaw: Array<Record<string, any>> = Array.isArray((nearbyVenuesRes as any)?.data) ? (nearbyVenuesRes as any).data
    : Array.isArray(nearbyVenuesRes) ? (nearbyVenuesRes as any[]) : [];

  const trainingBatches: Array<Record<string, any>> = Array.isArray((trainingRes as any)?.data) ? (trainingRes as any).data
    : Array.isArray(trainingRes) ? (trainingRes as any[]) : [];

  const peersNear: Array<Record<string, any>> = Array.isArray((peersNearRes as any)?.data)
    ? (peersNearRes as any).data : [];

  const nextBooking = bookings[0] ?? null;

  // Tournaments created by the current user that haven't ended
  const allTournaments: any[] = Array.isArray((tournamentsRes as any)?.data)
    ? (tournamentsRes as any).data
    : Array.isArray(tournamentsRes) ? (tournamentsRes as any[]) : [];
  const myActiveTournaments = allTournaments.filter(
    (t: any) =>
      t.createdById === currentUser?.id &&
      !["completed", "cancelled"].includes(t.status)
  );

  // Prefer GPS/location-based nearby venues; fall back to generic list
  const mapVenues = (arr: Array<Record<string, any>>) =>
    arr.map((v) => ({
      id: v.id, name: v.name ?? "Venue",
      location: { city: (v as any).location?.city ?? (v as any).locationCity ?? (v as any).city ?? "" },
      sport: v.primarySport ?? v.sport ?? "Sports",
      rating: v.rating ?? v.avgRating ?? 4.5,
      defaultPricePerHour: v.defaultPricePerHour ?? v.pricePerHour ?? 800,
      image: (v.images as string[] | undefined)?.[0] ?? v.image ?? v.imageUrl ?? FALLBACK_IMG,
      distance_km: v.distance_km ?? v.distance ?? null,
    }));

  const nearbyMapped  = mapVenues(nearbyVenuesRaw);
  const genericMapped = venues.length > 0 ? mapVenues(venues) : FALLBACK_VENUES;

  // If we have location-specific results use them; otherwise show generic
  const displayVenues = nearbyMapped.length > 0 ? nearbyMapped : genericMapped;
  const isLocationBased = nearbyMapped.length > 0;

  const featuredVenue = displayVenues[0];
  const nearbyVenues  = displayVenues.slice(1);

  if (activeRole === "coach")       return <CoachHome       userName={userName} initials={initials} />;
  if (activeRole === "venue_owner") return <VenueOwnerHome  userName={userName} initials={initials} />;

  return (
    <div className="pb-24 max-w-md mx-auto">

      {/* ── Header ── */}
      <div className="px-4 pt-6 mb-6 flex items-start justify-between">
        <div>
          <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{getGreeting()} 👋</p>
          <h1 className="text-white mt-1" style={{ fontSize: "26px", fontWeight: "800" }}>
            {userName ?? "Welcome back"}
          </h1>
          <LocationPill onOpen={() => setShowLocSheet(true)} />
        </div>
        <Link to="/profile"
          className="rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ width: "42px", height: "42px", fontSize: "16px", fontWeight: "700", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", marginTop: "2px" }}>
          {initials}
        </Link>
      </div>
      <LocationSheet open={showLocSheet} onClose={() => setShowLocSheet(false)} />

      {/* ── Quick Actions — 4-col ── */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to}
              className="flex flex-col items-center gap-1.5 py-3 active:scale-95 transition-transform"
              style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: "22px" }}>{a.emoji}</span>
              <span className="text-center text-[#94A3B8]"
                style={{ fontSize: "10px", fontWeight: "600", whiteSpace: "pre-line", lineHeight: 1.25 }}>
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── My Tournaments — active only ── */}
      {myActiveTournaments.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>My Tournaments</h2>
            <Link to="/tournaments" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
          </div>
          <div className="space-y-2">
            {myActiveTournaments.slice(0, 3).map((t: any) => {
              const ss     = TOURNAMENT_STATUS_STYLE[t.status] ?? TOURNAMENT_STATUS_STYLE.draft;
              const stages = Array.isArray(t.stages) ? t.stages : [];
              const teams  = Array.isArray(t.teams)  ? t.teams  : [];
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tournaments/${t.id}`)}
                  className="w-full flex items-center gap-3 p-4 text-left active:scale-[0.98] transition-transform"
                  style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "rgba(245,158,11,0.1)", fontSize: "22px" }}
                  >
                    {sportEmoji(t.sport)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "700" }}>{t.name}</p>
                    <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                      {t.sport} · {teams.length} team{teams.length !== 1 ? "s" : ""}
                      {stages.length > 0 ? ` · ${stages.length} stages` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className="px-2 py-0.5"
                      style={{ borderRadius: "6px", backgroundColor: ss.bg, fontSize: "9px", fontWeight: "800", color: ss.color, letterSpacing: "0.04em" }}
                    >
                      {(t.status ?? "draft").replace("_", " ").toUpperCase()}
                    </div>
                    <ChevronRight style={{ width: "14px", height: "14px", color: "#475569" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Next Game / Book CTA ── */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Next Game</h2>
          <Link to="/bookings" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
        </div>
        {nextBooking ? (
          <button onClick={() => navigate(`/bookings/${nextBooking.id}`)}
            className="w-full p-4 text-left active:scale-[0.98] transition-transform"
            style={{ borderRadius: "18px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>
                  {sportEmoji(nextBooking.sport)}
                </div>
                <h3 className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>
                  {nextBooking.venue?.name ?? "Venue"}
                </h3>
                <p className="text-white/75 mt-0.5" style={{ fontSize: "13px" }}>
                  {nextBooking.sport ?? "Sports"}
                </p>
              </div>
              <div className="px-3 py-1" style={{ borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.2)" }}>
                <span className="text-white" style={{ fontSize: "12px", fontWeight: "600" }}>
                  {nextBooking.bookingDate ? format(new Date(nextBooking.bookingDate), "MMM d") : "Today"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock style={{ width: "15px", height: "15px", color: "rgba(255,255,255,0.75)" }} />
              <span className="text-white/90" style={{ fontSize: "13px", fontWeight: "500" }}>
                {nextBooking.startTime ?? "—"} – {nextBooking.endTime ?? "—"}
              </span>
            </div>
          </button>
        ) : (
          <Link to="/book"
            className="flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
            style={{ borderRadius: "18px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)" }}>
            <div className="flex items-center justify-center"
              style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.2)", fontSize: "24px" }}>
              ⚡
            </div>
            <div>
              <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Book Your Next Game</p>
              <p className="text-white/70 mt-0.5" style={{ fontSize: "13px" }}>Find available courts near you</p>
            </div>
            <ChevronRight style={{ width: "20px", height: "20px", color: "rgba(255,255,255,0.7)", marginLeft: "auto" }} />
          </Link>
        )}
      </div>

      {/* ── Featured Venue — hero card ── */}
      {featuredVenue && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
                {isLocationBased ? "Near You" : "Featured Venue"}
              </h2>
              {isLocationBased && userLoc.city && (
                <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "1px" }}>
                  📍 {userLoc.city}{userLoc.source === "gps" ? " · GPS" : ""}
                </p>
              )}
            </div>
            <Link to="/venues" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
          </div>
          <button onClick={() => navigate(`/venues/${featuredVenue.id}`)}
            className="w-full overflow-hidden text-left active:scale-[0.98] transition-transform"
            style={{ borderRadius: "18px", position: "relative", height: "160px" }}>
            <img src={featuredVenue.image} alt={featuredVenue.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
            {/* Gradient overlay */}
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(10,15,26,0.95) 0%, rgba(10,15,26,0.3) 55%, transparent 100%)" }} />
            {/* FEATURED badge */}
            <div className="absolute top-3 right-3 px-2 py-0.5"
              style={{ borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
              <span className="text-white" style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em" }}>FEATURED</span>
            </div>
            {/* Info at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white" style={{ fontSize: "17px", fontWeight: "700" }}>{featuredVenue.name}</p>
              <p className="text-white/70 mt-0.5" style={{ fontSize: "12px" }}>
                ⭐ {typeof featuredVenue.rating === "number" ? featuredVenue.rating.toFixed(1) : featuredVenue.rating} · 📍 {(featuredVenue as any).location?.city} · from ₹{featuredVenue.defaultPricePerHour}/hr
              </p>
            </div>
          </button>
        </div>
      )}

      {/* ── Nearby Venues — horizontal scroll ── */}
      {nearbyVenues.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
              {isLocationBased ? "More Near You" : "Nearby Venues"}
            </h2>
            <Link to="/venues" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {nearbyVenues.map((v) => (
              <button key={v.id} onClick={() => navigate(`/venues/${v.id}`)}
                className="flex-shrink-0 overflow-hidden text-left active:scale-95 transition-transform"
                style={{ width: "170px", borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ height: "88px", overflow: "hidden" }}>
                  <img src={v.image} alt={v.name} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />
                </div>
                <div className="p-3">
                  <p className="text-white truncate" style={{ fontSize: "13px", fontWeight: "700" }}>{v.name}</p>
                  <p className="text-[#64748B] mt-0.5" style={{ fontSize: "10px" }}>
                    {sportEmoji(v.sport)} {v.sport}
                    {(v as any).distance_km != null ? ` · ${((v as any).distance_km as number).toFixed(1)} km` : ""}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#94A3B8]" style={{ fontSize: "11px" }}>
                      ⭐ {typeof v.rating === "number" ? v.rating.toFixed(1) : v.rating}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6" }}>
                      ₹{v.defaultPricePerHour}/hr
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Improve Your Game — training batches ── */}
      {trainingBatches.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <div>
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Improve Your Game</h2>
              {userLoc.city && (
                <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "1px" }}>
                  Trainers in {userLoc.city}
                </p>
              )}
            </div>
            <Link to="/training" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {trainingBatches.slice(0, 5).map((b: any) => {
              const color = sportColor(b.sport);
              return (
                <button key={b.id} onClick={() => navigate(`/training/${b.id}`)}
                  className="flex-shrink-0 p-3 text-left active:scale-95 transition-transform"
                  style={{ width: "165px", borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "26px", marginBottom: "8px" }}>{sportEmoji(b.sport)}</div>
                  <p className="text-white" style={{ fontSize: "13px", fontWeight: "700", lineHeight: 1.3, marginBottom: "3px" }}>
                    {b.name ?? "Training Batch"}
                  </p>
                  <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                    {b.trainer?.name ?? b.trainerName ?? "Coach"}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#64748B]" style={{ fontSize: "10px" }}>
                      👥 {b._count?.memberships ?? 0}/{b.capacity ?? "—"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color }}>
                      {(() => {
                        if (!b.sportFees) return "Free";
                        const raw = Object.values(b.sportFees as Record<string, unknown>)[0];
                        const price = typeof raw === "number" ? raw
                          : typeof raw === "object" && raw !== null
                            ? Object.values(raw as Record<string, unknown>).find((v) => typeof v === "number") as number | undefined
                            : undefined;
                        return price != null ? `₹${price}` : "—";
                      })()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Players Near You ── */}
      {peersNear.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <div>
              <h2 className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Players Near You</h2>
              {userLoc.city && (
                <p className="text-[#64748B]" style={{ fontSize: "11px", marginTop: "1px" }}>
                  In {userLoc.city}
                </p>
              )}
            </div>
            <Link to="/find-peers" className="text-[#3B82F6]" style={{ fontSize: "13px", fontWeight: "600" }}>See All</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {peersNear.map((p: any) => {
              const initials2 = getInitials(p.name);
              return (
                <Link key={p.id} to={`/players/${p.id}`}
                  className="flex-shrink-0 flex flex-col items-center gap-2 p-3 active:scale-95 transition-transform"
                  style={{ width: "88px", borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="rounded-full object-cover"
                      style={{ width: "44px", height: "44px" }} />
                  ) : (
                    <div className="rounded-full flex items-center justify-center"
                      style={{ width: "44px", height: "44px", background: "linear-gradient(135deg,#3B82F6,#8B5CF6)", fontSize: "16px", fontWeight: "700", color: "#fff" }}>
                      {initials2}
                    </div>
                  )}
                  <p className="text-white text-center truncate w-full" style={{ fontSize: "11px", fontWeight: "600" }}>
                    {p.name ?? "Player"}
                  </p>
                  <p className="text-[#64748B] text-center" style={{ fontSize: "10px" }}>
                    {p.location?.city ?? ""}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!nextBooking && displayVenues.length === 0 && (
        <div className="px-4">
          <Link to="/book" className="block w-full p-6 text-center"
            style={{ borderRadius: "20px", background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15))", border: "1px dashed rgba(59,130,246,0.4)" }}>
            <Zap style={{ width: "32px", height: "32px", color: "#3B82F6", margin: "0 auto 8px" }} />
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Book Your First Game</p>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Find available courts near you</p>
          </Link>
        </div>
      )}
    </div>
  );
}
