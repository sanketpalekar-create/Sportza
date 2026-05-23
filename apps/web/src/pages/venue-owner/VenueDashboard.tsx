/**
 * Venue Owner Dashboard
 * Overview: revenue, bookings, occupancy, quick navigation
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Calendar, IndianRupee, Building2,
  ChevronRight, ArrowUpRight, Clock, Users, ArrowLeft, Bell, X,
} from "lucide-react";
import { useRevenueReport, useBookingReport, useMyVenues } from "@sportza/api-client";
import { useRole } from "../../context/RoleContext";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { useVenueOwnerSocket } from "../../hooks/useVenueOwnerSocket";

// ─── CSS bar chart ────────────────────────────────────────────────────────────
function RevenueBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[#64748B]" style={{ fontSize: "11px" }}>{label}</span>
          <span className="text-[#94A3B8]" style={{ fontSize: "11px" }}>₹{value.toLocaleString()}</span>
        </div>
        <div className="w-full rounded-full" style={{ height: "6px", backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div
            className="rounded-full"
            style={{
              width: `${pct}%`,
              height: "6px",
              background: "linear-gradient(90deg,#3B82F6,#6366F1)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: bg }}
      >
        <Icon style={{ width: "20px", height: "20px", color }} />
      </div>
      <div className="text-white mb-0.5" style={{ fontSize: "22px", fontWeight: "800" }}>{value}</div>
      <div className="text-[#64748B]" style={{ fontSize: "12px" }}>{label}</div>
      {sub && <div className="text-[#22C55E] mt-1" style={{ fontSize: "11px", fontWeight: "600" }}>{sub}</div>}
    </div>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ label, sub, to, color }: { label: string; sub: string; to: string; color: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-left">
        <div className="text-white" style={{ fontSize: "15px", fontWeight: "600" }}>{label}</div>
        <div className="text-[#64748B]" style={{ fontSize: "12px" }}>{sub}</div>
      </div>
      <ChevronRight style={{ width: "18px", height: "18px", color: color }} />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VenueDashboard() {
  const navigate = useNavigate();
  const { switchRole } = useRole();
  const now         = new Date();
  const monthStart  = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd    = format(endOfMonth(now), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");

  const { data: revenueRes } = useRevenueReport({ startDate: thirtyDaysAgo, endDate: monthEnd, groupBy: "day" });
  const { data: bookingRes } = useBookingReport({ startDate: monthStart, endDate: monthEnd });

  // Venue real-time socket notifications
  const { data: venuesRes } = useMyVenues();
  const venues: Array<{ id: number }> = (venuesRes as any)?.data ?? [];
  const primaryVenueId = venues[0]?.id ?? null;

  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: string }>>([]);
  const addToast = useCallback((msg: string, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  useVenueOwnerSocket(primaryVenueId, addToast);

  const revenueData: Array<{ period?: string; total?: number }> = (revenueRes as any)?.data ?? [];
  const summary      = (revenueRes as any)?.summary ?? { totalRevenue: 0, totalBookings: 0 };
  const bookingData  = (bookingRes as any)?.data ?? {};

  const last7 = revenueData.slice(-7);
  const maxRev = Math.max(...last7.map((d) => d.total ?? 0), 1);

  const byStatus: Record<string, number> = bookingData?.byStatus ?? {};
  const confirmed  = (byStatus["confirmed"]  ?? 0) + (byStatus["fully_paid"] ?? 0);
  const pending    = (byStatus["pending"]    ?? 0) + (byStatus["pending_open_play"] ?? 0);
  const cancelled  = (byStatus["cancelled"]  ?? 0) + (byStatus["cancelled_user"] ?? 0) + (byStatus["cancelled_conflict"] ?? 0);

  const activeFacilities = Object.keys(bookingData?.byFacility ?? {}).length || 0;

  const stats = [
    {
      label: "Revenue This Month",
      value: `₹${((summary.totalRevenue ?? 0) / 1000).toFixed(1)}k`,
      sub: "↑ vs last month",
      icon: IndianRupee,
      color: "#22C55E",
      bg: "rgba(34,197,94,0.12)",
    },
    {
      label: "Total Bookings",
      value: summary.totalBookings ?? 0,
      icon: Calendar,
      color: "#3B82F6",
      bg: "rgba(59,130,246,0.12)",
    },
    {
      label: "Active Facilities",
      value: activeFacilities || "—",
      icon: Building2,
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.12)",
    },
    {
      label: "Confirmed",
      value: confirmed,
      icon: TrendingUp,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* ── Header ── */}
      <div className="px-4 pt-8 pb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => { switchRole("player"); navigate("/"); }}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft style={{ width: "14px", height: "14px", color: "#94A3B8" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Back to App</span>
          </button>
          <div
            className="px-3 py-1.5"
            style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B" }}>VENUE OWNER</span>
          </div>
        </div>
        <div>
          <h1 className="text-white" style={{ fontSize: "26px", fontWeight: "800" }}>Venue Dashboard</h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            {format(now, "MMMM yyyy")} · Overview
          </p>
        </div>
      </div>

      <div className="px-4 space-y-5 max-w-md mx-auto">
        {/* ── Stat grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* ── Revenue chart (last 7 days) ── */}
        {last7.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Revenue — Last 7 Days</span>
              <ArrowUpRight style={{ width: "16px", height: "16px", color: "#22C55E" }} />
            </div>
            <div className="space-y-3">
              {last7.map((d, i) => (
                <RevenueBar
                  key={i}
                  label={d.period ? format(new Date(d.period), "dd MMM") : `Day ${i + 1}`}
                  value={d.total ?? 0}
                  max={maxRev}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Booking status breakdown ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Bookings This Month</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Confirmed", value: confirmed,  color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
              { label: "Pending",   value: pending,    color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
              { label: "Cancelled", value: cancelled,  color: "#EF4444", bg: "rgba(239,68,68,0.1)"  },
            ].map((s) => (
              <div key={s.label} className="text-center p-3" style={{ borderRadius: "12px", backgroundColor: s.bg }}>
                <div style={{ fontSize: "20px", fontWeight: "800", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Monthly booking summary ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock style={{ width: "16px", height: "16px", color: "#3B82F6" }} />
            <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>This Month at a Glance</p>
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
            {confirmed > 0
              ? `${confirmed} confirmed booking${confirmed > 1 ? "s" : ""} this month`
              : "No confirmed bookings yet this month."}
            {pending > 0 ? ` · ${pending} pending` : ""}
          </p>
          <button
            onClick={() => navigate("/venue-owner/bookings")}
            className="mt-3 flex items-center gap-1"
            style={{ fontSize: "13px", fontWeight: "600", color: "#3B82F6" }}
          >
            View full schedule <ChevronRight style={{ width: "14px", height: "14px" }} />
          </button>
        </div>

        {/* ── Quick actions ── */}
        <div>
          <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "13px", fontWeight: "500" }}>Quick Actions</p>
          <div className="space-y-3">
            <QuickAction label="My Venues"          sub="View, add & edit your venues"        to="/venue-owner/venues"     color="#F59E0B" />
            <QuickAction label="Manage Bookings"    sub="View and track all bookings"         to="/venue-owner/bookings"   color="#3B82F6" />
            <QuickAction label="Facilities & Slots" sub="Courts, pricing, availability"       to="/venue-owner/facilities" color="#22C55E" />
            <QuickAction label="Reports"            sub="Monthly revenue breakdown"           to="/venue-owner/reports"    color="#8B5CF6" />
            <QuickAction label="Payments & Revenue" sub="Transactions, payouts & commission"  to="/venue-owner/payments"   color="#EC4899" />
            <QuickAction label="Court Displays"     sub="TV scoreboards & live screens"       to="/venue-owner/displays"   color="#06B6D4" />
          </div>
        </div>

        {/* ── Insight banner ── */}
        <div
          className="flex items-start gap-3 p-4"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,rgba(59,130,246,0.12),rgba(99,102,241,0.12))", border: "1px solid rgba(99,102,241,0.25)" }}
        >
          <Users style={{ width: "18px", height: "18px", color: "#6366F1", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Boost Occupancy</p>
            <p className="text-[#94A3B8]" style={{ fontSize: "13px", lineHeight: "1.5" }}>
              Slots before 8 AM and after 8 PM are typically underbooked. Consider off-peak pricing.
            </p>
          </div>
        </div>
      </div>

      {/* ── Real-time toasts ── */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-xs">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 px-4 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: t.type === "success" ? "rgba(34,197,94,0.15)" : t.type === "warning" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                border: `1px solid ${t.type === "success" ? "rgba(34,197,94,0.4)" : t.type === "warning" ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)"}`,
                backdropFilter: "blur(8px)",
              }}
            >
              <Bell style={{ width: "16px", height: "16px", color: t.type === "success" ? "#22C55E" : t.type === "warning" ? "#EF4444" : "#3B82F6", flexShrink: 0, marginTop: "1px" }} />
              <p style={{ fontSize: "13px", color: "#F1F5F9", flex: 1, lineHeight: "1.5" }}>{t.msg}</p>
              <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}>
                <X style={{ width: "14px", height: "14px", color: "#64748B" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
