/**
 * Venue Facilities — Manage courts, surfaces, sports, and pricing rules
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Pencil, Settings, CheckCircle2, XCircle,
  X, Building2, Layers, IndianRupee, ChevronLeft, ChevronRight, CalendarClock,
} from "lucide-react";
import { useMyVenues, useVenueFacilities, useCreateFacility, useUpdateFacility, apiClient } from "@sportza/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const facilitySchema = z.object({
  name:        z.string().min(1, "Name is required"),
  surfaceType: z.string().min(1, "Surface type is required"),
  sports:      z.string().min(1, "Sports are required"),
  count:       z.coerce.number().min(1, "Count must be at least 1"),
});
const pricingRuleSchema = z.object({
  ruleType:  z.string().min(1, "Rule type is required"),
  ruleValue: z.string().min(1, "Rule value is required"),
  metadata:  z.string().optional(),
});

type FacilityForm   = z.infer<typeof facilitySchema>;
type PricingRuleForm = z.infer<typeof pricingRuleSchema>;

const SURFACE_TYPES = ["Concrete", "Clay", "Synthetic", "Wood", "Carpet", "Grass"];
const RULE_TYPES    = ["weekday", "weekend", "peak", "off_peak", "hourly"];

// ─── Shared dark-input style ──────────────────────────────────────────────────
const inputSt = (err?: boolean): React.CSSProperties => ({
  width: "100%",
  height: "48px",
  borderRadius: "12px",
  backgroundColor: "#0F172A",
  border: `1.5px solid ${err ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"}`,
  color: "#F1F5F9",
  fontSize: "14px",
  paddingLeft: "14px",
  paddingRight: "14px",
  outline: "none",
});

const selectSt: React.CSSProperties = {
  ...inputSt(),
  appearance: "none",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "500" }}>{children}</label>;
}
function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-[#EF4444] mt-1" style={{ fontSize: "12px" }}>{msg}</p> : null;
}

// ─── Bottom Sheet wrapper ─────────────────────────────────────────────────────
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

// ─── Facility Form (shared by Add + Edit) ─────────────────────────────────────
function FacilityForm({
  defaultValues,
  onSubmit,
  onClose,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<FacilityForm>;
  onSubmit: (d: FacilityForm) => void;
  onClose: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FacilityForm>({
    resolver: zodResolver(facilitySchema),
    defaultValues: defaultValues ?? {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <FieldLabel>Facility Name</FieldLabel>
        <input {...register("name")} placeholder="e.g. Court 1" style={inputSt(!!errors.name)} />
        <FieldError msg={errors.name?.message} />
      </div>
      <div>
        <FieldLabel>Surface Type</FieldLabel>
        <div className="relative">
          <select {...register("surfaceType")} style={selectSt}>
            <option value="">Select…</option>
            {SURFACE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "14px", height: "14px", color: "#64748B", pointerEvents: "none" }} />
        </div>
        <FieldError msg={errors.surfaceType?.message} />
      </div>
      <div>
        <FieldLabel>Sports (comma-separated)</FieldLabel>
        <input {...register("sports")} placeholder="e.g. Tennis, Badminton" style={inputSt(!!errors.sports)} />
        <FieldError msg={errors.sports?.message} />
      </div>
      <div>
        <FieldLabel>Court Count</FieldLabel>
        <input {...register("count")} type="number" min={1} placeholder="1" style={inputSt(!!errors.count)} />
        <FieldError msg={errors.count?.message} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-3"
          style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-3"
          style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Pricing Rule Form ────────────────────────────────────────────────────────
function PricingForm({
  onSubmit, onClose, isPending,
}: { onSubmit: (d: PricingRuleForm) => void; onClose: () => void; isPending: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<PricingRuleForm>({
    resolver: zodResolver(pricingRuleSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <FieldLabel>Rule Type</FieldLabel>
        <div className="relative">
          <select {...register("ruleType")} style={selectSt}>
            {RULE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "14px", height: "14px", color: "#64748B", pointerEvents: "none" }} />
        </div>
        <FieldError msg={errors.ruleType?.message} />
      </div>
      <div>
        <FieldLabel>Rule Value (percentage or amount)</FieldLabel>
        <input {...register("ruleValue")} placeholder="e.g. 10 or 100" style={inputSt(!!errors.ruleValue)} />
        <FieldError msg={errors.ruleValue?.message} />
      </div>
      <div>
        <FieldLabel>Metadata (JSON, optional)</FieldLabel>
        <input {...register("metadata")} placeholder='{"key": "value"}' style={inputSt()} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-3"
          style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-3"
          style={{ borderRadius: "12px", background: "linear-gradient(135deg,#F59E0B,#D97706)", fontSize: "14px", fontWeight: "700", color: "#fff", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Adding…" : "Add Rule"}
        </button>
      </div>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type Facility = {
  id: number;
  name?: string;
  surfaceType?: string;
  sports?: string[];
  courtCount?: number;
  weekdayRate?: number;
  weekendRate?: number;
  active?: boolean;
};

export default function VenueFacilities() {
  const navigate = useNavigate();
  const [venueId,            setVenueId]            = useState<number | null>(null);
  const [addOpen,            setAddOpen]            = useState(false);
  const [editingFacility,    setEditingFacility]    = useState<Facility | null>(null);
  const [pricingFacilityId,  setPricingFacilityId]  = useState<number | null>(null);
  const [ruleOpen,           setRuleOpen]           = useState(false);
  const qc = useQueryClient();

  const { data: venuesRes } = useMyVenues();
  const venues: Array<{ id: number; name?: string }> = (venuesRes as any)?.data ?? [];
  const activeVenueId = venueId ?? venues[0]?.id ?? null;

  useEffect(() => {
    if (!venueId && venues[0]?.id) setVenueId(venues[0].id);
  }, [venues, venueId]);

  const { data: facilitiesRes, isLoading, isError } = useVenueFacilities(activeVenueId);
  const { data: rulesRes } = useQuery({
    queryKey: ["venues", activeVenueId, "pricing-rules"],
    queryFn:  () => apiClient.get(`/venues/${activeVenueId}/pricing-rules`).then((r) => r.data),
    enabled:  !!activeVenueId,
  });

  const facilities: Facility[] = (facilitiesRes as any)?.data ?? [];
  const pricingRules: Array<{ id: number; ruleType?: string; ruleValue?: string }> =
    (rulesRes as any)?.data ?? [];

  const createFacilityMutation = useCreateFacility(activeVenueId);
  const updateFacilityMutation = useUpdateFacility(activeVenueId);

  const createFacility = { mutate: (data: FacilityForm) => createFacilityMutation.mutate({
    name: data.name, surfaceType: data.surfaceType,
    sports: data.sports.split(",").map((s) => s.trim()), courtCount: data.count,
  }, { onSuccess: () => setAddOpen(false) }), isPending: createFacilityMutation.isPending };

  const updateFacility = { mutate: ({ id, data }: { id: number; data: Partial<FacilityForm> }) =>
    updateFacilityMutation.mutate({ facilityId: id, data: {
      name: data.name, surfaceType: data.surfaceType,
      sports: data.sports?.split(",").map((s) => s.trim()), courtCount: data.count,
    }}, { onSuccess: () => setEditingFacility(null) }), isPending: updateFacilityMutation.isPending };


  const addPricingRule = { mutate: (data: PricingRuleForm) =>
    apiClient.post(`/venues/${activeVenueId}/pricing-rules`, {
      facilityId: pricingFacilityId ?? (facilities[0]?.id ?? 0),
      ruleType: data.ruleType, ruleValue: Number(data.ruleValue),
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["venues", activeVenueId, "pricing-rules"] });
      setRuleOpen(false);
    }).catch(console.error),
    isPending: false };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* ── Header ── */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/venue-owner")}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Facilities</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
            {facilities.length} court{facilities.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {venues.length > 1 && (
            <select
              value={activeVenueId ?? ""}
              onChange={(e) => setVenueId(Number(e.target.value))}
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
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name ?? `Venue ${v.id}`}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => navigate("/venue-owner/schedule")}
            className="flex items-center gap-1.5 px-3 py-2"
            style={{ borderRadius: "10px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}
          >
            <CalendarClock style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
            <span style={{ color: "#3B82F6" }}>Schedule</span>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2"
            style={{ borderRadius: "10px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "13px", fontWeight: "700", color: "#fff" }}
          >
            <Plus style={{ width: "15px", height: "15px" }} />
            Add
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {/* ── No venue ── */}
        {!activeVenueId && venues.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Building2 style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>No venue found</p>
            <p className="text-[#64748B]" style={{ fontSize: "14px" }}>Create a venue first from the admin panel.</p>
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && [1, 2].map((i) => (
          <div key={i} className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {/* ── Error ── */}
        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <XCircle style={{ width: "32px", height: "32px", color: "#EF4444", margin: "0 auto 12px" }} />
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Failed to load facilities</p>
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && !isError && facilities.length === 0 && activeVenueId && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Layers style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No facilities yet</p>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "14px" }}>Add your first court or pitch</p>
            <button onClick={() => setAddOpen(true)}
              className="px-5 py-3"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
              + Add Facility
            </button>
          </div>
        )}

        {/* ── Facility cards ── */}
        {!isLoading && !isError && facilities.map((f) => (
          <div key={f.id} className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{f.name ?? "Court"}</span>
                  <span
                    className="px-2 py-0.5"
                    style={{
                      borderRadius: "999px",
                      backgroundColor: "rgba(34,197,94,0.12)",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "#22C55E",
                    }}
                  >
                    ACTIVE
                  </span>
                </div>
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                  {f.surfaceType ?? "—"} · {f.courtCount ?? 1} court{(f.courtCount ?? 1) > 1 ? "s" : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingFacility(f)}
                  className="flex items-center justify-center"
                  style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.1)" }}
                >
                  <Pencil style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
                </button>
                <button
                  onClick={() => { setPricingFacilityId(f.id); setRuleOpen(true); }}
                  className="flex items-center justify-center"
                  style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.1)" }}
                >
                  <Settings style={{ width: "14px", height: "14px", color: "#F59E0B" }} />
                </button>
              </div>
            </div>

            {/* Sports tags */}
            {(f.sports ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(f.sports ?? []).map((s: string) => (
                  <span key={s} className="px-2 py-0.5" style={{ borderRadius: "6px", backgroundColor: "rgba(99,102,241,0.12)", fontSize: "11px", fontWeight: "600", color: "#818CF8" }}>
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Bottom row: courts count + Schedule shortcut */}
            <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-1 text-[#64748B]">
                <IndianRupee style={{ width: "12px", height: "12px" }} />
                <span style={{ fontSize: "12px" }}>Courts: {f.courtCount ?? 1}</span>
              </div>
              <button
                onClick={() => navigate("/venue-owner/schedule")}
                className="flex items-center gap-1 px-2.5 py-1"
                style={{ borderRadius: "8px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <CalendarClock style={{ width: "11px", height: "11px", color: "#22C55E" }} />
                <span style={{ fontSize: "11px", color: "#22C55E", fontWeight: "600" }}>Schedule</span>
              </button>
            </div>
          </div>
        ))}

        {/* ── Pricing Rules ── */}
        {activeVenueId && (
          <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>Pricing Rules</p>
              <button
                onClick={() => { setPricingFacilityId(null); setRuleOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5"
                style={{ borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.1)", fontSize: "12px", fontWeight: "600", color: "#F59E0B" }}
              >
                <Plus style={{ width: "13px", height: "13px" }} />
                Add Rule
              </button>
            </div>
            {pricingRules.length === 0 ? (
              <p className="text-[#475569]" style={{ fontSize: "13px" }}>No pricing rules yet.</p>
            ) : (
              <div className="space-y-2">
                {pricingRules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2"
                    style={{ borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <span className="px-2 py-0.5" style={{ borderRadius: "6px", backgroundColor: "rgba(245,158,11,0.12)", fontSize: "11px", fontWeight: "700", color: "#F59E0B" }}>
                      {r.ruleType ?? "—"}
                    </span>
                    <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{r.ruleValue ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add facility sheet ── */}
      {addOpen && (
        <Sheet title="Add Facility" onClose={() => setAddOpen(false)}>
          <FacilityForm
            onSubmit={(d) => createFacility.mutate(d)}
            onClose={() => setAddOpen(false)}
            isPending={createFacility.isPending}
            submitLabel="Add Facility"
          />
        </Sheet>
      )}

      {/* ── Edit facility sheet ── */}
      {editingFacility && (
        <Sheet title="Edit Facility" onClose={() => setEditingFacility(null)}>
          <FacilityForm
            defaultValues={{
              name:        editingFacility.name ?? "",
              surfaceType: editingFacility.surfaceType ?? "",
              sports:      (editingFacility.sports ?? []).join(", "),
              count:       editingFacility.courtCount ?? 1,
            }}
            onSubmit={(d) => updateFacility.mutate({ id: editingFacility.id, data: d })}
            onClose={() => setEditingFacility(null)}
            isPending={updateFacility.isPending}
            submitLabel="Save Changes"
          />
        </Sheet>
      )}

      {/* ── Add pricing rule sheet ── */}
      {ruleOpen && (
        <Sheet title="Add Pricing Rule" onClose={() => { setRuleOpen(false); setPricingFacilityId(null); }}>
          <PricingForm
            onSubmit={(d) => addPricingRule.mutate(d)}
            onClose={() => { setRuleOpen(false); setPricingFacilityId(null); }}
            isPending={addPricingRule.isPending}
          />
        </Sheet>
      )}
    </div>
  );
}
