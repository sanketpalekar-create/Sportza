import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Building2, CheckCircle2, Dumbbell, Lock, RefreshCw, Shield, Zap } from "lucide-react";
import { useRole, type AppRole } from "../context/RoleContext";

// ── Role metadata ──────────────────────────────────────────────────────────────
const ROLE_META: Record<
  AppRole,
  {
    label: string;
    emoji: string;
    sub: string;
    accent: string;
    border: string;
    icon: typeof Zap;
    bg: string;
    features: string[];
  }
> = {
  player: {
    label: "Player",
    emoji: "🏃",
    sub: "Book venues, join games & track stats",
    accent: "#3B82F6",
    border: "rgba(59,130,246,0.55)",
    icon: Zap,
    bg: "rgba(59,130,246,0.12)",
    features: ["Book venues", "Join Open Play", "View stats", "Join training"],
  },
  coach: {
    label: "Coach",
    emoji: "🏆",
    sub: "Manage batches & training sessions",
    accent: "#22C55E",
    border: "rgba(34,197,94,0.55)",
    icon: Dumbbell,
    bg: "rgba(34,197,94,0.12)",
    features: ["Create batches", "Manage players", "Batch analytics", "Earnings dashboard"],
  },
  venue_owner: {
    label: "Venue Owner",
    emoji: "🏟️",
    sub: "Manage bookings & revenue",
    accent: "#F59E0B",
    border: "rgba(245,158,11,0.55)",
    icon: Building2,
    bg: "rgba(245,158,11,0.12)",
    features: ["Manage venues", "Pricing & slots", "Booking dashboard", "Revenue reports"],
  },
  admin: {
    label: "Admin",
    emoji: "⚙️",
    sub: "Full platform access",
    accent: "#EF4444",
    border: "rgba(239,68,68,0.55)",
    icon: Shield,
    bg: "rgba(239,68,68,0.12)",
    features: ["Full control", "Moderation", "Reports"],
  },
};

// ── Badge pill ─────────────────────────────────────────────────────────────────
// Rendered as a plain button — positioning handled by the sticky wrapper in MainLayout
export function RoleBadge({ onPress }: { onPress: () => void }) {
  const { activeRole } = useRole();
  const meta = ROLE_META[activeRole];

  return (
    <button
      onClick={onPress}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "5px 11px",
        borderRadius: "999px",
        background: `${meta.accent}22`,
        border: `1px solid ${meta.border}`,
        fontSize: "11px",
        fontWeight: "700",
        color: meta.accent,
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
      <span style={{ fontSize: "9px", opacity: 0.75 }}>▾</span>
    </button>
  );
}

// ── Bottom-sheet modal ─────────────────────────────────────────────────────────
export function RoleSwitchModal({ onClose }: { onClose: () => void }) {
  const { activeRole, availableRoles, switchRole, applyForRole, dbRole } = useRole();
  const [applying, setApplying] = useState<AppRole | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const navigate = useNavigate();
  const ALL_ROLES: AppRole[] = dbRole === "admin"
    ? ["player", "coach", "venue_owner", "admin"]
    : ["player", "coach", "venue_owner"];

  function roleDestination(role: AppRole) {
    if (role === "coach")       return "/trainer";
    if (role === "venue_owner") return "/venue-owner";
    if (role === "admin")       return "/admin";
    return "/";
  }

  function handleSwitch(role: AppRole) {
    switchRole(role);
    onClose();
    navigate(roleDestination(role));
  }

  async function handleApply(role: AppRole) {
    setApplying(role);
    setError(null);
    setQueued(null);
    try {
      const result: any = await applyForRole(role);
      if (result?.queued) {
        setQueued(`Your application for "${ROLE_META[role]?.label ?? role}" has been submitted. An admin will review it soon.`);
        return;
      }
      onClose();
      navigate(roleDestination(role));
    } catch {
      setError("Failed to switch role. Please try again.");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Scrim */}
      <div style={{ flex: 1, background: "rgba(0,0,0,0.65)" }} />

      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#162032",
          borderRadius: "24px 24px 0 0",
          padding: "20px 18px 44px",
          border: "1px solid rgba(255,255,255,0.07)",
          maxWidth: "480px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div style={{
          width: "40px", height: "4px",
          background: "rgba(255,255,255,0.15)",
          borderRadius: "999px",
          margin: "0 auto 18px",
        }} />

        <p style={{
          fontSize: "11px", fontWeight: "700", color: "#64748B",
          letterSpacing: "1.2px", textAlign: "center", marginBottom: "16px",
        }}>
          SWITCH ROLE
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {ALL_ROLES.map((roleId) => {
            const m = ROLE_META[roleId];
            const RoleIcon = m.icon;
            const isActive = activeRole === roleId;
            const isAvailable = availableRoles.includes(roleId);
            const isApplying = applying === roleId;

            return (
              <div
                key={roleId}
                style={{
                  padding: "14px 16px",
                  borderRadius: "18px",
                  border: `1.5px solid ${isActive ? m.border : "rgba(255,255,255,0.07)"}`,
                  background: isActive ? m.bg : "rgba(255,255,255,0.02)",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: isAvailable ? m.bg : "rgba(255,255,255,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <RoleIcon style={{ width: "22px", height: "22px", color: isAvailable ? m.accent : "#475569" }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <div style={{ fontWeight: "700", fontSize: "15px", color: isAvailable ? "#F1F5F9" : "rgba(241,245,249,0.5)" }}>
                        {m.label}
                      </div>
                      {isActive && (
                        <span
                          style={{
                            borderRadius: "999px",
                            background: m.accent,
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "3px 8px",
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                      {!isAvailable && <Lock style={{ width: "12px", height: "12px", color: "#475569", flexShrink: 0 }} />}
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{m.sub}</div>

                    {isActive && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                        {m.features.map((feature) => (
                          <span
                            key={feature}
                            style={{
                              borderRadius: "6px",
                              background: "rgba(255,255,255,0.06)",
                              fontSize: "11px",
                              color: "#94A3B8",
                              padding: "2px 8px",
                            }}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isActive ? (
                      <CheckCircle2 style={{ width: "22px", height: "22px", color: m.accent }} />
                    ) : isAvailable ? (
                      <button
                        onClick={() => handleSwitch(roleId)}
                        style={{
                          borderRadius: "10px",
                          background: m.bg,
                          fontSize: "13px",
                          fontWeight: "700",
                          color: m.accent,
                          whiteSpace: "nowrap",
                          padding: "8px 12px",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Switch
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApply(roleId)}
                        disabled={isApplying}
                        style={{
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.05)",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#94A3B8",
                          whiteSpace: "nowrap",
                          padding: "8px 12px",
                          border: "none",
                          cursor: isApplying ? "progress" : "pointer",
                          opacity: isApplying ? 0.8 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {isApplying && <RefreshCw style={{ width: "12px", height: "12px" }} className="animate-spin" />}
                        {isApplying ? "Applying..." : "Apply"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: "12px", color: "#475569", textAlign: "center", marginTop: "16px" }}>
          Your verified role:{" "}
          <span style={{ color: "#94A3B8", fontWeight: 600 }}>
            {ROLE_META[dbRole]?.label ?? dbRole}
          </span>
        </p>

        {queued && (
          <div
            style={{
              marginTop: "12px",
              borderRadius: "10px",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <CheckCircle2 style={{ width: "14px", height: "14px", color: "#22C55E", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "13px", color: "#22C55E", lineHeight: "1.4" }}>{queued}</p>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "12px",
              borderRadius: "10px",
              background: "rgba(239,68,68,0.1)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle style={{ width: "14px", height: "14px", color: "#EF4444", flexShrink: 0 }} />
            <p style={{ fontSize: "13px", color: "#EF4444" }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Default export — badge + modal together ────────────────────────────────────
export default function RoleSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RoleBadge onPress={() => setOpen(true)} />
      {open && <RoleSwitchModal onClose={() => setOpen(false)} />}
    </>
  );
}
