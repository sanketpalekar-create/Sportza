import { useState } from "react";
import { Link } from "react-router-dom";
import { useForgotPassword } from "@sportza/api-client";
import { ArrowLeft, Send } from "lucide-react";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState("");

  const forgotPwd = useForgotPassword();

  async function handleSubmit() {
    const val = identifier.trim();
    if (!val) { setError("Please enter your email or phone number"); return; }
    setError("");
    try {
      await forgotPwd.mutateAsync(val);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Something went wrong. Try again.");
    }
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
        <div
          className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
          style={{ borderRadius: "16px", background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
        >
          <Send style={{ width: "24px", height: "24px", color: "white" }} />
        </div>
        <h1 className="text-white mb-2" style={{ fontSize: "24px", fontWeight: "800" }}>
          {submitted ? "Check your email" : "Reset password"}
        </h1>
        <p className="text-[#94A3B8]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
          {submitted
            ? "If an account exists for that email, we've sent a reset link. Check your inbox (and spam folder)."
            : "Enter your email or phone number and we'll send you a reset link."}
        </p>
      </div>

      {!submitted ? (
        <>
          <div className="mb-2">
            <input
              type="text"
              placeholder="Email or phone number"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
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
            disabled={forgotPwd.isPending}
            className="w-full mt-5 flex items-center justify-center gap-2 text-white"
            style={{
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,#3B82F6,#6366F1)",
              fontSize: "16px",
              fontWeight: "700",
              opacity: forgotPwd.isPending ? 0.7 : 1,
            }}
          >
            {forgotPwd.isPending ? "Sending…" : "Send reset link"}
          </button>
        </>
      ) : (
        <Link
          to="/login"
          className="w-full flex items-center justify-center gap-2 text-white"
          style={{
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg,#3B82F6,#6366F1)",
            fontSize: "16px",
            fontWeight: "700",
            display: "flex",
          }}
        >
          Back to login
        </Link>
      )}
    </div>
  );
}
