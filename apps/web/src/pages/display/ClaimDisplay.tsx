import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@sportza/api-client";
import { Tv2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";

interface PairingInfo { courtName: string; displayId: number; expiresAt: string; status: string; }
interface MatchOption { id: number; sportName: string; status: string; formatName: string; }

const selectSt: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: "10px",
  backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "14px", outline: "none", appearance: "none",
};

export default function ClaimDisplay() {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);

  const { data: pairingRes, isLoading: pairingLoading, isError: pairingError } = useQuery<any>({
    queryKey: ["pairing", token],
    queryFn: () => apiClient.get(`/displays/pairing/${token}`).then((r) => r.data),
    retry: false,
  });

  const { data: matchesRes, isLoading: matchesLoading } = useQuery<any>({
    queryKey: ["matches-for-claim"],
    queryFn: () => apiClient.get("/matches", { params: { status: "scheduled", limit: 50 } }).then((r) => r.data),
  });

  const claim = useMutation({
    mutationFn: () => apiClient.post(`/displays/claim/${token}`, { matchId: selectedMatchId }).then((r) => r.data),
    onSuccess: () => { setClaimed(true); setTimeout(() => navigate(-1), 3000); },
  });

  const pairing: PairingInfo | null = pairingRes?.data ?? null;
  const matches: MatchOption[]      = matchesRes?.data ?? [];
  const isExpired        = pairing?.status === "expired";
  const isAlreadyClaimed = pairing?.status === "claimed";

  if (pairingLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-[#3B82F6] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pairingError || !pairing) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-6">
        <div className="w-full max-w-xs p-8 text-center" style={{ borderRadius: "24px", backgroundColor: "#1E293B" }}>
          <AlertCircle style={{ width: "40px", height: "40px", color: "#EF4444", margin: "0 auto 12px" }} />
          <p className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "700" }}>Invalid Session</p>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>This pairing link is not valid or has expired.</p>
        </div>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-6">
        <div className="w-full max-w-xs p-8 text-center" style={{ borderRadius: "24px", backgroundColor: "#1E293B" }}>
          <CheckCircle2 style={{ width: "48px", height: "48px", color: "#22C55E", margin: "0 auto 12px" }} />
          <p className="text-white mb-2" style={{ fontSize: "20px", fontWeight: "800" }}>Display Linked! 🎉</p>
          <p className="text-[#64748B]" style={{ fontSize: "14px" }}>The scoreboard will update momentarily.</p>
          <p className="text-[#475569] mt-3" style={{ fontSize: "12px" }}>Redirecting you back…</p>
        </div>
      </div>
    );
  }

  const expiresAt = pairing.expiresAt
    ? new Date(pairing.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        {/* Display identity */}
        <div className="p-5 mb-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center flex-shrink-0"
              style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(59,130,246,0.12)" }}>
              <Tv2 style={{ width: "22px", height: "22px", color: "#3B82F6" }} />
            </div>
            <div>
              <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{pairing.courtName}</p>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                {isExpired ? "Session expired" : isAlreadyClaimed ? "Already claimed" : `Expires at ${expiresAt}`}
              </p>
            </div>
          </div>

          {(isExpired || isAlreadyClaimed) && (
            <div className="p-3 text-center" style={{ borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-[#EF4444]" style={{ fontSize: "13px" }}>
                {isExpired
                  ? "This session expired. Ask the venue for a new pairing."
                  : "This display is already linked to a match."}
              </p>
            </div>
          )}
        </div>

        {!isExpired && !isAlreadyClaimed && (
          <div className="space-y-3">
            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>
                Select match to show on this display
              </label>
              <div className="relative">
                <select
                  value={selectedMatchId ?? ""}
                  onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
                  style={selectSt}
                  disabled={matchesLoading}>
                  <option value="">— choose a match —</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sportName} · {m.formatName} (#{m.id})
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B", pointerEvents: "none" }} />
              </div>
            </div>

            <button
              onClick={() => claim.mutate()}
              disabled={!selectedMatchId || claim.isPending}
              className="w-full py-4"
              style={{
                borderRadius: "14px", fontSize: "15px", fontWeight: "700", color: "#fff",
                background: (!selectedMatchId || claim.isPending) ? "#1E293B" : "linear-gradient(135deg,#3B82F6,#2563EB)",
              }}>
              {claim.isPending ? "Linking…" : "Link match to display"}
            </button>

            {claim.isError && (
              <p className="text-[#EF4444] text-center" style={{ fontSize: "12px" }}>
                {(claim.error as Error)?.message ?? "Failed to claim display."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
