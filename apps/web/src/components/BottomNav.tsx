import { NavLink } from "react-router-dom";
import {
  Home,
  Calendar,
  BarChart3,
  User,
  Dumbbell,
  CreditCard,
  LayoutDashboard,
  Building2,
  Zap,
  Users,
  ShieldCheck,
  ClipboardList,
  UserCog,
} from "lucide-react";
import { useRole, type AppRole } from "../context/RoleContext";

// ─── Nav config per role ──────────────────────────────────────────────────────
type NavItem = { to: string; icon: React.ElementType; label: string };

const NAV: Record<AppRole, NavItem[]> = {
  player: [
    { to: "/",            icon: Home,     label: "Home"     },
    { to: "/bookings",    icon: Calendar, label: "Bookings" },
    { to: "/open-plays",  icon: Zap,      label: "Play"     },
    { to: "/stats",       icon: BarChart3,label: "Stats"    },
    { to: "/profile",     icon: User,     label: "Profile"  },
  ],
  coach: [
    { to: "/trainer",              icon: LayoutDashboard, label: "Dashboard" },
    { to: "/trainer/batches",      icon: Dumbbell,        label: "Batches"   },
    { to: "/trainer/sessions",     icon: Calendar,        label: "Sessions"  },
    { to: "/trainer/payments",     icon: CreditCard,      label: "Earnings"  },
    { to: "/profile",              icon: User,            label: "Profile"   },
  ],
  venue_owner: [
    { to: "/venue-owner",            icon: LayoutDashboard, label: "Dashboard"  },
    { to: "/venue-owner/venues",     icon: Building2,       label: "Venues"     },
    { to: "/venue-owner/bookings",   icon: Calendar,        label: "Bookings"   },
    { to: "/venue-owner/reports",    icon: BarChart3,       label: "Reports"    },
    { to: "/profile",                icon: User,            label: "Profile"    },
  ],
  admin: [
    { to: "/admin",              icon: LayoutDashboard, label: "Dashboard"  },
    { to: "/admin/accounts",     icon: Users,           label: "Accounts"   },
    { to: "/admin/onboarding",   icon: UserCog,         label: "Onboarding" },
    { to: "/admin/venues",       icon: Building2,       label: "Venues"     },
    { to: "/admin/audit",        icon: ClipboardList,   label: "Audit"      },
  ],
};

// ─── Role badge colours ───────────────────────────────────────────────────────
const ROLE_BADGE: Record<AppRole, { label: string; color: string; bg: string }> = {
  player:      { label: "Player",      color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  coach:       { label: "Coach",       color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  venue_owner: { label: "Venue Owner", color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  admin:       { label: "Admin",       color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BottomNav() {
  const { activeRole } = useRole();
  const navItems = NAV[activeRole] ?? NAV.player;
  const badge    = ROLE_BADGE[activeRole];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        backgroundColor: "#0F172A",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Role indicator strip */}
      <div
        className="flex items-center justify-center py-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div
          className="flex items-center gap-1 px-2.5 py-0.5"
          style={{ borderRadius: "999px", backgroundColor: badge.bg }}
        >
          <span style={{ fontSize: "10px", fontWeight: "700", color: badge.color, letterSpacing: "0.04em" }}>
            {badge.label.toUpperCase()} MODE
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                isActive ? "" : ""
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "36px",
                    height: "32px",
                    borderRadius: "10px",
                    backgroundColor: isActive ? badge.bg : "transparent",
                    transition: "background-color 0.15s",
                  }}
                >
                  <Icon
                    style={{
                      width: "20px",
                      height: "20px",
                      color: isActive ? badge.color : "#475569",
                      transition: "color 0.15s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: isActive ? "700" : "400",
                    color: isActive ? badge.color : "#475569",
                    transition: "color 0.15s",
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
