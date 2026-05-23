/**
 * Create Venue — Add a new venue (POST /api/venues)
 * Multi-step: Basic Info → Sports → Rates → Review
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Building2,
  Percent, Check, Plus,
} from "lucide-react";
import { useCreateVenue } from "@sportza/api-client";
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

const STEPS = ["Info", "Sports", "Rates", "Review"];

export default function CreateVenue() {
  const navigate = useNavigate();
  const createVenue = useCreateVenue();

  const [step, setStep] = useState(0);

  // Step 0 — Basic info
  const [name, setName] = useState("");
  const [locationValue, setLocationValue] = useState<LocationValue>({ state: "", city: "" });
  const [description, setDescription] = useState("");

  // Step 1 — Sports
  const [sports, setSports] = useState<string[]>([]);

  // Step 2 — Rates
  const [capacity, setCapacity] = useState("1");
  const [gstRate, setGstRate] = useState("18");
  const [commissionPct, setCommissionPct] = useState("10");

  const toggleSport = (s: string) => {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0 && locationValue.state.length > 0 && locationValue.city.length > 0;
    if (step === 1) return sports.length > 0;
    return true;
  };

  const handleSubmit = () => {
    createVenue.mutate(
      {
        name: name.trim(),
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
        sports,
        capacity: parseInt(capacity, 10) || 1,
        gstRate: parseFloat(gstRate) || 18,
        commissionPercent: parseFloat(commissionPct) || 10,
      },
      {
        onSuccess: () => navigate("/venue-owner/venues"),
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : navigate("/venue-owner/venues"))}
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div>
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Add Venue</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-6">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-full"
                style={{
                  height: "4px",
                  backgroundColor: i <= step ? "#3B82F6" : "rgba(255,255,255,0.08)",
                  transition: "background-color 0.3s",
                }}
              />
              <span style={{ fontSize: "10px", fontWeight: "600", color: i <= step ? "#3B82F6" : "#475569" }}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto">
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-4 p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-2" style={{ fontSize: "16px", fontWeight: "700" }}>Venue Details</p>
            <div>
              <label style={labelSt}>
                <Building2 style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                Venue Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Green Arena Sports Complex"
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Location *</label>
              <LocationPicker
                value={locationValue}
                onChange={setLocationValue}
                required
              />
            </div>
            <div>
              <label style={labelSt}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell players what's great about your venue…"
                rows={3}
                style={{ ...inputSt, resize: "none" }}
              />
            </div>
          </div>
        )}

        {/* Step 1: Sports */}
        {step === 1 && (
          <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-1" style={{ fontSize: "16px", fontWeight: "700" }}>Sports Offered *</p>
            <p className="text-[#64748B] mb-4" style={{ fontSize: "13px" }}>Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS_LIST.map((s) => {
                const selected = sports.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSport(s)}
                    className="px-4 py-2.5 flex items-center gap-2"
                    style={{
                      borderRadius: "12px",
                      fontSize: "14px", fontWeight: "600",
                      backgroundColor: selected ? "rgba(59,130,246,0.2)" : "#0F172A",
                      color: selected ? "#3B82F6" : "#64748B",
                      border: selected ? "1.5px solid #3B82F6" : "1.5px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {selected ? <Check style={{ width: "14px", height: "14px" }} /> : <Plus style={{ width: "14px", height: "14px" }} />}
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
            {sports.length === 0 && (
              <p className="text-[#F59E0B] mt-4" style={{ fontSize: "12px" }}>Select at least one sport to continue.</p>
            )}
          </div>
        )}

        {/* Step 2: Rates */}
        {step === 2 && (
          <div className="space-y-4 p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <p className="text-white mb-2" style={{ fontSize: "16px", fontWeight: "700" }}>Rates & Commission</p>
            <div>
              <label style={labelSt}>Total Court Capacity *</label>
              <input
                type="number" min="1" step="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 4"
                style={inputSt}
              />
              <p className="text-[#64748B] mt-1" style={{ fontSize: "12px" }}>
                Total number of courts / playing areas.
              </p>
            </div>
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
                Platform Commission (%)
              </label>
              <input
                type="number" min="0" max="100" step="0.1"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                placeholder="10"
                style={inputSt}
              />
              <p className="text-[#64748B] mt-2" style={{ fontSize: "12px" }}>
                Platform fee deducted from each booking revenue.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="p-5" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
              <p className="text-white mb-4" style={{ fontSize: "16px", fontWeight: "700" }}>Review & Confirm</p>
              {[
                { label: "Name",       value: name },
                { label: "State",      value: locationValue.state || "—" },
                { label: "City",       value: locationValue.city || "—" },
                { label: "Address",    value: locationValue.address || "—" },
                { label: "Sports",     value: sports.join(", ") || "—" },
                { label: "Capacity",   value: `${capacity} court${parseInt(capacity, 10) !== 1 ? "s" : ""}` },
                { label: "GST",        value: `${gstRate}%` },
                { label: "Commission", value: `${commissionPct}%` },
              ].map((r) => (
                <div key={r.label} className="flex justify-between py-2.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[#64748B]" style={{ fontSize: "13px" }}>{r.label}</span>
                  <span className="text-white" style={{ fontSize: "13px", fontWeight: "600", maxWidth: "55%", textAlign: "right" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {createVenue.isError && (
              <p className="text-[#EF4444] text-center" style={{ fontSize: "13px" }}>
                Failed to create venue. Please try again.
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={createVenue.isPending}
              className="w-full py-4"
              style={{
                borderRadius: "14px",
                background: "linear-gradient(135deg,#22C55E,#16A34A)",
                fontSize: "15px", fontWeight: "700", color: "#fff",
                opacity: createVenue.isPending ? 0.7 : 1,
              }}
            >
              {createVenue.isPending ? "Creating…" : "Create Venue"}
            </button>
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="w-full flex items-center justify-center gap-2 py-4 mt-5"
            style={{
              borderRadius: "14px",
              background: canNext()
                ? "linear-gradient(135deg,#3B82F6,#2563EB)"
                : "rgba(255,255,255,0.06)",
              fontSize: "15px", fontWeight: "700",
              color: canNext() ? "#fff" : "#475569",
              cursor: canNext() ? "pointer" : "not-allowed",
            }}
          >
            Continue
            <ChevronRight style={{ width: "18px", height: "18px" }} />
          </button>
        )}
      </div>
    </div>
  );
}
