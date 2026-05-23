/**
 * Venue Payments & Revenue
 * Revenue stats, chart, recent transactions
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee, TrendingUp, Percent, Wallet,
  Calendar, ArrowUpRight, CheckCircle2, XCircle, Clock, ChevronLeft,
} from "lucide-react";
import { useRevenueReport, useVenueOwnerBookings } from "@sportza/api-client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const COMMISSION_RATE = 0.1;

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="flex items-center justify-center mb-3"
        style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: bg }}>
        <Icon style={{ width: "18px", height: "18px", color }} />
      </div>
      <div className="text-white mb-0.5" style={{ fontSize: "20px", fontWeight: "800" }}>{value}</div>
      <div className="text-[#64748B]" style={{ fontSize: "11px" }}>{label}</div>
      {sub && <div style={{ fontSize: "11px", fontWeight: "600", color, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

// ─── CSS bar chart row ────────────────────────────────────────────────────────
function RevBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[#64748B]" style={{ fontSize: "11px" }}>{label}</span>
        <span className="text-[#94A3B8]" style={{ fontSize: "11px" }}>₹{value.toLocaleString()}</span>
      </div>
      <div className="w-full rounded-full" style={{ height: "6px", backgroundColor: "rgba(255,255,255,0.06)" }}>
        <div className="rounded-full" style={{
          width: `${pct}%`, height: "6px",
          background: "linear-gradient(90deg,#22C55E,#16A34A)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ date, customer, facility, amount, status }: {
  date?: string; customer: string; facility: string; amount: number; status: string;
}) {
  const s = status?.toLowerCase();
  const [color, icon] = s === "confirmed" || s === "paid" || s === "completed"
    ? ["#22C55E", CheckCircle2]
    : s === "cancelled" || s === "failed"
    ? ["#EF4444", XCircle]
    : ["#F59E0B", Clock];
  const StatusIcon = icon;

  return (
    <div className="flex items-center justify-between py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${color}18` }}>
          <StatusIcon style={{ width: "16px", height: "16px", color }} />
        </div>
        <div>
          <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>{customer}</p>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {facility} · {date ? format(new Date(date), "dd MMM") : "—"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>₹{amount.toLocaleString()}</p>
        <p style={{ fontSize: "10px", fontWeight: "600", color, textTransform: "uppercase" }}>{status}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VenuePayments() {
  const navigate = useNavigate();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const { data: revenueRes } = useRevenueReport({ startDate: dateFrom, endDate: dateTo, groupBy: "day" });
  const { data: bookingsRes } = useVenueOwnerBookings({ startDate: dateFrom, endDate: dateTo, limit: 20 });

  const revenueData: Array<{ period?: string; total?: number }> = (revenueRes as any)?.data ?? [];
  const summary      = (revenueRes as any)?.summary ?? { totalRevenue: 0, totalBookings: 0 };
  const totalRevenue = summary.totalRevenue ?? 0;
  const commission   = totalRevenue * COMMISSION_RATE;
  const netRevenue   = totalRevenue - commission;

  const bookings: Array<Record<string, any>> = (bookingsRes as any)?.data ?? [];
  const transactions = bookings.map((b) => ({
    id:       b.id as number,
    date:     String(b.bookingDate ?? b.createdAt ?? ""),
    customer: (b.user as any)?.name ?? (b.user as any)?.email ?? "—",
    facility: String(b.facilityName ?? "—"),
    amount:   Number(b.totalAmount ?? 0),
    status:   String(b.status ?? "—"),
  }));

  const last14 = revenueData.slice(-14);
  const maxRev = Math.max(...last14.map((d) => d.total ?? 0), 1);

  const inputStyle: React.CSSProperties = {
    backgroundColor: "#1E293B",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#F1F5F9",
    fontSize: "13px",
    padding: "8px 10px",
    outline: "none",
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#0F172A] px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/venue-owner")}
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
          >
            <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
          </button>
          <div>
            <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Payments & Revenue</h1>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Transactions, payouts &amp; commission</p>
          </div>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <span className="text-[#475569]">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── Stat grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Revenue"  value={`₹${totalRevenue.toLocaleString()}`} icon={IndianRupee} color="#22C55E" bg="rgba(34,197,94,0.12)" sub="↑ gross" />
          <StatCard label="Net Revenue"    value={`₹${netRevenue.toLocaleString()}`}   icon={Wallet}      color="#3B82F6" bg="rgba(59,130,246,0.12)"  />
          <StatCard label="Commission 10%" value={`₹${commission.toLocaleString()}`}   icon={Percent}     color="#F59E0B" bg="rgba(245,158,11,0.12)" />
          <StatCard label="Bookings"       value={summary.totalBookings ?? 0}          icon={Calendar}    color="#8B5CF6" bg="rgba(139,92,246,0.12)"  />
        </div>

        {/* ── Revenue chart ── */}
        {last14.length > 0 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Revenue Trend</span>
              <ArrowUpRight style={{ width: "16px", height: "16px", color: "#22C55E" }} />
            </div>
            <div className="space-y-3">
              {last14.map((d, i) => (
                <RevBar
                  key={i}
                  label={d.period ? format(new Date(d.period), "dd MMM") : `Day ${i + 1}`}
                  value={d.total ?? 0}
                  max={maxRev}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Payout summary ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Payout Summary</p>
          {[
            { label: "Gross Revenue",        value: `₹${totalRevenue.toLocaleString()}`,  color: "#F1F5F9"  },
            { label: "Platform Commission",   value: `– ₹${commission.toLocaleString()}`,  color: "#EF4444"  },
            { label: "Net Payout",            value: `₹${netRevenue.toLocaleString()}`,    color: "#22C55E"  },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{row.label}</span>
              <span style={{ fontSize: "15px", fontWeight: "700", color: row.color }}>{row.value}</span>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-2 p-3" style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <TrendingUp style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Payouts processed every 7 days to your registered bank account.</p>
          </div>
        </div>

        {/* ── Recent transactions ── */}
        <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <p className="text-white mb-1" style={{ fontSize: "15px", fontWeight: "700" }}>Recent Transactions</p>
          <p className="text-[#64748B] mb-4" style={{ fontSize: "12px" }}>{transactions.length} bookings in range</p>
          {transactions.length === 0 ? (
            <p className="text-[#475569]" style={{ fontSize: "14px" }}>No transactions found.</p>
          ) : (
            transactions.map((tx) => (
              <TxRow key={tx.id} {...tx} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
