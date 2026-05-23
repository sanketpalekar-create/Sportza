import { useState } from "react";
import { useTrainerPayments, useTrainerMonthlyReport } from "@sportza/api-client";
import {
  IndianRupee, Wallet, Clock, Calendar, CheckCircle2, AlertCircle,
  BarChart3, Percent, TrendingUp, ChevronDown,
} from "lucide-react";
import { format, subMonths } from "date-fns";

const now = new Date();
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(now, i);
  return { label: format(d, "MMMM yyyy"), year: d.getFullYear(), month: d.getMonth() + 1 };
});

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: format(new Date(2024, i, 1), "MMMM"),
}));

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="flex items-center justify-center mb-2"
        style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: bg }}>
        <Icon style={{ width: "18px", height: "18px", color }} />
      </div>
      <div className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>{value}</div>
      <div className="text-[#64748B]" style={{ fontSize: "11px" }}>{label}</div>
    </div>
  );
}

export default function TrainerPayments() {
  const [tab, setTab] = useState<"overview" | "pending" | "completed">("overview");
  const [monthIdx, setMonthIdx] = useState(0);

  const mo = MONTH_OPTIONS[monthIdx];
  const { data: monthlyRes, isLoading: monthlyLoading } = useTrainerMonthlyReport({ year: mo.year, month: mo.month });
  const monthly: any = (monthlyRes as any)?.data ?? monthlyRes ?? {};

  const { data: paymentsRes, isLoading: listLoading } = useTrainerPayments({ limit: 100 });
  const allPayments: any[] = (paymentsRes as any)?.data ?? [];

  const displayPayments = allPayments.filter((p: any) =>
    tab === "pending" ? p.status !== "completed" : p.status === "completed"
  );

  const collected = allPayments.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + (p.trainerNetAmount ?? p.amount ?? 0), 0);
  const pending   = allPayments.filter((p: any) => p.status !== "completed").reduce((s: number, p: any) => s + (p.trainerNetAmount ?? p.amount ?? 0), 0);

  const paymentCount  = monthly?.paymentCount  ?? monthly?.count   ?? 0;
  const totalAmount   = monthly?.totalAmount   ?? monthly?.total   ?? 0;
  const commission    = monthly?.commission    ?? totalAmount * 0.1;
  const trainerNet    = monthly?.trainerNet    ?? monthly?.netRevenue ?? totalAmount - commission;

  const selectSt: React.CSSProperties = {
    backgroundColor: "#1E293B",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    color: "#F1F5F9",
    fontSize: "14px",
    padding: "10px 32px 10px 12px",
    outline: "none",
    width: "100%",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Earnings</h1>
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Track your revenue & collections</p>
      </div>

      <div className="px-4 space-y-5 max-w-md mx-auto">
        {/* View tabs */}
        <div className="flex gap-2">
          {(["overview", "pending", "completed"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5"
              style={{ borderRadius: "10px", fontSize: "12px", fontWeight: tab === t ? "700" : "500",
                backgroundColor: tab === t ? "#3B82F6" : "#1E293B",
                color: tab === t ? "#fff" : "#64748B",
                border: tab === t ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
              {t === "overview" ? "Monthly" : t === "pending" ? "Pending" : "Collected"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB: monthly report ── */}
        {tab === "overview" && (
          <>
            {/* Month selector */}
            <div className="relative">
              <select
                value={monthIdx}
                onChange={(e) => setMonthIdx(parseInt(e.target.value, 10))}
                style={selectSt}
              >
                {MONTH_OPTIONS.map((m, i) => (
                  <option key={i} value={i}>{m.label}</option>
                ))}
              </select>
              <ChevronDown style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#475569", pointerEvents: "none" }} />
            </div>

            {monthlyLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map((i) => <div key={i} className="animate-pulse h-24 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Payments"    value={String(paymentCount)}                icon={BarChart3}    color="#3B82F6" bg="rgba(59,130,246,0.12)"  />
                  <StatCard label="Total Amount" value={`₹${totalAmount.toLocaleString()}`} icon={IndianRupee}  color="#22C55E" bg="rgba(34,197,94,0.12)"   />
                  <StatCard label="Commission"   value={`₹${commission.toLocaleString()}`}  icon={Percent}      color="#F59E0B" bg="rgba(245,158,11,0.12)"  />
                  <StatCard label="Your Net"     value={`₹${trainerNet.toLocaleString()}`}  icon={TrendingUp}   color="#8B5CF6" bg="rgba(139,92,246,0.12)"  />
                </div>

                {totalAmount > 0 && (
                  <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
                    <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Payout Summary</p>
                    {[
                      { label: "Gross Amount",        value: `₹${totalAmount.toLocaleString()}`,  color: "#F1F5F9" },
                      { label: "Platform Commission",  value: `– ₹${commission.toLocaleString()}`, color: "#EF4444" },
                      { label: "Trainer Net",          value: `₹${trainerNet.toLocaleString()}`,   color: "#22C55E" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between py-2.5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{row.label}</span>
                        <span style={{ fontSize: "15px", fontWeight: "700", color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {totalAmount === 0 && (
                  <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                    <BarChart3 style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 12px" }} />
                    <p className="text-[#64748B]">No earnings recorded for {mo.label}.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── PENDING / COLLECTED TABS ── */}
        {(tab === "pending" || tab === "completed") && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Collected" value={`₹${collected.toLocaleString()}`} icon={Wallet}      color="#22C55E" bg="rgba(34,197,94,0.12)"  />
              <StatCard label="Pending"   value={`₹${pending.toLocaleString()}`}   icon={Clock}       color="#F59E0B" bg="rgba(245,158,11,0.12)" />
            </div>

            {listLoading ? (
              <div className="space-y-2">
                {[1,2,3].map((i) => <div key={i} className="animate-pulse h-20 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {displayPayments.length === 0 ? (
                  <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                    <p className="text-[#64748B]">No {tab} payments found.</p>
                  </div>
                ) : displayPayments.map((p: any) => (
                  <div key={p.id ?? p.createdAt ?? Math.random()} className="p-4"
                    style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                          {p.payer?.name ?? "Student"}
                        </p>
                        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                          {p.cycleMonth && p.cycleYear
                            ? `${MONTHS[Number(p.cycleMonth)-1]?.label ?? p.cycleMonth} ${p.cycleYear}`
                            : p.createdAt ? format(new Date(p.createdAt), "MMM yyyy") : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.status === "completed"
                          ? <CheckCircle2 style={{ width: "14px", height: "14px", color: "#22C55E" }} />
                          : <AlertCircle  style={{ width: "14px", height: "14px", color: "#F59E0B" }} />}
                        <span style={{ fontSize: "11px", fontWeight: "700",
                          color: p.status === "completed" ? "#22C55E" : "#F59E0B" }}>
                          {p.status === "completed" ? "COLLECTED" : "PENDING"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>
                        ₹{(p.trainerNetAmount ?? p.amount ?? 0).toLocaleString()}
                      </p>
                      {p.batch?.name && (
                        <span className="text-[#64748B]" style={{ fontSize: "11px" }}>{p.batch.name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
