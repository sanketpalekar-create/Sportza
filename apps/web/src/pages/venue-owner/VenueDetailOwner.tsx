/**
 * Venue Detail (Owner) — View and edit a single venue
 * Fields: Name, City, Address, Sports, GST rate, Commission %, Is active
 * Actions: Save, Deactivate/Reactivate, View bookings
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Save, Building2, Percent,
  Power, Calendar, Check, Layers, Tv2,
} from "lucide-react";
import { useVenue, useUpdateVenue } from "@sportza/api-client";
import LocationPicker, { type LocationValue } from "../../components/LocationPicker";

const SPORTS_LIST = [
  "football", "cricket", "badminton", "tennis",
  "padel", "basketball", "volleyball", "swimming", "pickleball",
];

const inputSt: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: "12px",
  backgroundColor: "#0F172A", border: "1.5px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "14px", outline: "none",
};

const labelSt: React.CSSProperties = {
  fontSize: "12px", fontWeight: "600", color: "#94A3B8",
  marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
      <p className="text-white mb-4" style={{ fontSize: "15px", fontWeight: "700" }}>{title}</p>
      {children}
    </div>
  );
}

export default function VenueDetailOwner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venueId = id ? parseInt(id, 10) : 0;

  const { data: res, isLoading, isError } = useVenue(venueId);
  const venue: any = (res as any)?.data ?? (res as any)?.venue ?? res;

  const updateVenue = useUpdateVenue(venueId);

  const [name, setName] = useState("");
  const [locationValue, setLocationValue] = useState<LocationValue>({ state: "", city: "" });
  const [sports, setSports] = useState<string[]>([]);
  const [gstRate, setGstRate] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (venue) {
      setName(venue.name ?? "");
      const loc = venue.location ?? {};
      setLocationValue({
        state:   loc.state   ?? "",
        city:    loc.city    ?? "",
        pincode: loc.pincode ?? "",
        address: loc.address ?? "",
        lat:     loc.lat     ?? undefined,
        lng:     loc.lng     ?? undefined,
      });
      setSports(venue.sports ?? []);
      setGstRate(String(venue.gstRate ?? venue.gst_rate ?? ""));
      setCommissionPct(String(venue.commissionPct ?? venue.commission_pct ?? ""));
      setIsActive(venue.isActive ?? venue.is_active ?? true);
    }
  }, [venue]);

  const toggleSport = (s: string) => {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleSave = () => {
    updateVenue.mutate(
      {
        name,
        sports,
        gstRate: gstRate ? parseFloat(gstRate) : undefined,
        commissionPercent: commissionPct ? parseFloat(commissionPct) : undefined,
        isActive,
        location: locationValue.state && locationValue.city
          ? {
              country: "India",
              state: locationValue.state,
              city: locationValue.city,
              pincode: locationValue.pincode || undefined,
              address: locationValue.address || undefined,
              lat: locationValue.lat,
              lng: locationValue.lng,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  };

  const handleToggleActive = () => {
    const newActive = !isActive;
    setIsActive(newActive);
    updateVenue.mutate({ isActive: newActive });
  };

  if (isError || (!isLoading && !venue)) {
    return (
      <div className="min-h-screen bg-[#0F172A] px-4 pt-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#64748B] mb-6">
          <ChevronLeft style={{ width: "20px", height: "20px" }} /> Back
        </button>
        <div className="p-5 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
          <p className="text-[#EF4444]">Venue not found or you don't have access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => navigate("/venue-owner/venues")}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse h-6 w-48 rounded" style={{ backgroundColor: "#1E293B" }} />
          ) : (
            <>
              <h1 className="text-white truncate" style={{ fontSize: "20px", fontWeight: "800" }}>
                {venue?.name ?? "Venue"}
              </h1>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Edit venue details</p>
            </>
          )}
        </div>
        <div
          className="px-2.5 py-1 flex-shrink-0"
          style={{
            borderRadius: "8px",
            backgroundColor: isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", color: isActive ? "#22C55E" : "#EF4444" }}>
            {isActive ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>
      </div>

      <div className="px-4 space-y-4 max-w-md mx-auto">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-40 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Basic info */}
            <Section title="Venue Info">
              <div className="space-y-4">
                <div>
                  <label style={labelSt}>
                    <Building2 style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                    Venue Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Green Arena"
                    style={inputSt}
                  />
                </div>
                <div>
                  <label style={labelSt}>Location</label>
                  <LocationPicker
                    value={locationValue}
                    onChange={setLocationValue}
                  />
                </div>
              </div>
            </Section>

            {/* Sports */}
            <Section title="Sports Offered">
              <div className="flex flex-wrap gap-2">
                {SPORTS_LIST.map((s) => {
                  const selected = sports.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSport(s)}
                      className="px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        borderRadius: "10px",
                        fontSize: "13px", fontWeight: "600",
                        backgroundColor: selected ? "rgba(59,130,246,0.2)" : "#0F172A",
                        color: selected ? "#3B82F6" : "#64748B",
                        border: selected ? "1.5px solid #3B82F6" : "1.5px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {selected && <Check style={{ width: "12px", height: "12px" }} />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Rates */}
            <Section title="Rates & Fees">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelSt}>
                    <Percent style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                    GST Rate (%)
                  </label>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    placeholder="18"
                    style={inputSt}
                  />
                </div>
                <div>
                  <label style={labelSt}>
                    <Percent style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                    Commission (%)
                  </label>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    placeholder="10"
                    style={inputSt}
                  />
                </div>
              </div>
            </Section>

            {/* Quick links */}
            <Section title="Quick Links">
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ venueId: String(venueId) });
                    if (name) params.set("venueName", name);
                    navigate(`/venue-owner/bookings?${params.toString()}`);
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                  style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <Calendar style={{ width: "16px", height: "16px", color: "#3B82F6" }} />
                    <span className="text-white" style={{ fontSize: "14px" }}>View Bookings</span>
                  </div>
                  <ChevronLeft style={{ width: "16px", height: "16px", color: "#475569", transform: "rotate(180deg)" }} />
                </button>
                <button
                  onClick={() => navigate("/venue-owner/facilities")}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                  style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <Layers style={{ width: "16px", height: "16px", color: "#22C55E" }} />
                    <span className="text-white" style={{ fontSize: "14px" }}>Facilities &amp; Schedule</span>
                  </div>
                  <ChevronLeft style={{ width: "16px", height: "16px", color: "#475569", transform: "rotate(180deg)" }} />
                </button>
                <button
                  onClick={() => navigate("/venue-owner/displays")}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                  style={{ borderRadius: "10px", backgroundColor: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <Tv2 style={{ width: "16px", height: "16px", color: "#8B5CF6" }} />
                    <span className="text-white" style={{ fontSize: "14px" }}>Court Displays</span>
                  </div>
                  <ChevronLeft style={{ width: "16px", height: "16px", color: "#475569", transform: "rotate(180deg)" }} />
                </button>
              </div>
            </Section>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={updateVenue.isPending}
                className="w-full flex items-center justify-center gap-2 py-4"
                style={{
                  borderRadius: "14px",
                  background: saved
                    ? "linear-gradient(135deg,#22C55E,#16A34A)"
                    : "linear-gradient(135deg,#3B82F6,#2563EB)",
                  fontSize: "15px", fontWeight: "700", color: "#fff",
                  opacity: updateVenue.isPending ? 0.7 : 1,
                }}
              >
                {saved
                  ? <><Check style={{ width: "18px", height: "18px" }} /> Saved!</>
                  : updateVenue.isPending
                  ? "Saving…"
                  : <><Save style={{ width: "18px", height: "18px" }} /> Save Changes</>}
              </button>

              <button
                onClick={handleToggleActive}
                disabled={updateVenue.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5"
                style={{
                  borderRadius: "14px",
                  backgroundColor: isActive ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  border: isActive ? "1.5px solid rgba(239,68,68,0.3)" : "1.5px solid rgba(34,197,94,0.3)",
                  fontSize: "14px", fontWeight: "700",
                  color: isActive ? "#EF4444" : "#22C55E",
                }}
              >
                <Power style={{ width: "16px", height: "16px" }} />
                {isActive ? "Deactivate Venue" : "Reactivate Venue"}
              </button>
            </div>

            {updateVenue.isError && (
              <p className="text-center text-[#EF4444]" style={{ fontSize: "13px" }}>
                Failed to save. Please try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
