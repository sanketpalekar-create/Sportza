import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useSports, useUpdateProfile, useNotifPrefs, useUpdateNotifPrefs } from "@sportza/api-client";
import type { NotifPrefsData } from "@sportza/api-client";
import { SportRulebook } from "../components/SportRulebook";
import {
  ArrowLeft,
  Bell,
  Mail,
  Smartphone,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex-shrink-0"
      style={{
        width: "48px",
        height: "28px",
        borderRadius: "999px",
        backgroundColor: on ? "#3B82F6" : "rgba(255,255,255,0.1)",
        border: "none",
        padding: "3px",
        transition: "background-color 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          backgroundColor: "#fff",
          display: "block",
          transition: "all 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

// ─── Sport chip ───────────────────────────────────────────────────────────────

function SportChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-2"
      style={{
        borderRadius: "12px",
        backgroundColor: selected ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
        border: selected ? "1.5px solid rgba(59,130,246,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
        fontSize: "13px",
        fontWeight: selected ? "700" : "500",
        color: selected ? "#3B82F6" : "#94A3B8",
        transition: "all 0.15s",
      }}
    >
      {selected && <CheckCircle2 style={{ width: "13px", height: "13px" }} />}
      {label}
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <Icon style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
      <p
        className="text-[#64748B]"
        style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {label}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const { data: sportsData } = useSports();
  const updateProfile = useUpdateProfile();
  const { data: prefsData, isLoading: prefsLoading } = useNotifPrefs();
  const updateNotifPrefs = useUpdateNotifPrefs();

  const apiUser = (userData as any)?.user ?? userData;

  // ── Notification state (server-backed) ──
  const serverPrefs: NotifPrefsData | undefined = (prefsData as any)?.data;

  function toggleNotif(key: keyof Omit<NotifPrefsData, "id" | "userId">) {
    if (!serverPrefs) return;
    const current = serverPrefs[key] as boolean;
    updateNotifPrefs.mutate({ [key]: !current });
  }

  // ── Sports state ──
  const allSports: { id: number; name: string; displayName?: string }[] = Array.isArray(
    (sportsData as any)?.data
  )
    ? (sportsData as any).data
    : Array.isArray(sportsData)
    ? (sportsData as any)
    : [];

  const savedSportIds: number[] = Array.isArray(apiUser?.sports) ? apiUser.sports : [];
  const [selectedSportIds, setSelectedSportIds] = useState<number[]>(savedSportIds);
  const [sportsSaved, setSportsSaved] = useState(false);
  const [sportsError, setSportsError] = useState<string | null>(null);
  const [sportsPending, setSportsPending] = useState(false);

  // Sync once user data arrives
  useEffect(() => {
    if (apiUser?.sports && Array.isArray(apiUser.sports)) {
      setSelectedSportIds(apiUser.sports);
    }
  }, [apiUser?.id]);

  function toggleSport(id: number) {
    setSportsSaved(false);
    setSelectedSportIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function saveSports() {
    setSportsError(null);
    setSportsSaved(false);
    setSportsPending(true);
    try {
      await updateProfile.mutateAsync({ sports: selectedSportIds });
      setSportsSaved(true);
      setTimeout(() => setSportsSaved(false), 3000);
    } catch (err: any) {
      setSportsError(
        err?.response?.data?.message ?? "Failed to save sports. Please try again."
      );
    } finally {
      setSportsPending(false);
    }
  }

  const sportsChanged =
    JSON.stringify([...selectedSportIds].sort()) !== JSON.stringify([...savedSportIds].sort());

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
            Settings
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
            Notifications & preferences
          </p>
        </div>
      </div>

      {/* ── Email Notifications ── */}
      <div className="mb-8">
        <SectionTitle icon={Mail} label="Email Notifications" />
        <div
          className="overflow-hidden"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {prefsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-[#475569]" style={{ width: "20px", height: "20px" }} />
            </div>
          ) : (
            (
              [
                { key: "emailBookings" as const, label: "Booking confirmations & reminders" },
                { key: "emailMatches"  as const, label: "Match invites & updates" },
                { key: "emailPromo"    as const, label: "Tips, offers & newsletters" },
              ]
            ).map(({ key, label }, i, arr) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-4"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <span className="text-white pr-4" style={{ fontSize: "15px", fontWeight: "500" }}>
                  {label}
                </span>
                <Toggle
                  on={serverPrefs ? (serverPrefs[key] as boolean) : false}
                  onToggle={() => toggleNotif(key)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Push / In-app Notifications ── */}
      <div className="mb-8">
        <SectionTitle icon={Smartphone} label="Push &amp; In-App Notifications" />
        <div
          className="overflow-hidden"
          style={{
            borderRadius: "16px",
            backgroundColor: "#1E293B",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {prefsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-[#475569]" style={{ width: "20px", height: "20px" }} />
            </div>
          ) : (
            (
              [
                { key: "pushBookings" as const, label: "Booking status changes" },
                { key: "pushMatches"  as const, label: "Match live updates & scores" },
                { key: "pushInvites"  as const, label: "Game & play invites" },
                { key: "pushBatch"    as const, label: "Batch & training updates" },
                { key: "pushWallet"   as const, label: "Wallet credits & debits" },
              ]
            ).map(({ key, label }, i, arr) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-4"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <span className="text-white pr-4" style={{ fontSize: "15px", fontWeight: "500" }}>
                  {label}
                </span>
                <Toggle
                  on={serverPrefs ? (serverPrefs[key] as boolean) : false}
                  onToggle={() => toggleNotif(key)}
                />
              </div>
            ))
          )}
        </div>
        <p className="mt-2 px-1 text-[#475569]" style={{ fontSize: "12px" }}>
          Preferences are saved to your account and apply across all your devices.
        </p>
      </div>

      {/* ── Sports Preferences ── */}
      <div className="mb-8">
        <SectionTitle icon={Trophy} label="Sports I Play" />
        {allSports.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-[#475569]" style={{ width: "24px", height: "24px" }} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {allSports.map((sport: any) => (
                <div key={sport.id} className="relative">
                  <SportChip
                    label={sport.displayName ?? sport.name}
                    selected={selectedSportIds.includes(sport.id)}
                    onToggle={() => toggleSport(sport.id)}
                  />
                  <span className="absolute -top-1.5 -right-1.5 z-10">
                    <SportRulebook sport={sport} />
                  </span>
                </div>
              ))}
            </div>

            {sportsError && (
              <div
                className="mt-4 flex items-start gap-2 px-3 py-3"
                style={{
                  borderRadius: "12px",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <AlertCircle style={{ width: "16px", height: "16px", color: "#EF4444", flexShrink: 0, marginTop: "1px" }} />
                <p className="text-[#EF4444]" style={{ fontSize: "13px" }}>
                  {sportsError}
                </p>
              </div>
            )}

            {sportsSaved && (
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
                  Sports preferences saved!
                </p>
              </div>
            )}

            <button
              onClick={saveSports}
              disabled={sportsPending || (!sportsChanged && !sportsSaved)}
              className="mt-4 w-full flex items-center justify-center gap-2"
              style={{
                padding: "14px",
                borderRadius: "14px",
                backgroundColor:
                  sportsPending || (!sportsChanged && !sportsSaved)
                    ? "rgba(59,130,246,0.35)"
                    : "#3B82F6",
                fontSize: "15px",
                fontWeight: "700",
                color: "#fff",
                transition: "background-color 0.2s",
                cursor: sportsPending || (!sportsChanged && !sportsSaved) ? "not-allowed" : "pointer",
              }}
            >
              {sportsPending ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: "16px", height: "16px" }} />
                  Saving…
                </>
              ) : sportsSaved ? (
                <>
                  <CheckCircle2 style={{ width: "16px", height: "16px" }} />
                  Saved!
                </>
              ) : (
                "Save Sports Preferences"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
