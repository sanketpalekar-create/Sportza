import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCancelPeerInvite,
  useCurrentUser,
  useReceivedPeerInvites,
  useRespondToPeerInvite,
  useSentPeerInvites,
  usePeerList,
  useRespondToPeerRequest,
} from "@sportza/api-client";
import { ArrowLeft, ChevronRight, Inbox, Send, Users, UserPlus, Check, X } from "lucide-react";

type TabId = "received" | "sent" | "peers";

// ─── Play invite helpers ──────────────────────────────────────────────────────

function formatInviteWindow(invite: any) {
  const parts: string[] = [];
  if (invite.proposedDate) {
    parts.push(
      new Date(invite.proposedDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    );
  }
  if (invite.proposedStartTime) parts.push(invite.proposedStartTime);
  if (invite.proposedEndTime) parts.push(`- ${invite.proposedEndTime}`);
  return parts.join(" · ");
}

function InviteCard({
  invite,
  mode,
  onAccept,
  onDecline,
  onCancel,
  onOpenPlayer,
}: {
  invite: any;
  mode: "received" | "sent";
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onOpenPlayer: () => void;
}) {
  const otherUser = mode === "received" ? invite.sender : invite.receiver;
  const statusColor =
    invite.status === "accepted"
      ? "#22C55E"
      : invite.status === "declined"
        ? "#EF4444"
        : invite.status === "cancelled"
          ? "#64748B"
          : "#F59E0B";

  return (
    <div
      className="p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button onClick={onOpenPlayer} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white truncate" style={{ fontSize: "15px", fontWeight: "700" }}>
                {otherUser?.name ?? "Player"}
              </span>
              <span
                className="px-1.5 py-0.5"
                style={{
                  borderRadius: "999px",
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                  fontSize: "10px",
                  fontWeight: "700",
                  textTransform: "capitalize",
                }}
              >
                {invite.status}
              </span>
            </div>
            <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
              {invite.sportRef?.displayName ?? invite.sport}
            </p>
            {formatInviteWindow(invite) && (
              <p className="text-[#64748B] mt-1" style={{ fontSize: "12px" }}>
                {formatInviteWindow(invite)}
              </p>
            )}
            {invite.message && (
              <p className="text-[#CBD5E1] mt-2" style={{ fontSize: "12px", lineHeight: "1.5" }}>
                {invite.message}
              </p>
            )}
          </div>
          <ChevronRight style={{ width: "16px", height: "16px", color: "#475569", flexShrink: 0 }} />
        </div>
      </button>

      {mode === "received" && invite.status === "pending" && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5"
            style={{
              borderRadius: "12px",
              backgroundColor: "#0F172A",
              color: "#94A3B8",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5"
            style={{
              borderRadius: "12px",
              backgroundColor: "#3B82F6",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            Accept
          </button>
        </div>
      )}

      {mode === "sent" && invite.status === "pending" && (
        <button
          onClick={onCancel}
          className="w-full py-2.5 mt-4"
          style={{
            borderRadius: "12px",
            backgroundColor: "#0F172A",
            color: "#94A3B8",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          Cancel Invite
        </button>
      )}
    </div>
  );
}

// ─── Peer relationship request card ──────────────────────────────────────────

function PeerRequestCard({
  relationship,
  direction,
  resolvedOther,
  onAccept,
  onDecline,
  onOpenPlayer,
}: {
  relationship: any;
  direction: "incoming" | "outgoing" | "accepted";
  resolvedOther?: any;
  onAccept: () => void;
  onDecline: () => void;
  onOpenPlayer: () => void;
}) {
  const otherUser =
    resolvedOther !== undefined
      ? resolvedOther
      : direction === "incoming"
        ? relationship.requester
        : relationship.addressee;

  const statusColor =
    direction === "accepted"
      ? "#22C55E"
      : direction === "incoming"
        ? "#F59E0B"
        : "#64748B";

  const statusLabel =
    direction === "accepted" ? "Peer" : direction === "incoming" ? "Wants to connect" : "Request sent";

  return (
    <div
      className="p-4"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button onClick={onOpenPlayer} className="w-full text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white truncate" style={{ fontSize: "15px", fontWeight: "700" }}>
                {otherUser?.name ?? "Player"}
              </span>
              <span
                className="px-1.5 py-0.5"
                style={{
                  borderRadius: "999px",
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                  fontSize: "10px",
                  fontWeight: "700",
                }}
              >
                {statusLabel}
              </span>
            </div>
            {(otherUser as any)?.location?.city && (
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                {(otherUser as any).location.city}
              </p>
            )}
          </div>
          <ChevronRight style={{ width: "16px", height: "16px", color: "#475569", flexShrink: 0 }} />
        </div>
      </button>

      {direction === "incoming" && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 flex items-center justify-center gap-2"
            style={{
              borderRadius: "12px",
              backgroundColor: "#0F172A",
              color: "#94A3B8",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            <X style={{ width: "14px", height: "14px" }} />
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 flex items-center justify-center gap-2"
            style={{
              borderRadius: "12px",
              backgroundColor: "#22C55E",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            <Check style={{ width: "14px", height: "14px" }} />
            Accept
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div
      className="flex flex-col items-center text-center p-8"
      style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{ width: "60px", height: "60px", borderRadius: "16px", backgroundColor: "rgba(255,255,255,0.05)" }}
      >
        <Icon style={{ width: "28px", height: "28px", color: "#3B82F6" }} />
      </div>
      <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>
        {title}
      </p>
      <p className="text-[#64748B]" style={{ fontSize: "13px", lineHeight: "1.5" }}>
        {body}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PeerInvites() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("received");

  const { data: currentUserRes } = useCurrentUser();
  const myId: number | null = (currentUserRes as any)?.user?.id ?? null;

  const { data: receivedRes, isLoading: loadingReceived } = useReceivedPeerInvites();
  const { data: sentRes, isLoading: loadingSent } = useSentPeerInvites();
  const { data: peersRes, isLoading: loadingPeers } = usePeerList();
  const respondInvite = useRespondToPeerInvite();
  const cancelInvite = useCancelPeerInvite();
  const respondPeer = useRespondToPeerRequest();

  const received: any[] = (receivedRes as any)?.data ?? [];
  const sent: any[] = (sentRes as any)?.data ?? [];
  const incomingPeers: any[] = (peersRes as any)?.incoming ?? [];
  const outgoingPeers: any[] = (peersRes as any)?.outgoing ?? [];
  const acceptedPeers: any[] = (peersRes as any)?.accepted ?? [];

  const tabs = [
    { id: "received" as TabId, label: "Play Received", badge: received.filter((i) => i.status === "pending").length },
    { id: "sent" as TabId, label: "Play Sent", badge: 0 },
    { id: "peers" as TabId, label: "Peers", badge: incomingPeers.length },
  ];

  const isLoading =
    activeTab === "received" ? loadingReceived : activeTab === "sent" ? loadingSent : loadingPeers;

  const openPlayerProfile = (userId: number, name?: string, location?: { city?: string }) => {
    navigate(`/players/${userId}`, { state: { name, location } });
  };

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#1E293B" }}
        >
          <ArrowLeft style={{ width: "18px", height: "18px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Invites &amp; Peers</h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Play invites and peer connections</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2.5 relative"
            style={{
              borderRadius: "11px",
              backgroundColor: activeTab === tab.id ? "#0F172A" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#64748B",
              fontSize: "13px",
              fontWeight: activeTab === tab.id ? "700" : "500",
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center"
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "#EF4444",
                  fontSize: "9px",
                  fontWeight: "800",
                  color: "#fff",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }} />
          ))}
        </div>
      ) : activeTab === "received" ? (
        received.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No play invites received"
            body="When other players invite you for a future game, they'll appear here."
          />
        ) : (
          <div className="space-y-3">
            {received.map((invite: any) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                mode="received"
                onAccept={() => respondInvite.mutate({ inviteId: invite.id, status: "accepted" })}
                onDecline={() => respondInvite.mutate({ inviteId: invite.id, status: "declined" })}
                onCancel={() => cancelInvite.mutate(invite.id)}
                onOpenPlayer={() =>
                  navigate(`/players/${invite.senderId}`, { state: { name: invite.sender?.name } })
                }
              />
            ))}
          </div>
        )
      ) : activeTab === "sent" ? (
        sent.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No play invites sent"
            body="Invites you send from player profiles or matchmaking will appear here."
          />
        ) : (
          <div className="space-y-3">
            {sent.map((invite: any) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                mode="sent"
                onAccept={() => {}}
                onDecline={() => {}}
                onCancel={() => cancelInvite.mutate(invite.id)}
                onOpenPlayer={() =>
                  navigate(`/players/${invite.receiverId}`, { state: { name: invite.receiver?.name } })
                }
              />
            ))}
          </div>
        )
      ) : (
        // ── Peers tab ──
        <div className="space-y-5">
          {incomingPeers.length > 0 && (
            <div>
              <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
                INCOMING PEER REQUESTS
              </p>
              <div className="space-y-3">
                {incomingPeers.map((rel: any) => (
                  <PeerRequestCard
                    key={rel.id}
                    relationship={rel}
                    direction="incoming"
                    onAccept={() => respondPeer.mutate({ id: rel.id, action: "accept" })}
                    onDecline={() => respondPeer.mutate({ id: rel.id, action: "decline" })}
                    onOpenPlayer={() =>
                      openPlayerProfile(rel.requester?.id, rel.requester?.name, rel.requester?.location)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {outgoingPeers.length > 0 && (
            <div>
              <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
                SENT PEER REQUESTS
              </p>
              <div className="space-y-3">
                {outgoingPeers.map((rel: any) => (
                  <PeerRequestCard
                    key={rel.id}
                    relationship={rel}
                    direction="outgoing"
                    onAccept={() => {}}
                    onDecline={() => {}}
                    onOpenPlayer={() =>
                      openPlayerProfile(rel.addressee?.id, rel.addressee?.name, rel.addressee?.location)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {acceptedPeers.length > 0 && (
            <div>
              <p className="text-[#94A3B8] mb-3 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
                YOUR PEERS
              </p>
              <div className="space-y-3">
                {acceptedPeers.map((rel: any) => {
                  const other =
                    myId !== null && rel.requesterId === myId
                      ? rel.addressee
                      : rel.requester;
                  return (
                    <PeerRequestCard
                      key={rel.id}
                      relationship={rel}
                      direction="accepted"
                      resolvedOther={other}
                      onAccept={() => {}}
                      onDecline={() => {}}
                      onOpenPlayer={() => openPlayerProfile(other?.id, other?.name, other?.location)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {incomingPeers.length === 0 && outgoingPeers.length === 0 && acceptedPeers.length === 0 && (
            <EmptyState
              icon={Users}
              title="No peer connections yet"
              body="Visit a player profile and tap 'Connect as peers' to start building your network."
            />
          )}

          {incomingPeers.length === 0 && (outgoingPeers.length > 0 || acceptedPeers.length > 0) && (
            <div
              className="flex items-center gap-3 p-4"
              style={{
                borderRadius: "14px",
                backgroundColor: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              <UserPlus style={{ width: "16px", height: "16px", color: "#6366F1", flexShrink: 0 }} />
              <p className="text-[#64748B]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
                Find players in matchmaking and connect as peers to unlock detailed rating comparisons.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
