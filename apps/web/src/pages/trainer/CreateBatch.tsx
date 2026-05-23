import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateBatch, useGenerateSessions, useVenues, useCurrentUser, useTrainer, useSports } from "@sportza/api-client";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";

// Day index: 0 = Sunday … 6 = Saturday (matches JS Date.getDay())
const DAYS: { label: string; short: string; value: number }[] = [
  { label: "Monday",    short: "Mon", value: 1 },
  { label: "Tuesday",   short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday",  short: "Thu", value: 4 },
  { label: "Friday",    short: "Fri", value: 5 },
  { label: "Saturday",  short: "Sat", value: 6 },
  { label: "Sunday",    short: "Sun", value: 0 },
];

const createBatchSchema = z.object({
  name:           z.string().min(1, "Name is required").max(255),
  description:    z.string().max(5000).optional(),
  sport:          z.string().min(1, "Sport is required"),
  capacity:       z.coerce.number().int().min(1).default(20),
  venueId:        z.coerce.number().int().positive().optional().nullable(),
  fee:            z.coerce.number().min(0).optional(),
  skillLevel:     z.enum(["beginner", "intermediate", "advanced"]).optional(),
  skillRatingMin: z.coerce.number().int().min(100).max(3000).optional(),
  skillRatingMax: z.coerce.number().int().min(100).max(3000).optional(),
  startTime:      z.string().min(1, "Start time is required"),
  endTime:        z.string().min(1, "End time is required"),
}).refine(
  (d) => !d.startTime || !d.endTime || d.startTime < d.endTime,
  { message: "End time must be after start time", path: ["endTime"] }
);

type CreateBatchForm = z.infer<typeof createBatchSchema>;

const inputSt = (err?: boolean): React.CSSProperties => ({
  width: "100%", padding: "12px 14px", borderRadius: "10px",
  backgroundColor: "#0F172A", border: `1px solid ${err ? "#EF4444" : "rgba(255,255,255,0.08)"}`,
  color: "#fff", fontSize: "15px", outline: "none", boxSizing: "border-box",
});

const selectSt: React.CSSProperties = { ...inputSt(), appearance: "none", cursor: "pointer" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "13px", fontWeight: "600" }}>
      {children}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[#EF4444]" style={{ fontSize: "11px" }}>{msg}</p>;
}

export default function CreateBatch() {
  const navigate = useNavigate();
  const createBatch = useCreateBatch();
  const generateSessions = useGenerateSessions();
  const { data: venuesRes } = useVenues();

  // Resolve current trainer's assigned sports
  const { data: userRes } = useCurrentUser();
  const trainerId: number | undefined = (userRes as any)?.user?.id;
  const { data: trainerRes, isLoading: trainerLoading } = useTrainer(trainerId ?? 0);
  const { data: sportsRes } = useSports();
  const trainerProfile = (trainerRes as any)?.data;
  const trainerSports: string[] = Array.isArray(trainerProfile?.sports) ? trainerProfile.sports : [];
  const allApiSports: Array<{ id: number; name: string; displayName: string; rulebookTitle?: string | null; rulebookLines?: string[] | null }> =
    Array.isArray((sportsRes as any)?.data) ? (sportsRes as any).data : [];

  const venues = Array.isArray((venuesRes as any)?.data) ? (venuesRes as any).data : (Array.isArray(venuesRes) ? venuesRes : []);

  // Multi-day selection state (array of day numeric values)
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [daysError, setDaysError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreateBatchForm>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: { capacity: 20 },
  });
  const watchedSport = watch("sport");
  const selectedSportObj = allApiSports.find(
    s => s.name === (watchedSport || "").toLowerCase() || s.displayName === watchedSport
  );

  const toggleDay = (value: number) => {
    setSelectedDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
    setDaysError(null);
  };

  const isPending = createBatch.isPending || generateSessions.isPending;
  const noSports = !trainerLoading && trainerSports.length === 0;

  const onSubmit = (data: CreateBatchForm) => {
    if (selectedDays.length === 0) {
      setDaysError("Select at least one day");
      return;
    }

    const schedule = {
      weekdays: selectedDays,
      startTime: data.startTime,
      endTime: data.endTime,
    };

    const fees = data.fee != null
      ? { sportFees: { [data.sport]: data.fee }, feeSchedules: {} }
      : undefined;

    createBatch.mutate(
      {
        name: data.name,
        description: data.description || undefined,
        sport: data.sport,
        capacity: data.capacity,
        venueId: data.venueId ?? undefined,
        schedule,
        fees,
        skillRatingMin: data.skillRatingMin ?? undefined,
        skillRatingMax: data.skillRatingMax ?? undefined,
      },
      {
        onSuccess: (res: any) => {
          const id = res?.data?.id ?? res?.id;
          if (id) {
            generateSessions.mutate(
              { batchId: id, weeks: 8 },
              { onSettled: () => navigate(`/trainer/batches/${id}`) }
            );
          } else {
            navigate("/trainer/batches");
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-36">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Create Batch</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Set up your training program</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-4 space-y-4 max-w-md mx-auto">

          {/* Section: Batch Details */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Batch Details</p>

            <div>
              <FieldLabel>Batch Name *</FieldLabel>
              <input
                {...register("name")}
                style={inputSt(!!errors.name)}
                placeholder="e.g. Evening Football – Beginners"
              />
              <FieldError msg={errors.name?.message} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <FieldLabel>Sport *</FieldLabel>
                {selectedSportObj && <SportRulebook sport={selectedSportObj} />}
              </div>
              {trainerLoading ? (
                <div style={{ ...inputSt(), color: "#475569" }}>Loading your sports…</div>
              ) : trainerSports.length === 0 ? (
                <div
                  className="flex items-start gap-2 p-3"
                  style={{ borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <AlertCircle style={{ width: "16px", height: "16px", color: "#F59E0B", flexShrink: 0, marginTop: "1px" }} />
                  <p style={{ fontSize: "13px", color: "#F59E0B", lineHeight: "1.4" }}>
                    No sports tagged to your profile yet. Go to{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      style={{ fontWeight: "700", textDecoration: "underline", background: "none", border: "none", color: "#F59E0B", cursor: "pointer", padding: 0, fontSize: "13px" }}
                    >
                      Profile
                    </button>{" "}
                    and add your sports to create a batch.
                  </p>
                </div>
              ) : (
                <select {...register("sport")} style={selectSt}>
                  <option value="">Select sport</option>
                  {trainerSports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              )}
              <FieldError msg={errors.sport?.message} />
            </div>

            <div>
              <FieldLabel>Skill Level</FieldLabel>
              <select {...register("skillLevel")} style={selectSt}>
                <option value="">Any level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <FieldLabel>Capacity (max players)</FieldLabel>
              <input
                {...register("capacity")}
                type="number"
                min={1}
                style={inputSt(!!errors.capacity)}
                placeholder="20"
              />
              <FieldError msg={errors.capacity?.message} />
            </div>

            <div>
              <FieldLabel>Fee per session (₹)</FieldLabel>
              <input {...register("fee")} type="number" min={0} style={inputSt()} placeholder="0" />
            </div>

            {/* Sportza Rating Range */}
            <div>
              <FieldLabel>Sportza Rating Range (optional)</FieldLabel>
              <p className="text-[#64748B] mb-2" style={{ fontSize: "12px" }}>
                Leave blank to allow all skill levels. Ratings start at 1000.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    {...register("skillRatingMin")}
                    type="number"
                    min={100}
                    max={3000}
                    placeholder="Min (e.g. 900)"
                    style={inputSt(!!errors.skillRatingMin)}
                  />
                  <FieldError msg={errors.skillRatingMin?.message} />
                </div>
                <div className="flex items-center text-[#64748B]" style={{ fontSize: "14px", paddingTop: "4px" }}>–</div>
                <div className="flex-1">
                  <input
                    {...register("skillRatingMax")}
                    type="number"
                    min={100}
                    max={3000}
                    placeholder="Max (e.g. 1200)"
                    style={inputSt(!!errors.skillRatingMax)}
                  />
                  <FieldError msg={errors.skillRatingMax?.message} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Venue */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Venue</p>
            <div>
              <FieldLabel>Venue (optional)</FieldLabel>
              <select {...register("venueId")} style={selectSt}>
                <option value="">No specific venue</option>
                {venues.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Schedule */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Schedule</p>

            {/* Day multi-select pills */}
            <div>
              <FieldLabel>Days of the week *</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map((day) => {
                  const active = selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "700",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: active ? "#22C55E" : "#0F172A",
                        color: active ? "#fff" : "#64748B",
                        transition: "background-color 0.15s, color 0.15s",
                      }}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              {daysError && (
                <p className="mt-1 text-[#EF4444]" style={{ fontSize: "11px" }}>{daysError}</p>
              )}
            </div>

            {/* Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Start Time *</FieldLabel>
                <input
                  {...register("startTime")}
                  type="time"
                  style={inputSt(!!errors.startTime)}
                />
                <FieldError msg={errors.startTime?.message} />
              </div>
              <div>
                <FieldLabel>End Time *</FieldLabel>
                <input
                  {...register("endTime")}
                  type="time"
                  style={inputSt(!!errors.endTime)}
                />
                <FieldError msg={errors.endTime?.message} />
              </div>
            </div>

            <p className="text-[#475569]" style={{ fontSize: "11px" }}>
              Sessions will be auto-generated for the next 8 weeks based on this schedule.
            </p>
          </div>

          {/* Section: Description */}
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>
              Description (optional)
            </p>
            <textarea
              {...register("description")}
              rows={4}
              placeholder="Tell players what this batch covers…"
              style={{ ...inputSt(), resize: "none" }}
            />
          </div>

          {(createBatch.isError || generateSessions.isError) && (
            <p className="text-[#EF4444] text-center" style={{ fontSize: "13px" }}>
              {createBatch.isError ? "Failed to create batch. Try again." : "Batch created but session generation failed. You can retry from the batch detail page."}
            </p>
          )}
        </div>

        {/* Sticky CTA */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-10"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", background: "linear-gradient(to top,#0F172A 75%,transparent)" }}
        >
          <div className="max-w-md mx-auto">
            <button
              type="submit"
              disabled={isPending || noSports}
              className="w-full flex items-center justify-center gap-2 py-4"
              style={{
                borderRadius: "14px", fontSize: "16px", fontWeight: "700", color: "#fff",
                background: isPending || noSports ? "#1E293B" : "linear-gradient(135deg,#22C55E,#16A34A)",
                cursor: noSports ? "not-allowed" : "pointer",
              }}
            >
              {createBatch.isPending
                ? "Creating batch…"
                : generateSessions.isPending
                ? "Generating sessions…"
                : <> Create Batch <ChevronRight style={{ width: "20px", height: "20px" }} /></>
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
