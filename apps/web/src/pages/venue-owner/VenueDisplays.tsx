/**
 * Venue Displays — Manage TV scoreboard screens at courts
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMyVenues, useVenueDisplays, useCreateDisplay, useGeneratePairing, useDeleteDisplay } from "@sportza/api-client";
import {
  Tv2, Plus, RefreshCw, QrCode, Trash2,
  Wifi, WifiOff, Circle, X, Copy, CheckCircle2, ChevronLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DisplayRecord {
  id: number;
  courtName: string;
  status: string;
  venueId: number;
  currentMatchId: number | null;
  match?: { id: number; sportName: string; status: string } | null;
  pairings: Array<{ token: string; expiresAt: string }>;
}
interface PairingResult {
  token: string;
  displayId: number;
  courtName: string;
  venueName: string;
  expiresAt: string;
  displayUrl: string;
}

const WEB_BASE = import.meta.env.VITE_WEB_URL ?? window.location.origin;
void WEB_BASE;

function statusConfig(status: string) {
  switch (status) {
    case "live":
      return { label: "Live", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: Circle };
    case "awaiting":
      return { label: "Awaiting", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: Wifi };
    default:
      return { label: "Idle", color: "#475569", bg: "rgba(71,85,105,0.12)", icon: WifiOff };
  }
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          maxHeight: "90dvh",
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-4 flex-shrink-0">
          <span className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>{title}</span>
          <button onClick={onClose} style={{ padding: "6px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <X style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VenueDisplays() {
  const navigate = useNavigate();
  const [venueId,       setVenueId]       = useState<number | null>(null);
  const [showAdd,       setShowAdd]       = useState(false);
  const [courtName,     setCourtName]     = useState("");
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null);
  const [copied,        setCopied]        = useState(false);

  const { data: venuesRes } = useMyVenues();
  const myVenues: Array<{ id: number; name: string }> = (venuesRes as any)?.data ?? [];
  if (myVenues.length && !venueId) setVenueId(myVenues[0].id);

  const { data: displaysRes, isLoading } = useVenueDisplays(venueId);
  const displays: DisplayRecord[] = (displaysRes as any)?.data ?? [];

  const addDisplayMutation = useCreateDisplay();
  const generatePairingMutation = useGeneratePairing(venueId);
  const deleteDisplayMutation = useDeleteDisplay(venueId);

  const pairingUrl = pairingResult?.displayUrl ?? "";
  const qrSrc = pairingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=4&data=${encodeURIComponent(pairingUrl)}`
    : "";

  const handleCopy = () => {
    navigator.clipboard?.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="flex-1 min-w-0">
            <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Court Displays</h1>
            <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Manage live scoreboards at your venue</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!venueId}
            className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
            style={{ borderRadius: "10px", background: "linear-gradient(135deg,#8B5CF6,#6366F1)", fontSize: "13px", fontWeight: "700", color: "#fff", opacity: !venueId ? 0.5 : 1 }}
          >
            <Plus style={{ width: "15px", height: "15px" }} />
            Add court
          </button>
        </div>

        {myVenues.length > 1 && (
          <select
            value={venueId ?? ""}
            onChange={(e) => setVenueId(parseInt(e.target.value, 10))}
            style={{
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              color: "#F1F5F9",
              fontSize: "13px",
              padding: "6px 10px",
              outline: "none",
            }}
          >
            {myVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        {/* Loading */}
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {/* Empty */}
        {!isLoading && displays.length === 0 && venueId && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Tv2 style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No courts added</p>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "14px" }}>
              Add a court display to enable live scoreboards on your TVs.
            </p>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-3"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#8B5CF6,#6366F1)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
              + Add Court
            </button>
          </div>
        )}

        {/* Display cards */}
        {displays.map((display) => {
          const cfg = statusConfig(display.status);
          const StatusIcon = cfg.icon;
          const activePairingToken = display.pairings[0]?.token;

          return (
            <div key={display.id} className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center"
                    style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "rgba(139,92,246,0.12)" }}>
                    <Tv2 style={{ width: "20px", height: "20px", color: "#8B5CF6" }} />
                  </div>
                  <div>
                    <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{display.courtName}</p>
                    {display.match && (
                      <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                        {display.match.sportName} · Match #{display.match.id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1"
                  style={{ borderRadius: "999px", backgroundColor: cfg.bg }}>
                  <StatusIcon style={{ width: "10px", height: "10px", color: cfg.color }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>

              {/* Active pairing */}
              {activePairingToken && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2"
                  style={{ borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <RefreshCw style={{ width: "13px", height: "13px", color: "#3B82F6", flexShrink: 0 }} />
                  <span className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                    Code: <code className="text-white font-mono">{activePairingToken.slice(0, 12).toUpperCase()}</code>
                    {" "}· expires {new Date(display.pairings[0].expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => generatePairingMutation.mutate(display.id, { onSuccess: (res) => setPairingResult((res as any).data) })}
                  disabled={generatePairingMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2"
                  style={{ borderRadius: "10px", backgroundColor: "rgba(139,92,246,0.1)", fontSize: "12px", fontWeight: "600", color: "#8B5CF6" }}
                >
                  <QrCode style={{ width: "14px", height: "14px" }} />
                  {activePairingToken ? "Regenerate" : "Pair display"}
                </button>

                {display.currentMatchId && (
                  <button
                    onClick={() => window.open(`/scoreboard/${display.currentMatchId}`, "_blank")}
                    className="flex items-center gap-1.5 px-3 py-2"
                    style={{ borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.1)", fontSize: "12px", fontWeight: "600", color: "#22C55E" }}
                  >
                    <Wifi style={{ width: "14px", height: "14px" }} />
                    View scoreboard
                  </button>
                )}

                <button
                  onClick={() => deleteDisplayMutation.mutate(display.id)}
                  disabled={deleteDisplayMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 ml-auto"
                  style={{ borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.08)", fontSize: "12px", fontWeight: "600", color: "#EF4444" }}
                >
                  <Trash2 style={{ width: "14px", height: "14px" }} />
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add court sheet ── */}
      {showAdd && (
        <Sheet title="Add Court Display" onClose={() => { setShowAdd(false); setCourtName(""); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "500" }}>
                Court Name
              </label>
              <input
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                placeholder="e.g. Court 1, Turf A, Main Arena"
                autoFocus
                style={{
                  width: "100%",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#0F172A",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  color: "#F1F5F9",
                  fontSize: "14px",
                  paddingLeft: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAdd(false); setCourtName(""); }} className="flex-1 py-3"
                style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                if (venueId) addDisplayMutation.mutate({ venueId, courtName }, { onSuccess: () => { setShowAdd(false); setCourtName(""); } });
              }}
                disabled={!courtName.trim() || addDisplayMutation.isPending}
                className="flex-1 py-3"
                style={{ borderRadius: "12px", background: "linear-gradient(135deg,#8B5CF6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: !courtName.trim() || addDisplayMutation.isPending ? 0.6 : 1 }}
              >
                {addDisplayMutation.isPending ? "Adding…" : "Add Court"}
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {/* ── QR Pairing sheet ── */}
      {pairingResult && (
        <Sheet title="Pair Display" onClose={() => setPairingResult(null)}>
          <div className="space-y-4 text-center">
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Open this URL on the TV or scan the QR to link a match.
            </p>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#fff", display: "inline-block" }}>
                <img src={qrSrc} alt="Pairing QR" width={220} height={220} style={{ borderRadius: "8px" }} />
              </div>
            </div>

            {/* Code info */}
            <div className="p-4 text-left space-y-2" style={{ borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{pairingResult.courtName}</p>
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                Session code: <code className="text-white font-mono tracking-widest">{pairingResult.token.slice(0, 12).toUpperCase()}</code>
              </p>
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                Expires: {new Date(pairingResult.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {/* Instructions */}
            <div className="p-4 text-left" style={{ borderRadius: "14px", backgroundColor: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <p className="text-white mb-2" style={{ fontSize: "13px", fontWeight: "700" }}>TV Setup Instructions</p>
              <ol className="space-y-1">
                {[
                  "Open a browser on the smart TV or Fire Stick",
                  `Navigate to: ${pairingResult.displayUrl}`,
                  "The QR above will appear on screen",
                  "Match creator scans the QR in the app to link the match",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2 text-[#64748B]" style={{ fontSize: "12px" }}>
                    <span className="text-[#6366F1] font-bold flex-shrink-0">{i + 1}.</span>
                    <span style={{ wordBreak: "break-all" }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Copy URL button */}
            <button
              onClick={handleCopy}
              className="w-full py-3 flex items-center justify-center gap-2"
              style={{
                borderRadius: "12px",
                backgroundColor: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)",
                fontSize: "14px",
                fontWeight: "600",
                color: copied ? "#22C55E" : "#94A3B8",
                border: copied ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.2s",
              }}
            >
              {copied ? <CheckCircle2 style={{ width: "16px", height: "16px" }} /> : <Copy style={{ width: "16px", height: "16px" }} />}
              {copied ? "Copied!" : "Copy TV URL"}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
