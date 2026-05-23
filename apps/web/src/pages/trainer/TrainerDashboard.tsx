import { useNavigate } from "react-router-dom";
import { useTrainerDashboard, usePaymentReminderWhatsApp, useUnreadCount } from "@sportza/api-client";
import {
  Users, Layers, Wallet, TrendingUp,
  Star, ChevronRight, IndianRupee, ArrowLeft, AlertTriangle, MessageCircle, Bell,
} from "lucide-react";
import { useRole } from "../../context/RoleContext";
import { format } from "date-fns";

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string | number;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="flex items-center justify-center mb-3"
        style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: bg }}>
        <Icon style={{ width: "20px", height: "20px", color }} />
      </div>
      <div className="text-white mb-0.5" style={{ fontSize: "22px", fontWeight: "800" }}>{value}</div>
      <div className="text-[#64748B]" style={{ fontSize: "12px" }}>{label}</div>
    </div>
  );
}

function QuickAction({ label, sub, to, color }: { label: string; sub: string; to: string; color: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-left">
        <div className="text-white" style={{ fontSize: "15px", fontWeight: "600" }}>{label}</div>
        <div className="text-[#64748B]" style={{ fontSize: "12px" }}>{sub}</div>
      </div>
      <ChevronRight style={{ width: "18px", height: "18px", color }} />
    </button>
  );
}

export default function TrainerDashboard() {
  const navigate = useNavigate();
  const { switchRole } = useRole();
  const { data: response, isLoading } = useTrainerDashboard();
  const dashboard = (response as any)?.data;

  const batchCount      = dashboard?.batchCount      ?? 0;
  const studentCount    = dashboard?.studentCount    ?? 0;
  const totalEarnings   = dashboard?.totalEarnings   ?? 0;
  const overduePayments: Array<{
    batchId: number; batchName: string; playerId: number; playerName: string;
    playerPhone: string | null; cycleMonth: number; cycleYear: number;
  }> = dashboard?.overduePayments ?? [];
  const remindMutation = usePaymentReminderWhatsApp();
  const { data: unreadData } = useUnreadCount();
  const unreadCount: number = (unreadData as any)?.count ?? 0;
  const recentPayments: Array<{ id: number; amount?: number; trainerNetAmount?: number; createdAt?: string }> =
    dashboard?.recentPayments ?? [];
  const monthlyEarnings = recentPayments
    .filter((p) => {
      if (!p?.createdAt) return false;
      const d = new Date(p.createdAt);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    })
    .reduce((s, p) => s + (p.trainerNetAmount ?? p.amount ?? 0), 0);

  const stats = [
    { label: "Active Batches",   value: batchCount,                          icon: Layers,     color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
    { label: "Total Students",   value: studentCount,                        icon: Users,      color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
    { label: "This Month",       value: `₹${monthlyEarnings.toLocaleString()}`, icon: Wallet,  color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    { label: "Total Earnings",   value: `₹${totalEarnings.toLocaleString()}`,   icon: TrendingUp, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => { switchRole("player"); navigate("/"); }}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft style={{ width: "14px", height: "14px", color: "#94A3B8" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Back to App</span>
          </button>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              onClick={() => navigate("/notifications")}
              className="relative flex items-center justify-center"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#1E293B",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Bell style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center text-white"
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "999px",
                    backgroundColor: "#EF4444",
                    fontSize: "10px",
                    fontWeight: "800",
                    padding: "0 4px",
                    lineHeight: "18px",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <div className="px-3 py-1.5" style={{ borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#22C55E" }}>COACH MODE</span>
            </div>
          </div>
        </div>
        <h1 className="text-white" style={{ fontSize: "26px", fontWeight: "800" }}>Coach Dashboard</h1>
        <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{format(new Date(), "MMMM yyyy")} · Overview</p>
      </div>

      <div className="px-4 space-y-5 max-w-md mx-auto">
        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map((i) => <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {/* Overdue fees (no completed payment this month) */}
        {overduePayments.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle style={{ width: "18px", height: "18px", color: "#F59E0B" }} />
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Fees due this month</p>
            </div>
            <p className="text-[#64748B] mb-3" style={{ fontSize: "12px" }}>
              Students without a completed payment recorded for the current billing cycle.
            </p>
            <div className="space-y-2">
              {overduePayments.slice(0, 8).map((row) => (
                <div key={`${row.batchId}-${row.playerId}`} className="flex items-center justify-between gap-2 py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="min-w-0">
                    <p className="text-white truncate" style={{ fontSize: "13px", fontWeight: "600" }}>{row.playerName}</p>
                    <p className="text-[#64748B] truncate" style={{ fontSize: "11px" }}>{row.batchName}</p>
                  </div>
                  <button
                    type="button"
                    disabled={remindMutation.isPending || !row.playerPhone}
                    onClick={() =>
                      remindMutation.mutate(
                        { batchId: row.batchId, playerId: row.playerId },
                        {
                          onSuccess: (res: any) => {
                            const url = res?.data?.whatsappUrl;
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                            else if (res?.data?.message) alert(res.data.message);
                          },
                        }
                      )
                    }
                    className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0"
                    style={{
                      borderRadius: "8px",
                      backgroundColor: row.playerPhone ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.2)",
                      color: row.playerPhone ? "#22C55E" : "#64748B",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    <MessageCircle style={{ width: "12px", height: "12px" }} />
                    WA
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Recent Payments</p>
          {recentPayments.length === 0 ? (
            <p className="text-[#475569]" style={{ fontSize: "14px" }}>No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2">
                    <IndianRupee style={{ width: "14px", height: "14px", color: "#22C55E" }} />
                    <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                      ₹{(p.trainerNetAmount ?? p.amount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>
                    {p.createdAt ? format(new Date(p.createdAt), "dd MMM") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating teaser */}
        <button onClick={() => navigate("/trainer/reviews")}
          className="w-full flex items-center gap-3 p-4"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,179,8,0.08))", border: "1px solid rgba(245,158,11,0.25)" }}>
          <Star style={{ width: "20px", height: "20px", color: "#F59E0B", flexShrink: 0 }} />
          <div className="flex-1 text-left">
            <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>Reviews & Ratings</p>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>See what your students say</p>
          </div>
          <ChevronRight style={{ width: "16px", height: "16px", color: "#F59E0B" }} />
        </button>

        {/* Quick actions */}
        <div>
          <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "13px", fontWeight: "500" }}>Quick Actions</p>
          <div className="space-y-3">
            <QuickAction label="Create Batch"    sub="Start a new training program"    to="/trainer/batches/create" color="#22C55E" />
            <QuickAction label="My Batches"      sub="View and manage your batches"    to="/trainer/batches"        color="#3B82F6" />
            <QuickAction label="Sessions"        sub="Track attendance & schedule"     to="/trainer/sessions"       color="#8B5CF6" />
            <QuickAction label="Batch calendar"  sub="Fill rates & weekly sessions"    to="/trainer/calendar"       color="#22C55E" />
            <QuickAction label="Earnings"        sub="Payments and revenue"            to="/trainer/payments"       color="#F59E0B" />
          </div>
        </div>
      </div>
    </div>
  );
}
