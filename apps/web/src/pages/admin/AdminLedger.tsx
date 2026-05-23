import { useState } from "react";
import { useAdminLedger, useAdminWalletAdjust } from "@sportza/api-client";
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, PlusCircle } from "lucide-react";

function AdjustModal({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: () => void }) {
  const [userId,      setUserId]      = useState("");
  const [type,        setType]        = useState<"credit" | "debit">("credit");
  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [reason,      setReason]      = useState("");

  const adjustMutation = useAdminWalletAdjust();

  async function submit() {
    if (!userId || !amount || !description || !reason) return;
    await adjustMutation.mutateAsync({
      userId: parseInt(userId, 10),
      type,
      amount: parseFloat(amount),
      description,
      reason,
    });
    onSuccess();
    onClose();
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px", padding: "10px 12px", color: "#F1F5F9", fontSize: "14px",
    boxSizing: "border-box", marginBottom: "10px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "#64748B", marginBottom: "4px", display: "block",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9", marginBottom: "6px" }}>Wallet Adjustment</h3>
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "16px" }}>
          Amounts over ₹500 require a second admin to approve before execution.
        </p>

        <label style={labelStyle}>User ID</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Enter user ID" type="number" style={fieldStyle} />

        <label style={labelStyle}>Type</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {(["credit", "debit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: "9px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
                border: "none", cursor: "pointer",
                background: type === t
                  ? (t === "credit" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)")
                  : "rgba(255,255,255,0.05)",
                color: type === t
                  ? (t === "credit" ? "#22C55E" : "#EF4444")
                  : "#64748B",
              }}
            >
              {t === "credit" ? "Credit +" : "Debit −"}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Amount (₹)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number" min="0.01" step="0.01" style={fieldStyle} />

        <label style={labelStyle}>Description (shown in ledger)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Refund correction for booking #123" style={fieldStyle} />

        <label style={labelStyle}>Internal reason (audit trail)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this adjustment needed?" rows={2}
          style={{ ...fieldStyle, resize: "none" }} />

        <button
          onClick={submit}
          disabled={adjustMutation.isPending || !userId || !amount || !description || !reason}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: type === "credit" ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#EF4444,#B91C1C)",
            color: "#fff", fontSize: "15px", fontWeight: "700",
            opacity: adjustMutation.isPending || !userId || !amount || !description || !reason ? 0.6 : 1,
            cursor: adjustMutation.isPending ? "progress" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {adjustMutation.isPending && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
          Submit Adjustment
        </button>
      </div>
    </div>
  );
}

export default function AdminLedger() {
  const [userIdFilter, setUserIdFilter] = useState("");
  const [type, setType]                 = useState<"all" | "credit" | "debit">("all");
  const [page, setPage]                 = useState(1);
  const [showAdjust, setShowAdjust]     = useState(false);

  const params = {
    userId: userIdFilter ? parseInt(userIdFilter, 10) : undefined,
    type:   type !== "all" ? type : undefined,
    page,
  };

  const { data, isLoading, refetch } = useAdminLedger(params);
  const transactions = data?.transactions ?? [];
  const total        = data?.total ?? 0;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9" }}>Ledger & Finance</h1>
          <button
            onClick={() => setShowAdjust(true)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "12px",
              background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
              color: "#A855F7", fontSize: "13px", fontWeight: "700", cursor: "pointer",
            }}
          >
            <PlusCircle style={{ width: "14px", height: "14px" }} /> Adjust
          </button>
        </div>

        {/* Filter by user */}
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B" }} />
          <input
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
            placeholder="Filter by User ID..."
            type="number"
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px", padding: "10px 12px 10px 36px", color: "#F1F5F9", fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: "8px", paddingBottom: "12px" }}>
          {(["all", "credit", "debit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setPage(1); }}
              style={{
                padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                border: "none", cursor: "pointer",
                background: type === t
                  ? (t === "credit" ? "#22C55E" : t === "debit" ? "#EF4444" : "#A855F7")
                  : "rgba(255,255,255,0.06)",
                color: type === t ? "#fff" : "#94A3B8",
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
          {isLoading ? "Loading..." : `${total} transaction${total !== 1 ? "s" : ""}`}
        </p>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <RefreshCw style={{ width: "24px", height: "24px", color: "#A855F7" }} className="animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>No transactions found</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {transactions.map((tx: any) => (
              <div
                key={tx.id}
                style={{
                  background: "#162032", borderRadius: "14px", padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", gap: "12px",
                }}
              >
                {tx.type === "credit"
                  ? <ArrowUpCircle style={{ width: "22px", height: "22px", color: "#22C55E", flexShrink: 0 }} />
                  : <ArrowDownCircle style={{ width: "22px", height: "22px", color: "#EF4444", flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#F1F5F9" }}>{tx.description}</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>
                    {tx.user?.name ?? tx.user?.email ?? `User #${tx.userId}`} · #{tx.id}
                    {tx.referenceType && ` · ${tx.referenceType}`}
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: tx.type === "credit" ? "#22C55E" : "#EF4444" }}>
                    {tx.type === "credit" ? "+" : "−"}₹{tx.amount.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "10px", color: "#475569" }}>bal ₹{tx.balanceAfter.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 30 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>Prev</button>
            <span style={{ color: "#64748B", fontSize: "13px", lineHeight: "34px" }}>Page {page}</span>
            <button onClick={() => setPage(page + 1)} disabled={transactions.length < 30}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: transactions.length < 30 ? 0.4 : 1 }}>Next</button>
          </div>
        )}
      </div>

      {showAdjust && (
        <AdjustModal onClose={() => setShowAdjust(false)} onSuccess={refetch} />
      )}
    </div>
  );
}
