import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, usePlayerStats, useMySkillRatings, useWallet } from "@sportza/api-client";
import {
  User,
  Bell,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Settings,
  Shield,
  Dumbbell,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Lock,
  RefreshCw,
  Building2,
  Zap,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRole, type AppRole } from "../context/RoleContext";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_META: Record<
  AppRole,
  { label: string; description: string; icon: React.ElementType; color: string; bg: string; features: string[] }
> = {
  player: {
    label: "Player",
    description: "Book courts, join games, track stats",
    icon: Zap,
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
    features: ["Book venues", "Join Open Play", "View stats", "Join training"],
  },
  coach: {
    label: "Coach",
    description: "Create training batches, manage players",
    icon: Dumbbell,
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
    features: ["Create batches", "Manage players", "Batch analytics", "Earnings dashboard"],
  },
  venue_owner: {
    label: "Venue Owner",
    description: "Manage venues, slots, and bookings",
    icon: Building2,
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    features: ["Manage venues", "Pricing & slots", "Booking dashboard", "Revenue reports"],
  },
  admin: {
    label: "Admin",
    description: "Full system control and moderation",
    icon: Shield,
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    features: ["Full control", "Moderation", "Reports"],
  },
};

// ─── Role Switcher Sheet ──────────────────────────────────────────────────────
function RoleSwitcherSheet({ onClose }: { onClose: () => void }) {
  const { activeRole, availableRoles, switchRole, applyForRole, dbRole } = useRole();
  const [applying, setApplying] = useState<AppRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [queued, setQueued] = useState<string | null>(null);

  const ALL_ROLES: AppRole[] = dbRole === "admin"
    ? ["player", "coach", "venue_owner", "admin"]
    : ["player", "coach", "venue_owner"];

  function roleDestination(role: AppRole) {
    if (role === "coach")       return "/trainer";
    if (role === "venue_owner") return "/venue-owner";
    if (role === "admin")       return "/admin";
    return "/";
  }

  const handleSwitch = (role: AppRole) => {
    switchRole(role);
    onClose();
    navigate(roleDestination(role));
  };

  const handleApply = async (role: AppRole) => {
    setApplying(role);
    setError(null);
    setQueued(null);
    try {
      const result: any = await applyForRole(role);
      // Application queued for admin review (player applying for privileged role)
      if (result?.queued) {
        setQueued(`Your application for the "${role}" role has been submitted. An admin will review it soon.`);
        setApplying(null);
        return;
      }
      onClose();
      navigate(roleDestination(role));
    } catch {
      setError("Failed to submit application. Please try again.");
    } finally {
      setApplying(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />

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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Switch Role</h2>
          <button
            onClick={onClose}
            className="text-[#64748B]"
            style={{ fontSize: "14px" }}
          >
            Done
          </button>
        </div>

        <div className="space-y-3">
          {ALL_ROLES.map((role) => {
            const meta     = ROLE_META[role];
            const RoleIcon = meta.icon;
            const isActive = activeRole === role;
            const isAvailable = availableRoles.includes(role);
            const isApplying  = applying === role;

            return (
              <div
                key={role}
                className="p-4"
                style={{
                  borderRadius: "16px",
                  backgroundColor: isActive ? meta.bg : "rgba(255,255,255,0.03)",
                  border: isActive
                    ? `1.5px solid ${meta.color}40`
                    : "1.5px solid rgba(255,255,255,0.06)",
                  transition: "all 0.2s",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      backgroundColor: isAvailable ? meta.bg : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <RoleIcon style={{ width: "22px", height: "22px", color: isAvailable ? meta.color : "#475569" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-white"
                        style={{ fontSize: "16px", fontWeight: "700", opacity: isAvailable ? 1 : 0.5 }}
                      >
                        {meta.label}
                      </span>
                      {isActive && (
                        <span
                          className="px-2 py-0.5"
                          style={{ borderRadius: "999px", backgroundColor: meta.color, fontSize: "10px", fontWeight: "700", color: "#fff" }}
                        >
                          ACTIVE
                        </span>
                      )}
                      {!isAvailable && (
                        <Lock style={{ width: "12px", height: "12px", color: "#475569" }} />
                      )}
                    </div>
                    <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{meta.description}</p>

                    {/* Features */}
                    {isActive && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {meta.features.map((f) => (
                          <span
                            key={f}
                            className="px-2 py-0.5"
                            style={{ borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "11px", color: "#94A3B8" }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="flex-shrink-0">
                    {isActive ? (
                      <CheckCircle2 style={{ width: "22px", height: "22px", color: meta.color }} />
                    ) : isAvailable ? (
                      <button
                        onClick={() => handleSwitch(role)}
                        className="px-3 py-2"
                        style={{
                          borderRadius: "10px",
                          backgroundColor: meta.bg,
                          fontSize: "13px",
                          fontWeight: "700",
                          color: meta.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Switch
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApply(role)}
                        disabled={isApplying}
                        className="px-3 py-2 flex items-center gap-1"
                        style={{
                          borderRadius: "10px",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#94A3B8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isApplying && <RefreshCw style={{ width: "12px", height: "12px" }} className="animate-spin" />}
                        {isApplying ? "Applying…" : "Apply"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DB role note */}
        <p className="text-center text-[#475569] mt-4" style={{ fontSize: "12px" }}>
          Your verified role: <span className="text-[#94A3B8] font-semibold">{ROLE_META[dbRole]?.label ?? dbRole}</span>
        </p>

        {queued && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2" style={{ borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.1)" }}>
            <CheckCircle2 style={{ width: "14px", height: "14px", color: "#22C55E", flexShrink: 0 }} />
            <p style={{ fontSize: "13px", color: "#22C55E" }}>{queued}</p>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2" style={{ borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle style={{ width: "14px", height: "14px", color: "#EF4444" }} />
            <p className="text-[#EF4444]" style={{ fontSize: "13px" }}>{error}</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MENU_SECTIONS = [
  {
    section: "Account",
    items: [
      { id: 1, label: "Edit Profile",    icon: User,      to: "/profile/edit",  comingSoon: false },
      { id: 2, label: "My Batches",      icon: Dumbbell,  to: "/my-batches",    comingSoon: false },
      { id: 3, label: "My Bookings",     icon: CreditCard,to: "/bookings",      comingSoon: false },
      { id: 31, label: "Payments & Wallet", icon: CreditCard, to: "/payments", comingSoon: false },
      { id: 4, label: "Notifications",   icon: Bell,      to: "/notifications", comingSoon: false },
    ],
  },
  {
    section: "Preferences",
    items: [
      { id: 5, label: "Settings",          icon: Settings, to: "/settings", comingSoon: false },
      { id: 6, label: "Privacy & Security",icon: Shield,   to: "/privacy",  comingSoon: false },
    ],
  },
  {
    section: "Support",
    items: [
      { id: 7, label: "Help Center", icon: HelpCircle, to: null, comingSoon: true  },
      { id: 8, label: "Log Out",     icon: LogOut,     to: null, danger: true       },
    ],
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const { data: statsData } = usePlayerStats();
  const { data: ratingsData } = useMySkillRatings();
  const { data: walletRes } = useWallet();
  const walletBalance: number = (walletRes as any)?.data?.balance ?? 0;
  const { activeRole, dbRole, availableRoles, switchRole } = useRole();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);

  const apiUser  = (userData as any)?.user ?? userData;
  const otpUser  =
    typeof window !== "undefined"
      ? (() => { try { return JSON.parse(localStorage.getItem("sportza_user") || "null"); } catch { return null; } })()
      : null;
  const user = apiUser ?? otpUser;

  const name: string = user?.name ?? "User";
  const email: string = user?.email ?? "";
  const phone: string = (user as any)?.phone ?? "";
  const city: string  = (user as any)?.location?.city ?? (user as any)?.locationCity ?? (user as any)?.city ?? "Pune, Maharashtra";
  const memberSince: string = (user as any)?.createdAt
    ? new Date((user as any).createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "Jan 2025";

  const activeRoleMeta = ROLE_META[activeRole];
  const dbRoleMeta     = ROLE_META[dbRole];

  const stats: Array<Record<string, unknown>> = Array.isArray(statsData)
    ? (statsData as Array<Record<string, unknown>>)
    : ((statsData as any)?.data ?? []);

  const totalGames = stats.reduce((s, r) => s + ((r.totalMatches as number) ?? 0), 0);
  const totalWins  = stats.reduce((s, r) => s + ((r.matchesWon as number) ?? 0), 0);
  const winRate    = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const hours      = Math.round(totalGames * 1.5);

  const quickStats = [
    { label: "Games",    value: totalGames || (user as any)?.totalBookings || 0 },
    { label: "Win Rate", value: `${winRate}%` },
    { label: "Hours",    value: `${hours}h`   },
  ];

  const skillRatings: Array<Record<string, any>> = Array.isArray(ratingsData?.data) ? ratingsData.data : [];

  function confidenceColor(confidence: string) {
    switch (confidence) {
      case "master":      return "#A855F7";
      case "expert":      return "#6366F1";
      case "advanced":    return "#22C55E";
      case "established": return "#3B82F6";
      case "developing":  return "#F59E0B";
      case "beginner":    return "#F97316";
      case "unranked":    return "#64748B";
      // legacy labels
      case "high":        return "#22C55E";
      case "medium":      return "#F59E0B";
      case "provisional": return "#3B82F6";
      default:            return "#64748B";
    }
  }

  function confidenceLabel(confidence: string) {
    switch (confidence) {
      case "master":      return "Master";
      case "expert":      return "Expert";
      case "advanced":    return "Advanced";
      case "established": return "Established";
      case "developing":  return "Developing";
      case "beginner":    return "Beginner";
      case "unranked":    return "Unranked";
      // legacy labels
      case "high":        return "Established";
      case "medium":      return "Developing";
      case "provisional": return "Beginner";
      default:            return "Unranked";
    }
  }

  function ratingTier(rating: number) {
    if (rating >= 1400) return { label: "Elite", color: "#A855F7" };
    if (rating >= 1200) return { label: "Advanced", color: "#3B82F6" };
    if (rating >= 1000) return { label: "Intermediate", color: "#22C55E" };
    return { label: "Beginner", color: "#F59E0B" };
  }

  const handleLogout = async () => {
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      await fetch(`${base}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // proceed even if server call fails
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("sportza_token");
    localStorage.removeItem("sportza_user");
    localStorage.removeItem("sportza_active_role");
    window.location.href = "/login";
  };

  const handleMenuAction = (item: (typeof MENU_SECTIONS)[0]["items"][0]) => {
    if ((item as any).danger) { handleLogout(); return; }
    if ((item as any).to && !(item as any).comingSoon) { navigate((item as any).to); return; }
    if ((item as any).comingSoon) {
      alert("Coming soon — this feature is in development.");
    }
  };

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-white mb-1" style={{ fontSize: "28px", fontWeight: "700" }}>Profile</h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>Manage your account</p>
      </div>

      {/* ── Profile Card ── */}
      <div className="mb-6">
        <div className="bg-[#1E293B] p-6 relative overflow-hidden"
          style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-start gap-4 mb-4">
            <div
              className="rounded-full bg-[#3B82F6] flex items-center justify-center text-white flex-shrink-0"
              style={{ width: "64px", height: "64px", fontSize: "24px", fontWeight: "700" }}
            >
              {getInitials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h2 className="text-white" style={{ fontSize: "22px", fontWeight: "600" }}>{name}</h2>
                <div
                  className="px-2 py-0.5"
                  style={{ borderRadius: "999px", backgroundColor: activeRoleMeta.bg }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "600", color: activeRoleMeta.color }}>
                    {activeRoleMeta.label}
                  </span>
                </div>
                {dbRole !== activeRole && (
                  <div
                    className="px-2 py-0.5"
                    style={{ borderRadius: "999px", backgroundColor: dbRoleMeta.bg }}
                    title="Your verified account role"
                  >
                    <span style={{ fontSize: "11px", fontWeight: "600", color: dbRoleMeta.color }}>
                      {dbRoleMeta.label} account
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {email && (
                  <div className="flex items-center gap-2 text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    <Mail style={{ width: "13px", height: "13px" }} />
                    <span className="truncate">{email}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2 text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    <Phone style={{ width: "13px", height: "13px" }} />
                    <span>{phone}</span>
                  </div>
                )}
                {city && (
                  <div className="flex items-center gap-2 text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    <MapPin style={{ width: "13px", height: "13px" }} />
                    <span>{city}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {quickStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-white mb-1" style={{ fontSize: "22px", fontWeight: "600" }}>
                  {stat.value}
                </div>
                <div className="text-[#94A3B8]" style={{ fontSize: "12px" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sportza Wallet ── */}
      <button
        onClick={() => navigate("/payments")}
        className="w-full mb-6"
      >
        <div
          className="p-4 flex items-center gap-4"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.06))", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <div className="flex items-center justify-center flex-shrink-0"
            style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)" }}>
            <span style={{ fontSize: "22px" }}>💳</span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Sportza Wallet</p>
            <p className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>₹{walletBalance.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5"
            style={{ borderRadius: "999px", backgroundColor: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#22C55E" }}>View Ledger →</span>
          </div>
        </div>
      </button>

      {/* ── Skill Ratings ── */}
      {skillRatings.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setRatingsOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 mb-3 transition-colors hover:bg-white/5"
            style={{
              borderRadius: "16px",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
              Sportza Ratings
            </span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "13px", color: "#94A3B8", fontWeight: "500" }}>
                {skillRatings.length} sports
              </span>
              {ratingsOpen
                ? <ChevronUp style={{ width: "18px", height: "18px", color: "#6366F1" }} />
                : <ChevronDown style={{ width: "18px", height: "18px", color: "#6366F1" }} />
              }
            </div>
          </button>
          {ratingsOpen && (
          <div className="bg-[#1E293B] overflow-hidden"
            style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            {skillRatings.map((r: any, index: number) => {
              const tier = ratingTier(r.rating);
              const confColor = confidenceColor(r.confidence);
              const confLabel = confidenceLabel(r.confidence);
              const isLast = index === skillRatings.length - 1;
              const recentHistory: any[] = r.recentHistory ?? [];
              const lastDelta = recentHistory[0]?.delta ?? null;

              return (
                <div
                  key={r.sportId}
                  className="p-4"
                  style={{ borderBottom: !isLast ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: `${tier.color}18`,
                        }}
                      >
                        <Zap style={{ width: "20px", height: "20px", color: tier.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                            {r.sport?.displayName ?? r.sport?.name}
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span style={{ fontSize: "12px", color: confColor, fontWeight: "600" }}>
                            {confLabel}
                          </span>
                          <span className="text-[#475569]" style={{ fontSize: "11px" }}>
                            · {r.matchesPlayed} {r.matchesPlayed === 1 ? "match" : "matches"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div style={{ fontSize: "10px", color: "#475569", fontWeight: "600", marginBottom: "2px" }}>
                        SPORTZA RATING
                      </div>
                      <div className="text-white" style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                        {r.rating}
                      </div>
                      {lastDelta !== null && (
                        <div
                          className="flex items-center justify-end gap-0.5"
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: lastDelta > 0 ? "#22C55E" : lastDelta < 0 ? "#EF4444" : "#64748B",
                          }}
                        >
                          {lastDelta > 0 ? (
                            <TrendingUp style={{ width: "12px", height: "12px" }} />
                          ) : lastDelta < 0 ? (
                            <TrendingDown style={{ width: "12px", height: "12px" }} />
                          ) : (
                            <Minus style={{ width: "12px", height: "12px" }} />
                          )}
                          {lastDelta > 0 ? `+${lastDelta}` : lastDelta}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ── Admin Panel shortcut (DB role = admin) ── */}
      {dbRole === "admin" && (
        <div className="mb-6">
          <button
            onClick={() => {
              switchRole("admin");
              navigate("/admin");
            }}
            className="w-full flex items-center justify-between p-4 transition-colors hover:bg-white/5"
            style={{
              borderRadius: "16px",
              backgroundColor: "#1E293B",
              border: "1px solid rgba(239,68,68,0.35)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.12)" }}
              >
                <Shield style={{ width: "22px", height: "22px", color: "#EF4444" }} />
              </div>
              <div className="text-left">
                <span className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Admin Panel</span>
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Manage accounts, onboarding, venues & ledger</p>
              </div>
            </div>
            <ChevronRight style={{ width: "20px", height: "20px", color: "#EF4444" }} />
          </button>
        </div>
      )}

      {/* ── Role Switcher Card ── */}
      <div className="mb-6">
        <h3 className="text-[#94A3B8] mb-3 px-2" style={{ fontSize: "14px", fontWeight: "500" }}>
          Active Role
        </h3>
        <button
          onClick={() => setShowRoleSwitcher(true)}
          className="w-full flex items-center justify-between p-4 transition-colors hover:bg-white/5"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: `1px solid ${activeRoleMeta.color}30`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: activeRoleMeta.bg }}
            >
              <activeRoleMeta.icon style={{ width: "22px", height: "22px", color: activeRoleMeta.color }} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>
                  {activeRoleMeta.label} Mode
                </span>
                <span
                  className="px-1.5 py-0.5"
                  style={{ borderRadius: "6px", backgroundColor: activeRoleMeta.bg, fontSize: "10px", fontWeight: "700", color: activeRoleMeta.color }}
                >
                  ACTIVE
                </span>
              </div>
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{activeRoleMeta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {availableRoles.length > 1 && (
              <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>
                Switch
              </span>
            )}
            <ChevronRight style={{ width: "20px", height: "20px", color: "#64748B" }} />
          </div>
        </button>

        {/* Quick role pills if multiple available */}
        {availableRoles.length > 1 && (
          <div className="flex gap-2 mt-3 px-1">
            {availableRoles.map((role) => {
              const meta = ROLE_META[role];
              const isActive = role === activeRole;
              return (
                <button
                  key={role}
                  onClick={() => {
                    switchRole(role);
                    if (role === "coach") navigate("/trainer");
                    else if (role === "venue_owner") navigate("/venue-owner");
                    else if (role === "admin") navigate("/admin");
                    else navigate("/");
                  }}
                  className="flex-1 py-2 px-3 flex items-center justify-center gap-1.5"
                  style={{
                    borderRadius: "10px",
                    backgroundColor: isActive ? meta.bg : "rgba(255,255,255,0.04)",
                    border: isActive ? `1px solid ${meta.color}40` : "1px solid rgba(255,255,255,0.06)",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: isActive ? meta.color : "#64748B",
                    transition: "all 0.15s",
                  }}
                >
                  <meta.icon style={{ width: "14px", height: "14px" }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Menu Sections ── */}
      <div className="space-y-8">
        {MENU_SECTIONS.map((section) => (
          <div key={section.section}>
            <h3 className="text-[#94A3B8] mb-3 px-2" style={{ fontSize: "14px", fontWeight: "500" }}>
              {section.section}
            </h3>
            <div className="bg-[#1E293B] overflow-hidden"
              style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              {section.items.map((item, index) => {
                const Icon    = item.icon;
                const isDanger = !!(item as any).danger;
                const isLast   = index === section.items.length - 1;
                const isComingSoon = !!(item as any).comingSoon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuAction(item as any)}
                    className="w-full flex items-center justify-between p-4 transition-colors hover:bg-white/5"
                    style={{ borderBottom: !isLast ? "1px solid rgba(255,255,255,0.05)" : "none", opacity: isComingSoon ? 0.65 : 1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          backgroundColor: isDanger ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                        }}
                      >
                        <Icon style={{ width: "20px", height: "20px", color: isDanger ? "#EF4444" : "#3B82F6" }} />
                      </div>
                      <span style={{ fontSize: "16px", fontWeight: "500", color: isDanger ? "#EF4444" : "#FFFFFF" }}>
                        {item.label}
                      </span>
                      {isComingSoon && (
                        <span className="px-1.5 py-0.5" style={{ borderRadius: "6px", backgroundColor: "rgba(100,116,139,0.2)", fontSize: "10px", fontWeight: "700", color: "#64748B" }}>
                          SOON
                        </span>
                      )}
                    </div>
                    {!isComingSoon && (
                      <ChevronRight style={{ width: "20px", height: "20px", color: isDanger ? "#EF4444" : "#94A3B8" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 text-center">
        <p className="text-[#64748B]" style={{ fontSize: "14px" }}>Member since {memberSince}</p>
        <p className="text-[#475569] mt-1" style={{ fontSize: "12px" }}>Sportza v1.0.0</p>
      </div>

      {/* ── Role Switcher Modal ── */}
      {showRoleSwitcher && <RoleSwitcherSheet onClose={() => setShowRoleSwitcher(false)} />}
    </div>
  );
}
