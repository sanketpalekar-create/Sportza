import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useResetPassword } from "@sportza/api-client";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword]         = useState("");
  const [confirm, setConfirm]           = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState(false);

  const resetPwd = useResetPassword();

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
    }
  }, [token]);

  function validate(): string | null {
    if (!password) return "Please enter a new password";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirm) return "Passwords do not match";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    try {
      await resetPwd.mutateAsync({ token, password });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to reset password. The link may have expired.");
    }
  }

  if (success) {
    return (
      <div className="w-full text-center">
        <div
          className="w-16 h-16 flex items-center justify-center mx-auto mb-6"
          style={{ borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.15)" }}
        >
          <CheckCircle style={{ width: "32px", height: "32px", color: "#22C55E" }} />
        </div>
        <h1 className="text-white mb-3" style={{ fontSize: "24px", fontWeight: "800" }}>Password reset!</h1>
        <p className="text-[#94A3B8] mb-8" style={{ fontSize: "14px" }}>
          Your password has been updated. Redirecting you to login…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Link
        to="/login"
        className="flex items-center gap-1.5 text-[#94A3B8] mb-8 transition-colors hover:text-white"
        style={{ fontSize: "14px", fontWeight: "500" }}
      >
        <ArrowLeft style={{ width: "16px", height: "16px" }} />
        Back to login
      </Link>

      <div className="mb-8 text-center">
        <h1 className="text-white mb-2" style={{ fontSize: "24px", fontWeight: "800" }}>Set new password</h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "14px" }}>
          Choose a strong password you haven't used before.
        </p>
      </div>

      {/* New password */}
      <div className="mb-3">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            className="w-full text-white placeholder-[#475569] outline-none transition-all"
            style={{
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "#1E293B",
              border: error ? "2px solid #EF4444" : "2px solid rgba(255,255,255,0.06)",
              paddingLeft: "18px",
              paddingRight: "52px",
              fontSize: "16px",
              fontWeight: "500",
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
          >
            {showPassword
              ? <EyeOff style={{ width: "18px", height: "18px" }} />
              : <Eye style={{ width: "18px", height: "18px" }} />}
          </button>
        </div>

        {/* Password strength hint */}
        {password.length > 0 && password.length < 8 && (
          <p className="text-[#F59E0B] mt-1 px-1" style={{ fontSize: "12px" }}>
            At least 8 characters required
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div className="mb-2">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full text-white placeholder-[#475569] outline-none transition-all"
          style={{
            height: "56px",
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: error ? "2px solid #EF4444" : "2px solid rgba(255,255,255,0.06)",
            paddingLeft: "18px",
            paddingRight: "18px",
            fontSize: "16px",
            fontWeight: "500",
          }}
        />
        {error && (
          <p className="text-[#EF4444] mt-2 px-1" style={{ fontSize: "13px" }}>{error}</p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={resetPwd.isPending || !token}
        className="w-full mt-5 flex items-center justify-center gap-2 text-white"
        style={{
          height: "56px",
          borderRadius: "16px",
          background: "linear-gradient(135deg,#3B82F6,#6366F1)",
          fontSize: "16px",
          fontWeight: "700",
          opacity: (resetPwd.isPending || !token) ? 0.7 : 1,
        }}
      >
        {resetPwd.isPending ? "Resetting…" : "Reset password"}
      </button>
    </div>
  );
}
