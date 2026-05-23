import { useNavigate } from "react-router-dom";
import { useAdminStats } from "@sportza/api-client";
import {
  Users, Building2, CreditCard, ClipboardList, ShieldAlert,
  TrendingUp, UserCheck, UserX, CheckCircle2, Clock,
} from "lucide-react";

export default function AdminDashboard() {
  const { data, isLoading } = useAdminStats();
  const navigate = useNavigate();

  const stats = data ?? {};
  const users  = stats.users  ?? {};
  const venues = stats.venues ?? {};

  const cards = [
    {
      label: "Total Users",
      value: isLoading ? "—" : users.total ?? 0,
      sub: `${users.active ?? 0} active`,
      icon: Users,
      color: "#3B82F6",
      bg: "rgba(59,130,246,0.12)",
      to: "/admin/accounts",
    },
    {
      label: "Suspended",
      value: isLoading ? "—" : users.suspended ?? 0,
      sub: "accounts restricted",
      icon: UserX,
      color: "#EF4444",
      bg: "rgba(239,68,68,0.12)",
      to: "/admin/accounts?status=suspended",
    },
    {
      label: "Active Venues",
      value: isLoading ? "—" : venues.active ?? 0,
      sub: `of ${venues.total ?? 0} total`,
      icon: Building2,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
      to: "/admin/venues",
    },
    {
      label: "Pending Approvals",
      value: isLoading ? "—" : stats.pendingApprovals ?? 0,
      sub: "high-risk actions",
      icon: Clock,
      color: "#A855F7",
      bg: "rgba(168,85,247,0.12)",
      to: "/admin/audit",
    },
    {
      label: "Role Applications",
      value: isLoading ? "—" : stats.pendingOnboarding ?? 0,
      sub: "awaiting approval",
      icon: TrendingUp,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
      to: "/admin/onboarding",
    },
    {
      label: "Trainers",
      value: isLoading ? "—" : stats.roles?.trainers ?? 0,
      sub: "active coaches",
      icon: UserCheck,
      color: "#22C55E",
      bg: "rgba(34,197,94,0.12)",
      to: "/admin/onboarding",
    },
    {
      label: "Venue Owners",
      value: isLoading ? "—" : stats.roles?.owners ?? 0,
      sub: "registered owners",
      icon: UserCheck,
      color: "#06B6D4",
      bg: "rgba(6,182,212,0.12)",
      to: "/admin/onboarding",
    },
  ];

  const quickActions = [
    { label: "Manage Accounts",    icon: Users,         color: "#3B82F6", to: "/admin/accounts" },
    { label: "Onboarding Queue",   icon: ShieldAlert,   color: "#F59E0B", to: "/admin/onboarding" },
    { label: "Venue Management",   icon: Building2,     color: "#22C55E", to: "/admin/venues" },
    { label: "Ledger & Finance",   icon: CreditCard,    color: "#A855F7", to: "/admin/ledger" },
    { label: "Audit & Approvals",  icon: ClipboardList, color: "#EF4444", to: "/admin/audit" },
  ];

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 12px", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ShieldAlert style={{ width: "20px", height: "20px", color: "#EF4444" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9" }}>Admin Panel</h1>
            <p style={{ fontSize: "12px", color: "#64748B" }}>Sportza operations dashboard</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => navigate(card.to)}
                style={{
                  background: "#162032",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: card.bg, display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "10px",
                  }}
                >
                  <Icon style={{ width: "18px", height: "18px", color: card.color }} />
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#F1F5F9", lineHeight: 1 }}>
                  {isLoading ? (
                    <div style={{ width: "40px", height: "24px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" }} />
                  ) : card.value}
                </div>
                <div style={{ fontSize: "11px", fontWeight: "600", color: card.color, marginTop: "4px" }}>{card.label}</div>
                <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>{card.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", letterSpacing: "1px", marginBottom: "10px" }}>
          QUICK ACTIONS
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                style={{
                  background: "#162032",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "38px", height: "38px", borderRadius: "10px",
                    background: `${action.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: "18px", height: "18px", color: action.color }} />
                </div>
                <span style={{ fontSize: "15px", fontWeight: "600", color: "#F1F5F9" }}>{action.label}</span>
                <div style={{ marginLeft: "auto" }}>
                  <CheckCircle2 style={{ width: "16px", height: "16px", color: "#334155" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
