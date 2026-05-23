import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useUpdateProfile } from "@sportza/api-client";
import {
  ArrowLeft,
  User,
  Phone,
  Image,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import LocationPicker, { type LocationValue } from "../components/LocationPicker";

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateName(v: string) {
  if (!v.trim()) return "Name is required";
  if (v.trim().length > 255) return "Name is too long";
  return null;
}

function validatePhone(v: string) {
  if (!v) return null; // optional
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7) return "Enter a valid phone number (min 7 digits)";
  if (v.length > 20) return "Phone number is too long";
  return null;
}

function validateAvatar(v: string) {
  if (!v) return null; // optional
  try {
    new URL(v);
    return null;
  } catch {
    return "Enter a valid URL";
  }
}


// ─── Field component ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  icon: React.ElementType;
  placeholder?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  readOnly?: boolean;
  hint?: string;
}

function Field({
  label,
  value,
  onChange,
  error,
  icon: Icon,
  placeholder,
  inputMode,
  type = "text",
  readOnly = false,
  hint,
}: FieldProps) {
  return (
    <div>
      <label
        className="block mb-1.5 text-[#94A3B8]"
        style={{ fontSize: "13px", fontWeight: "600", letterSpacing: "0.02em" }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          borderRadius: "14px",
          backgroundColor: readOnly ? "rgba(255,255,255,0.02)" : "#1E293B",
          border: error
            ? "1.5px solid rgba(239,68,68,0.6)"
            : "1.5px solid rgba(255,255,255,0.07)",
          transition: "border-color 0.15s",
        }}
      >
        <Icon
          style={{
            width: "18px",
            height: "18px",
            color: readOnly ? "#334155" : "#475569",
            flexShrink: 0,
          }}
        />
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-white placeholder-[#334155]"
          style={{
            fontSize: "15px",
            fontWeight: "500",
            opacity: readOnly ? 0.45 : 1,
            cursor: readOnly ? "not-allowed" : "text",
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[#EF4444]" style={{ fontSize: "12px" }}>
          <AlertCircle style={{ width: "12px", height: "12px", flexShrink: 0 }} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-[#475569]" style={{ fontSize: "12px" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const apiUser = (userData as any)?.user ?? userData;
  const cachedUser =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem("sportza_user") || "null");
          } catch {
            return null;
          }
        })()
      : null;
  const user = apiUser ?? cachedUser;

  // ── Form state ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [locationValue, setLocationValue] = useState<LocationValue>({ state: "", city: "", pincode: "", address: "" });

  // ── Error state ──
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prefill form when user data loads
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setAvatar(user.avatar ?? "");
      const loc = (user as any).location;
      setLocationValue({
        state:   loc?.state   ?? "",
        city:    loc?.city    ?? "",
        pincode: loc?.pincode ?? "",
        address: loc?.address ?? "",
        lat:     loc?.lat     ?? undefined,
        lng:     loc?.lng     ?? undefined,
      });
    }
  }, [user?.id]);

  function validate() {
    const e: Record<string, string | null> = {
      name: validateName(name),
      phone: validatePhone(phone),
      avatar: validateAvatar(avatar),
    };
    setErrors(e);
    return Object.values(e).every((v) => !v);
  }

  async function handleSave() {
    setSubmitError(null);
    setSaved(false);
    if (!validate()) return;

    try {
      await updateProfile.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || null,
        avatar: avatar.trim() || null,
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
      });
      setSaved(true);
      setTimeout(() => navigate("/profile"), 1200);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Failed to save changes. Please try again.";
      setSubmitError(msg);
    }
  }

  const isPending = updateProfile.isPending;

  if (userLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[#3B82F6]" style={{ width: "32px", height: "32px" }} />
      </div>
    );
  }

  return (
    <div className="pb-32 px-4 pt-6 max-w-md mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/profile")}
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
          <h1 className="text-white" style={{ fontSize: "24px", fontWeight: "700" }}>
            Edit Profile
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Update your personal info
          </p>
        </div>
      </div>

      {/* ── Avatar preview ── */}
      {avatar && !errors.avatar && (
        <div className="flex justify-center mb-6">
          <div className="relative">
            <img
              src={avatar}
              alt="Avatar preview"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              className="rounded-full object-cover"
              style={{ width: "80px", height: "80px", border: "3px solid rgba(59,130,246,0.4)" }}
            />
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <div className="space-y-5">
        {/* Personal info section */}
        <div>
          <p
            className="text-[#64748B] mb-3 px-1"
            style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Personal Info
          </p>
          <div className="space-y-4">
            <Field
              label="Full Name"
              value={name}
              onChange={(v) => {
                setName(v);
                setErrors((e) => ({ ...e, name: validateName(v) }));
              }}
              error={errors.name}
              icon={User}
              placeholder="Your full name"
            />
            <Field
              label="Email"
              value={user?.email ?? ""}
              onChange={() => {}}
              icon={User}
              readOnly
              hint="Email cannot be changed here"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setErrors((e) => ({ ...e, phone: validatePhone(v) }));
              }}
              error={errors.phone}
              icon={Phone}
              placeholder="+91 9999999999"
              inputMode="tel"
              type="tel"
            />
            <Field
              label="Avatar URL"
              value={avatar}
              onChange={(v) => {
                setAvatar(v);
                setErrors((e) => ({ ...e, avatar: validateAvatar(v) }));
              }}
              error={errors.avatar}
              icon={Image}
              placeholder="https://example.com/photo.jpg"
              hint="Paste a public image URL"
              type="url"
              inputMode="url"
            />
          </div>
        </div>

        {/* Location section */}
        <div>
          <p
            className="text-[#64748B] mb-3 px-1"
            style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Location
          </p>
          <LocationPicker value={locationValue} onChange={setLocationValue} />
        </div>
      </div>

      {/* ── Submit error ── */}
      {submitError && (
        <div
          className="mt-6 flex items-start gap-3 px-4 py-3"
          style={{ borderRadius: "14px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertCircle style={{ width: "18px", height: "18px", color: "#EF4444", flexShrink: 0, marginTop: "1px" }} />
          <p className="text-[#EF4444]" style={{ fontSize: "14px" }}>
            {submitError}
          </p>
        </div>
      )}

      {/* ── Success ── */}
      {saved && (
        <div
          className="mt-6 flex items-center gap-3 px-4 py-3"
          style={{ borderRadius: "14px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <CheckCircle2 style={{ width: "18px", height: "18px", color: "#22C55E", flexShrink: 0 }} />
          <p className="text-[#22C55E]" style={{ fontSize: "14px", fontWeight: "600" }}>
            Profile updated! Returning to profile…
          </p>
        </div>
      )}

      {/* ── Save button ── */}
      <button
        onClick={handleSave}
        disabled={isPending || saved}
        className="w-full mt-8 flex items-center justify-center gap-2"
        style={{
          padding: "16px",
          borderRadius: "16px",
          backgroundColor: isPending || saved ? "rgba(59,130,246,0.5)" : "#3B82F6",
          fontSize: "16px",
          fontWeight: "700",
          color: "#fff",
          transition: "background-color 0.2s",
          cursor: isPending || saved ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" style={{ width: "18px", height: "18px" }} />
            Saving…
          </>
        ) : saved ? (
          <>
            <CheckCircle2 style={{ width: "18px", height: "18px" }} />
            Saved!
          </>
        ) : (
          "Save Changes"
        )}
      </button>
    </div>
  );
}
