import { useState } from "react";
import {
  useAdminVenues, useAdminActivateVenue, useAdminDeactivateVenue,
  useAdminReassignVenueOwner, useAdminUsers,
} from "@sportza/api-client";
import { Search, ToggleLeft, ToggleRight, RefreshCw, MapPin, Users, UserCog, X } from "lucide-react";

function ConfirmModal({
  title, body, placeholder, requireInput,
  onConfirm, onClose, loading,
}: {
  title: string; body: string; placeholder?: string; requireInput?: boolean;
  onConfirm: (val: string) => void; onClose: () => void; loading: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9", marginBottom: "8px" }}>{title}</h3>
        <p style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "16px" }}>{body}</p>
        {placeholder && (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
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
          onClick={() => onConfirm(val)}
          disabled={loading || (requireInput && !val.trim())}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: "linear-gradient(135deg,#F59E0B,#D97706)",
            color: "#0F172A", fontSize: "15px", fontWeight: "700",
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

export default function AdminVenues() {
  const [q, setQ]           = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage]     = useState(1);
  const [modal, setModal]   = useState<null | { type: string; venueId: number; venueName: string }>(null);

  // Reassign-owner state
  const [ownerSearchQ, setOwnerSearchQ]       = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);

  const params = {
    q: q || undefined,
    status: status !== "all" ? status : undefined,
    page,
  };

  const { data, isLoading, refetch } = useAdminVenues(params);
  const activateMutation   = useAdminActivateVenue();
  const deactivateMutation = useAdminDeactivateVenue();
  const reassignMutation   = useAdminReassignVenueOwner();

  // Search for new owner (only when reassign modal is open and query ≥ 2 chars)
  const { data: ownerSearchData } = useAdminUsers(
    modal?.type === "reassign-owner" && ownerSearchQ.length >= 2 ? { q: ownerSearchQ } : undefined
  );
  const ownerResults: any[] = ownerSearchData?.users ?? [];

  const venues = data?.venues ?? [];
  const total  = data?.total  ?? 0;
  const mutating = activateMutation.isPending || deactivateMutation.isPending || reassignMutation.isPending;

  async function handleConfirm(val: string) {
    if (!modal) return;
    if (modal.type === "activate") {
      await activateMutation.mutateAsync({ id: modal.venueId });
    } else if (modal.type === "deactivate") {
      await deactivateMutation.mutateAsync({ id: modal.venueId, reason: val || undefined });
    } else if (modal.type === "reassign-owner" && selectedOwnerId) {
      await reassignMutation.mutateAsync({ id: modal.venueId, ownerId: selectedOwnerId });
    }
    setModal(null);
    setOwnerSearchQ("");
    setSelectedOwnerId(null);
    refetch();
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#0F172A" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 0", background: "linear-gradient(180deg,#162032 0%,#0F172A 100%)" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#F1F5F9", marginBottom: "14px" }}>
          Venue Management
        </h1>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B" }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search venues by name or city..."
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px", padding: "10px 12px 10px 36px", color: "#F1F5F9", fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: "8px", paddingBottom: "12px" }}>
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              style={{
                padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600",
                border: "none", cursor: "pointer",
                background: status === s ? "#F59E0B" : "rgba(255,255,255,0.06)",
                color:      status === s ? "#0F172A" : "#94A3B8",
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
          {isLoading ? "Loading..." : `${total} venue${total !== 1 ? "s" : ""}`}
        </p>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <RefreshCw style={{ width: "24px", height: "24px", color: "#F59E0B" }} className="animate-spin" />
          </div>
        ) : venues.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>No venues found</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {venues.map((venue: any) => (
              <div
                key={venue.id}
                style={{
                  background: "#162032",
                  borderRadius: "16px",
                  padding: "16px",
                  border: `1px solid ${venue.isActive ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: "700", color: "#F1F5F9" }}>{venue.name}</span>
                      <span style={{
                        fontSize: "10px", fontWeight: "700",
                        color:   venue.isActive ? "#22C55E" : "#64748B",
                        background: venue.isActive ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                        borderRadius: "6px", padding: "2px 7px",
                      }}>
                        {venue.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                      <MapPin style={{ width: "11px", height: "11px", color: "#64748B" }} />
                      <span style={{ fontSize: "12px", color: "#64748B" }}>
                        {(venue as any).location?.address ?? (venue as any).location?.city ?? "—"}
                      </span>
                    </div>

                    {venue.owner && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                        <Users style={{ width: "11px", height: "11px", color: "#64748B" }} />
                        <span style={{ fontSize: "12px", color: "#64748B" }}>
                          Owner: {venue.owner.name ?? venue.owner.email}
                        </span>
                      </div>
                    )}

                    {venue.sportFacilities?.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                        {venue.sportFacilities.length} facilit{venue.sportFacilities.length !== 1 ? "ies" : "y"}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                    <button
                      onClick={() => setModal({
                        type:      venue.isActive ? "deactivate" : "activate",
                        venueId:   venue.id,
                        venueName: venue.name,
                      })}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                    >
                      {venue.isActive
                        ? <ToggleRight style={{ width: "28px", height: "28px", color: "#22C55E" }} />
                        : <ToggleLeft  style={{ width: "28px", height: "28px", color: "#475569" }} />
                      }
                    </button>
                    <button
                      onClick={() => {
                        setOwnerSearchQ("");
                        setSelectedOwnerId(null);
                        setModal({ type: "reassign-owner", venueId: venue.id, venueName: venue.name });
                      }}
                      style={{
                        padding: "5px 8px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                        color: "#3B82F6", background: "rgba(59,130,246,0.1)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      <UserCog style={{ width: "12px", height: "12px" }} /> Owner
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
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>
              Prev
            </button>
            <span style={{ color: "#64748B", fontSize: "13px", lineHeight: "34px" }}>Page {page}</span>
            <button onClick={() => setPage(page + 1)} disabled={venues.length < 20}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px", border: "none", cursor: "pointer", opacity: venues.length < 20 ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        )}
      </div>

      {modal && modal.type !== "reassign-owner" && (
        <ConfirmModal
          title={modal.type === "activate" ? "Activate Venue" : "Deactivate Venue"}
          body={
            modal.type === "activate"
              ? `Activate "${modal.venueName}"? It will become visible and bookable.`
              : `Deactivate "${modal.venueName}"? Existing bookings are not affected but new ones will be blocked.`
          }
          placeholder={modal.type === "deactivate" ? "Optional reason..." : undefined}
          requireInput={false}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          loading={mutating}
        />
      )}

      {modal?.type === "reassign-owner" && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#162032", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#F1F5F9" }}>Reassign Owner</h3>
              <button onClick={() => setModal(null)}><X style={{ width: "20px", height: "20px", color: "#64748B" }} /></button>
            </div>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "16px" }}>
              Select a new owner for <strong style={{ color: "#F1F5F9" }}>{modal.venueName}</strong>
            </p>

            <div style={{ position: "relative", marginBottom: "10px" }}>
              <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "#64748B" }} />
              <input
                value={ownerSearchQ}
                onChange={(e) => { setOwnerSearchQ(e.target.value); setSelectedOwnerId(null); }}
                placeholder="Search user by name or email..."
                autoFocus
                style={{
                  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "12px", padding: "10px 12px 10px 36px", color: "#F1F5F9", fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {ownerResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px", maxHeight: "200px", overflowY: "auto" }}>
                {ownerResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedOwnerId(u.id); setOwnerSearchQ(u.name ?? u.email); }}
                    style={{
                      background: selectedOwnerId === u.id ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                      border: selectedOwnerId === u.id ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "10px", padding: "10px 12px",
                      display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: "#94A3B8", flexShrink: 0 }}>
                      {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#F1F5F9" }}>{u.name ?? "—"}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>{u.email} · {u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => handleConfirm("")}
              disabled={mutating || !selectedOwnerId}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px",
                background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                color: "#fff", fontSize: "15px", fontWeight: "700",
                opacity: mutating || !selectedOwnerId ? 0.5 : 1,
                cursor: mutating ? "progress" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {mutating && <RefreshCw style={{ width: "14px", height: "14px" }} className="animate-spin" />}
              {selectedOwnerId ? "Confirm Reassignment" : "Search & select a user above"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
