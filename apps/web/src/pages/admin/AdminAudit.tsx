import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminAuditLog, useAdminApprovals,
  useAdminApproveRequest, useAdminRejectRequest,
  useAdminOnboarding,
} from "@sportza/api-client";
import { CheckCircle2, XCircle, Clock, ClipboardList, FileText, RefreshCw, UserCog } from "lucide-react";

type Tab = "approvals" | "audit";

function ApprovalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    pending:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
    approved: { color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
    rejected: { color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  };
  const s = map[status] ?? { color: "#64748B", bg: "rgba(100,116,139,0.12)" };
  return (
    <span style={{ fontSize: "10px", fontWeight: "700", color: s.color, background: s.bg, borderRadius: "6px", padding: "2px 8px" }}>
      {status.toUpperCase()}
    </span>
  );
}

function ReviewModal({
  request, onClose, onDone,
}: { request: any; onClose: () => void; onDone: () => void }) {
  const [note, setNote]   = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const approveMutation   = useAdminApproveRequest();
  const rejectMutation    = useAdminRejectRequest();
  const loading           = approveMutation.isPending || rejectMutation.isPending;

  async function submit() {
    if (!action) return;
    if (action === "approve") {
      await approveMutation.mutateAsync({ id: request.id, reviewNote: note });
    } else {
      if (!note.trim()) return;
      await rejectMutation.mutateAsync({ id: request.id, reviewNote: note });
    }
    onDone();
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9", marginBottom: "8px" }}>Review Request</h3>

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>TYPE</div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#F1F5F9", marginBottom: "8px" }}>{request.type}</div>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>REASON</div>
          <div style={{ fontSize: "13px", color: "#94A3B8" }}>{request.reason}</div>
          {request.payload && (
            <>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "8px", marginBottom: "4px" }}>PAYLOAD</div>
              <pre style={{ fontSize: "11px", color: "#64748B", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(request.payload, null, 2)}
              </pre>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button
            onClick={() => setAction("approve")}
            style={{
              flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
              background: action === "approve" ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
              color: action === "approve" ? "#22C55E" : "#64748B", border: "none", cursor: "pointer",
            }}
          >
            Approve
          </button>
          <button
            onClick={() => setAction("reject")}
            style={{
              flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
              background: action === "reject" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
              color: action === "reject" ? "#EF4444" : "#64748B", border: "none", cursor: "pointer",
            }}
          >
            Reject
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={action === "reject" ? "Rejection reason (required)..." : "Review note (optional)..."}
          rows={3}
          style={{
            width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px", padding: "10px 12px", color: "#F1F5F9", fontSize: "14px",
            resize: "none", marginBottom: "12px", boxSizing: "border-box",
          }}
        />

        <button
          onClick={submit}
          disabled={!action || loading || (action === "reject" && !note.trim())}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: action === "approve" ? "linear-gradient(135deg,#22C55E,#16A34A)"
              : action === "reject" ? "linear-gradient(135deg,#EF4444,#B91C1C)"
              : "rgba(255,255,255,0.08)",
            color: "#fff", fontSize: "15px", fontWeight: "700",
            opacity: !action || loading || (action === "reject" && !note.trim()) ? 0.5 : 1,
            cursor: loading ? "progress" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {loading && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
          {action === "approve" ? "Approve & Execute" : action === "reject" ? "Reject" : "Select action"}
        </button>
      </div>
    </div>
  );
}

export default function AdminAudit() {
  const [tab, setTab]               = useState<Tab>("approvals");
  const [approvalStatus, setApprStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<any | null>(null);
  const navigate                    = useNavigate();

  const { data: approvalsData, isLoading: approvalsLoading, refetch: refetchApprovals } =
    useAdminApprovals({ status: approvalStatus !== "all" ? approvalStatus : undefined, page });

  const { data: roleAppsData, isLoading: roleAppsLoading } =
    useAdminOnboarding({ status: "pending" });

  const { data: auditData, isLoading: auditLoading } =
    useAdminAuditLog({ page });

  const approvals    = approvalsData?.requests     ?? [];
  const totalAppr    = approvalsData?.total        ?? 0;
  const auditLogs    = auditData?.logs             ?? [];
  const totalAudit   = auditData?.total            ?? 0;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9", marginBottom: "14px" }}>Audit & Approvals</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", marginBottom: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "3px" }}>
          {([{ key: "approvals", label: "Approvals", icon: Clock }, { key: "audit", label: "Audit Log", icon: FileText }] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: "9px", fontSize: "13px", fontWeight: "700",
                border: "none", cursor: "pointer",
                background: tab === key ? "#EF4444" : "transparent",
                color:      tab === key ? "#fff" : "#64748B",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <Icon style={{ width: "14px", height: "14px" }} />
              {label}
              {key === "approvals" && approvalsData?.total > 0 && tab !== "approvals" && (
                <span style={{ background: "#EF4444", color: "#fff", borderRadius: "999px", fontSize: "10px", fontWeight: "800", padding: "1px 6px" }}>
                  {approvalsData.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Approval sub-filters */}
        {tab === "approvals" && (
          <div style={{ display: "flex", gap: "8px", paddingBottom: "12px" }}>
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setApprStatus(s); setPage(1); }}
                style={{
                  padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                  border: "none", cursor: "pointer",
                  background: approvalStatus === s ? "#EF4444" : "rgba(255,255,255,0.06)",
                  color:      approvalStatus === s ? "#fff"    : "#94A3B8",
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* ── Approvals tab ── */}
        {tab === "approvals" && (
          <>
            {/* ── Role application requests section ── */}
            {(() => {
              const roleApps: any[] = roleAppsData?.users ?? [];
              const roleAppsCount   = roleAppsData?.total ?? 0;
              return (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserCog style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B", letterSpacing: "0.5px" }}>
                        ROLE APPLICATIONS
                      </span>
                      {roleAppsCount > 0 && (
                        <span style={{ background: "#F59E0B", color: "#0F172A", borderRadius: "999px", fontSize: "10px", fontWeight: "800", padding: "1px 7px" }}>
                          {roleAppsCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("/admin/onboarding")}
                      style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px" }}
                    >
                      View All →
                    </button>
                  </div>

                  {roleAppsLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                      <RefreshCw style={{ width: "18px", height: "18px", color: "#F59E0B" }} className="animate-spin" />
                    </div>
                  ) : roleApps.length === 0 ? (
                    <div style={{ background: "#162032", borderRadius: "14px", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                      <p style={{ fontSize: "13px", color: "#475569" }}>No pending role applications</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {roleApps.slice(0, 5).map((user: any) => (
                        <div
                          key={user.id}
                          style={{
                            background: "#162032", borderRadius: "14px", padding: "12px 14px",
                            border: "1px solid rgba(245,158,11,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#F1F5F9" }}>{user.name ?? user.email}</div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                              {user.email}
                              {user.onboardingNote && (
                                <span> · applied for <strong style={{ color: "#F59E0B" }}>{user.onboardingNote}</strong></span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => navigate("/admin/onboarding")}
                            style={{
                              padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                              background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "none", cursor: "pointer",
                              whiteSpace: "nowrap", flexShrink: 0,
                            }}
                          >
                            Review
                          </button>
                        </div>
                      ))}
                      {roleAppsCount > 5 && (
                        <button
                          onClick={() => navigate("/admin/onboarding")}
                          style={{
                            background: "rgba(245,158,11,0.06)", borderRadius: "12px", padding: "10px",
                            border: "1px dashed rgba(245,158,11,0.3)", color: "#F59E0B",
                            fontSize: "12px", fontWeight: "700", cursor: "pointer", width: "100%",
                          }}
                        >
                          + {roleAppsCount - 5} more applications — View in Onboarding
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "16px 0 4px" }} />
                </div>
              );
            })()}

            <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
              {approvalsLoading ? "Loading..." : `${totalAppr} request${totalAppr !== 1 ? "s" : ""}`}
            </p>
            {approvalsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <RefreshCw style={{ width: "24px", height: "24px", color: "#EF4444" }} className="animate-spin" />
              </div>
            ) : approvals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
                No {approvalStatus !== "all" ? approvalStatus : ""} requests
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {approvals.map((req: any) => (
                  <div
                    key={req.id}
                    style={{
                      background: "#162032", borderRadius: "16px", padding: "14px 16px",
                      border: req.status === "pending" ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#F1F5F9", marginBottom: "2px" }}>{req.type}</div>
                        <div style={{ fontSize: "11px", color: "#64748B" }}>
                          By {req.initiator?.name ?? req.initiator?.email} ·{" "}
                          {new Date(req.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <ApprovalStatusBadge status={req.status} />
                    </div>

                    <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "10px" }}>{req.reason}</div>

                    {req.reviewNote && (
                      <div style={{ fontSize: "11px", color: "#64748B", fontStyle: "italic", marginBottom: "8px" }}>
                        Review note: {req.reviewNote}
                      </div>
                    )}

                    {req.status === "pending" && (
                      <button
                        onClick={() => setSelected(req)}
                        style={{
                          padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
                          background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "6px",
                        }}
                      >
                        <ClipboardList style={{ width: "13px", height: "13px" }} /> Review
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Audit log tab ── */}
        {tab === "audit" && (
          <>
            <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
              {auditLoading ? "Loading..." : `${totalAudit} log entr${totalAudit !== 1 ? "ies" : "y"}`}
            </p>
            {auditLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <RefreshCw style={{ width: "24px", height: "24px", color: "#94A3B8" }} className="animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>No audit entries yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {auditLogs.map((log: any) => (
                  <div
                    key={log.id}
                    style={{
                      background: "#162032", borderRadius: "14px", padding: "12px 14px",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#F1F5F9" }}>{log.action}</div>
                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                          Actor: {log.actor?.name ?? log.actor?.email ?? `#${log.actorId}`}
                          {log.target && ` → ${log.target?.name ?? log.target?.email ?? `#${log.targetId}`}`}
                        </div>
                      </div>
                      <div style={{ fontSize: "10px", color: "#475569", flexShrink: 0, textAlign: "right" }}>
                        {new Date(log.createdAt).toLocaleDateString("en-IN")}<br />
                        {new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalAudit > 30 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>Prev</button>
                <span style={{ color: "#64748B", fontSize: "13px", lineHeight: "34px" }}>Page {page}</span>
                <button onClick={() => setPage(page + 1)} disabled={auditLogs.length < 30}
                  style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: auditLogs.length < 30 ? 0.4 : 1 }}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <ReviewModal
          request={selected}
          onClose={() => setSelected(null)}
          onDone={refetchApprovals}
        />
      )}
    </div>
  );
}
