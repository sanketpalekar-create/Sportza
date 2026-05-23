import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOpenPlay, useCurrentUser, useUpdateOpenPlay, useUpdateOpenPlayStatus, useRemoveOpenPlayPlayer } from "@sportza/api-client";
import {
  ChevronLeft, Users, MapPin, Calendar, Clock, Share2, Trash2, Edit3, XCircle, CheckCircle2, Copy,
} from "lucide-react";
import { format } from "date-fns";

type OpenPlayData = {
  id: number; sport: string; formatName?: string; maxPlayers: number;
  bookingDate: string; startTime: string; endTime: string;
  status: string; title?: string;
  venue?: { name?: string }; facilityName?: string; createdById?: number;
  players?: Array<{ id: number; userId: number; user?: { name?: string } }>;
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open:      { color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  full:      { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  cancelled: { color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  closed:    { color: "#64748B", bg: "rgba(100,116,139,0.12)" },
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "14px", outline: "none",
};

export default function ManageSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = id ? parseInt(id, 10) : 0;

  const { data, isLoading } = useOpenPlay(sessionId);
  const { data: userRes }   = useCurrentUser();
  const openPlay            = ((data as any)?.data ?? data) as OpenPlayData | undefined;
  const currentUser         = (userRes as any)?.user ?? (userRes as any)?.data?.user;
  const currentUserId: number | undefined = currentUser?.id;
  const isCreator           = !!openPlay && !!currentUserId && openPlay.createdById === currentUserId;

  const [showEditSheet, setShowEditSheet]   = useState(false);
  const [editDate, setEditDate]             = useState("");
  const [editStartTime, setEditStartTime]   = useState("");
  const [editEndTime, setEditEndTime]       = useState("");
  const [editMaxPlayers, setEditMaxPlayers] = useState<number | "">("");
  const [copied, setCopied]                 = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);

  const updateOpenPlayMutation = useUpdateOpenPlay(sessionId);
  const updateStatusMutation = useUpdateOpenPlayStatus(sessionId);
  const removePlayerMutation = useRemoveOpenPlayPlayer(sessionId);

  const handleCancelSession = () => {
    updateStatusMutation.mutate("cancelled", {
      onSuccess: () => {
        setShowCancelSheet(false);
        navigate("/open-plays");
      },
    });
  };

  const handleEditSave = () => {
    const payload: Record<string, unknown> = {};
    if (editDate)              payload.bookingDate = editDate;
    if (editStartTime)         payload.startTime   = editStartTime;
    if (editEndTime)           payload.endTime     = editEndTime;
    if (editMaxPlayers !== "") payload.maxPlayers  = Number(editMaxPlayers);
    if (Object.keys(payload).length > 0) {
      updateOpenPlayMutation.mutate(payload, { onSuccess: () => setShowEditSheet(false) });
    }
  };

  const removePlayer = (playerUserId: number) => {
    if (playerUserId === openPlay?.createdById) return;
    removePlayerMutation.mutate(playerUserId);
  };

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/open-plays/${sessionId}` : "";

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: openPlay?.title ?? "Open Play", url: inviteLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-[#3B82F6] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!openPlay || !isCreator) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#EF4444] mb-4" style={{ fontSize: "16px" }}>
          {!openPlay ? "Session not found." : "Only the host can manage this session."}
        </p>
        <button onClick={() => navigate(-1)} className="text-[#3B82F6]" style={{ fontSize: "14px" }}>Go back</button>
      </div>
    );
  }

  const players    = openPlay.players ?? [];
  const fillPct    = Math.round((players.length / openPlay.maxPlayers) * 100);
  const ss         = STATUS_STYLE[openPlay.status] ?? STATUS_STYLE.open;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button onClick={() => navigate(`/open-plays/${sessionId}`)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white truncate" style={{ fontSize: "20px", fontWeight: "800" }}>Manage Session</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{openPlay.title ?? `${openPlay.sport} Open Play`}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1"
          style={{ borderRadius: "8px", backgroundColor: ss.bg, fontSize: "11px", fontWeight: "700", color: ss.color }}>
          {openPlay.status.toUpperCase()}
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* Session info card */}
        <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Session Info</p>
            <button onClick={() => {
              setEditDate(openPlay.bookingDate?.slice(0,10) ?? "");
              setEditStartTime(openPlay.startTime ?? "");
              setEditEndTime(openPlay.endTime ?? "");
              setEditMaxPlayers(openPlay.maxPlayers ?? "");
              setShowEditSheet(true);
            }} className="flex items-center gap-1 px-2.5 py-1.5"
              style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.1)", fontSize: "12px", fontWeight: "600", color: "#3B82F6" }}>
              <Edit3 style={{ width: "12px", height: "12px" }} />
              Edit
            </button>
          </div>
          <div className="space-y-2">
            {[
              { icon: MapPin,    text: openPlay.venue?.name ?? openPlay.facilityName ?? "—" },
              { icon: Calendar,  text: openPlay.bookingDate ? format(new Date(openPlay.bookingDate), "dd MMM yyyy") : "—" },
              { icon: Clock,     text: `${openPlay.startTime} – ${openPlay.endTime}` },
              { icon: Users,     text: `${players.length} / ${openPlay.maxPlayers} players` },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[#64748B]">
                <Icon style={{ width: "14px", height: "14px" }} />
                <span style={{ fontSize: "13px" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Players */}
        <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Players · {players.length}/{openPlay.maxPlayers}</p>
            <span style={{ fontSize: "12px", fontWeight: "700", color: fillPct >= 100 ? "#EF4444" : "#22C55E" }}>
              {fillPct >= 100 ? "Full" : `${openPlay.maxPlayers - players.length} open`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full rounded-full mb-4" style={{ height: "5px", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <div className="rounded-full" style={{
              width: `${Math.min(fillPct, 100)}%`, height: "5px",
              backgroundColor: fillPct >= 100 ? "#EF4444" : "#22C55E",
            }} />
          </div>
          <div className="space-y-2">
            {players.map((p) => {
              const isHost = p.userId === openPlay.createdById;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "36px", height: "36px", borderRadius: "50%",
                      backgroundColor: isHost ? "rgba(59,130,246,0.2)" : "#334155",
                      fontSize: "14px", fontWeight: "700", color: isHost ? "#3B82F6" : "#fff" }}>
                    {(p.user?.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>
                      {p.user?.name ?? `Player #${p.userId}`}
                    </p>
                    {isHost && <p className="text-[#3B82F6]" style={{ fontSize: "10px", fontWeight: "700" }}>HOST</p>}
                  </div>
                  {!isHost && (
                    <button onClick={() => removePlayer(p.userId)}
                      className="flex items-center justify-center"
                      style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.1)" }}>
                      <Trash2 style={{ width: "14px", height: "14px", color: "#EF4444" }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <button onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3.5"
          style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)", fontSize: "14px", fontWeight: "700", color: copied ? "#22C55E" : "#fff" }}>
          {copied ? <CheckCircle2 style={{ width: "16px", height: "16px" }} /> : <Share2 style={{ width: "16px", height: "16px" }} />}
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>

        {openPlay.status !== "cancelled" && (
          <button onClick={() => setShowCancelSheet(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5"
            style={{ borderRadius: "14px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "14px", fontWeight: "700", color: "#EF4444" }}>
            <XCircle style={{ width: "16px", height: "16px" }} />
            Cancel Session
          </button>
        )}
      </div>

      {/* Edit Sheet */}
      {showEditSheet && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditSheet(false); }}>
          <div className="w-full" style={{ borderRadius: "24px 24px 0 0", backgroundColor: "#1E293B" }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>Edit Session</p>
              <button onClick={() => setShowEditSheet(false)} className="text-[#64748B]" style={{ fontSize: "20px" }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Date", type: "date", value: editDate, set: setEditDate },
                { label: "Start Time", type: "time", value: editStartTime, set: setEditStartTime },
                { label: "End Time", type: "time", value: editEndTime, set: setEditEndTime },
              ].map(({ label, type, value, set }) => (
                <div key={label}>
                  <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>{label}</label>
                  <input type={type} value={value} onChange={(e) => set(e.target.value)} style={inputSt} />
                </div>
              ))}
              <div>
                <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>Max Players</label>
                <input type="number" value={editMaxPlayers} onChange={(e) => setEditMaxPlayers(Number(e.target.value))} min={1} style={inputSt} />
              </div>
              <button onClick={handleEditSave} className="w-full py-4"
                style={{ borderRadius: "14px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Sheet */}
      {showCancelSheet && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCancelSheet(false); }}>
          <div className="w-full p-5" style={{ borderRadius: "24px 24px 0 0", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "800" }}>Cancel Session?</p>
            <p className="text-[#94A3B8] mb-5" style={{ fontSize: "14px", lineHeight: "1.5" }}>
              All {players.length} player{players.length !== 1 ? "s" : ""} will be notified. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelSheet(false)} className="flex-1 py-3.5"
                style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "700", color: "#94A3B8" }}>
                Keep Session
              </button>
              <button onClick={handleCancelSession}
                disabled={updateStatusMutation.isPending} className="flex-1 py-3.5"
                style={{ borderRadius: "12px", backgroundColor: "#EF4444", fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                {updateStatusMutation.isPending ? "Cancelling…" : "Cancel Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
