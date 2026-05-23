import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTournament, useRegisterForTournament } from "@sportza/api-client";
import { ChevronLeft, Users, CheckCircle, Trophy, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

const INPUT: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: "10px",
  backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "15px", outline: "none", boxSizing: "border-box",
};

export default function TournamentRegister() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const tournamentId = id ? parseInt(id, 10) : 0;

  const { data: tourRes, isLoading } = useTournament(tournamentId);
  const registerMutation             = useRegisterForTournament(tournamentId);

  const tournament: any = (tourRes as any)?.data ?? tourRes;
  const teams: any[]    = Array.isArray(tournament?.teams) ? tournament.teams : [];

  const [teamName,     setTeamName]     = useState("");
  const [captainName,  setCaptainName]  = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [notes,        setNotes]        = useState("");
  const [playerUsernames, setPlayerUsernames] = useState("");
  const [done,         setDone]         = useState(false);
  const [error,        setError]        = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!teamName.trim() || !captainName.trim()) {
      setError("Team name and captain name are required.");
      return;
    }
    (registerMutation as any).mutate(
      {
        teamName: teamName.trim(),
        captainName: captainName.trim(),
        captainPhone: captainPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        playerUsernames: Array.from(
          new Set(
            playerUsernames
              .split(/[\n,]+/)
              .map((v) => v.trim())
              .filter(Boolean)
          )
        ),
      },
      {
        onSuccess: () => setDone(true),
        onError: (err: any) =>
          setError(err?.response?.data?.error ?? err?.response?.data?.message ?? "Registration failed. Please try again."),
      }
    );
  }

  // ── Not accepting registrations ──────────────────────────────────────────

  const notAccepting = !isLoading && tournament && tournament.status !== "registration";

  if (notAccepting) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
          <h1 className="text-white mb-2" style={{ fontSize: "22px", fontWeight: "800" }}>
            Not Accepting Registrations
          </h1>
          <p className="text-[#64748B]" style={{ fontSize: "14px", lineHeight: "1.6" }}>
            {tournament?.name} is currently{" "}
            <span style={{ color: "#F59E0B", fontWeight: "700" }}>
              {(tournament?.status ?? "").replace("_", " ")}
            </span>{" "}
            and not open for team registrations.
          </p>
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="mt-6 px-6 py-3 active:scale-[0.98] transition-transform"
            style={{ borderRadius: "12px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
          >
            View Tournament
          </button>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center mb-4"
            style={{ width: "72px", height: "72px", borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.12)", margin: "0 auto 20px" }}>
            <CheckCircle style={{ width: "36px", height: "36px", color: "#22C55E" }} />
          </div>
          <h1 className="text-white mb-2" style={{ fontSize: "22px", fontWeight: "800" }}>Registration Submitted!</h1>
          <p className="text-[#64748B] mb-2" style={{ fontSize: "14px", lineHeight: "1.6" }}>
            <span className="text-white font-semibold">{teamName}</span> has been submitted for review.
          </p>
          <p className="text-[#475569]" style={{ fontSize: "13px" }}>
            The tournament organizer will review and accept your registration.
          </p>
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="mt-6 px-6 py-3 active:scale-[0.98] transition-transform"
            style={{ borderRadius: "12px", background: "linear-gradient(135deg,#22C55E,#16A34A)", fontSize: "14px", fontWeight: "700", color: "#fff" }}
          >
            View Tournament
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-5">
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#1E293B" }}
        >
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#94A3B8" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-white" style={{ fontSize: "20px", fontWeight: "800" }}>Team Registration</h1>
          {!isLoading && tournament && (
            <p className="text-[#64748B]" style={{ fontSize: "11px" }}>{tournament.name}</p>
          )}
        </div>
        <div style={{ fontSize: "24px" }}>🏆</div>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4">

        {/* Tournament info card */}
        {!isLoading && tournament && (
          <div className="p-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <div className="flex items-center gap-3 mb-3">
              <div style={{ fontSize: "28px" }}>
                {tournament.sport === "Football" ? "⚽" :
                  tournament.sport === "Cricket" ? "🏏" :
                  tournament.sport === "Badminton" ? "🏸" :
                  tournament.sport === "Tennis" ? "🎾" :
                  tournament.sport === "Padel" ? "🎾" :
                  tournament.sport === "Basketball" ? "🏀" :
                  tournament.sport === "Pickleball" ? "🏓" : "🏆"}
              </div>
              <div>
                <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>{tournament.name}</p>
                <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{tournament.sport}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {tournament.startDate && (
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <Calendar style={{ width: "13px", height: "13px" }} />
                  <span style={{ fontSize: "12px" }}>{format(new Date(tournament.startDate), "dd MMM yyyy")}</span>
                </div>
              )}
              {tournament.venue?.name && (
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <MapPin style={{ width: "13px", height: "13px" }} />
                  <span style={{ fontSize: "12px" }}>{tournament.venue.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Users style={{ width: "13px", height: "13px" }} />
                <span style={{ fontSize: "12px" }}>
                  {teams.length} registered
                  {tournament.maxTeams ? ` · ${tournament.maxTeams} max` : ""}
                </span>
              </div>
            </div>
            {tournament.description && (
              <p className="text-[#64748B] mt-2" style={{ fontSize: "12px", lineHeight: "1.5" }}>{tournament.description}</p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="animate-pulse h-28 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        )}

        {/* Registration form */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-white" style={{ fontSize: "16px", fontWeight: "700" }}>Team Details</p>

            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
                TEAM NAME *
              </label>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. Thunder FC"
                style={INPUT}
                required
              />
            </div>

            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
                CAPTAIN NAME *
              </label>
              <input
                value={captainName}
                onChange={e => setCaptainName(e.target.value)}
                placeholder="Your full name"
                style={INPUT}
                required
              />
            </div>

            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
                CONTACT NUMBER
              </label>
              <input
                value={captainPhone}
                onChange={e => setCaptainPhone(e.target.value)}
                placeholder="+91 98765 43210"
                type="tel"
                style={INPUT}
              />
            </div>

            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
                PLAYER USERNAMES (optional)
              </label>
              <textarea
                value={playerUsernames}
                onChange={e => setPlayerUsernames(e.target.value)}
                placeholder="One per line or comma separated (email or display name)"
                rows={3}
                style={{ ...INPUT, resize: "vertical" }}
              />
              <p className="text-[#64748B] mt-1" style={{ fontSize: "11px" }}>
                Unknown usernames will be added as placeholders for organizer review.
              </p>
            </div>

            <div>
              <label className="block text-[#94A3B8] mb-1.5" style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.04em" }}>
                NOTES (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional information…"
                rows={3}
                style={{ ...INPUT, resize: "none" }}
              />
            </div>

            {error && (
              <div className="p-3" style={{ borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p style={{ fontSize: "13px", color: "#EF4444" }}>{error}</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={registerMutation.isPending || !teamName.trim() || !captainName.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 active:scale-[0.98] transition-transform"
              style={{
                borderRadius: "14px", fontSize: "16px", fontWeight: "700",
                color: (!teamName.trim() || !captainName.trim()) ? "#475569" : "#fff",
                background: (!teamName.trim() || !captainName.trim() || registerMutation.isPending)
                  ? "#1E293B"
                  : "linear-gradient(135deg,#22C55E,#16A34A)",
                boxShadow: (teamName.trim() && captainName.trim() && !registerMutation.isPending)
                  ? "0 4px 24px rgba(34,197,94,0.35)"
                  : "none",
              }}
            >
              <Trophy style={{ width: "20px", height: "20px" }} />
              {registerMutation.isPending ? "Submitting…" : "Submit Registration"}
            </button>
          </div>
        </form>

        {/* Disclaimer */}
        <p className="text-center text-[#475569]" style={{ fontSize: "11px", lineHeight: "1.5", paddingTop: "4px" }}>
          Your registration will be reviewed by the tournament organizer.
          You will be notified once accepted.
        </p>

      </div>
    </div>
  );
}
