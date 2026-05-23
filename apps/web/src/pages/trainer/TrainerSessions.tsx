import { useState, useEffect, useMemo } from "react";
import { apiClient, useBatches, useCurrentUser, useMarkAttendance } from "@sportza/api-client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ClipboardCheck, Users, Calendar, Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { format } from "date-fns";

type TabFilter = "all" | "upcoming" | "completed" | "cancelled";

interface Session {
  id: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  attendance?: Array<{
    id: number;
    present?: boolean;
    status?: string;
    player?: { id?: number; name?: string; email?: string };
  }>;
}

function attendanceIsPresent(a: { present?: boolean; status?: string }) {
  if (a.present !== undefined) return a.present;
  const s = (a.status ?? "").toLowerCase();
  return s === "present" || s === "late" || s === "excused";
}

interface BatchSession extends Session {
  batch?: { id: number; name?: string };
}

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" }, { id: "cancelled", label: "Cancelled" },
];

function AttendanceSheet({ session, onClose, onSave, isLoading }: {
  session: BatchSession; onClose: () => void;
  onSave: (data: Array<{ playerId: number; present: boolean }>) => void;
  isLoading: boolean;
}) {
  const batchId = session.batch?.id;
  const { data: batchRes } = useQuery<any>({
    queryKey: ["batches", batchId],
    queryFn: () => apiClient.get(`/batches/${batchId}`).then((r) => r.data),
    enabled: !!batchId,
  });
  const memberships: any[] = batchRes?.data?.memberships ?? batchRes?.memberships ?? [];
  const players = memberships
    .filter((m: any) => m.status === "active")
    .map((m: any) => ({ id: m.player?.id ?? m.playerId ?? 0, name: m.player?.name ?? m.player?.email ?? "?" }))
    .filter((p) => p.id > 0);

  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const playerIdsKey = players.map((p) => p.id).join(",");
  const attKey =
    session.attendance?.map((a) => `${a.player?.id}:${a.status ?? a.present}`).join(",") ?? "";

  useEffect(() => {
    if (players.length === 0) return;
    const map: Record<number, boolean> = {};
    for (const p of players) {
      const att = session.attendance?.find((a) => a.player?.id === p.id);
      map[p.id] = att ? attendanceIsPresent(att) : true;
    }
    setChecked(map);
  }, [session.id, playerIdsKey, attKey]);

  const presentCount = Object.values(checked).filter(Boolean).length;
  const absentCount  = players.length - presentCount;
  const allPresent   = players.length > 0 && presentCount === players.length;
  const allAbsent    = players.length > 0 && absentCount  === players.length;

  const markAll = (present: boolean) =>
    setChecked(Object.fromEntries(players.map((p) => [p.id, present])));

  const toggle = (id: number) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: "520px",
          borderRadius: "20px 20px 0 0",
          backgroundColor: "#1E293B",
          height: "auto",
          maxHeight: "calc(100svh - 80px)",
          marginBottom: "80px",
          flexShrink: 0,
        }}
      >
        {/* ── Header ── */}
        <div
          className="px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white" style={{ fontSize: "18px", fontWeight: "800" }}>
                Mark Attendance
              </p>
              <p className="text-[#64748B] mt-0.5" style={{ fontSize: "13px" }}>
                {session.batch?.name}
                {session.date ? ` · ${format(new Date(session.date), "dd MMM yyyy")}` : ""}
                {session.startTime ? ` · ${session.startTime}` : ""}
                {session.endTime   ? `–${session.endTime}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              <X style={{ width: "16px", height: "16px", color: "#94A3B8" }} />
            </button>
          </div>

          {/* Summary pills + Mark All shortcuts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{ borderRadius: "999px", backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <CheckCircle2 style={{ width: "13px", height: "13px", color: "#22C55E" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#22C55E" }}>
                  {presentCount} Present
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{ borderRadius: "999px", backgroundColor: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <XCircle style={{ width: "13px", height: "13px", color: "#EF4444" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#EF4444" }}>
                  {absentCount} Absent
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => markAll(true)}
                disabled={allPresent}
                style={{
                  padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                  border: "none", cursor: allPresent ? "default" : "pointer",
                  backgroundColor: allPresent ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.12)",
                  color: allPresent ? "#475569" : "#22C55E",
                }}
              >
                All Present
              </button>
              <button
                onClick={() => markAll(false)}
                disabled={allAbsent}
                style={{
                  padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                  border: "none", cursor: allAbsent ? "default" : "pointer",
                  backgroundColor: allAbsent ? "rgba(255,255,255,0.04)" : "rgba(239,68,68,0.10)",
                  color: allAbsent ? "#475569" : "#EF4444",
                }}
              >
                All Absent
              </button>
            </div>
          </div>
        </div>

        {/* ── Player list — scrollable ── */}
        <div className="px-4 py-3 space-y-2 overflow-y-auto flex-1">
          {players.length === 0 ? (
            <div className="text-center py-10">
              <Users style={{ width: "32px", height: "32px", color: "#334155", margin: "0 auto 8px" }} />
              <p className="text-[#64748B]" style={{ fontSize: "14px" }}>No active players in this batch.</p>
            </div>
          ) : players.map((p) => {
            const isPresent = checked[p.id] ?? true;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-3"
                style={{
                  borderRadius: "14px",
                  backgroundColor: isPresent ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)",
                  border: `1px solid ${isPresent ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.18)"}`,
                }}
              >
                {/* Avatar */}
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    background: isPresent
                      ? "linear-gradient(135deg,#22C55E,#16A34A)"
                      : "linear-gradient(135deg,#475569,#334155)",
                    fontSize: "15px", fontWeight: "700", color: "#fff",
                  }}
                >
                  {p.name[0].toUpperCase()}
                </div>

                {/* Name */}
                <span className="flex-1 text-white" style={{ fontSize: "15px", fontWeight: "600" }}>
                  {p.name}
                </span>

                {/* Present / Absent toggle */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { if (!isPresent) toggle(p.id); }}
                    style={{
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                      border: "none", cursor: isPresent ? "default" : "pointer", transition: "all 0.15s",
                      backgroundColor: isPresent ? "#22C55E" : "rgba(255,255,255,0.06)",
                      color: isPresent ? "#fff" : "#475569",
                    }}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => { if (isPresent) toggle(p.id); }}
                    style={{
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                      border: "none", cursor: isPresent ? "pointer" : "default", transition: "all 0.15s",
                      backgroundColor: !isPresent ? "#EF4444" : "rgba(255,255,255,0.06)",
                      color: !isPresent ? "#fff" : "#475569",
                    }}
                  >
                    Absent
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Save — always pinned at bottom ── */}
        <div
          className="px-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px 18px" }}
        >
          <button
            disabled={isLoading || players.length === 0}
            onClick={() => onSave(players.map((p) => ({ playerId: p.id, present: checked[p.id] ?? true })))}
            className="w-full py-4"
            style={{
              borderRadius: "14px",
              background: players.length === 0
                ? "#1E293B"
                : "linear-gradient(135deg,#3B82F6,#2563EB)",
              fontSize: "15px", fontWeight: "700", color: "#fff",
              cursor: isLoading || players.length === 0 ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading
              ? "Saving…"
              : `Save Attendance · ${presentCount} Present, ${absentCount} Absent`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainerSessions() {
  const [filter, setFilter] = useState<TabFilter>("all");
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<BatchSession | null>(null);
  const qc = useQueryClient();

  const { data: userRes } = useCurrentUser();
  const trainerId = (userRes as any)?.user?.id;
  const { data: batchesRes } = useBatches({ trainerId, page: 1, limit: 50 });
  const batches: any[] = (batchesRes as any)?.data ?? [];

  const sessionsQueries = useQueries({
    queries: batches.map((b: any) => ({
      queryKey: ["batches", b.id, "sessions"] as const,
      queryFn: () => apiClient.get(`/batches/${b.id}/sessions`).then((r) => r.data).catch(() => ({ data: [] })),
      enabled: !!b.id,
    })),
  });

  const allSessions: BatchSession[] = batches.flatMap((b: any, i: number) => {
    const res: any = sessionsQueries[i]?.data;
    const list: Session[] = res?.data ?? res ?? [];
    return list.map((s) => ({ ...s, batch: { id: b.id, name: b.name } }));
  });

  const now = new Date();
  const filtered = allSessions.filter((s) => {
    const d = s.date ? new Date(s.date) : null;
    const past = d && d < now;
    const status = (s.status ?? "").toLowerCase();
    if (filter === "upcoming")  return !past && status !== "cancelled";
    if (filter === "completed") return !!past && status !== "cancelled";
    if (filter === "cancelled") return status === "cancelled";
    return true;
  });

  const markAttendanceMutation = useMarkAttendance();
  const handleMarkAttendance = (sessionId: number, attendance: Array<{ playerId: number; present: boolean }>) => {
    markAttendanceMutation.mutate(
      { sessionId, attendance: attendance.map((a) => ({ playerId: a.playerId, status: a.present ? "present" as const : "absent" as const })) },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches"] }); setAttendanceSession(null); } }
    );
  };

  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const todaySessions = useMemo(() => {
    return filtered.filter((s) => {
      if (!s.date) return false;
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === todayStart.getTime();
    });
  }, [filtered, todayStart]);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Sessions</h1>
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {todaySessions.length > 0 && (
        <div className="px-4 mb-4 max-w-md mx-auto">
          <div className="p-4" style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
            <p className="text-white mb-2" style={{ fontSize: "13px", fontWeight: "700" }}>Today — mark attendance</p>
            <p className="text-[#94A3B8] mb-3" style={{ fontSize: "12px" }}>
              Tap Mark Attendance on each session so you don&apos;t forget.
            </p>
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAttendanceSession(s)}
                  className="w-full text-left p-3 flex items-center justify-between"
                  style={{ borderRadius: "10px", backgroundColor: "#0F172A" }}
                >
                  <span className="text-white" style={{ fontSize: "13px" }}>{s.batch?.name}</span>
                  <span className="text-[#3B82F6]" style={{ fontSize: "12px", fontWeight: "700" }}>Open</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className="flex-shrink-0 px-4 py-2"
              style={{ borderRadius: "10px", fontSize: "13px", fontWeight: active ? "700" : "500",
                backgroundColor: active ? "#3B82F6" : "#1E293B",
                color: active ? "#fff" : "#64748B",
                border: active ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        {filtered.length === 0 ? (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <Calendar style={{ width: "36px", height: "36px", color: "#334155", margin: "0 auto 8px" }} />
            <p className="text-[#64748B]">No sessions match this filter.</p>
          </div>
        ) : filtered.map((s) => {
          const isExpanded = expandedSession === s.id;
          const attendance = s.attendance ?? [];
          const presentCount = attendance.filter((a) => attendanceIsPresent(a)).length;

          return (
            <div key={s.id} style={{ borderRadius: "16px", backgroundColor: "#1E293B", overflow: "hidden" }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedSession(isExpanded ? null : s.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white mb-0.5" style={{ fontSize: "15px", fontWeight: "700" }}>
                      {s.batch?.name ?? "Batch"}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1 text-[#64748B]">
                        <Calendar style={{ width: "12px", height: "12px" }} />
                        <span style={{ fontSize: "12px" }}>
                          {s.date ? format(new Date(s.date), "dd MMM yyyy") : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[#64748B]">
                        <Clock style={{ width: "12px", height: "12px" }} />
                        <span style={{ fontSize: "12px" }}>{s.startTime ?? "—"} – {s.endTime ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 px-2 py-1"
                      style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.12)" }}>
                      <Users style={{ width: "11px", height: "11px", color: "#3B82F6" }} />
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6" }}>{presentCount}</span>
                    </div>
                    {isExpanded
                      ? <ChevronUp style={{ width: "16px", height: "16px", color: "#475569" }} />
                      : <ChevronDown style={{ width: "16px", height: "16px", color: "#475569" }} />}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setAttendanceSession(s); }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-2"
                  style={{ borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.1)", fontSize: "12px", fontWeight: "600", color: "#3B82F6" }}>
                  <ClipboardCheck style={{ width: "13px", height: "13px" }} />
                  Mark Attendance
                </button>
              </div>

              {isExpanded && attendance.length > 0 && (
                <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[#64748B] mt-3 mb-2" style={{ fontSize: "12px", fontWeight: "600" }}>ATTENDANCE</p>
                  {attendance.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-1.5">
                      <span className="text-white" style={{ fontSize: "13px" }}>
                        {a.player?.name ?? a.player?.email ?? "Unknown"}
                      </span>
                      <div className="flex items-center gap-1">
                        {attendanceIsPresent(a)
                          ? <CheckCircle2 style={{ width: "14px", height: "14px", color: "#22C55E" }} />
                          : <XCircle style={{ width: "14px", height: "14px", color: "#EF4444" }} />}
                        <span style={{ fontSize: "11px", fontWeight: "700", color: attendanceIsPresent(a) ? "#22C55E" : "#EF4444" }}>
                          {attendanceIsPresent(a) ? "Present" : "Absent"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {attendanceSession && (
        <AttendanceSheet
          session={attendanceSession}
          onClose={() => setAttendanceSession(null)}
          onSave={(att) => handleMarkAttendance(attendanceSession.id, att)}
          isLoading={markAttendanceMutation.isPending}
        />
      )}
    </div>
  );
}
