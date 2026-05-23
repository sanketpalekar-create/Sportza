import { useState } from "react";
import {
  useAdminOnboarding, useAdminUsers,
  useAdminApproveTrainer, useAdminApproveOwner,
  useAdminRejectOnboarding, useAdminOffboardUser,
} from "@sportza/api-client";
import { CheckCircle2, XCircle, RefreshCw, UserMinus, Search } from "lucide-react";

type FilterMode = "all" | "trainer" | "owner" | "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    approved: { color: "#22C55E", bg: "rgba(34,197,94,0.12)",   label: "Approved" },
    rejected: { color: "#EF4444", bg: "rgba(239,68,68,0.12)",   label: "Rejected" },
    pending:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  label: "Pending"  },
  };
  const s = map[status ?? ""] ?? { color: "#64748B", bg: "rgba(100,116,139,0.12)", label: "None" };
  return (
    <span style={{ fontSize: "10px", fontWeight: "700", color: s.color, background: s.bg, borderRadius: "6px", padding: "2px 7px" }}>
      {s.label}
    </span>
  );
}

function ActionModal({
  title, body, placeholder, onConfirm, onClose, loading, confirmLabel, confirmColor,
}: {
  title: string; body: string; placeholder?: string;
  onConfirm: (note: string) => void; onClose: () => void;
  loading: boolean; confirmLabel?: string; confirmColor?: string;
}) {
  const [note, setNote] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9", marginBottom: "8px" }}>{title}</h3>
        <p style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "16px" }}>{body}</p>
        {placeholder && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={placeholder}
            rows={3}
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "10px 12px", color: "#F1F5F9", fontSize: "14px",
              resize: "none", marginBottom: "16px", boxSizing: "border-box",
            }}
          />
        )}
        <button
          onClick={() => onConfirm(note)}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: `linear-gradient(135deg,${confirmColor ?? "#22C55E"},${confirmColor ?? "#22C55E"}cc)`,
            color: "#fff", fontSize: "15px", fontWeight: "700",
            opacity: loading ? 0.7 : 1, cursor: loading ? "progress" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {loading && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
          {confirmLabel ?? "Confirm"}
        </button>
      </div>
    </div>
  );
}

// ── Shared action buttons row ──────────────────────────────────────────────────
function UserActionButtons({ user, onAction }: {
  user: any;
  onAction: (type: string, userId: number, userName: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
      <button
        onClick={() => onAction("approve-trainer", user.id, user.name ?? user.email)}
        style={{ padding: "7px 12px", borderRadius: "9px", fontSize: "12px", fontWeight: "700", color: "#22C55E", background: "rgba(34,197,94,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
      >
        <CheckCircle2 style={{ width: "12px", height: "12px" }} /> Approve Trainer
      </button>
      <button
        onClick={() => onAction("approve-owner", user.id, user.name ?? user.email)}
        style={{ padding: "7px 12px", borderRadius: "9px", fontSize: "12px", fontWeight: "700", color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
      >
        <CheckCircle2 style={{ width: "12px", height: "12px" }} /> Approve Owner
      </button>
      <button
        onClick={() => onAction("reject", user.id, user.name ?? user.email)}
        style={{ padding: "7px 12px", borderRadius: "9px", fontSize: "12px", fontWeight: "700", color: "#EF4444", background: "rgba(239,68,68,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
      >
        <XCircle style={{ width: "12px", height: "12px" }} /> Reject
      </button>
      <button
        onClick={() => onAction("offboard", user.id, user.name ?? user.email)}
        style={{ padding: "7px 12px", borderRadius: "9px", fontSize: "12px", fontWeight: "700", color: "#94A3B8", background: "rgba(148,163,184,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
      >
        <UserMinus style={{ width: "12px", height: "12px" }} /> Offboard
      </button>
    </div>
  );
}

export default function AdminOnboarding() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [modal, setModal]   = useState<null | { type: string; userId: number; userName: string }>(null);

  // Search state — for finding any user to directly onboard
  const [searchQ, setSearchQ]         = useState("");
  const [showSearch, setShowSearch]   = useState(false);

  const queueParams = {
    status: ["pending", "approved", "rejected"].includes(filter) ? filter : undefined,
    role:   filter === "trainer" ? "trainer" : filter === "owner" ? "venue_owner" : undefined,
  };

  const { data, isLoading, refetch } = useAdminOnboarding(queueParams);

  // Always-on pending count for the badge (independent of active filter)
  const { data: pendingData } = useAdminOnboarding({ status: "pending" });
  const pendingCount = pendingData?.total ?? 0;

  // Search query — only fires when search is active
  const { data: searchData, isLoading: searchLoading } = useAdminUsers(
    showSearch && searchQ.length >= 2 ? { q: searchQ } : undefined
  );

  const approveTrMutation  = useAdminApproveTrainer();
  const approveOwMutation  = useAdminApproveOwner();
  const rejectMutation     = useAdminRejectOnboarding();
  const offboardMutation   = useAdminOffboardUser();

  const users   = data?.users ?? [];
  const loading = approveTrMutation.isPending || approveOwMutation.isPending || rejectMutation.isPending || offboardMutation.isPending;

  async function handleConfirm(note: string) {
    if (!modal) return;
    if (modal.type === "approve-trainer") {
      await approveTrMutation.mutateAsync({ id: modal.userId, note });
    } else if (modal.type === "approve-owner") {
      await approveOwMutation.mutateAsync({ id: modal.userId, note });
    } else if (modal.type === "reject") {
      await rejectMutation.mutateAsync({ id: modal.userId, reason: note });
    } else if (modal.type === "offboard") {
      await offboardMutation.mutateAsync({ id: modal.userId, reason: note });
    }
    setModal(null);
    setSearchQ("");
    setShowSearch(false);
    refetch();
  }

  const filters: { key: FilterMode; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "pending",  label: "Pending" },
    { key: "trainer",  label: "Trainers" },
    { key: "owner",    label: "Owners" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  const searchResults: any[] = searchData?.users ?? [];

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9" }}>
            Onboarding / Offboarding
          </h1>
          {/* Toggle search */}
          <button
            onClick={() => { setShowSearch((v) => !v); setSearchQ(""); }}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", borderRadius: "12px",
              background: showSearch ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
              border: showSearch ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: showSearch ? "#3B82F6" : "#94A3B8",
              fontSize: "13px", fontWeight: "700", cursor: "pointer",
            }}
          >
            <Search style={{ width: "14px", height: "14px" }} />
            {showSearch ? "Cancel" : "Find User"}
          </button>
        </div>

        {/* User search panel */}
        {showSearch && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B" }} />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search by name, email or phone to onboard directly..."
                autoFocus
                style={{
                  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "12px", padding: "10px 12px 10px 36px", color: "#F1F5F9", fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {searchQ.length >= 2 && (
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {searchLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                    <RefreshCw style={{ width: "20px", height: "20px", color: "#3B82F6" }} className="animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#475569", textAlign: "center", padding: "16px 0" }}>No users found</p>
                ) : (
                  searchResults.map((user: any) => (
                    <div
                      key={user.id}
                      style={{ background: "#1E293B", borderRadius: "14px", padding: "14px 16px", border: "1px solid rgba(59,130,246,0.15)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                          background: "rgba(255,255,255,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px", fontWeight: "700", color: "#94A3B8",
                        }}>
                          {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#F1F5F9" }}>{user.name ?? "—"}</div>
                          <div style={{ fontSize: "11px", color: "#64748B" }}>{user.email} · role: {user.role}</div>
                        </div>
                        {user.onboardingStatus && <StatusBadge status={user.onboardingStatus} />}
                      </div>
                      <UserActionButtons user={user} onAction={(type, userId, userName) => setModal({ type, userId, userName })} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Filter tabs */}
        {!showSearch && (
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px" }}>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                  whiteSpace: "nowrap", flexShrink: 0, border: "none", cursor: "pointer",
                  background: filter === f.key ? "#F59E0B" : "rgba(255,255,255,0.06)",
                  color:      filter === f.key ? "#0F172A" : "#94A3B8",
                }}
              >
                {f.label}
                {f.key === "pending" && pendingCount > 0 && filter !== "pending" && (
                  <span style={{ marginLeft: "5px", background: "#F59E0B", color: "#0F172A", borderRadius: "999px", fontSize: "10px", fontWeight: "800", padding: "1px 5px" }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Queue list — hidden while search is active */}
      {!showSearch && (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
            {isLoading ? "Loading..." : `${data?.total ?? 0} record${data?.total !== 1 ? "s" : ""}`}
          </p>

          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <RefreshCw style={{ width: "24px", height: "24px", color: "#F59E0B" }} className="animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
              {filter === "pending"
                ? "No pending applications. Players who apply for a role will appear here."
                : "No records found"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {users.map((user: any) => (
                <div
                  key={user.id}
                  style={{
                    background: "#162032", borderRadius: "16px", padding: "16px",
                    border: user.onboardingStatus === "pending"
                      ? "1px solid rgba(245,158,11,0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#F1F5F9" }}>{user.name ?? "—"}</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>{user.email}</div>
                    </div>
                    <StatusBadge status={user.onboardingStatus} />
                  </div>

                  <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>
                    Current role: <span style={{ color: "#F1F5F9", fontWeight: "600" }}>{user.role}</span>
                    {user.onboardingNote && (
                      <span style={{ color: "#64748B" }}> · applied for: <strong style={{ color: "#F59E0B" }}>{user.onboardingNote}</strong></span>
                    )}
                  </div>

                  {user.trainerProfile && (
                    <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px" }}>
                      Trainer profile · rating {user.trainerProfile.rating?.toFixed(1) ?? "N/A"}
                    </div>
                  )}
                  {user.ownedVenues?.length > 0 && (
                    <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px" }}>
                      Venues: {user.ownedVenues.map((v: any) => v.name).join(", ")}
                    </div>
                  )}
                  {user.onboardingNote && user.onboardingStatus !== "pending" && (
                    <div style={{ fontSize: "11px", color: "#94A3B8", fontStyle: "italic", marginBottom: "8px" }}>
                      Note: {user.onboardingNote}
                    </div>
                  )}

                  <UserActionButtons user={user} onAction={(type, userId, userName) => setModal({ type, userId, userName })} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <ActionModal
          title={
            modal.type === "approve-trainer" ? "Approve as Trainer"
            : modal.type === "approve-owner" ? "Approve as Venue Owner"
            : modal.type === "reject" ? "Reject Application"
            : "Offboard User"
          }
          body={
            modal.type === "approve-trainer"
              ? `Approve "${modal.userName}" as a trainer? Their role will be updated and a trainer profile provisioned.`
            : modal.type === "approve-owner"
              ? `Approve "${modal.userName}" as a venue owner?`
            : modal.type === "reject"
              ? `Reject the application for "${modal.userName}". Please provide a reason.`
            : `Offboard "${modal.userName}"? This is high-risk and will be queued for a second admin to approve.`
          }
          placeholder={
            modal.type === "approve-trainer" || modal.type === "approve-owner"
              ? "Optional note..."
              : "Reason (required)..."
          }
          confirmLabel={
            modal.type === "approve-trainer" ? "Approve as Trainer"
            : modal.type === "approve-owner" ? "Approve as Owner"
            : modal.type === "reject" ? "Reject"
            : "Queue Offboarding"
          }
          confirmColor={
            modal.type === "approve-trainer" ? "#22C55E"
            : modal.type === "approve-owner" ? "#F59E0B"
            : "#EF4444"
          }
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          loading={loading}
        />
      )}
    </div>
  );
}
