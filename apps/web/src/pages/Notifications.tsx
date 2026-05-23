import { useNavigate } from "react-router-dom";
import { useNotifications, useMarkRead, useMarkAllRead } from "@sportza/api-client";
import {
  ArrowLeft,
  Bell,
  Megaphone,
  UserPlus,
  Wallet,
  AlertCircle,
  CheckCheck,
  Loader2,
  ChevronRight,
  Calendar,
  XCircle,
  RotateCcw,
  Swords,
  Users,
  CheckCircle2,
  ShieldAlert,
  Mail,
  TrendingUp,
  Trophy,
  BookOpen,
  Lock,
  UserMinus,
  UserX,
  RefreshCw,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(items: any[]): { label: string; items: any[] }[] {
  const groups: Map<string, any[]> = new Map();
  for (const item of items) {
    const label = dateLabel(item.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Type icon + color ────────────────────────────────────────────────────────

function typeConfig(type: string): { icon: React.ElementType; color: string; bg: string } {
  switch (type) {
    // ── Training / Batch ────────────────────────────────────────
    case "BATCH_ANNOUNCEMENT":
      return { icon: Megaphone,    color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };
    case "BATCH_NEW_MEMBER":
      return { icon: UserPlus,     color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "BATCH_MEMBER_APPROVED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "BATCH_MEMBER_REJECTED":
      return { icon: XCircle,      color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };
    case "BATCH_MEMBER_ADDED":
      return { icon: UserPlus,     color: "#6366F1", bg: "rgba(99,102,241,0.15)"  };
    case "PAYMENT_RECORDED":
      return { icon: Wallet,       color: "#A855F7", bg: "rgba(168,85,247,0.15)"  };
    case "PAYMENT_REMINDER":
      return { icon: AlertCircle,  color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };

    // ── Peer invites ────────────────────────────────────────────
    case "PEER_INVITE_RECEIVED":
      return { icon: Swords,       color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };
    case "PEER_INVITE_ACCEPTED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "PEER_INVITE_DECLINED":
      return { icon: XCircle,      color: "#94A3B8", bg: "rgba(148,163,184,0.15)" };
    case "PEER_INVITE_CANCELLED":
      return { icon: XCircle,      color: "#94A3B8", bg: "rgba(148,163,184,0.15)" };

    // ── Peer relationships ───────────────────────────────────────
    case "PEER_REQUEST_RECEIVED":
      return { icon: Users,        color: "#8B5CF6", bg: "rgba(139,92,246,0.15)"  };
    case "PEER_REQUEST_ACCEPTED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "PEER_REQUEST_DECLINED":
      return { icon: XCircle,      color: "#94A3B8", bg: "rgba(148,163,184,0.15)" };

    // ── Bookings ────────────────────────────────────────────────
    case "BOOKING_CONFIRMED":
      return { icon: Calendar,     color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "BOOKING_CANCELLED":
      return { icon: XCircle,      color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };
    case "BOOKING_CANCELLED_OWNER":
      return { icon: ShieldAlert,  color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };

    // ── Refunds ──────────────────────────────────────────────────
    case "REFUND_INITIATED":
      return { icon: RotateCcw,    color: "#6366F1", bg: "rgba(99,102,241,0.15)"  };
    case "REFUND_COMPLETED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "REFUND_FAILED":
      return { icon: AlertCircle,  color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };

    // ── Open play ────────────────────────────────────────────────
    case "OPEN_PLAY_PLAYER_JOINED":
      return { icon: UserPlus,     color: "#10B981", bg: "rgba(16,185,129,0.15)"  };
    case "OPEN_PLAY_CONFIRMED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "OPEN_PLAY_CANCELLED":
      return { icon: XCircle,      color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };
    case "OPEN_PLAY_DEADLINE_MISSED":
      return { icon: AlertCircle,  color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };

    // ── Wallet ───────────────────────────────────────────────────
    case "WALLET_CREDITED":
      return { icon: Wallet,       color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "WALLET_DEBITED":
      return { icon: Wallet,       color: "#A855F7", bg: "rgba(168,85,247,0.15)"  };

    // ── Payments ─────────────────────────────────────────────────
    case "PAYMENT_CAPTURED":
      return { icon: Wallet,       color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "PAYMENT_FAILED":
      return { icon: Wallet,       color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };

    // ── Split bookings ────────────────────────────────────────────
    case "SPLIT_PARTICIPANT_JOINED":
      return { icon: Users,        color: "#10B981", bg: "rgba(16,185,129,0.15)"  };
    case "SPLIT_PARTICIPANT_LEFT":
      return { icon: Users,        color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };
    case "SPLIT_FULLY_FUNDED":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };

    // ── Matches ───────────────────────────────────────────────────
    case "MATCH_SCHEDULED":
      return { icon: Swords,       color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };
    case "MATCH_LIVE":
      return { icon: Swords,       color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };
    case "MATCH_COMPLETED":
      return { icon: Swords,       color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "RATING_CHANGED":
      return { icon: TrendingUp,   color: "#8B5CF6", bg: "rgba(139,92,246,0.15)"  };

    // ── Tournaments ───────────────────────────────────────────────
    case "TOURNAMENT_ANNOUNCEMENT":
      return { icon: Trophy,       color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };
    case "TOURNAMENT_STARTED":
      return { icon: Trophy,       color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "TOURNAMENT_COMPLETED":
      return { icon: Trophy,       color: "#A855F7", bg: "rgba(168,85,247,0.15)"  };
    case "TOURNAMENT_PLAYER_ADDED":
      return { icon: Trophy,       color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };
    case "TOURNAMENT_STAGE_ADVANCED":
      return { icon: Trophy,       color: "#10B981", bg: "rgba(16,185,129,0.15)"  };

    // ── Batch / Training (remaining) ──────────────────────────────
    case "BATCH_SESSION_SCHEDULED":
      return { icon: BookOpen,     color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };
    case "BATCH_REVIEW_POSTED":
      return { icon: BookOpen,     color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "BATCH_REVIEW_RECEIVED":
      return { icon: BookOpen,     color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };
    case "BATCH_DEACTIVATED":
      return { icon: BookOpen,     color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };
    case "BATCH_MEMBER_LEFT":
      return { icon: BookOpen,     color: "#94A3B8", bg: "rgba(148,163,184,0.15)" };

    // ── Open play (remaining) ─────────────────────────────────────
    case "OPEN_PLAY_SESSION_FULL":
      return { icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.15)"   };
    case "OPEN_PLAY_SETTLED":
      return { icon: Lock,         color: "#8B5CF6", bg: "rgba(139,92,246,0.15)"  };
    case "OPEN_PLAY_PLAYER_REMOVED":
      return { icon: UserX,        color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };

    // ── Peer (remaining) ──────────────────────────────────────────
    case "PEER_REMOVED":
      return { icon: UserMinus,    color: "#EF4444", bg: "rgba(239,68,68,0.15)"   };

    // ── Account / Security ────────────────────────────────────────
    case "PASSWORD_CHANGED":
      return { icon: ShieldAlert,  color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  };
    case "ROLE_SWITCHED":
      return { icon: RefreshCw,    color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  };

    default:
      return { icon: Bell,         color: "#64748B", bg: "rgba(100,116,139,0.15)" };
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif, onRead }: { notif: any; onRead: (id: number) => void }) {
  const navigate = useNavigate();
  const { icon: Icon, color, bg } = typeConfig(notif.type);
  const batchId = (notif.data as any)?.batchId;

  function handleClick() {
    if (!notif.isRead) onRead(notif.id);
    if (batchId) navigate(`/trainer/batches/${batchId}`);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-white/5"
      style={{ opacity: notif.isRead ? 0.65 : 1 }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: bg }}
      >
        <Icon style={{ width: "20px", height: "20px", color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-white leading-snug"
            style={{ fontSize: "14px", fontWeight: notif.isRead ? "500" : "700" }}
          >
            {notif.title}
          </p>
          <span className="text-[#64748B] flex-shrink-0" style={{ fontSize: "11px" }}>
            {relativeTime(notif.createdAt)}
          </span>
        </div>
        <p className="text-[#94A3B8] mt-0.5 leading-snug" style={{ fontSize: "13px" }}>
          {notif.body}
        </p>
      </div>

      {/* Unread dot + chevron */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
        {!notif.isRead && (
          <span
            style={{ width: "8px", height: "8px", borderRadius: "999px", backgroundColor: "#3B82F6" }}
          />
        )}
        {batchId && (
          <ChevronRight style={{ width: "16px", height: "16px", color: "#475569" }} />
        )}
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useNotifications({ limit: 50 });
  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications: any[] = (data as any)?.data ?? [];
  const unreadCount: number  = (data as any)?.unreadCount ?? 0;
  const groups = groupByDate(notifications);

  function handleMarkRead(id: number) {
    markRead.mutate(id);
  }

  function handleMarkAll() {
    markAllRead.mutate();
  }

  return (
    <div className="pb-32 max-w-md mx-auto">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 pt-6 pb-4 sticky top-0 z-10"
        style={{ backgroundColor: "#0F172A" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <ArrowLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
          </button>
          <div>
            <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "700" }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "600" }}>
                {unreadCount} unread
              </p>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markAllRead.isPending}
            className="flex items-center gap-1.5 px-3 py-2"
            style={{
              borderRadius: "10px",
              backgroundColor: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.2)",
              fontSize: "12px",
              fontWeight: "700",
              color: "#3B82F6",
            }}
          >
            {markAllRead.isPending ? (
              <Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" />
            ) : (
              <CheckCheck style={{ width: "14px", height: "14px" }} />
            )}
            Mark all read
          </button>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#3B82F6]" style={{ width: "32px", height: "32px" }} />
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <AlertCircle style={{ width: "40px", height: "40px", color: "#EF4444" }} className="mb-3" />
          <p className="text-[#EF4444]" style={{ fontSize: "15px", fontWeight: "600" }}>
            Failed to load notifications
          </p>
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div
            className="flex items-center justify-center mb-4"
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              backgroundColor: "rgba(59,130,246,0.1)",
            }}
          >
            <Bell style={{ width: "36px", height: "36px", color: "#3B82F6" }} />
          </div>
          <p className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "700" }}>
            All caught up!
          </p>
          <p className="text-[#64748B]" style={{ fontSize: "14px" }}>
            Booking confirmations, peer invites, batch announcements, payment updates, and session alerts will appear here.
          </p>
        </div>
      )}

      {/* ── Grouped list ── */}
      {!isLoading && !isError && groups.length > 0 && (
        <div className="space-y-6 px-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p
                className="text-[#64748B] mb-2 px-1"
                style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                {group.label}
              </p>
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: "16px",
                  backgroundColor: "#1E293B",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {group.items.map((notif, i) => (
                  <div
                    key={notif.id}
                    style={{
                      borderBottom:
                        i < group.items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      backgroundColor: notif.isRead ? "transparent" : "rgba(59,130,246,0.04)",
                    }}
                  >
                    <NotifRow notif={notif} onRead={handleMarkRead} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
