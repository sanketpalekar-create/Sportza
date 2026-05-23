/**
 * SetPasswordPrompt — shown after OTP login for users who don't yet have a password.
 * Non-blocking: user can dismiss and set it later from their profile.
 */
import { useState } from "react";
import { useSetPassword } from "@sportza/api-client";
import { Eye, EyeOff, Lock, X } from "lucide-react";

interface Props {
  onDone: () => void;
}

export default function SetPasswordPrompt({ onDone }: Props) {
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");

  const setPwd = useSetPassword();

  async function handleSet() {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    try {
      await setPwd.mutateAsync(password);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to set password. Try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full sm:max-w-sm mx-auto p-6"
        style={{
          backgroundColor: "#0F172A",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
            >
              <Lock style={{ width: "18px", height: "18px", color: "white" }} />
            </div>
            <div>
              <h3 className="text-white font-bold" style={{ fontSize: "17px" }}>Set a password</h3>
              <p className="text-[#64748B]" style={{ fontSize: "12px" }}>Skip OTP next time</p>
            </div>
          </div>
          <button onClick={onDone} className="text-[#475569] hover:text-white transition-colors p-1">
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        <p className="text-[#94A3B8] mb-5" style={{ fontSize: "13px", lineHeight: "1.6" }}>
          Add a password so you can sign in faster next time — no OTP needed.
        </p>

        {/* Password input */}
        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Choose a password (min. 8 chars)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSet()}
            autoFocus
            className="w-full text-white placeholder-[#475569] outline-none"
            style={{
              height: "52px",
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: error ? "2px solid #EF4444" : "2px solid rgba(255,255,255,0.08)",
              paddingLeft: "16px",
              paddingRight: "48px",
              fontSize: "15px",
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
          >
            {showPassword ? <EyeOff style={{ width: "17px" }} /> : <Eye style={{ width: "17px" }} />}
          </button>
        </div>
        {error && (
          <p className="text-[#EF4444] mb-3 px-1" style={{ fontSize: "12px" }}>{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onDone}
            className="flex-1 py-3 text-[#64748B] font-semibold transition-colors hover:text-white"
            style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "14px" }}
          >
            Skip for now
          </button>
          <button
            onClick={handleSet}
            disabled={setPwd.isPending}
            className="flex-1 py-3 text-white font-semibold"
            style={{
              borderRadius: "14px",
              background: "linear-gradient(135deg,#3B82F6,#6366F1)",
              fontSize: "14px",
              opacity: setPwd.isPending ? 0.7 : 1,
            }}
          >
            {setPwd.isPending ? "Saving…" : "Set password"}
          </button>
        </div>
      </div>
    </div>
  );
}
