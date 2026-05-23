import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, useBatches, useCurrentUser } from "@sportza/api-client";
import { useQueries } from "@tanstack/react-query";
import { addDays, startOfWeek, format, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export default function TrainerBatchCalendar() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: userRes } = useCurrentUser();
  const trainerId = (userRes as any)?.user?.id;
  const { data: batchesRes } = useBatches({ trainerId, page: 1, limit: 50 });
  const batches: any[] = (batchesRes as any)?.data ?? [];

  const sessionsQueries = useQueries({
    queries: batches.map((b: any) => ({
      queryKey: ["batches", b.id, "sessions", "calendar"] as const,
      queryFn: () => apiClient.get(`/batches/${b.id}/sessions`, { params: { limit: 200 } }).then((r) => r.data),
      enabled: !!b.id,
    })),
  });

  const sessionsByBatch = useMemo(() => {
    return batches.map((b: any, i: number) => {
      const res: any = sessionsQueries[i]?.data;
      const list = res?.data ?? [];
      return { batch: b, sessions: list as Array<{ id: number; date?: string; startTime?: string; endTime?: string }> };
    });
  }, [batches, sessionsQueries]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fillStats = useMemo(() => {
    return batches.map((b: any) => {
      const cap = b.capacity ?? 20;
      const filled = b._count?.memberships ?? 0;
      const pct = cap > 0 ? Math.round((filled / cap) * 100) : 0;
      return { id: b.id, name: b.name, filled, cap, pct };
    });
  }, [batches]);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Batch calendar</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Sessions & fill rates</p>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between p-3" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="p-2"
            style={{ borderRadius: "8px", backgroundColor: "#0F172A" }}
          >
            <ChevronLeft style={{ width: "18px", color: "#94A3B8" }} />
          </button>
          <div className="flex items-center gap-2 text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
            <Calendar style={{ width: "16px", color: "#3B82F6" }} />
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          </div>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="p-2"
            style={{ borderRadius: "8px", backgroundColor: "#0F172A" }}
          >
            <ChevronRight style={{ width: "18px", color: "#94A3B8" }} />
          </button>
        </div>

        <div>
          <p className="text-[#94A3B8] mb-2 px-1" style={{ fontSize: "12px", fontWeight: "600" }}>
            Fill rate (students / capacity)
          </p>
          <div className="space-y-2">
            {fillStats.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/trainer/batches/${s.id}`)}
                className="w-full text-left p-3 flex items-center justify-between"
                style={{ borderRadius: "12px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>{s.name}</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: s.pct >= 80 ? "#22C55E" : s.pct >= 50 ? "#F59E0B" : "#EF4444" }}>
                  {s.filled}/{s.cap} ({s.pct}%)
                </span>
              </button>
            ))}
            {fillStats.length === 0 && (
              <p className="text-[#64748B] text-center py-4" style={{ fontSize: "14px" }}>No batches yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[#94A3B8] px-1" style={{ fontSize: "12px", fontWeight: "600" }}>Week view</p>
          {days.map((day) => {
            const items = sessionsByBatch.flatMap(({ batch, sessions }) =>
              sessions
                .filter((s) => s.date && isSameDay(new Date(s.date), day))
                .map((s) => ({ batch, s }))
            );
            return (
              <div key={day.toISOString()} className="p-3" style={{ borderRadius: "14px", backgroundColor: "#1E293B" }}>
                <p className="text-white mb-2" style={{ fontSize: "13px", fontWeight: "700" }}>
                  {format(day, "EEE d MMM")}
                </p>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-[#475569]" style={{ fontSize: "12px" }}>No sessions</p>
                  ) : (
                    items.map(({ batch, s }) => (
                      <div
                        key={`${batch.id}-${s.id}`}
                        className="flex items-center justify-between py-2 px-2"
                        style={{ borderRadius: "8px", backgroundColor: "#0F172A" }}
                      >
                        <span className="text-[#E2E8F0]" style={{ fontSize: "12px" }}>{batch.name}</span>
                        <span className="text-[#64748B]" style={{ fontSize: "11px" }}>
                          {s.startTime}–{s.endTime}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
