/**
 * Login — Friction Reduction Layer
 *
 * Key insight: "Login should not feel like a task"
 * → OTP (default) or Password — user's choice
 * → "Keep me logged in" for 30-day refresh token persistence
 * → Google as a quick alternative
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSendOtp,
  useVerifyOtp,
  useSendPhoneOtp,
  useVerifyPhoneOtp,
  useLoginWithPassword,
  setAuthToken,
} from "@sportza/api-client";
import GoogleSignInError from "../components/GoogleSignInError";
import { useSportzaGoogleSignIn } from "../hooks/useSportzaGoogleSignIn";
import { Phone, Mail, ArrowLeft, ChevronRight, Eye, EyeOff, Lock } from "lucide-react";

type ContactMethod = "phone" | "email";
type LoginMode    = "otp" | "password";
type OtpStep      = "input" | "otp";

// ─── 6-box OTP input ─────────────────────────────────────────────────────────
function OtpBoxes({
  value,
  onChange,
  onComplete,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
  error?: string;
}) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!value[i] && i > 0) {
        refs[i - 1].current?.focus();
        onChange(value.slice(0, i - 1));
      } else {
        onChange(value.slice(0, i) + value.slice(i + 1));
      }
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) { refs[i - 1].current?.focus(); return; }
    if (e.key === "ArrowRight" && i < 5) { refs[i + 1].current?.focus(); return; }
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    if (i < 5) refs[i + 1].current?.focus();
    else if (next.length === 6) onComplete();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length > 0) {
      onChange(digits.padEnd(6, "").slice(0, 6));
      refs[Math.min(digits.length, 5)].current?.focus();
      if (digits.length === 6) onComplete();
    }
    e.preventDefault();
  }

  return (
    <div>
      <div className="flex gap-2 justify-center" onPaste={handlePaste}>
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onFocus={(e) => e.target.select()}
            className="text-white text-center outline-none transition-all"
            style={{
              width: "46px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: error
                ? "2px solid #EF4444"
                : value[i]
                ? "2px solid #3B82F6"
                : "2px solid rgba(255,255,255,0.08)",
              fontSize: "22px",
              fontWeight: "700",
              caretColor: "transparent",
            }}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-[#EF4444] mt-2" style={{ fontSize: "13px" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Google button ────────────────────────────────────────────────────────────
function GoogleButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3.5 transition-colors"
      style={{
        borderRadius: "16px",
        backgroundColor: "#1E293B",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: "15px",
        fontWeight: "600",
        color: "#FFFFFF",
        opacity: loading ? 0.7 : 1,
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? "Signing in…" : "Continue with Google"}
    </button>
  );
}

// ─── "Keep me logged in" checkbox ────────────────────────────────────────────
function KeepMeIn({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className="flex items-center justify-center transition-all"
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "6px",
          border: checked ? "none" : "2px solid rgba(255,255,255,0.2)",
          backgroundColor: checked ? "#3B82F6" : "transparent",
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: "14px", color: "#94A3B8" }}>Keep me logged in</span>
    </label>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loginMode, setLoginMode]       = useState<LoginMode>("otp");
  const [method, setMethod]             = useState<ContactMethod>("phone");
  const [step, setStep]                 = useState<OtpStep>("input");
  const [identifier, setIdentifier]     = useState("");
  const [inputVal, setInputVal]         = useState("");
  const [otpVal, setOtpVal]             = useState("");
  const [passwordVal, setPasswordVal]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [inputErr, setInputErr]         = useState("");
  const [otpErr, setOtpErr]             = useState("");
  const [passwordErr, setPasswordErr]   = useState("");
  const [devOtpHint, setDevOtpHint]     = useState<string | null>(null);

  const sendOtp     = useSendOtp();
  const verifyOtp   = useVerifyOtp();
  const sendPhone   = useSendPhoneOtp();
  const verifyPhone = useVerifyPhoneOtp();
  const loginPwd    = useLoginWithPassword();

  const isSending   = sendOtp.isPending || sendPhone.isPending;
  const isVerifying = verifyOtp.isPending || verifyPhone.isPending;

  const handleSuccess = useCallback((result: any) => {
    const token = result?.token ?? result?.data?.token;
    const user  = result?.user  ?? result?.data?.user;

    if (token) {
      localStorage.setItem("auth_token", token);
      setAuthToken(token);
    }

    if (user) {
      localStorage.setItem("sportza_user", JSON.stringify(user));
    }

    void queryClient.invalidateQueries({ queryKey: ["auth"] });
    navigate("/", { replace: true });
  }, [navigate, queryClient]);

  const { googleErr, googlePending, openGooglePopup } = useSportzaGoogleSignIn({
    keepLoggedIn,
    onSuccess: handleSuccess,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, [method, loginMode]);

  // ─── OTP flow ─────────────────────────────────────────────────────────────

  async function handleSend() {
    setInputErr("");
    const val = inputVal.trim();
    if (!val) {
      setInputErr("Please enter your " + (method === "phone" ? "mobile number" : "email"));
      return;
    }
    if (method === "phone" && !/^\+?[\d\s\-()]{7,}$/.test(val)) {
      setInputErr("Enter a valid mobile number"); return;
    }
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setInputErr("Enter a valid email address"); return;
    }
    try {
      setDevOtpHint(null);
      if (method === "phone") {
        const res: any = await sendPhone.mutateAsync({ phone: val });
        if (res?.devOtp) {
          setDevOtpHint(res.devOtp);
          setOtpVal(res.devOtp); // auto-fill the OTP boxes
        }
      } else {
        await sendOtp.mutateAsync({ email: val });
      }
      setIdentifier(val);
      setOtpVal("");
      setOtpErr("");
      setStep("otp");
    } catch (err: any) {
      setInputErr(err?.response?.data?.message ?? "Failed to send OTP. Try again.");
    }
  }

  async function handleVerifyOtp() {
    if (otpVal.length < 6) { setOtpErr("Enter the 6-digit code"); return; }
    setOtpErr("");
    try {
      let result: any;
      if (method === "phone") {
        result = await verifyPhone.mutateAsync({ phone: identifier, code: otpVal, keepLoggedIn });
      } else {
        result = await verifyOtp.mutateAsync({ email: identifier, code: otpVal, keepLoggedIn });
      }
      handleSuccess(result);
    } catch (err: any) {
      setOtpErr(err?.response?.data?.message ?? "Invalid or expired code");
    }
  }

  // ─── Password flow ────────────────────────────────────────────────────────

  async function handlePasswordLogin() {
    const val = inputVal.trim();
    if (!val) { setInputErr("Please enter your email or phone"); return; }
    if (!passwordVal) { setPasswordErr("Please enter your password"); return; }
    setInputErr("");
    setPasswordErr("");
    try {
      const result = await loginPwd.mutateAsync({
        identifier: val,
        password: passwordVal,
        keepLoggedIn,
      });
      handleSuccess(result);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Invalid credentials";
      setPasswordErr(msg);
    }
  }

  function goBack() { setStep("input"); setOtpVal(""); setOtpErr(""); }

  // ─── Shared input section ─────────────────────────────────────────────────

  const identifierInput = (
    <div className="mb-2">
      <input
        ref={inputRef}
        type={method === "phone" ? "tel" : "email"}
        placeholder={
          loginMode === "password"
            ? "Email or phone number"
            : method === "phone"
            ? "+91 98765 43210"
            : "you@example.com"
        }
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); setInputErr(""); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            loginMode === "password" ? handlePasswordLogin() : handleSend();
          }
        }}
        className="w-full text-white placeholder-[#475569] outline-none transition-all"
        style={{
          height: "56px",
          borderRadius: "16px",
          backgroundColor: "#1E293B",
          border: inputErr ? "2px solid #EF4444" : "2px solid rgba(255,255,255,0.06)",
          paddingLeft: "18px",
          paddingRight: "18px",
          fontSize: "16px",
          fontWeight: "500",
        }}
      />
      {inputErr && (
        <p className="text-[#EF4444] mt-2 px-1" style={{ fontSize: "13px" }}>{inputErr}</p>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* OTP step — verify screen */}
      {loginMode === "otp" && step === "otp" ? (
        <>
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-[#94A3B8] mb-6 transition-colors hover:text-white"
            style={{ fontSize: "14px", fontWeight: "500" }}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
            Change number
          </button>

          <div className="mb-8 text-center">
            <h2 className="text-white mb-2" style={{ fontSize: "24px", fontWeight: "800" }}>Enter OTP</h2>
            <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              We sent a 6-digit code to
            </p>
            <p className="text-white mt-1" style={{ fontSize: "16px", fontWeight: "700" }}>
              {identifier}
            </p>
          </div>

          {devOtpHint && (
            <div
              className="mb-4 text-center px-4 py-3"
              style={{
                borderRadius: "12px",
                backgroundColor: "rgba(234,179,8,0.12)",
                border: "1px solid rgba(234,179,8,0.35)",
              }}
            >
              <p style={{ fontSize: "11px", color: "#FCD34D", marginBottom: "4px", fontWeight: 600 }}>
                DEV MODE — OTP not sent via SMS
              </p>
              <p style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "8px", color: "#FCD34D" }}>
                {devOtpHint}
              </p>
            </div>
          )}

          <div className="mb-6">
            <OtpBoxes
              value={otpVal}
              onChange={setOtpVal}
              onComplete={handleVerifyOtp}
              error={otpErr}
            />
          </div>

          <div className="mb-5">
            <KeepMeIn checked={keepLoggedIn} onChange={setKeepLoggedIn} />
          </div>

          <button
            onClick={handleVerifyOtp}
            disabled={isVerifying || otpVal.length < 6}
            className="w-full flex items-center justify-center gap-2 text-white"
            style={{
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,#3B82F6,#6366F1)",
              fontSize: "16px",
              fontWeight: "700",
              opacity: isVerifying || otpVal.length < 6 ? 0.6 : 1,
            }}
          >
            {isVerifying ? "Verifying…" : "Sign In"}
          </button>

          <div className="text-center mt-5">
            <span className="text-[#64748B]" style={{ fontSize: "14px" }}>Didn't receive it? </span>
            <button
              onClick={() => { setOtpVal(""); handleSend(); }}
              disabled={isSending}
              className="text-[#3B82F6] font-semibold"
              style={{ fontSize: "14px" }}
            >
              {isSending ? "Sending…" : "Resend OTP"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-white mb-2" style={{ fontSize: "28px", fontWeight: "800" }}>Welcome back</h1>
            <p className="text-[#94A3B8]" style={{ fontSize: "15px" }}>Sign in to your account</p>
          </div>

          {/* Mode toggle: OTP / Password */}
          <div
            className="flex p-1 mb-6"
            style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}
          >
            {(["otp", "password"] as LoginMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setLoginMode(m); setInputErr(""); setPasswordErr(""); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-all"
                style={{
                  borderRadius: "12px",
                  backgroundColor: loginMode === m ? "#3B82F6" : "transparent",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: loginMode === m ? "#FFFFFF" : "#64748B",
                }}
              >
                {m === "otp" ? <Phone style={{ width: "15px", height: "15px" }} /> : <Lock style={{ width: "15px", height: "15px" }} />}
                {m === "otp" ? "OTP" : "Password"}
              </button>
            ))}
          </div>

          {/* Contact method toggle (OTP mode only) */}
          {loginMode === "otp" && (
            <div
              className="flex p-1 mb-4"
              style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              {(["phone", "email"] as ContactMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setInputVal(""); setInputErr(""); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-all"
                  style={{
                    borderRadius: "8px",
                    backgroundColor: method === m ? "rgba(255,255,255,0.08)" : "transparent",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: method === m ? "#FFFFFF" : "#64748B",
                  }}
                >
                  {m === "phone"
                    ? <Phone style={{ width: "13px", height: "13px" }} />
                    : <Mail style={{ width: "13px", height: "13px" }} />}
                  {m === "phone" ? "Mobile" : "Email"}
                </button>
              ))}
            </div>
          )}

          {/* Identifier input */}
          {identifierInput}

          {/* Password input */}
          {loginMode === "password" && (
            <div className="mb-2 mt-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={passwordVal}
                  onChange={(e) => { setPasswordVal(e.target.value); setPasswordErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                  className="w-full text-white placeholder-[#475569] outline-none transition-all"
                  style={{
                    height: "56px",
                    borderRadius: "16px",
                    backgroundColor: "#1E293B",
                    border: passwordErr ? "2px solid #EF4444" : "2px solid rgba(255,255,255,0.06)",
                    paddingLeft: "18px",
                    paddingRight: "52px",
                    fontSize: "16px",
                    fontWeight: "500",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
                >
                  {showPassword
                    ? <EyeOff style={{ width: "18px", height: "18px" }} />
                    : <Eye style={{ width: "18px", height: "18px" }} />}
                </button>
              </div>
              {passwordErr && (
                <p className="text-[#EF4444] mt-2 px-1" style={{ fontSize: "13px" }}>{passwordErr}</p>
              )}
              <div className="flex justify-end mt-2">
                <Link
                  to="/forgot-password"
                  className="text-[#3B82F6]"
                  style={{ fontSize: "13px", fontWeight: "500" }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          )}

          {/* Keep me logged in */}
          <div className="mb-5 mt-4">
            <KeepMeIn checked={keepLoggedIn} onChange={setKeepLoggedIn} />
          </div>

          {/* Primary CTA */}
          <button
            onClick={loginMode === "otp" ? handleSend : handlePasswordLogin}
            disabled={isSending || loginPwd.isPending}
            className="w-full flex items-center justify-center gap-2 text-white"
            style={{
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,#3B82F6,#6366F1)",
              fontSize: "16px",
              fontWeight: "700",
              opacity: (isSending || loginPwd.isPending) ? 0.7 : 1,
            }}
          >
            {isSending || loginPwd.isPending
              ? (loginMode === "otp" ? "Sending…" : "Signing in…")
              : loginMode === "otp"
              ? (
                <>Send OTP <ChevronRight style={{ width: "18px", height: "18px" }} /></>
              )
              : "Sign In"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1" style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)" }} />
            <span className="text-[#475569]" style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
            <div className="flex-1" style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)" }} />
          </div>

          <GoogleButton onClick={() => openGooglePopup()} loading={googlePending} />
          <GoogleSignInError message={googleErr} />

          {/* Footer */}
          <p className="text-center mt-6 text-[#64748B]" style={{ fontSize: "14px" }}>
            New here?{" "}
            <Link to="/register" className="text-[#3B82F6] font-semibold">
              Create account
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
