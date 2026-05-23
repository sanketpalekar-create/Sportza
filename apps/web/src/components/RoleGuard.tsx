/**
 * RoleGuard — Protects routes that require a specific role.
 *
 * If the user's activeRole doesn't match, shows a friendly "apply" screen
 * instead of a blank redirect.
 */
import { useNavigate, Outlet } from "react-router-dom";
import { Lock, ChevronRight, Dumbbell, Building2, Shield } from "lucide-react";
import { useRole, type AppRole } from "../context/RoleContext";

interface RoleGuardProps {
  required: AppRole | AppRole[];
}

export default function RoleGuard({ required }: RoleGuardProps) {
  const { activeRole, dbRole, availableRoles, applyForRole, isLoading } = useRole();
  const navigate = useNavigate();
  const allowed  = Array.isArray(required) ? required : [required];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 bg-[#0F172A] min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#3B82F6] border-t-transparent" />
      </div>
    );
  }

  // User's active role satisfies requirement
  if (allowed.some((r) => activeRole === r)) {
    return <Outlet />;
  }

  // DB-level admin always has access to admin routes (UI mode may still be "player")
  if (allowed.includes("admin") && dbRole === "admin") {
    return <Outlet />;
  }

  // Determine the "target" role for the apply prompt
  const targetRole: AppRole = allowed[0];
  const canApply = !availableRoles.includes(targetRole);

  const COPY: Record<string, { emoji: string; title: string; subtitle: string; icon: React.ElementType; color: string; bg: string }> = {
    coach: {
      emoji:    "🏋️",
      title:    "Coach Dashboard",
      subtitle: "Create training batches, manage players, and track earnings.",
      icon:     Dumbbell,
      color:    "#22C55E",
      bg:       "rgba(34,197,94,0.12)",
    },
    venue_owner: {
      emoji:    "🏟️",
      title:    "Venue Owner Dashboard",
      subtitle: "Manage your venue listings, pricing, slots, and bookings.",
      icon:     Building2,
      color:    "#F59E0B",
      bg:       "rgba(245,158,11,0.12)",
    },
    admin: {
      emoji:    "🔐",
      title:    "Admin Panel",
      subtitle: "This area is restricted to Sportza admins only.",
      icon:     Shield,
      color:    "#EF4444",
      bg:       "rgba(239,68,68,0.12)",
    },
  };

  const copy = COPY[targetRole] ?? {
    emoji:    "🔒",
    title:    "Access Restricted",
    subtitle: "You don't have permission to view this page.",
    icon:     Lock,
    color:    "#94A3B8",
    bg:       "rgba(148,163,184,0.1)",
  };

  const IconComp = copy.icon;

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
      {/* Emoji */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: copy.bg, border: `1.5px solid ${copy.color}30`, fontSize: "40px" }}
      >
        {copy.emoji}
      </div>

      <h1 className="text-white mb-2" style={{ fontSize: "24px", fontWeight: "800" }}>
        {copy.title}
      </h1>
      <p className="text-[#94A3B8] mb-8 max-w-xs" style={{ fontSize: "15px", lineHeight: "1.6" }}>
        {copy.subtitle}
      </p>

      {/* Feature list */}
      {targetRole === "coach" && (
        <div className="w-full max-w-xs mb-8 space-y-2 text-left">
          {["Create training batches", "Manage enrolled players", "Track session attendance", "View earnings & payouts"].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: copy.color }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{f}</span>
            </div>
          ))}
        </div>
      )}
      {targetRole === "venue_owner" && (
        <div className="w-full max-w-xs mb-8 space-y-2 text-left">
          {["Manage venue listings", "Set pricing & availability", "View all bookings", "Revenue reports"].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: copy.color }} />
              <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-xs space-y-3">
        {/* User already has this role but wrong active view → switch */}
        {availableRoles.includes(targetRole) && (
          <button
            onClick={async () => {
              await applyForRole(targetRole);
              navigate(
                targetRole === "coach" ? "/trainer"
                : targetRole === "venue_owner" ? "/venue-owner"
                : targetRole === "admin" ? "/admin"
                : "/"
              );
            }}
            className="w-full py-4 flex items-center justify-center gap-2"
            style={{
              borderRadius: "16px",
              background: `linear-gradient(135deg,${copy.color},${copy.color}cc)`,
              fontSize: "16px",
              fontWeight: "800",
              color: "#fff",
            }}
          >
            <IconComp style={{ width: "18px", height: "18px" }} />
            Switch to {copy.title}
            <ChevronRight style={{ width: "18px", height: "18px" }} />
          </button>
        )}

        {/* Apply for the role (user doesn't have it yet) — admin is not self-applyable */}
        {canApply && targetRole !== "admin" && (
          <button
            onClick={async () => {
              await applyForRole(targetRole);
              navigate(targetRole === "coach" ? "/trainer" : "/venue-owner");
            }}
            className="w-full py-4 flex items-center justify-center gap-2"
            style={{
              borderRadius: "16px",
              background: `linear-gradient(135deg,${copy.color},${copy.color}cc)`,
              fontSize: "16px",
              fontWeight: "800",
              color: "#fff",
            }}
          >
            <IconComp style={{ width: "18px", height: "18px" }} />
            Become a {targetRole === "coach" ? "Coach" : "Venue Owner"}
            <ChevronRight style={{ width: "18px", height: "18px" }} />
          </button>
        )}

        <button
          onClick={() => navigate(-1)}
          className="w-full py-4"
          style={{
            borderRadius: "16px",
            backgroundColor: "rgba(255,255,255,0.05)",
            fontSize: "15px",
            fontWeight: "600",
            color: "#94A3B8",
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
