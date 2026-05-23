import { useMemo, useState } from "react";
import { useCreatePeerInvite, useSports } from "@sportza/api-client";
import { SportRulebook } from "./SportRulebook";

type SportOption = {
  id: number;
  name: string;
  displayName: string;
};

export default function PeerInviteSheet({
  receiverId,
  receiverName,
  defaultSportId,
  onClose,
  onSuccess,
}: {
  receiverId: number;
  receiverName?: string;
  defaultSportId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data: sportsRes } = useSports();
  const createPeerInvite = useCreatePeerInvite();

  const sports =
    (sportsRes?.data as SportOption[] | undefined)?.filter(Boolean) ?? [];

  const [sportId, setSportId] = useState<number | "">(
    defaultSportId && defaultSportId > 0 ? defaultSportId : ""
  );
  const [proposedDate, setProposedDate] = useState("");
  const [proposedStartTime, setProposedStartTime] = useState("");
  const [proposedEndTime, setProposedEndTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedSport = useMemo(
    () => sports.find((sport) => sport.id === sportId),
    [sports, sportId]
  );

  const submit = async () => {
    if (!sportId) {
      setError("Choose a sport first.");
      return;
    }

    if (proposedStartTime && proposedEndTime && proposedEndTime <= proposedStartTime) {
      setError("End time must be later than start time.");
      return;
    }

    setError(null);

    try {
      await createPeerInvite.mutateAsync({
        receiverId,
        sportId,
        proposedDate: proposedDate || undefined,
        proposedStartTime: proposedStartTime || undefined,
        proposedEndTime: proposedEndTime || undefined,
        message: message.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to send invite.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>
              Invite to Play
            </h2>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
              {receiverName ? `Send a future play invite to ${receiverName}` : "Send a future play invite"}
            </p>
          </div>
          <button onClick={onClose} className="text-[#64748B]" style={{ fontSize: "14px" }}>
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "700" }}>
                SPORT
              </label>
              {selectedSport && <SportRulebook sport={selectedSport} />}
            </div>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full px-4 py-3 text-white"
              style={{
                borderRadius: "14px",
                backgroundColor: "#0F172A",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <option value="" style={{ color: "#0F172A" }}>
                Select sport
              </option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id} style={{ color: "#0F172A" }}>
                  {sport.displayName}
                </option>
              ))}
            </select>
            {selectedSport && (
              <p className="text-[#64748B] mt-2" style={{ fontSize: "12px" }}>
                Invite for {selectedSport.displayName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "700" }}>
                PREFERRED DATE
              </label>
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full px-4 py-3 text-white"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "700" }}>
                  START TIME
                </label>
                <input
                  type="time"
                  value={proposedStartTime}
                  onChange={(e) => setProposedStartTime(e.target.value)}
                  className="w-full px-4 py-3 text-white"
                  style={{
                    borderRadius: "14px",
                    backgroundColor: "#0F172A",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "700" }}>
                  END TIME
                </label>
                <input
                  type="time"
                  value={proposedEndTime}
                  onChange={(e) => setProposedEndTime(e.target.value)}
                  className="w-full px-4 py-3 text-white"
                  style={{
                    borderRadius: "14px",
                    backgroundColor: "#0F172A",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[#94A3B8] mb-2" style={{ fontSize: "12px", fontWeight: "700" }}>
              MESSAGE
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Want to play next week?"
              className="w-full px-4 py-3 text-white resize-none"
              style={{
                borderRadius: "14px",
                backgroundColor: "#0F172A",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {error && (
            <div
              className="px-4 py-3"
              style={{
                borderRadius: "12px",
                backgroundColor: "rgba(239,68,68,0.12)",
                color: "#FCA5A5",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#0F172A",
                color: "#94A3B8",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={createPeerInvite.isPending}
              className="flex-1 py-3"
              style={{
                borderRadius: "14px",
                backgroundColor: "#3B82F6",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
                opacity: createPeerInvite.isPending ? 0.7 : 1,
              }}
            >
              {createPeerInvite.isPending ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
