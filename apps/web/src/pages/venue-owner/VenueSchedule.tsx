/**
 * Venue Schedule — Full scheduling control for venue owners
 *
 * Tabs:
 *   Weekly Hours  — per-day open/close, slot duration, break times
 *   Exceptions    — holidays, events, maintenance blocks
 *   Preview       — visual slot preview for any date
 *   Bulk Block    — block multiple date ranges in one action
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import {
  ChevronLeft, Clock, Plus, X, Trash2, Copy,
  CheckCircle2, AlertCircle, Calendar, Eye, Layers,
  ToggleLeft, ToggleRight, Settings,
} from "lucide-react";
import {
  useMyVenues,
  useVenueFacilities,
  useFacilitySchedule,
  useFacilityExceptions,
  useSchedulePreview,
  useUpsertWeeklySchedule,
  useAddScheduleException,
  useDeleteScheduleException,
  useBulkBlockSchedule,
  useCopySchedule,
  type DaySchedule,
  type BreakTime,
} from "@sportza/api-client";

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "90 min", value: 90 },
  { label: "2 hours", value: 120 },
];
const EXCEPTION_TYPES = [
  { value: "holiday",      label: "Holiday",     color: "#EF4444" },
  { value: "maintenance",  label: "Maintenance", color: "#F59E0B" },
  { value: "event",        label: "Event",       color: "#8B5CF6" },
  { value: "custom_hours", label: "Custom Hours", color: "#3B82F6" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  backgroundColor: "#0F172A",
  border: "1.5px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#F1F5F9",
  fontSize: "13px",
  height: "40px",
  paddingLeft: "10px",
  paddingRight: "10px",
  outline: "none",
  width: "100%",
};
const selectSt: React.CSSProperties = { ...inputSt, appearance: "none" };
const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: "600", color: "#94A3B8",
  marginBottom: "4px", display: "block", textTransform: "uppercase",
};

const DEFAULT_SCHEDULE: DaySchedule = {
  dayOfWeek: 0, isOpen: true, openTime: "06:00",
  closeTime: "23:00", slotDuration: 60, breakTimes: [],
};

function makeDefaultWeek(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    ...DEFAULT_SCHEDULE,
    dayOfWeek: i,
    isOpen: i !== 0, // close Sundays by default
  }));
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="fixed top-5 left-1/2 z-50 flex items-center gap-2 px-4 py-3"
      style={{
        transform: "translateX(-50%)",
        borderRadius: "14px",
        backgroundColor: type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        border: `1px solid ${type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
        backdropFilter: "blur(10px)",
        maxWidth: "90vw",
      }}
    >
      {type === "success"
        ? <CheckCircle2 style={{ width: "16px", height: "16px", color: "#22C55E", flexShrink: 0 }} />
        : <AlertCircle  style={{ width: "16px", height: "16px", color: "#EF4444", flexShrink: 0 }} />}
      <p style={{ fontSize: "13px", color: "#F1F5F9" }}>{msg}</p>
    </div>
  );
}

// ─── Sheet wrapper ────────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          maxHeight: "92dvh",
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-4 flex-shrink-0">
          <span className="text-white" style={{ fontSize: "17px", fontWeight: "800" }}>{title}</span>
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

// ─── Break Time editor ────────────────────────────────────────────────────────
function BreakTimesEditor({ breaks, onChange }: { breaks: BreakTime[]; onChange: (b: BreakTime[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase" }}>Break Times</span>
        <button
          type="button"
          onClick={() => onChange([...breaks, { start: "13:00", end: "14:00" }])}
          className="flex items-center gap-1 px-2 py-1"
          style={{ borderRadius: "6px", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <Plus style={{ width: "10px", height: "10px", color: "#3B82F6" }} />
          <span style={{ fontSize: "11px", color: "#3B82F6", fontWeight: "600" }}>Add</span>
        </button>
      </div>
      {breaks.length === 0 && (
        <p style={{ fontSize: "12px", color: "#475569" }}>No breaks — slots run continuously</p>
      )}
      {breaks.map((b, idx) => (
        <div key={idx} className="flex items-center gap-2 mb-2">
          <input
            type="time"
            value={b.start}
            onChange={(e) => {
              const next = [...breaks];
              next[idx] = { ...next[idx], start: e.target.value };
              onChange(next);
            }}
            style={{ ...inputSt, width: "auto", flex: 1 }}
          />
          <span style={{ fontSize: "12px", color: "#64748B" }}>–</span>
          <input
            type="time"
            value={b.end}
            onChange={(e) => {
              const next = [...breaks];
              next[idx] = { ...next[idx], end: e.target.value };
              onChange(next);
            }}
            style={{ ...inputSt, width: "auto", flex: 1 }}
          />
          <button
            type="button"
            onClick={() => onChange(breaks.filter((_, i) => i !== idx))}
            style={{ padding: "6px", borderRadius: "6px", backgroundColor: "rgba(239,68,68,0.1)", flexShrink: 0 }}
          >
            <Trash2 style={{ width: "12px", height: "12px", color: "#EF4444" }} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Day Row editor ───────────────────────────────────────────────────────────
function DayRow({
  day,
  onChange,
  onExpand,
  expanded,
}: {
  day: DaySchedule;
  onChange: (d: DaySchedule) => void;
  onExpand: () => void;
  expanded: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: "14px",
        backgroundColor: "#1E293B",
        border: day.isOpen ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(255,255,255,0.06)",
        marginBottom: "8px",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Day toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...day, isOpen: !day.isOpen })}
          style={{ flexShrink: 0 }}
        >
          {day.isOpen
            ? <ToggleRight style={{ width: "26px", height: "26px", color: "#3B82F6" }} />
            : <ToggleLeft  style={{ width: "26px", height: "26px", color: "#475569" }} />}
        </button>
        {/* Day name */}
        <span className="font-bold" style={{ fontSize: "14px", color: day.isOpen ? "#F1F5F9" : "#475569", width: "36px", flexShrink: 0 }}>
          {DAY_FULL[day.dayOfWeek].slice(0, 3)}
        </span>
        {/* Summary or "Closed" */}
        {day.isOpen ? (
          <span style={{ fontSize: "12px", color: "#64748B", flex: 1 }}>
            {day.openTime}–{day.closeTime} · {SLOT_DURATIONS.find((s) => s.value === day.slotDuration)?.label ?? `${day.slotDuration}m`}
            {day.breakTimes.length > 0 && ` · ${day.breakTimes.length} break`}
          </span>
        ) : (
          <span style={{ fontSize: "12px", color: "#475569", flex: 1 }}>Closed</span>
        )}
        {/* Expand/collapse for open days */}
        {day.isOpen && (
          <button
            type="button"
            onClick={onExpand}
            style={{ padding: "4px 8px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <Settings style={{ width: "14px", height: "14px", color: expanded ? "#3B82F6" : "#64748B" }} />
          </button>
        )}
      </div>

      {/* Expanded edit panel */}
      {day.isOpen && expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <label style={labelSt}>Opens</label>
              <input
                type="time"
                value={day.openTime}
                onChange={(e) => onChange({ ...day, openTime: e.target.value })}
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Closes</label>
              <input
                type="time"
                value={day.closeTime}
                onChange={(e) => onChange({ ...day, closeTime: e.target.value })}
                style={inputSt}
              />
            </div>
          </div>

          <div>
            <label style={labelSt}>Slot Duration</label>
            <select
              value={day.slotDuration}
              onChange={(e) => onChange({ ...day, slotDuration: Number(e.target.value) })}
              style={selectSt}
            >
              {SLOT_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <BreakTimesEditor breaks={day.breakTimes} onChange={(b) => onChange({ ...day, breakTimes: b })} />
        </div>
      )}
    </div>
  );
}

// ─── Weekly Schedule Tab ──────────────────────────────────────────────────────
function WeeklyTab({
  facilityId,
  facilities,
  onToast,
}: {
  facilityId: number;
  facilities: Array<{ id: number; name?: string }>;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const { data: scheduleRes, isLoading } = useFacilitySchedule(facilityId);
  const upsert = useUpsertWeeklySchedule(facilityId);
  const copySchedule = useCopySchedule(facilityId);

  const serverDays: DaySchedule[] = (scheduleRes as any)?.data ?? [];
  const [localDays, setLocalDays] = useState<DaySchedule[]>(makeDefaultWeek());
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  useEffect(() => {
    if (serverDays.length === 7) {
      setLocalDays(serverDays.map((d: any) => ({
        ...d,
        breakTimes: Array.isArray(d.breakTimes) ? d.breakTimes : [],
      })));
    }
  }, [scheduleRes]);

  const handleSave = () => {
    upsert.mutate(localDays, {
      onSuccess: () => onToast("Schedule saved", "success"),
      onError: () => onToast("Failed to save schedule", "error"),
    });
  };

  const handleCopy = () => {
    if (copyTargets.length === 0) return;
    copySchedule.mutate(copyTargets, {
      onSuccess: () => { onToast(`Schedule copied to ${copyTargets.length} court(s)`, "success"); setCopyOpen(false); },
      onError: () => onToast("Copy failed", "error"),
    });
  };

  if (isLoading) {
    return <div className="space-y-2 pt-2">{[1,2,3,4,5,6,7].map((i) => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ backgroundColor: "#1E293B" }} />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Set operating hours for each day</p>
        {facilities.length > 1 && (
          <button
            onClick={() => setCopyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ borderRadius: "8px", backgroundColor: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}
          >
            <Copy style={{ width: "13px", height: "13px", color: "#8B5CF6" }} />
            <span style={{ fontSize: "12px", color: "#8B5CF6", fontWeight: "600" }}>Copy to…</span>
          </button>
        )}
      </div>

      {localDays.map((day) => (
        <DayRow
          key={day.dayOfWeek}
          day={day}
          onChange={(updated) => setLocalDays((prev) => prev.map((d) => d.dayOfWeek === updated.dayOfWeek ? updated : d))}
          expanded={expandedDay === day.dayOfWeek}
          onExpand={() => setExpandedDay((e) => e === day.dayOfWeek ? null : day.dayOfWeek)}
        />
      ))}

      <button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="w-full py-3.5 mt-2"
        style={{
          borderRadius: "14px",
          background: "linear-gradient(135deg,#3B82F6,#6366F1)",
          fontSize: "15px", fontWeight: "700", color: "#fff",
          opacity: upsert.isPending ? 0.7 : 1,
        }}
      >
        {upsert.isPending ? "Saving…" : "Save Schedule"}
      </button>

      {/* Copy modal */}
      {copyOpen && (
        <Sheet title="Copy Schedule To" onClose={() => setCopyOpen(false)}>
          <p className="text-[#64748B] mb-4" style={{ fontSize: "13px" }}>Select courts to apply this schedule to</p>
          <div className="space-y-2 mb-5">
            {facilities.filter((f) => f.id !== facilityId).map((f) => {
              const checked = copyTargets.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => setCopyTargets((prev) => checked ? prev.filter((id) => id !== f.id) : [...prev, f.id])}
                  className="w-full flex items-center justify-between p-3"
                  style={{ borderRadius: "12px", backgroundColor: checked ? "rgba(59,130,246,0.1)" : "#0F172A", border: `1px solid ${checked ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.06)"}` }}
                >
                  <span style={{ fontSize: "14px", color: "#F1F5F9", fontWeight: "600" }}>{f.name ?? `Facility ${f.id}`}</span>
                  {checked && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#3B82F6" }} />}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCopyOpen(false)} className="flex-1 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>Cancel</button>
            <button onClick={handleCopy} disabled={copyTargets.length === 0 || copySchedule.isPending} className="flex-1 py-3"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#8B5CF6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: copyTargets.length === 0 ? 0.5 : 1 }}>
              {copySchedule.isPending ? "Copying…" : `Copy to ${copyTargets.length} court(s)`}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ─── Exceptions Tab ───────────────────────────────────────────────────────────
function ExceptionsTab({
  facilityId,
  onToast,
}: {
  facilityId: number;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);

  const { data: excRes, isLoading } = useFacilityExceptions(facilityId, today, future);
  const addException = useAddScheduleException(facilityId);
  const deleteException = useDeleteScheduleException();
  const exceptions: any[] = (excRes as any)?.data ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    startDate: today,
    endDate:   today,
    type: "maintenance" as const,
    label: "",
    isFullBlock: true,
    customOpen: "09:00",
    customClose: "18:00",
    reason: "",
  });

  const handleAdd = () => {
    addException.mutate(form, {
      onSuccess: () => { onToast("Exception added", "success"); setAddOpen(false); },
      onError:   () => onToast("Failed to add exception", "error"),
    });
  };

  const exTypeColor = (type: string) => EXCEPTION_TYPES.find((t) => t.value === type)?.color ?? "#64748B";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Holidays, events, maintenance closures</p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5"
          style={{ borderRadius: "8px", background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
        >
          <Plus style={{ width: "13px", height: "13px", color: "#fff" }} />
          <span style={{ fontSize: "12px", color: "#fff", fontWeight: "600" }}>Add</span>
        </button>
      </div>

      {isLoading && [1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl animate-pulse mb-2" style={{ backgroundColor: "#1E293B" }} />)}

      {!isLoading && exceptions.length === 0 && (
        <div className="text-center py-10">
          <Calendar style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
          <p className="text-[#64748B]" style={{ fontSize: "14px" }}>No exceptions set</p>
          <p style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>Add holidays, events, or maintenance blocks</p>
        </div>
      )}

      {exceptions.map((exc) => (
        <div key={exc.id} className="flex items-start justify-between p-4 mb-2"
          style={{ borderRadius: "14px", backgroundColor: "#1E293B", border: `1px solid ${exTypeColor(exc.type)}33` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: "10px", fontWeight: "700", color: exTypeColor(exc.type), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {exc.type}
              </span>
              {exc.label && <span className="text-white" style={{ fontSize: "13px", fontWeight: "600" }}>{exc.label}</span>}
            </div>
            <p style={{ fontSize: "12px", color: "#64748B" }}>
              {exc.startDate === exc.endDate ? exc.startDate : `${exc.startDate} → ${exc.endDate}`}
              {exc.isFullBlock ? " · Full day blocked" : ` · Custom: ${exc.customOpen}–${exc.customClose}`}
            </p>
            {exc.reason && <p style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{exc.reason}</p>}
          </div>
          <button
            onClick={() => deleteException.mutate(exc.id, {
              onSuccess: () => onToast("Exception removed", "success"),
              onError:   () => onToast("Failed to remove", "error"),
            })}
            style={{ padding: "6px", borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.08)", flexShrink: 0, marginLeft: "8px" }}
          >
            <Trash2 style={{ width: "14px", height: "14px", color: "#EF4444" }} />
          </button>
        </div>
      ))}

      {addOpen && (
        <Sheet title="Add Exception" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            <div>
              <label style={labelSt}>Type</label>
              <div className="grid grid-cols-2 gap-2">
                {EXCEPTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value as any }))}
                    style={{
                      borderRadius: "10px", padding: "10px 8px",
                      backgroundColor: form.type === t.value ? `${t.color}18` : "#0F172A",
                      border: `1.5px solid ${form.type === t.value ? t.color : "rgba(255,255,255,0.06)"}`,
                      fontSize: "13px", fontWeight: "600", color: form.type === t.value ? t.color : "#64748B",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelSt}>Label (optional)</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Diwali, Annual Maintenance…" style={inputSt} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelSt}>Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={inputSt} />
              </div>
            </div>

            {/* Block type toggle */}
            <div>
              <label style={labelSt}>Block Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((full) => (
                  <button
                    key={String(full)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isFullBlock: full }))}
                    style={{
                      borderRadius: "10px", padding: "10px",
                      backgroundColor: form.isFullBlock === full ? "rgba(59,130,246,0.12)" : "#0F172A",
                      border: `1.5px solid ${form.isFullBlock === full ? "#3B82F6" : "rgba(255,255,255,0.06)"}`,
                      fontSize: "13px", fontWeight: "600",
                      color: form.isFullBlock === full ? "#3B82F6" : "#64748B",
                    }}
                  >
                    {full ? "Full Day Block" : "Custom Hours"}
                  </button>
                ))}
              </div>
            </div>

            {!form.isFullBlock && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelSt}>Open From</label>
                  <input type="time" value={form.customOpen} onChange={(e) => setForm((f) => ({ ...f, customOpen: e.target.value }))} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Close At</label>
                  <input type="time" value={form.customClose} onChange={(e) => setForm((f) => ({ ...f, customClose: e.target.value }))} style={inputSt} />
                </div>
              </div>
            )}

            <div>
              <label style={labelSt}>Reason (optional)</label>
              <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Internal note…" style={inputSt} />
            </div>

            {addException.isError && (
              <p style={{ fontSize: "12px", color: "#EF4444" }}>Failed to add exception — check dates.</p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setAddOpen(false)} className="flex-1 py-3"
                style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={addException.isPending} className="flex-1 py-3"
                style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: addException.isPending ? 0.7 : 1 }}>
                {addException.isPending ? "Adding…" : "Add Exception"}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ─── Preview Tab ──────────────────────────────────────────────────────────────
function PreviewTab({ facilityId }: { facilityId: number }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useSchedulePreview(facilityId, date);

  const preview = data as any;
  const slots: Array<{ startTime: string; endTime: string; status: string }> = preview?.slots ?? [];

  const statusStyle = (s: string) => ({
    available: { bg: "rgba(34,197,94,0.15)", text: "#22C55E", label: "Open" },
    booked:    { bg: "rgba(59,130,246,0.2)",  text: "#3B82F6", label: "Booked" },
    pending:   { bg: "rgba(245,158,11,0.18)", text: "#F59E0B", label: "Pending" },
  }[s] ?? { bg: "rgba(100,116,139,0.15)", text: "#64748B", label: s });

  const available = slots.filter((s) => s.status === "available").length;
  const booked    = slots.filter((s) => s.status === "booked").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <label style={labelSt}>Preview Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputSt} />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => setDate(format(addDays(new Date(date), -1), "yyyy-MM-dd"))}
            style={{ padding: "8px 10px", borderRadius: "8px", backgroundColor: "#1E293B", color: "#94A3B8", fontSize: "12px" }}>‹</button>
          <button onClick={() => setDate(format(addDays(new Date(date), 1), "yyyy-MM-dd"))}
            style={{ padding: "8px 10px", borderRadius: "8px", backgroundColor: "#1E293B", color: "#94A3B8", fontSize: "12px" }}>›</button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: "#1E293B" }} />)}</div>
      ) : preview?.closedReason ? (
        <div className="text-center py-10">
          <AlertCircle style={{ width: "40px", height: "40px", color: "#F59E0B", margin: "0 auto 12px" }} />
          <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Facility Closed</p>
          <p style={{ fontSize: "14px", color: "#64748B" }}>{preview.closedReason}</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex gap-3 mb-4">
            {[
              { label: "Total slots", value: slots.length, color: "#F1F5F9" },
              { label: "Available", value: available, color: "#22C55E" },
              { label: "Booked", value: booked, color: "#3B82F6" },
            ].map((s) => (
              <div key={s.label} className="flex-1 text-center py-2" style={{ borderRadius: "10px", backgroundColor: "#1E293B" }}>
                <p style={{ fontSize: "18px", fontWeight: "800", color: s.color }}>{s.value}</p>
                <p style={{ fontSize: "10px", color: "#64748B" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Slot list */}
          {slots.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748B", textAlign: "center", paddingTop: "20px" }}>No slots generated for this schedule</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => {
                const st = statusStyle(slot.status);
                return (
                  <div key={slot.startTime} className="flex flex-col px-3 py-2"
                    style={{ borderRadius: "10px", backgroundColor: st.bg, border: `1px solid ${st.text}22` }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: st.text }}>{slot.startTime}–{slot.endTime}</span>
                    <span style={{ fontSize: "10px", color: st.text, opacity: 0.8 }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Bulk Block Tab ───────────────────────────────────────────────────────────
function BulkBlockTab({
  facilityId,
  onToast,
}: {
  facilityId: number;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const bulkBlock = useBulkBlockSchedule(facilityId);
  const [ranges, setRanges] = useState([{ startDate: "", endDate: "" }]);
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"holiday" | "event" | "maintenance" | "custom_hours">("maintenance");
  const [done, setDone] = useState(false);

  const addRange = () => setRanges((r) => [...r, { startDate: "", endDate: "" }]);
  const removeRange = (i: number) => setRanges((r) => r.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    const filled = ranges.filter((r) => r.startDate && r.endDate);
    if (filled.length === 0) return;
    bulkBlock.mutate({ ranges: filled, label: label || undefined, reason: reason || undefined, type }, {
      onSuccess: (res) => {
        onToast(`${(res as any).count} block(s) created`, "success");
        setDone(true);
      },
      onError: () => onToast("Failed to create blocks", "error"),
    });
  };

  if (done) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 style={{ width: "48px", height: "48px", color: "#22C55E", margin: "0 auto 12px" }} />
        <p className="text-white mb-2" style={{ fontSize: "18px", fontWeight: "700" }}>Blocks created!</p>
        <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "20px" }}>Slots are now blocked for the selected dates</p>
        <button onClick={() => { setDone(false); setRanges([{ startDate: "", endDate: "" }]); setLabel(""); setReason(""); }}
          className="px-6 py-3" style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff" }}>
          Block More
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p style={{ fontSize: "12px", color: "#64748B" }}>Block multiple date ranges in one action — for maintenance, tournaments, or holidays.</p>

      {/* Type */}
      <div>
        <label style={labelSt}>Block Type</label>
        <div className="grid grid-cols-2 gap-2">
          {EXCEPTION_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setType(t.value as any)}
              style={{
                borderRadius: "10px", padding: "8px",
                backgroundColor: type === t.value ? `${t.color}18` : "#0F172A",
                border: `1.5px solid ${type === t.value ? t.color : "rgba(255,255,255,0.06)"}`,
                fontSize: "12px", fontWeight: "600", color: type === t.value ? t.color : "#64748B",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date ranges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label style={labelSt}>Date Ranges</label>
          <button onClick={addRange} className="flex items-center gap-1 px-2 py-1"
            style={{ borderRadius: "6px", backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Plus style={{ width: "10px", height: "10px", color: "#3B82F6" }} />
            <span style={{ fontSize: "11px", color: "#3B82F6", fontWeight: "600" }}>Add Range</span>
          </button>
        </div>
        {ranges.map((r, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input type="date" value={r.startDate}
              onChange={(e) => setRanges((prev) => prev.map((x, idx) => idx === i ? { ...x, startDate: e.target.value } : x))}
              style={{ ...inputSt, flex: 1 }} />
            <span style={{ fontSize: "12px", color: "#64748B" }}>→</span>
            <input type="date" value={r.endDate}
              onChange={(e) => setRanges((prev) => prev.map((x, idx) => idx === i ? { ...x, endDate: e.target.value } : x))}
              style={{ ...inputSt, flex: 1 }} />
            {ranges.length > 1 && (
              <button onClick={() => removeRange(i)} style={{ padding: "6px", borderRadius: "6px", backgroundColor: "rgba(239,68,68,0.08)", flexShrink: 0 }}>
                <X style={{ width: "12px", height: "12px", color: "#EF4444" }} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <label style={labelSt}>Label (optional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Annual Tournament" style={inputSt} />
      </div>
      <div>
        <label style={labelSt}>Reason (optional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Internal note for the team" style={inputSt} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={bulkBlock.isPending || ranges.every((r) => !r.startDate || !r.endDate)}
        className="w-full py-3.5"
        style={{
          borderRadius: "14px",
          background: "linear-gradient(135deg,#EF4444,#DC2626)",
          fontSize: "15px", fontWeight: "700", color: "#fff",
          opacity: bulkBlock.isPending ? 0.7 : 1,
        }}
      >
        {bulkBlock.isPending ? "Blocking…" : `Block ${ranges.filter((r) => r.startDate && r.endDate).length} Range(s)`}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "weekly",     label: "Weekly Hours", icon: Clock },
  { id: "exceptions", label: "Exceptions",   icon: Calendar },
  { id: "preview",    label: "Preview",      icon: Eye },
  { id: "bulk",       label: "Bulk Block",   icon: Layers },
];

export default function VenueSchedule() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("weekly");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const { data: venuesRes } = useMyVenues();
  const venues: Array<{ id: number; name?: string }> = (venuesRes as any)?.data ?? [];
  const [venueId, setVenueId] = useState<number | null>(null);
  const activeVenueId = venueId ?? venues[0]?.id ?? null;

  const { data: facilitiesRes } = useVenueFacilities(activeVenueId);
  const facilities: Array<{ id: number; name?: string }> = (facilitiesRes as any)?.data ?? [];
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const activeFacilityId = facilityId ?? facilities[0]?.id ?? null;

  // Keep facilityId in sync when venue changes
  useEffect(() => { setFacilityId(null); }, [activeVenueId]);
  useEffect(() => { if (facilities.length > 0 && !facilityId) setFacilityId(facilities[0].id); }, [facilities]);

  const addToast = (msg: string, type: "success" | "error") => setToast({ msg, type });

  return (
    <div className="min-h-screen bg-[#0F172A] pb-32">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#0F172A]">
        <div className="flex items-center gap-3 px-4 pt-6 pb-3">
          <button
            onClick={() => navigate("/venue-owner/facilities")}
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
          >
            <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Facility Schedule</h1>
            <p style={{ fontSize: "12px", color: "#64748B" }}>Availability, hours &amp; blocking</p>
          </div>
        </div>

        {/* Venue + Facility selectors */}
        <div className="px-4 pb-3 space-y-2">
          {venues.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {venues.map((v) => (
                <button key={v.id} onClick={() => setVenueId(v.id)}
                  className="flex-shrink-0 px-3 py-1.5"
                  style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600", backgroundColor: activeVenueId === v.id ? "#3B82F6" : "#1E293B", color: activeVenueId === v.id ? "#fff" : "#94A3B8", border: activeVenueId === v.id ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
                  {v.name ?? `Venue ${v.id}`}
                </button>
              ))}
            </div>
          )}

          {/* Court tabs */}
          {facilities.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {facilities.map((f) => (
                <button key={f.id} onClick={() => setFacilityId(f.id)}
                  className="flex-shrink-0 px-3 py-1.5"
                  style={{ borderRadius: "999px", fontSize: "12px", fontWeight: "600", backgroundColor: activeFacilityId === f.id ? "#F59E0B" : "#1E293B", color: activeFacilityId === f.id ? "#fff" : "#94A3B8", border: activeFacilityId === f.id ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
                  {f.name ?? `Court ${f.id}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0 transition-all"
                style={{
                  borderRadius: "10px",
                  backgroundColor: active ? "rgba(59,130,246,0.15)" : "transparent",
                  border: active ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                }}
              >
                <Icon style={{ width: "13px", height: "13px", color: active ? "#3B82F6" : "#64748B" }} />
                <span style={{ fontSize: "12px", fontWeight: "600", color: active ? "#3B82F6" : "#64748B" }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-2 max-w-md mx-auto">
        {!activeFacilityId ? (
          <div className="text-center py-16">
            <AlertCircle style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>No facilities found</p>
            <p style={{ fontSize: "14px", color: "#64748B" }}>Add a facility first from the Facilities page</p>
            <button
              onClick={() => navigate("/venue-owner/facilities")}
              className="mt-4 px-5 py-2.5"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
            >
              Go to Facilities
            </button>
          </div>
        ) : (
          <>
            {activeTab === "weekly"     && <WeeklyTab     facilityId={activeFacilityId} facilities={facilities} onToast={addToast} />}
            {activeTab === "exceptions" && <ExceptionsTab facilityId={activeFacilityId} onToast={addToast} />}
            {activeTab === "preview"    && <PreviewTab    facilityId={activeFacilityId} />}
            {activeTab === "bulk"       && <BulkBlockTab  facilityId={activeFacilityId} onToast={addToast} />}
          </>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
