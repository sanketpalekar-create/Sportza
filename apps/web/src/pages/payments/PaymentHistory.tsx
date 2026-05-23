import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaymentHistory, useWallet, useWalletTransactions } from "@sportza/api-client";
import { format } from "date-fns";
import { IndianRupee, ChevronRight, CheckCircle2, XCircle, Clock, Receipt, Wallet, TrendingUp, TrendingDown } from "lucide-react";

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  paid:    { color: "#22C55E", bg: "rgba(34,197,94,0.12)",   icon: CheckCircle2, label: "Paid"    },
  failed:  { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   icon: XCircle,      label: "Failed"  },
  pending: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: Clock,        label: "Pending" },
  refunded:{ color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",  icon: CheckCircle2, label: "Refunded"},
};

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  padel: "🎾", basketball: "🏀", volleyball: "🏐", pickleball: "🏓",
};

export default function PaymentHistory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"payments" | "wallet">("payments");
  const { data: res, isLoading, isError } = usePaymentHistory({ page: 1, limit: 50 });
  const { data: walletRes } = useWallet();
  const { data: walletTxRes, isLoading: walletLoading } = useWalletTransactions({ page: 1, limit: 30 });
  const payments: any[] = (res as any)?.data ?? [];
  const walletBalance: number = (walletRes as any)?.data?.balance ?? 0;
  const walletTxItems: any[] = (walletTxRes as any)?.data ?? [];

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Payments & Wallet</h1>
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{payments.length} transaction{payments.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* Summary cards row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total paid card */}
          <div className="p-4 flex items-center gap-3"
            style={{ borderRadius: "18px", background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(37,99,235,0.08))", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div className="flex items-center justify-center flex-shrink-0"
              style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(59,130,246,0.15)" }}>
              <IndianRupee style={{ width: "20px", height: "20px", color: "#3B82F6" }} />
            </div>
            <div>
              <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Total Paid</p>
              <p className="text-white" style={{ fontSize: "20px", fontWeight: "900" }}>₹{totalPaid.toLocaleString()}</p>
            </div>
          </div>

          {/* Wallet balance card */}
          <button
            onClick={() => setActiveTab("wallet")}
            className="p-4 flex items-center gap-3 w-full text-left"
            style={{ borderRadius: "18px", background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.08))", border: `1px solid ${activeTab === "wallet" ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.2)"}` }}>
            <div className="flex items-center justify-center flex-shrink-0"
              style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)" }}>
              <Wallet style={{ width: "20px", height: "20px", color: "#22C55E" }} />
            </div>
            <div>
              <p className="text-[#64748B]" style={{ fontSize: "11px" }}>Sportza Wallet</p>
              <p className="text-white" style={{ fontSize: "20px", fontWeight: "900" }}>₹{walletBalance.toFixed(0)}</p>
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
          {(["payments", "wallet"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5"
              style={{
                borderRadius: "11px",
                fontSize: "13px",
                fontWeight: "700",
                backgroundColor: activeTab === tab ? "#0F172A" : "transparent",
                color: activeTab === tab ? "#FFFFFF" : "#64748B",
                transition: "all 0.2s",
              }}
            >
              {tab === "payments" ? "Payment History" : "Wallet Ledger"}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading && [1,2,3,4].map((i) => (
          <div key={i} className="animate-pulse h-24 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {isError && (
          <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#EF4444]">Failed to load payment history.</p>
          </div>
        )}

        {/* ── Payment History Tab ── */}
        {activeTab === "payments" && (
          <>
            {isLoading && [1,2,3,4].map((i) => (
              <div key={i} className="animate-pulse h-24 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
            ))}

            {isError && (
              <div className="p-8 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
                <p className="text-[#EF4444]">Failed to load payment history.</p>
              </div>
            )}

            {!isLoading && !isError && payments.length === 0 && (
              <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
                <Receipt style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
                <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No payments yet</p>
                <p className="text-[#64748B]" style={{ fontSize: "14px" }}>Your payment history will appear here</p>
              </div>
            )}

            {!isLoading && !isError && payments.map((p: any) => {
              const style = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending;
              const StatusIcon = style.icon;
              const sportName = (p.booking?.sport ?? "").toLowerCase();
              const emoji = SPORT_EMOJI[sportName] ?? "🎯";

              return (
                <button key={p.id} onClick={() => p.booking?.id && navigate(`/bookings/${p.booking.id}`)}
                  className="w-full p-4 text-left hover:bg-white/5 transition-colors"
                  style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center flex-shrink-0"
                      style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.05)", fontSize: "22px" }}>
                      {emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>
                          ₹{(p.amount ?? 0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 px-2 py-0.5"
                          style={{ borderRadius: "6px", backgroundColor: style.bg }}>
                          <StatusIcon style={{ width: "10px", height: "10px", color: style.color }} />
                          <span style={{ fontSize: "10px", fontWeight: "800", color: style.color }}>{style.label.toUpperCase()}</span>
                        </div>
                      </div>
                      <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                        {p.booking?.sport ?? "—"} · {p.booking?.facilityName ?? "—"}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[#475569]" style={{ fontSize: "11px" }}>
                          Ref #{p.booking?.id ?? "—"} · {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "—"}
                        </p>
                        {p.booking?.id && <ChevronRight style={{ width: "14px", height: "14px", color: "#334155" }} />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ── Wallet Ledger Tab ── */}
        {activeTab === "wallet" && (
          <>
            {/* Balance hero */}
            <div className="p-5 text-center"
              style={{ borderRadius: "20px", background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.06))", border: "1px solid rgba(34,197,94,0.25)" }}>
              <Wallet style={{ width: "32px", height: "32px", color: "#22C55E", margin: "0 auto 8px" }} />
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Available Balance</p>
              <p className="text-white" style={{ fontSize: "36px", fontWeight: "900", letterSpacing: "-1px" }}>
                ₹{walletBalance.toFixed(2)}
              </p>
              <p className="text-[#64748B] mt-1" style={{ fontSize: "11px" }}>
                Sportza Wallet — used for host adjustments and session credits
              </p>
            </div>

            {walletLoading && [1,2,3].map((i) => (
              <div key={i} className="animate-pulse h-16 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
            ))}

            {!walletLoading && walletTxItems.length === 0 && (
              <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
                <Wallet style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
                <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>No wallet activity yet</p>
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Credits from open play adjustments will appear here</p>
              </div>
            )}

            {!walletLoading && walletTxItems.map((tx: any) => {
              const isCredit = tx.type === "credit";
              return (
                <div key={tx.id}
                  className="p-4 flex items-center gap-3"
                  style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "40px", height: "40px", borderRadius: "12px",
                      backgroundColor: isCredit ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    }}>
                    {isCredit
                      ? <TrendingUp style={{ width: "18px", height: "18px", color: "#22C55E" }} />
                      : <TrendingDown style={{ width: "18px", height: "18px", color: "#EF4444" }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white" style={{ fontSize: "14px", fontWeight: "600" }}>
                      {tx.description}
                    </p>
                    <p className="text-[#64748B]" style={{ fontSize: "11px" }}>
                      {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yyyy, h:mm a") : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{ fontSize: "16px", fontWeight: "800", color: isCredit ? "#22C55E" : "#EF4444" }}>
                      {isCredit ? "+" : "-"}₹{(tx.amount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[#475569]" style={{ fontSize: "10px" }}>
                      Balance: ₹{(tx.balanceAfter ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
