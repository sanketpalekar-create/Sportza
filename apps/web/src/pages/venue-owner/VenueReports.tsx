/**
 * Reports (Venue Owner) — Monthly venue report
 * Select venue + month → booking count, total amount, commission, venue net
 * API: GET /api/reports/venues/:venueId/monthly?year=&month=
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, IndianRupee, Calendar, Percent, Building2,
  ChevronDown, TrendingUp, ChevronLeft,
} from "lucide-react";
import { useMyVenues, useVenueMonthlyReport } from "@sportza/api-client";
import { format, subMonths } from "date-fns";

function StatCard({
  label, value, icon: Icon, color, bg,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
      <div className="flex items-center justify-center mb-3"
        style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: bg }}>
        <Icon style={{ width: "18px", height: "18px", color }} />
      </div>
      <div className="text-white mb-0.5" style={{ fontSize: "20px", fontWeight: "800" }}>{value}</div>
      <div className="text-[#64748B]" style={{ fontSize: "11px" }}>{label}</div>
    </div>
  );
}

const now = new Date();

function buildMonthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      label: format(d, "MMMM yyyy"),
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
    };
  });
}

export default function VenueReports() {
  const navigate = useNavigate();
  const MONTH_OPTIONS = buildMonthOptions();

  const [selectedVenueId, setSelectedVenueId] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState(0); // index into MONTH_OPTIONS

  const { data: venuesRes, isLoading: venuesLoading } = useMyVenues();
  const venues: any[] = (venuesRes as any)?.data ?? (venuesRes as any)?.venues ?? (Array.isArray(venuesRes) ? venuesRes : []);

  const mo = MONTH_OPTIONS[selectedMonth];
  const venueId = selectedVenueId || (venues[0]?.id ?? 0);

  const { data: reportRes, isLoading: reportLoading } = useVenueMonthlyReport({
    venueId,
    year:  mo.year,
    month: mo.month,
  });

  const report: any = (reportRes as any)?.data ?? reportRes ?? {};
  const bookingCount = report?.bookingCount ?? report?.bookings ?? 0;
  const totalAmount  = report?.totalAmount  ?? report?.revenue   ?? 0;
  const commission   = report?.commission   ?? totalAmount * 0.1;
  const venueNet     = report?.venueNet     ?? report?.netRevenue ?? totalAmount - commission;

  const hasData = bookingCount > 0 || totalAmount > 0;

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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-5">
        <button
          onClick={() => navigate("/venue-owner")}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 style={{ width: "18px", height: "18px", color: "#8B5CF6" }} />
            <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Reports</h1>
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Monthly revenue breakdown by venue</p>
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* Selectors */}
        <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          {/* Venue picker */}
          <div>
            <label
              style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8",
                       marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              <Building2 style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
              Select Venue
            </label>
            <div className="relative">
              {venuesLoading ? (
                <div className="animate-pulse h-10 rounded-xl" style={{ backgroundColor: "#0F172A" }} />
              ) : (
                <select
                  value={selectedVenueId || venueId}
                  onChange={(e) => setSelectedVenueId(parseInt(e.target.value, 10))}
                  style={selectSt}
                >
                  {venues.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
              <ChevronDown style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#475569", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Month picker */}
          <div>
            <label
              style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8",
                       marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              <Calendar style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
              Select Month
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                style={selectSt}
              >
                {MONTH_OPTIONS.map((m, i) => (
                  <option key={i} value={i}>{m.label}</option>
                ))}
              </select>
              <ChevronDown style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#475569", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {/* Report */}
        {venueId > 0 && (
          <>
            {reportLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse h-24 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
                ))}
              </div>
            ) : !hasData ? (
              <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
                <BarChart3 style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
                <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>No data</p>
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                  No bookings recorded for {mo.label}.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Bookings"         value={bookingCount}                          icon={Calendar}     color="#3B82F6" bg="rgba(59,130,246,0.12)" />
                  <StatCard label="Total Revenue"    value={`₹${totalAmount.toLocaleString()}`}   icon={IndianRupee}  color="#22C55E" bg="rgba(34,197,94,0.12)"  />
                  <StatCard label="Commission"       value={`₹${commission.toLocaleString()}`}    icon={Percent}      color="#F59E0B" bg="rgba(245,158,11,0.12)" />
                  <StatCard label="Venue Net"        value={`₹${venueNet.toLocaleString()}`}      icon={TrendingUp}   color="#8B5CF6" bg="rgba(139,92,246,0.12)" />
                </div>

                {/* Payout summary */}
                <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
                  <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>Payout Summary</p>
                  {[
                    { label: "Gross Revenue",       value: `₹${totalAmount.toLocaleString()}`,  color: "#F1F5F9"  },
                    { label: "Platform Commission", value: `– ₹${commission.toLocaleString()}`, color: "#EF4444"  },
                    { label: "Venue Net Revenue",   value: `₹${venueNet.toLocaleString()}`,     color: "#22C55E"  },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-2.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-[#94A3B8]" style={{ fontSize: "14px" }}>{row.label}</span>
                      <span style={{ fontSize: "15px", fontWeight: "700", color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {venues.length === 0 && !venuesLoading && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
              You don't have any venues yet. Add a venue to see reports.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
