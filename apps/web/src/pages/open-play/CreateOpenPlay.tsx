import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, startOfDay } from "date-fns";
import { useCreateOpenPlay, useSports, useVenue, useVenues, useVenueSlots } from "@sportza/api-client";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";

// ─── Schema ───────────────────────────────────────────────────────────────────
const createOpenPlaySchema = z.object({
  venueId:        z.coerce.number().int().positive("Select a venue"),
  sport:          z.string().min(1, "Select a sport"),
  formatName:     z.string().min(1, "Format is required"),
  maxPlayers:     z.coerce.number().min(2, "Min 2 players").max(50, "Max 50 players"),
  minimumPlayers: z.coerce.number().min(2, "Min 2 players").optional(),
  pricePerPlayer: z.coerce.number().min(0, "Enter price (0 for free)"),
  skillLevel:     z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["beginner", "intermediate", "advanced"]).optional()
  ),
  skillRatingMin: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(100, "Min rating must be ≥ 100").max(3000, "Max rating must be ≤ 3000").optional()
  ),
  skillRatingMax: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(100, "Min rating must be ≥ 100").max(3000, "Max rating must be ≤ 3000").optional()
  ),
  bookingDate:    z.string().min(1, "Select a date"),
  startTime:      z.string().min(1, "Select an available slot"),
  endTime:        z.string().min(1, "Select an available slot"),
  facilityId:     z.coerce.number().int().positive("Select an available slot"),
  facilityName:   z.string().min(1, "Select an available slot"),
  title:          z.string().optional(),
  notes:          z.string().optional(),
}).refine(
  (d) => !d.minimumPlayers || d.minimumPlayers <= d.maxPlayers,
  { message: "Minimum players cannot exceed max players", path: ["minimumPlayers"] }
);

type CreateOpenPlayForm = z.infer<typeof createOpenPlaySchema>;
type Slot = { startTime: string; endTime: string; price: number; available: boolean };
type FacilitySlot = { facilityId: number; facilityName: string; slots: Slot[] };
type SelectedSlot = { facilityId: number; facilityName: string; startTime: string; endTime: string; price: number };

// ─── Sport emoji map ──────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾", padel: "🎾",
  basketball: "🏀", volleyball: "🏐", swimming: "🏊", "table tennis": "🏓",
  hockey: "🏑", pickleball: "🏓", default: "🎯",
};

function sportEmoji(name: string) {
  return SPORT_EMOJI[name.toLowerCase()] ?? SPORT_EMOJI.default;
}

function buildDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

function formatSlotTime(startTime: string, endTime: string) {
  return `${startTime} - ${endTime}`;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "13px", fontWeight: "500" }}>
        {label}
      </label>
      {children}
      {error && <p className="text-[#EF4444] mt-1" style={{ fontSize: "12px" }}>{error}</p>}
    </div>
  );
}

// ─── Dark select ──────────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  width: "100%",
  height: "52px",
  borderRadius: "14px",
  backgroundColor: "#111827",
  border: "1.5px solid rgba(255,255,255,0.08)",
  color: "#F1F5F9",
  fontSize: "15px",
  paddingLeft: "14px",
  paddingRight: "14px",
  appearance: "none",
};

// ─── Dark input ───────────────────────────────────────────────────────────────
const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%",
  height: "52px",
  borderRadius: "14px",
  backgroundColor: "#111827",
  border: `1.5px solid ${hasError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"}`,
  color: "#F1F5F9",
  fontSize: "15px",
  paddingLeft: "14px",
  paddingRight: "14px",
  outline: "none",
});

// ─── Confirmation Screen ──────────────────────────────────────────────────────
function SuccessScreen({
  sportName,
  venueName,
  date,
  time,
  players,
  price,
  sessionId,
  onView,
  onCreate,
}: {
  sportName: string;
  venueName: string;
  date: string;
  time: string;
  players: number;
  price: number;
  sessionId?: number;
  onView: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] px-6 text-center">
      {/* Icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)", boxShadow: "0 0 40px rgba(34,197,94,0.3)" }}
      >
        <CheckCircle2 style={{ width: "40px", height: "40px", color: "#fff" }} />
      </div>

      <h1 className="text-white mb-2" style={{ fontSize: "26px", fontWeight: "800" }}>
        Session Created! 🎉
      </h1>
      <p className="text-[#94A3B8] mb-8" style={{ fontSize: "15px", lineHeight: "1.6" }}>
        Your open play session is live. Players can now discover and join it.
      </p>

      {/* Summary card */}
      <div
        className="w-full max-w-sm p-5 mb-8 text-left space-y-3"
        style={{ borderRadius: "20px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "32px" }}>{sportEmoji(sportName)}</span>
          <div>
            <p className="text-white" style={{ fontSize: "18px", fontWeight: "700" }}>{sportName}</p>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>{venueName}</p>
          </div>
        </div>
        {[
          { label: "Date", value: date },
          { label: "Time", value: time },
          { label: "Players", value: `0 / ${players} joined` },
          { label: "Price", value: price > 0 ? `₹${price}/player` : "Free" },
        ].map((row) => (
          <div key={row.label} className="flex justify-between">
            <span className="text-[#64748B]" style={{ fontSize: "14px" }}>{row.label}</span>
            <span className="text-[#E2E8F0]" style={{ fontSize: "14px", fontWeight: "600" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onView}
          className="w-full py-4"
          style={{
            borderRadius: "16px",
            background: "linear-gradient(135deg,#3B82F6,#6366F1)",
            fontSize: "16px",
            fontWeight: "700",
            color: "#fff",
          }}
        >
          View Session →
        </button>
        <button
          onClick={onCreate}
          className="w-full py-4"
          style={{
            borderRadius: "16px",
            backgroundColor: "rgba(255,255,255,0.06)",
            fontSize: "15px",
            fontWeight: "600",
            color: "#94A3B8",
          }}
        >
          Create Another
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateOpenPlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const createOpenPlay = useCreateOpenPlay();
  const { data: sportsRes } = useSports();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOpenPlayForm>({
    resolver: zodResolver(createOpenPlaySchema),
    defaultValues: { maxPlayers: 10, minimumPlayers: 4, formatName: "", pricePerPlayer: 0 },
  });

  const watchVenueId     = watch("venueId");
  const watchSport       = watch("sport");
  const watchPlayers     = watch("maxPlayers");
  const watchMinPlayers  = watch("minimumPlayers");
  const watchFormat      = watch("formatName");

  const { data: venuesRes } = useVenues({ limit: 100, sport: watchSport || undefined });
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [collapsedFacilities, setCollapsedFacilities] = useState<Set<number>>(new Set());
  const [created, setCreated] = useState<{ id?: number; sport: string; venue: string; date: string; time: string; players: number; price: number } | null>(null);
  const { data: venueRes } = useVenue(selectedVenueId ?? 0);

  const sports = (sportsRes?.data as Array<{ id: number; name: string; displayName: string; formats?: Array<{ name: string }> }>) ?? [];
  const venues = Array.isArray((venuesRes as any)?.data)
    ? ((venuesRes as any).data as Array<{ id: number; name: string }>)
    : Array.isArray(venuesRes)
      ? (venuesRes as Array<{ id: number; name: string }>)
      : [];
  const days = buildDays();
  const selectedSport = sports.find((sport) => sport.name === watchSport);
  const formatOptions = selectedSport?.formats?.length
    ? selectedSport.formats
    : [{ name: "Open Play" }];
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedVenue = (venueRes as any)?.data as { gstRate?: number } | undefined;
  const gstRate = selectedVenue?.gstRate ?? 18;
  const { data: slotsRes, isLoading: slotsLoading } = useVenueSlots(selectedVenueId ?? 0, {
    date: dateStr,
    sport: watchSport || undefined,
  });
  const slotFacilities = (((slotsRes as any)?.facilities ?? (slotsRes as any)?.data?.facilities ?? []) as FacilitySlot[])
    .map((facility) => ({
      ...facility,
      slots: (facility.slots ?? []).filter((slot) => slot.available),
    }))
    .filter((facility) => facility.slots.length > 0);
  const selectedVenueName = venues.find((venue) => venue.id === selectedVenueId)?.name ?? "";

  const slotSubtotal = selectedSlots.reduce((sum, s) => sum + s.price, 0);
  const slotGstAmount = slotSubtotal > 0 ? roundMoney((slotSubtotal * gstRate) / 100) : 0;
  const totalVenueCost = roundMoney(slotSubtotal + slotGstAmount);
  const effectiveMax = Math.max(watchPlayers ?? 10, 1);
  const effectiveMin = Math.max(watchMinPlayers ?? 2, 2);
  const computedPricePerPlayer = totalVenueCost > 0
    ? roundMoney(totalVenueCost / effectiveMax)
    : 0;
  const priceRangeHigh = totalVenueCost > 0
    ? roundMoney(totalVenueCost / Math.min(effectiveMin, effectiveMax))
    : 0;
  const hostProtectionAmount = totalVenueCost > 0 ? roundMoney(totalVenueCost * 0.5) : 0;
  const slotStartTime = selectedSlots[0]?.startTime ?? "";
  const slotEndTime = selectedSlots[selectedSlots.length - 1]?.endTime ?? "";
  const slotKey = (s: SelectedSlot) => `${s.facilityId}::${s.startTime}`;

  const slotError =
    errors.startTime?.message ??
    errors.endTime?.message ??
    errors.facilityId?.message ??
    errors.facilityName?.message;

  useEffect(() => {
    if (typeof watchVenueId === "number" && !isNaN(watchVenueId) && watchVenueId > 0) {
      setSelectedVenueId(watchVenueId);
    } else {
      setSelectedVenueId(null);
    }
  }, [watchVenueId]);

  useEffect(() => {
    if (sports.length === 0) return;

    const openPlayState = location.state as { sportName?: string; sport?: string } | null;
    const requestedSportName = openPlayState?.sportName ?? openPlayState?.sport;
    const requestedSport = requestedSportName
      ? sports.find((sport) => sport.name === requestedSportName)
      : null;
    const fallbackSport = requestedSport ?? sports[0];

    if (!watchSport) {
      setValue("sport", fallbackSport.name);
      setValue("formatName", fallbackSport.formats?.[0]?.name ?? "Open Play");
    }
  }, [location.state, setValue, sports, watchSport]);

  useEffect(() => {
    if (!watchSport || formatOptions.length === 0) return;
    const hasValidFormat = formatOptions.some((format) => format.name === watchFormat);
    if (!hasValidFormat) {
      setValue("formatName", formatOptions[0].name);
    }
  }, [formatOptions, setValue, watchFormat, watchSport]);

  useEffect(() => {
    setValue("bookingDate", dateStr, { shouldValidate: true });
  }, [dateStr, setValue]);

  // Clear slot selection when date / venue / sport changes
  useEffect(() => {
    setSelectedSlots([]);
    setCollapsedFacilities(new Set());
    setValue("facilityId", 0, { shouldValidate: true });
    setValue("facilityName", "", { shouldValidate: true });
    setValue("startTime", "", { shouldValidate: true });
    setValue("endTime", "", { shouldValidate: true });
  }, [dateStr, selectedVenueId, setValue, watchSport]);

  // Clear venue and slot selection when sport changes (avoid sport/venue mismatch)
  useEffect(() => {
    setSelectedVenueId(null);
    setSelectedSlots([]);
    setValue("venueId", 0 as any, { shouldValidate: false });
  // Only run when sport actually changes, not on initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSport]);

  // When facilities load, collapse all except the first
  useEffect(() => {
    if (slotFacilities.length > 1) {
      setCollapsedFacilities(new Set(slotFacilities.slice(1).map(f => f.facilityId)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotFacilities.length, dateStr, selectedVenueId]);

  // Sync form fields whenever selectedSlots changes (use merged start/end range)
  useEffect(() => {
    if (selectedSlots.length === 0) {
      setValue("facilityId", 0, { shouldValidate: true });
      setValue("facilityName", "", { shouldValidate: true });
      setValue("startTime", "", { shouldValidate: true });
      setValue("endTime", "", { shouldValidate: true });
    } else {
      const first = selectedSlots[0];
      const last  = selectedSlots[selectedSlots.length - 1];
      setValue("facilityId",   first.facilityId,   { shouldValidate: true });
      setValue("facilityName", first.facilityName, { shouldValidate: true });
      setValue("startTime",    first.startTime,    { shouldValidate: true });
      setValue("endTime",      last.endTime,       { shouldValidate: true });
    }
  }, [selectedSlots, setValue]);

  function toggleSlot(slot: Slot, facility: FacilitySlot) {
    const candidate: SelectedSlot = {
      facilityId:   facility.facilityId,
      facilityName: facility.facilityName,
      startTime:    slot.startTime,
      endTime:      slot.endTime,
      price:        slot.price,
    };

    setSelectedSlots((prev) => {
      // Tap on the last selected slot → deselect it
      if (
        prev.length > 0 &&
        prev[prev.length - 1].startTime === slot.startTime &&
        prev[0].facilityId === facility.facilityId
      ) {
        return prev.slice(0, -1);
      }

      // Different facility → start fresh
      if (prev.length > 0 && prev[0].facilityId !== facility.facilityId) {
        return [candidate];
      }

      // Must be consecutive with the last selected slot
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (slot.startTime !== last.endTime) return prev; // not consecutive — ignore
      }

      // Max 3 slots
      if (prev.length >= 3) return prev;

      return [...prev, candidate];
    });
  }

  // Keep hidden price field aligned with derived slot pricing
  useEffect(() => {
    setValue("pricePerPlayer", computedPricePerPlayer, { shouldValidate: true });
  }, [computedPricePerPlayer, setValue]);

  const onSubmit = (data: CreateOpenPlayForm) => {
    const payload = {
      venueId:        data.venueId,
      sport:          data.sport,
      formatName:     data.formatName,
      playersPerTeam: 1,
      maxPlayers:     data.maxPlayers,
      minimumPlayers: data.minimumPlayers ?? Math.max(2, Math.ceil(data.maxPlayers * 0.5)),
      pricePerPlayer: data.pricePerPlayer,
      skillLevel:     data.skillLevel,
      skillRatingMin: data.skillRatingMin ?? undefined,
      skillRatingMax: data.skillRatingMax ?? undefined,
      bookingDate:    data.bookingDate,
      startTime:      data.startTime,
      endTime:        data.endTime,
      facilityId:     data.facilityId,
      facilityName:   data.facilityName,
      title:          data.title,
      notes:          data.notes,
    };
    createOpenPlay.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: (res: { data?: { id?: number } }) => {
        const id = res?.data?.id ?? (res as unknown as { id?: number })?.id;
        const venueName = venues.find((v) => v.id === data.venueId)?.name ?? "Venue";
        setCreated({
          id,
          sport:   data.sport,
          venue:   venueName,
          date:    format(new Date(`${data.bookingDate}T00:00:00`), "EEE, d MMM yyyy"),
          time:    `${data.startTime} – ${data.endTime}`,
          players: data.maxPlayers,
          price:   data.pricePerPlayer ?? 0,
        });
      },
    });
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (created) {
    return (
      <SuccessScreen
        sportName={created.sport}
        venueName={created.venue}
        date={created.date}
        time={created.time}
        players={created.players}
        price={created.price}
        sessionId={created.id}
        onView={() => (created.id ? navigate(`/open-plays/${created.id}`) : navigate("/open-plays"))}
        onCreate={() => { setCreated(null); }}
      />
    );
  }

  // ── Live preview values ─────────────────────────────────────────────────────
  const previewSport = watchSport ? `${sportEmoji(watchSport)} ${watchSport}` : "—";
  const previewPlayers = watchPlayers ?? 10;
  const previewPrice = computedPricePerPlayer > 0
    ? (priceRangeHigh > computedPricePerPlayer
      ? `₹${computedPricePerPlayer}–₹${priceRangeHigh}/player`
      : `₹${computedPricePerPlayer}/player`)
    : "Free";
  const footerSlotLabel = selectedSlots.length > 0
    ? `${format(selectedDate, "EEE, d MMM")} · ${slotStartTime} – ${slotEndTime}${selectedSlots.length > 1 ? ` (${selectedSlots.length} slots)` : ""}`
    : selectedVenueId
      ? "Select up to 3 consecutive slots below"
      : "Select a venue first";
  const footerSlotMeta = selectedSlots.length > 0
    ? `${selectedSlots[0].facilityName} · Total ₹${totalVenueCost.toFixed(2)}`
    : selectedVenueName || "No venue selected";

  return (
    <div className="min-h-screen bg-[#0F172A] pb-44">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4" style={{ height: "56px" }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.07)" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Host a Session</h1>
      </div>

      {/* ── Live preview chip ───────────────────────────────────────────────── */}
      <div className="mx-4 mb-4 px-4 py-3 flex items-center gap-3"
        style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <Zap style={{ width: "16px", height: "16px", color: "#3B82F6", flexShrink: 0 }} />
        <div className="flex gap-3 flex-wrap">
          <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>{previewSport}</span>
          <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>· {previewPlayers} players</span>
          <span className="text-[#94A3B8]" style={{ fontSize: "13px" }}>· {previewPrice}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register("bookingDate")} />
        <input type="hidden" {...register("startTime")} />
        <input type="hidden" {...register("endTime")} />
        <input type="hidden" {...register("facilityId", { valueAsNumber: true })} />
        <input type="hidden" {...register("facilityName")} />
        <input type="hidden" {...register("pricePerPlayer", { valueAsNumber: true })} />
        <div className="px-4 space-y-4 max-w-md mx-auto">

          {/* ── Section: Game Details ──────────────────────────────────────── */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Game Details</p>

            {/* Sport */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "500" }}>Sport</label>
                {selectedSport && <SportRulebook sport={selectedSport} />}
              </div>
              <div className="relative">
                <select
                  {...register("sport")}
                  style={selectStyle}
                  onChange={(e) => {
                    setValue("sport", e.target.value);
                    const s = sports.find((sp) => sp.name === e.target.value);
                    if (s?.formats?.[0]) setValue("formatName", s.formats[0].name, { shouldValidate: true });
                  }}
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.name}>{sportEmoji(s.name)} {s.displayName}</option>
                  ))}
                </select>
                <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "16px", height: "16px", color: "#64748B", pointerEvents: "none" }} />
              </div>
              {errors.sport?.message && <p className="text-[#EF4444] mt-1" style={{ fontSize: "12px" }}>{errors.sport.message}</p>}
            </div>

            {/* Format */}
            <Field label="Game Format" error={errors.formatName?.message}>
              <div className="relative">
                <select
                  {...register("formatName")}
                  style={selectStyle}
                >
                  {formatOptions.map((format) => (
                    <option key={format.name} value={format.name}>
                      {format.name}
                    </option>
                  ))}
                </select>
                <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "16px", height: "16px", color: "#64748B", pointerEvents: "none" }} />
              </div>
            </Field>

            {/* Max players + Min players */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max Players" error={errors.maxPlayers?.message}>
                <div className="relative">
                  <Users style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748B" }} />
                  <input
                    {...register("maxPlayers")}
                    type="number"
                    min={2}
                    max={50}
                    style={{ ...inputStyle(!!errors.maxPlayers), paddingLeft: "36px" }}
                  />
                </div>
              </Field>
              <Field label="Min Players" error={(errors as any).minimumPlayers?.message}>
                <div className="relative">
                  <Users style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#F59E0B" }} />
                  <input
                    {...register("minimumPlayers")}
                    type="number"
                    min={2}
                    max={watchPlayers ?? 50}
                    style={{ ...inputStyle(!!(errors as any).minimumPlayers), paddingLeft: "36px" }}
                  />
                </div>
              </Field>
            </div>

            {/* Dynamic pricing info */}
            {selectedSlots.length > 0 ? (
              <div className="space-y-2">
                <div
                  className="px-4 py-3"
                  style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  <p className="text-[#64748B] mb-1" style={{ fontSize: "12px", fontWeight: "600" }}>
                    Price range per player
                  </p>
                  <p className="text-white" style={{ fontSize: "15px", fontWeight: "800" }}>
                    ₹{computedPricePerPlayer.toFixed(0)}
                    {priceRangeHigh > computedPricePerPlayer && ` – ₹${priceRangeHigh.toFixed(0)}`}
                    <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "500", marginLeft: "6px" }}>per player</span>
                  </p>
                  <p className="text-[#64748B] mt-1" style={{ fontSize: "11px" }}>
                    Final price depends on total players who join ({effectiveMin}–{effectiveMax} expected)
                  </p>
                </div>

                <div
                  className="px-4 py-3 flex items-start gap-3"
                  style={{ borderRadius: "14px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>🔒</span>
                  <div>
                    <p className="text-[#F59E0B]" style={{ fontSize: "13px", fontWeight: "700" }}>
                      Host protection: ₹{hostProtectionAmount.toFixed(0)}
                    </p>
                    <p className="text-[#92400E]" style={{ fontSize: "12px", lineHeight: "1.5" }}>
                      You pay 50% upfront to secure the venue slot. This amount is fully credited to your Sportza Wallet if the session doesn't reach {effectiveMin} players.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="px-4 py-3"
                style={{ borderRadius: "14px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                  Select a venue slot to see the auto-calculated price range.
                </p>
              </div>
            )}

            {/* Skill Level */}
            <Field label="Skill Level" error={errors.skillLevel?.message}>
              <div className="relative">
                <select
                  {...register("skillLevel")}
                  style={selectStyle}
                >
                  <option value="">Any Level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <ChevronRight style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%) rotate(90deg)", width: "16px", height: "16px", color: "#64748B", pointerEvents: "none" }} />
              </div>
            </Field>

            {/* Sportza Rating Range */}
            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "13px", fontWeight: "500" }}>
                Sportza Rating Range (optional)
              </label>
              <p className="text-[#64748B] mb-2" style={{ fontSize: "12px" }}>
                Players start at 1000. Leave blank to allow any rating.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  {...register("skillRatingMin")}
                  type="number"
                  min={100}
                  max={3000}
                  placeholder="Min (e.g. 900)"
                  style={{ ...inputStyle(!!errors.skillRatingMin), flex: 1 }}
                />
                <span className="text-[#64748B]" style={{ fontSize: "14px", flexShrink: 0 }}>–</span>
                <input
                  {...register("skillRatingMax")}
                  type="number"
                  min={100}
                  max={3000}
                  placeholder="Max (e.g. 1200)"
                  style={{ ...inputStyle(!!errors.skillRatingMax), flex: 1 }}
                />
              </div>
              {errors.skillRatingMin && <p className="text-[#EF4444] mt-1" style={{ fontSize: "12px" }}>{errors.skillRatingMin.message}</p>}
              {errors.skillRatingMax && <p className="text-[#EF4444] mt-1" style={{ fontSize: "12px" }}>{errors.skillRatingMax.message}</p>}
            </div>

            {/* Title (optional) */}
            <Field label="Session Title (optional)" error={errors.title?.message}>
              <input {...register("title")} placeholder="e.g. Saturday Morning Futsal" style={inputStyle(!!errors.title)} />
            </Field>
          </div>

          {/* ── Section: Venue ─────────────────────────────────────────────── */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Venue</p>

            <Field label="Venue" error={errors.venueId?.message}>
              <input type="hidden" {...register("venueId", { valueAsNumber: true })} />

              {/* Custom venue picker trigger */}
              <button
                type="button"
                onClick={() => setVenuePickerOpen(true)}
                className="w-full flex items-center gap-3 text-left"
                style={{
                  height: "52px",
                  borderRadius: "14px",
                  backgroundColor: "#111827",
                  border: `1.5px solid ${errors.venueId ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"}`,
                  paddingLeft: "14px",
                  paddingRight: "14px",
                }}
              >
                <MapPin style={{ width: "16px", height: "16px", color: "#64748B", flexShrink: 0 }} />
                <span style={{
                  flex: 1,
                  fontSize: "15px",
                  color: selectedVenueName ? "#F1F5F9" : "#64748B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {selectedVenueName || "Select venue…"}
                </span>
                <ChevronRight style={{ width: "16px", height: "16px", color: "#64748B", transform: "rotate(90deg)", flexShrink: 0 }} />
              </button>

              {/* Venue list — inline expanded panel */}
              {venuePickerOpen && (
                <div
                  className="mt-2 overflow-hidden"
                  style={{ borderRadius: "14px", backgroundColor: "#0F172A", border: "1.5px solid rgba(59,130,246,0.35)" }}
                >
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: "600" }}>
                      {venues.length} venue{venues.length !== 1 ? "s" : ""} available
                    </span>
                    <button type="button" onClick={() => setVenuePickerOpen(false)}>
                      <X style={{ width: "16px", height: "16px", color: "#64748B" }} />
                    </button>
                  </div>
                  <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                    {venues.length === 0 ? (
                      <p className="px-4 py-4 text-[#64748B]" style={{ fontSize: "13px" }}>No venues found.</p>
                    ) : (
                      venues.map((v) => {
                        const isActive = selectedVenueId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setValue("venueId", v.id, { shouldValidate: true });
                              setSelectedVenueId(v.id);
                              setVenuePickerOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left"
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              backgroundColor: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                            }}
                          >
                            <MapPin style={{ width: "14px", height: "14px", color: isActive ? "#3B82F6" : "#64748B", flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "14px", fontWeight: isActive ? "700" : "400", color: isActive ? "#E2E8F0" : "#CBD5E1" }}>
                              {v.name}
                            </span>
                            {isActive && (
                              <CheckCircle2 style={{ width: "16px", height: "16px", color: "#3B82F6", flexShrink: 0 }} />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </Field>

            {selectedSlots.length > 0 ? (
              <div
                className="px-4 py-3"
                style={{ borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <p className="text-[#64748B] mb-1" style={{ fontSize: "12px", fontWeight: "600" }}>
                  {selectedSlots.length === 1 ? "Selected slot" : `${selectedSlots.length} slots selected`}
                </p>
                <p className="text-white" style={{ fontSize: "14px", fontWeight: "700" }}>
                  {selectedSlots[0].facilityName}
                </p>
                <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
                  {format(selectedDate, "EEEE, d MMM")} · {slotStartTime} – {slotEndTime}
                </p>
              </div>
            ) : selectedVenueId ? (
              <div className="flex items-center gap-2 text-[#94A3B8]" style={{ fontSize: "13px" }}>
                <Info style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                Pick a day and then tap up to 3 consecutive slots below.
              </div>
            ) : null}
          </div>

          {/* ── Section: Date & Time ───────────────────────────────────────── */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Date & Time</p>

            <Field label="Select a day" error={errors.bookingDate?.message}>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day) => {
                  const isSelected = format(day, "yyyy-MM-dd") === dateStr;
                  return (
                    <button
                      key={format(day, "yyyy-MM-dd")}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className="flex min-w-0 flex-col items-center justify-center px-1 py-2"
                      style={{
                        borderRadius: "12px",
                        backgroundColor: isSelected ? "#3B82F6" : "#111827",
                        border: isSelected ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.08)",
                        color: isSelected ? "#FFFFFF" : "#94A3B8",
                      }}
                    >
                      <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>
                        {format(day, "EEE")}
                      </span>
                      <span style={{ fontSize: "15px", fontWeight: "800", lineHeight: 1.1, marginTop: "3px" }}>
                        {format(day, "d")}
                      </span>
                      <span style={{ fontSize: "10px", marginTop: "1px" }}>
                        {format(day, "MMM")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar style={{ width: "15px", height: "15px", color: "#64748B" }} />
                <p className="text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "600" }}>
                  Available slots for {format(selectedDate, "EEEE, d MMM")}
                </p>
              </div>

              {!selectedVenueId ? (
                <div
                  className="px-4 py-4 text-center"
                  style={{ borderRadius: "14px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    Select a venue to load available courts and times.
                  </p>
                </div>
              ) : slotsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div key={item} className="p-4" style={{ borderRadius: "14px", backgroundColor: "#111827" }}>
                      <div className="h-4 w-28 rounded bg-[#1E293B] animate-pulse mb-3" />
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((slot) => (
                          <div key={slot} className="h-16 rounded-xl bg-[#1E293B] animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : slotFacilities.length === 0 ? (
                <div
                  className="px-4 py-4 text-center"
                  style={{ borderRadius: "14px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-white mb-1" style={{ fontSize: "14px", fontWeight: "700" }}>
                    No slots available
                  </p>
                  <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                    Try another day from the next 7 days.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slotFacilities.map((facility) => {
                    const facilitySelectedCount = selectedSlots.filter(s => s.facilityId === facility.facilityId).length;

                    const expanded = !collapsedFacilities.has(facility.facilityId);

                    const toggleCollapse = () => {
                      setCollapsedFacilities(prev => {
                        const next = new Set(prev);
                        if (next.has(facility.facilityId)) next.delete(facility.facilityId);
                        else next.add(facility.facilityId);
                        return next;
                      });
                    };

                    return (
                      <div
                        key={facility.facilityId}
                        style={{ borderRadius: "16px", backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}
                      >
                        {/* ── Collapsible header ── */}
                        <button
                          type="button"
                          onClick={toggleCollapse}
                          className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-white truncate" style={{ fontSize: "14px", fontWeight: "700" }}>
                              {facility.facilityName}
                            </p>
                            {facilitySelectedCount > 0 && (
                              <span
                                className="flex items-center justify-center shrink-0"
                                style={{
                                  height: "18px", minWidth: "18px", borderRadius: "999px",
                                  backgroundColor: "#3B82F6", fontSize: "10px",
                                  fontWeight: "700", color: "#fff", padding: "0 5px",
                                }}
                              >
                                {facilitySelectedCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[#64748B]" style={{ fontSize: "11px", fontWeight: "600" }}>
                              {facility.slots.length} slot{facility.slots.length !== 1 ? "s" : ""}
                            </span>
                            <ChevronRight
                              style={{
                                width: "15px", height: "15px", color: "#64748B",
                                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                              }}
                            />
                          </div>
                        </button>

                        {/* ── Slot grid ── */}
                        {expanded && (
                          <div className="px-4 pb-4">
                            <div className="grid grid-cols-2 gap-2">
                              {facility.slots.map((slot) => {
                                const key = slotKey({ facilityId: facility.facilityId, facilityName: facility.facilityName, startTime: slot.startTime, endTime: slot.endTime, price: slot.price });
                                const isSelected = selectedSlots.some(s => slotKey(s) === key);

                                return (
                                  <button
                                    key={`${facility.facilityId}-${slot.startTime}`}
                                    type="button"
                                    onClick={() => toggleSlot(slot, facility)}
                                    className="relative flex flex-col items-start justify-center px-3 py-3 text-left"
                                    style={{
                                      borderRadius: "12px",
                                      backgroundColor: isSelected ? "#3B82F6" : "rgba(59,130,246,0.08)",
                                      border: isSelected ? "1px solid #3B82F6" : "1px solid rgba(59,130,246,0.18)",
                                    }}
                                  >
                                    {isSelected && (
                                      <span
                                        className="absolute top-1.5 right-1.5 flex items-center justify-center"
                                        style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.25)" }}
                                      >
                                        <CheckCircle2 style={{ width: "10px", height: "10px", color: "#fff" }} />
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Clock style={{ width: "12px", height: "12px", color: isSelected ? "#FFFFFF" : "#94A3B8" }} />
                                      <span style={{ fontSize: "13px", fontWeight: "700", color: isSelected ? "#FFFFFF" : "#E2E8F0" }}>
                                        {formatSlotTime(slot.startTime, slot.endTime)}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: "700", color: isSelected ? "#FFFFFF" : "#3B82F6" }}>
                                      ₹{slot.price}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {slotError && (
                <p className="text-[#EF4444] mt-2" style={{ fontSize: "12px" }}>
                  {slotError}
                </p>
              )}
            </div>
          </div>

          {/* ── Section: Notes ─────────────────────────────────────────────── */}
          <div className="p-5 space-y-4" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Notes (optional)</p>
            <Field label="Equipment rules, game format details, etc." error={errors.notes?.message}>
              <textarea
                {...register("notes")}
                rows={3}
                placeholder="e.g. Bring your own racquet. Beginner-friendly session."
                style={{
                  width: "100%",
                  borderRadius: "14px",
                  backgroundColor: "#111827",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  color: "#F1F5F9",
                  fontSize: "15px",
                  padding: "14px",
                  outline: "none",
                  resize: "none",
                  lineHeight: "1.5",
                }}
              />
            </Field>
          </div>

          {/* error from mutation */}
          {createOpenPlay.isError && (
            <div className="px-4 py-3" style={{ borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <p className="text-[#EF4444]" style={{ fontSize: "14px" }}>Something went wrong. Please try again.</p>
            </div>
          )}
        </div>

        {/* ── Sticky CTA ─────────────────────────────────────────────────────── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-2"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)",
            background: "linear-gradient(to top, #0F172A 82%, rgba(15,23,42,0.96) 94%, rgba(15,23,42,0.88) 100%)",
            pointerEvents: "none",
          }}
        >
          <div className="max-w-md mx-auto" style={{ pointerEvents: "auto" }}>
            {/* Selected slot preview */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2"
              style={{ borderRadius: "10px", backgroundColor: "#162033", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="min-w-0 flex-1">
                <p className="text-white truncate" style={{ fontSize: "12px", fontWeight: "700" }}>{footerSlotLabel}</p>
                <p className="text-[#64748B] truncate" style={{ fontSize: "11px" }}>{footerSlotMeta}</p>
              </div>
              <p className="text-[#94A3B8] shrink-0" style={{ fontSize: "12px", fontWeight: "600" }}>{previewPlayers} players · {previewPrice}</p>
            </div>

            <button
              type="submit"
              disabled={createOpenPlay.isPending || selectedSlots.length === 0}
            className="w-full py-4 flex items-center justify-center gap-2"
            style={{
              borderRadius: "16px",
              background: createOpenPlay.isPending || selectedSlots.length === 0 ? "#1E293B" : "linear-gradient(135deg,#3B82F6,#6366F1)",
              fontSize: "17px",
              fontWeight: "800",
              color: "#fff",
              opacity: createOpenPlay.isPending || selectedSlots.length === 0 ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {createOpenPlay.isPending ? (
                "Creating Session…"
              ) : (
                <>
                  Create Game
                  <ChevronRight style={{ width: "20px", height: "20px" }} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
