import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminUsers, useAdminSuspendUser, useAdminActivateUser, useAdminChangeRole,
} from "@sportza/api-client";
import { Search, UserX, UserCheck, RefreshCw, X, ShieldAlert } from "lucide-react";

type FilterStatus = "all" | "active" | "suspended";
type FilterRole   = "all" | "player" | "coach" | "trainer" | "venue_owner" | "admin";

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin:       { color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  venue_owner: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  trainer:     { color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  coach:       { color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  player:      { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
};

function roleBadge(role: string) {
  const c = ROLE_COLORS[role] ?? { color: "#64748B", bg: "rgba(100,116,139,0.12)" };
  return (
    <span style={{
      fontSize: "10px", fontWeight: "700", color: c.color,
      background: c.bg, borderRadius: "6px", padding: "2px 7px",
    }}>
      {role.toUpperCase()}
    </span>
  );
}

// ── Confirm modal ──────────────────────────────────────────────────────────────
function ConfirmModal({
  title, body, placeholder, requireInput,
  onConfirm, onClose, loading,
}: {
  title: string; body: string; placeholder?: string;
  requireInput?: boolean; onConfirm: (val: string) => void;
  onClose: () => void; loading: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: "480px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9" }}>{title}</h3>
          <button onClick={onClose}><X style={{ width: "20px", height: "20px", color: "#64748B" }} /></button>
        </div>
        <p style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "16px" }}>{body}</p>
        {(requireInput || placeholder) && (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={placeholder ?? "Reason..."}
            rows={3}
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "10px 12px", color: "#F1F5F9", fontSize: "14px",
              resize: "none", marginBottom: "16px", boxSizing: "border-box",
            }}
          />
        )}
        <button
          onClick={() => onConfirm(val)}
          disabled={loading || (requireInput && !val.trim())}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: "linear-gradient(135deg,#EF4444,#B91C1C)",
            color: "#fff", fontSize: "15px", fontWeight: "700",
            opacity: loading || (requireInput && !val.trim()) ? 0.6 : 1,
            cursor: loading ? "progress" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {loading && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
          Confirm
        </button>
      </div>
    </div>
  );
}

const DB_ROLES = ["player", "coach", "trainer", "venue_owner", "admin"] as const;
type DbRole = typeof DB_ROLES[number];

export default function AdminAccounts() {
  const navigate = useNavigate();
  const [q, setQ]               = useState("");
  const [status, setStatus]     = useState<FilterStatus>("all");
  const [role, setRole]         = useState<FilterRole>("all");
  const [page, setPage]         = useState(1);
  const [modal, setModal]       = useState<null | { type: string; userId: number; userName: string; currentRole?: string }>(null);
  const [newRole, setNewRole]   = useState<DbRole>("player");
  const [roleReason, setRoleReason] = useState("");

  const params = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    role:   role   !== "all" ? role   : undefined,
    page,
  };

  const { data, isLoading, refetch } = useAdminUsers(params);
  const suspendMutation  = useAdminSuspendUser();
  const activateMutation = useAdminActivateUser();
  const roleMutation     = useAdminChangeRole();

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const debouncedQ = useCallback((val: string) => {
    setQ(val);
    setPage(1);
  }, []);

  function openSuspend(u: any)  { setModal({ type: "suspend",  userId: u.id, userName: u.name ?? u.email }); }
  function openActivate(u: any) { setModal({ type: "activate", userId: u.id, userName: u.name ?? u.email }); }
  function openChangeRole(u: any) {
    setNewRole(u.role as DbRole);
    setRoleReason("");
    setModal({ type: "change-role", userId: u.id, userName: u.name ?? u.email, currentRole: u.role });
  }

  async function handleConfirm(val: string) {
    if (!modal) return;
    if (modal.type === "suspend") {
      await suspendMutation.mutateAsync({ id: modal.userId, reason: val });
    } else if (modal.type === "activate") {
      await activateMutation.mutateAsync({ id: modal.userId });
    } else if (modal.type === "change-role") {
      await roleMutation.mutateAsync({ id: modal.userId, role: newRole, reason: roleReason || undefined });
    }
    setModal(null);
    refetch();
  }

  const mutating = suspendMutation.isPending || activateMutation.isPending || roleMutation.isPending;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9", marginBottom: "14px" }}>Account Management</h1>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B" }} />
          <input
            value={q}
            onChange={(e) => debouncedQ(e.target.value)}
            placeholder="Search by name, email, or phone..."
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px", padding: "10px 12px 10px 36px", color: "#F1F5F9", fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px" }}>
          {(["all", "active", "suspended"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              style={{
                padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                whiteSpace: "nowrap", flexShrink: 0,
                background: status === s ? "#EF4444" : "rgba(255,255,255,0.06)",
                color: status === s ? "#fff" : "#94A3B8",
                border: "none", cursor: "pointer",
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
          {(["all", "admin", "venue_owner", "trainer", "coach", "player"] as FilterRole[]).map((r) => (
            <button
              key={r}
              onClick={() => { setRole(r); setPage(1); }}
              style={{
                padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                whiteSpace: "nowrap", flexShrink: 0,
                background: role === r ? "#3B82F6" : "rgba(255,255,255,0.06)",
                color: role === r ? "#fff" : "#94A3B8",
                border: "none", cursor: "pointer",
              }}
            >
              {r === "all" ? "All Roles" : r.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Count */}
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
          {isLoading ? "Loading..." : `${total} user${total !== 1 ? "s" : ""} found`}
        </p>

        {/* User list */}
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <RefreshCw style={{ width: "24px", height: "24px", color: "#3B82F6" }} className="animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>No users found</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {users.map((user: any) => (
              <div
                key={user.id}
                style={{
                  background: "#162032",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  border: `1px solid ${user.isActive ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.25)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {/* Avatar */}
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "16px", fontWeight: "700", color: "#94A3B8",
                  }}>
                    {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#F1F5F9" }}>
                        {user.name ?? "—"}
                      </span>
                      {roleBadge(user.role)}
                      {!user.isActive && (
                        <span style={{ fontSize: "10px", fontWeight: "700", color: "#EF4444", background: "rgba(239,68,68,0.12)", borderRadius: "6px", padding: "2px 7px" }}>
                          SUSPENDED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{user.email}</div>
                    {user.phone && <div style={{ fontSize: "11px", color: "#475569" }}>{user.phone}</div>}
                    {user.suspensionReason && (
                      <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px", fontStyle: "italic" }}>
                        Suspended: {user.suspensionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                    {user.isActive ? (
                      <button
                        onClick={() => openSuspend(user)}
                        style={{
                          padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                          color: "#EF4444", background: "rgba(239,68,68,0.1)", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "4px",
                        }}
                      >
                        <UserX style={{ width: "12px", height: "12px" }} /> Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => openActivate(user)}
                        style={{
                          padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                          color: "#22C55E", background: "rgba(34,197,94,0.1)", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "4px",
                        }}
                      >
                        <UserCheck style={{ width: "12px", height: "12px" }} /> Activate
                      </button>
                    )}
                    <button
                      onClick={() => openChangeRole(user)}
                      style={{
                        padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                        color: "#A855F7", background: "rgba(168,85,247,0.1)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      <ShieldAlert style={{ width: "12px", height: "12px" }} /> Role
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}
            >
              Prev
            </button>
            <span style={{ color: "#64748B", fontSize: "13px", lineHeight: "34px" }}>Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={users.length < 20}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: users.length < 20 ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {modal && modal.type !== "change-role" && (
        <ConfirmModal
          title={modal.type === "suspend" ? "Suspend Account" : "Activate Account"}
          body={
            modal.type === "suspend"
              ? `Suspend "${modal.userName}"? They will lose access immediately and their sessions will be revoked.`
              : `Reactivate "${modal.userName}"? They will regain full access.`
          }
          placeholder={modal.type === "suspend" ? "Enter suspension reason..." : undefined}
          requireInput={modal.type === "suspend"}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          loading={mutating}
        />
      )}

      {/* Change-role modal */}
      {modal?.type === "change-role" && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9" }}>Change Role</h3>
              <button onClick={() => setModal(null)}><X style={{ width: "20px", height: "20px", color: "#64748B" }} /></button>
            </div>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "16px" }}>
              Changing role for <strong style={{ color: "#F1F5F9" }}>{modal.userName}</strong> (current: {modal.currentRole})
            </p>

            <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", letterSpacing: "0.5px", marginBottom: "8px" }}>SELECT NEW ROLE</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {DB_ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setNewRole(r)}
                  style={{
                    padding: "7px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
                    border: "none", cursor: "pointer",
                    background: newRole === r ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                    color: newRole === r ? "#A855F7" : "#64748B",
                  }}
                >
                  {r.replace("_", " ")}
                </button>
              ))}
            </div>

            <textarea
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
              placeholder="Reason for role change (optional)..."
              rows={2}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", padding: "10px 12px", color: "#F1F5F9", fontSize: "14px",
                resize: "none", marginBottom: "14px", boxSizing: "border-box",
              }}
            />

            <button
              onClick={() => handleConfirm("")}
              disabled={mutating || newRole === modal.currentRole}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px",
                background: "linear-gradient(135deg,#A855F7,#7C3AED)",
                color: "#fff", fontSize: "15px", fontWeight: "700",
                opacity: mutating || newRole === modal.currentRole ? 0.5 : 1,
                cursor: mutating ? "progress" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {mutating && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
              Set Role to {newRole.replace("_", " ")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
