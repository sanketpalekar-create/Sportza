import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useSetPassword, useDeleteAccount } from "@sportza/api-client";
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link,
  Chrome,
  Facebook,
  Trash2,
  ShieldAlert,
} from "lucide-react";

// ─── Password form ────────────────────────────────────────────────────────────

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const setPassword = useSetPassword();

  const [password, setPasswordVal] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function validate() {
    const e: { password?: string; confirm?: string } = {};
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    setApiError(null);
    setSuccess(false);
    if (!validate()) return;
    try {
      await setPassword.mutateAsync(password);
      setSuccess(true);
      setPasswordVal("");
      setConfirm("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setApiError(err?.response?.data?.message ?? "Failed to update password. Try again.");
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {/* Password input */}
        <div>
          <label className="block mb-1.5 text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "600" }}>
            {hasPassword ? "New Password" : "Set Password"}
          </label>
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: errors.password
                ? "1.5px solid rgba(239,68,68,0.6)"
                : "1.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <Lock style={{ width: "18px", height: "18px", color: "#475569", flexShrink: 0 }} />
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPasswordVal(e.target.value);
                if (e.target.value.length >= 8) setErrors((er) => ({ ...er, password: undefined }));
              }}
              placeholder="Min. 8 characters"
              className="flex-1 bg-transparent outline-none text-white placeholder-[#334155]"
              style={{ fontSize: "15px" }}
            />
            <button onClick={() => setShowPwd((v) => !v)} className="text-[#475569]">
              {showPwd ? (
                <EyeOff style={{ width: "18px", height: "18px" }} />
              ) : (
                <Eye style={{ width: "18px", height: "18px" }} />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 flex items-center gap-1 text-[#EF4444]" style={{ fontSize: "12px" }}>
              <AlertCircle style={{ width: "12px", height: "12px" }} />
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm input */}
        <div>
          <label className="block mb-1.5 text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "600" }}>
            Confirm Password
          </label>
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderRadius: "14px",
              backgroundColor: "#1E293B",
              border: errors.confirm
                ? "1.5px solid rgba(239,68,68,0.6)"
                : "1.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <Lock style={{ width: "18px", height: "18px", color: "#475569", flexShrink: 0 }} />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (e.target.value === password) setErrors((er) => ({ ...er, confirm: undefined }));
              }}
              placeholder="Repeat password"
              className="flex-1 bg-transparent outline-none text-white placeholder-[#334155]"
              style={{ fontSize: "15px" }}
            />
            <button onClick={() => setShowConfirm((v) => !v)} className="text-[#475569]">
              {showConfirm ? (
                <EyeOff style={{ width: "18px", height: "18px" }} />
              ) : (
                <Eye style={{ width: "18px", height: "18px" }} />
              )}
            </button>
          </div>
          {errors.confirm && (
            <p className="mt-1.5 flex items-center gap-1 text-[#EF4444]" style={{ fontSize: "12px" }}>
              <AlertCircle style={{ width: "12px", height: "12px" }} />
              {errors.confirm}
            </p>
          )}
        </div>
      </div>

      {apiError && (
        <div
          className="mt-4 flex items-start gap-2 px-3 py-3"
          style={{
            borderRadius: "12px",
            backgroundColor: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertCircle style={{ width: "16px", height: "16px", color: "#EF4444", flexShrink: 0, marginTop: "1px" }} />
          <p className="text-[#EF4444]" style={{ fontSize: "13px" }}>{apiError}</p>
        </div>
      )}

      {success && (
        <div
          className="mt-4 flex items-center gap-2 px-3 py-3"
          style={{
            borderRadius: "12px",
            backgroundColor: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <CheckCircle2 style={{ width: "16px", height: "16px", color: "#22C55E", flexShrink: 0 }} />
          <p className="text-[#22C55E]" style={{ fontSize: "13px", fontWeight: "600" }}>
            Password {hasPassword ? "updated" : "set"} successfully!
          </p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={setPassword.isPending || success}
        className="mt-4 w-full flex items-center justify-center gap-2"
        style={{
          padding: "14px",
          borderRadius: "14px",
          backgroundColor:
            setPassword.isPending || success ? "rgba(59,130,246,0.4)" : "#3B82F6",
          fontSize: "15px",
          fontWeight: "700",
          color: "#fff",
          transition: "background-color 0.2s",
          cursor: setPassword.isPending || success ? "not-allowed" : "pointer",
        }}
      >
        {setPassword.isPending ? (
          <>
            <Loader2 className="animate-spin" style={{ width: "16px", height: "16px" }} />
            Saving…
          </>
        ) : success ? (
          <>
            <CheckCircle2 style={{ width: "16px", height: "16px" }} />
            Saved!
          </>
        ) : hasPassword ? (
          "Update Password"
        ) : (
          "Set Password"
        )}
      </button>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === "DELETE";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#1E293B",
          border: "1px solid rgba(239,68,68,0.2)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-center mb-4">
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "rgba(239,68,68,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert style={{ width: "28px", height: "28px", color: "#EF4444" }} />
          </div>
        </div>
        <h2 className="text-white text-center mb-2" style={{ fontSize: "20px", fontWeight: "800" }}>
          Delete Account?
        </h2>
        <p className="text-[#94A3B8] text-center mb-6" style={{ fontSize: "14px", lineHeight: "1.5" }}>
          This will permanently remove your personal data. Your matches, bookings and game history will be anonymized. This action cannot be undone.
        </p>

        <label className="block mb-2 text-[#94A3B8]" style={{ fontSize: "13px", fontWeight: "600" }}>
          Type <span className="text-[#EF4444] font-bold">DELETE</span> to confirm
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          className="w-full bg-transparent outline-none text-white placeholder-[#334155] px-4 py-3 mb-4"
          style={{
            borderRadius: "14px",
            border: "1.5px solid rgba(239,68,68,0.4)",
            backgroundColor: "rgba(239,68,68,0.05)",
            fontSize: "15px",
            fontWeight: "600",
            letterSpacing: "0.05em",
          }}
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4"
            style={{
              borderRadius: "14px",
              backgroundColor: "rgba(255,255,255,0.06)",
              fontSize: "15px",
              fontWeight: "700",
              color: "#94A3B8",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="flex-1 py-4 flex items-center justify-center gap-2"
            style={{
              borderRadius: "14px",
              backgroundColor: confirmed && !isPending ? "#EF4444" : "rgba(239,68,68,0.3)",
              fontSize: "15px",
              fontWeight: "700",
              color: "#fff",
              cursor: confirmed && !isPending ? "pointer" : "not-allowed",
              transition: "background-color 0.2s",
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" style={{ width: "16px", height: "16px" }} />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 style={{ width: "16px", height: "16px" }} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, color = "#3B82F6" }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <Icon style={{ width: "14px", height: "14px", color }} />
      <p
        className="text-[#64748B]"
        style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {label}
      </p>
    </div>
  );
}

export default function Privacy() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const deleteAccount = useDeleteAccount();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const apiUser = (userData as any)?.user ?? userData;
  const hasPassword: boolean = apiUser?.hasPassword ?? false;
  const hasGoogle: boolean = apiUser?.hasGoogle ?? false;
  const hasFacebook: boolean = apiUser?.hasFacebook ?? false;

  async function handleDeleteConfirm() {
    try {
      await deleteAccount.mutateAsync();
      window.location.href = "/login";
    } catch {
      setShowDeleteModal(false);
    }
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
            Privacy & Security
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Password, accounts & data
          </p>
        </div>
      </div>

      {/* ── Password ── */}
      <div className="mb-8">
        <SectionTitle icon={Lock} label={hasPassword ? "Change Password" : "Set Password"} />
        <div
          className="p-4"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {!hasPassword && (
            <p className="text-[#64748B] mb-4" style={{ fontSize: "13px" }}>
              You signed in without a password. Add one so you can also log in with email & password.
            </p>
          )}
          <PasswordSection hasPassword={hasPassword} />
        </div>
      </div>

      {/* ── Linked Accounts ── */}
      <div className="mb-8">
        <SectionTitle icon={Link} label="Linked Accounts" />
        <div
          className="overflow-hidden"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Google */}
          <div
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: hasGoogle ? "rgba(234,67,53,0.12)" : "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Chrome
                  style={{ width: "20px", height: "20px", color: hasGoogle ? "#EA4335" : "#475569" }}
                />
              </div>
              <div>
                <span className="text-white" style={{ fontSize: "15px", fontWeight: "600" }}>
                  Google
                </span>
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                  {hasGoogle ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            <span
              className="px-2.5 py-1"
              style={{
                borderRadius: "8px",
                backgroundColor: hasGoogle ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                fontSize: "12px",
                fontWeight: "700",
                color: hasGoogle ? "#22C55E" : "#475569",
              }}
            >
              {hasGoogle ? "Linked" : "Not linked"}
            </span>
          </div>

          {/* Facebook */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: hasFacebook ? "rgba(24,119,242,0.12)" : "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Facebook
                  style={{ width: "20px", height: "20px", color: hasFacebook ? "#1877F2" : "#475569" }}
                />
              </div>
              <div>
                <span className="text-white" style={{ fontSize: "15px", fontWeight: "600" }}>
                  Facebook
                </span>
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>
                  {hasFacebook ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            <span
              className="px-2.5 py-1"
              style={{
                borderRadius: "8px",
                backgroundColor: hasFacebook ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                fontSize: "12px",
                fontWeight: "700",
                color: hasFacebook ? "#22C55E" : "#475569",
              }}
            >
              {hasFacebook ? "Linked" : "Not linked"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="mb-8">
        <SectionTitle icon={ShieldAlert} label="Danger Zone" color="#EF4444" />
        <div
          className="p-4"
          style={{
            borderRadius: "16px",
            backgroundColor: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <Trash2 style={{ width: "18px", height: "18px", color: "#EF4444", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p className="text-white mb-1" style={{ fontSize: "15px", fontWeight: "700" }}>
                Delete Account
              </p>
              <p className="text-[#94A3B8]" style={{ fontSize: "13px", lineHeight: "1.5" }}>
                Permanently removes your personal information. Your game history is anonymized and retained for platform integrity. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3"
            style={{
              borderRadius: "12px",
              backgroundColor: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              fontSize: "15px",
              fontWeight: "700",
              color: "#EF4444",
            }}
          >
            <Trash2 style={{ width: "16px", height: "16px" }} />
            Delete My Account
          </button>
        </div>
      </div>

      {/* ── Delete modal ── */}
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          isPending={deleteAccount.isPending}
        />
      )}
    </div>
  );
}
