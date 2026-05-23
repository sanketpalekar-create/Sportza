import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournaments, useCurrentUser, useSports } from "@sportza/api-client";
import { Plus, Trophy, Calendar, Users, ChevronRight } from "lucide-react";
import { SportRulebook } from "../../components/SportRulebook";
import { format } from "date-fns";

const SPORT_OPTIONS = ["Football","Cricket","Badminton","Tennis","Padel","Basketball","Pickleball"];
const STATUS_OPTIONS = ["draft","registration","in_progress","completed","cancelled"];

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  registration: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  in_progress:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  completed:    { color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  cancelled:    { color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  draft:        { color: "#64748B", bg: "rgba(100,116,139,0.12)" },
};

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾", basketball: "🏀",
  padel: "🎾",
  pickleball: "🏓",
};

export default function TournamentList() {
  const navigate = useNavigate();
  const [sport, setSport]   = useState("");
  const [status, setStatus] = useState("");

  const { data: userRes }   = useCurrentUser();
  const isAuth              = !!((userRes as any)?.data ?? userRes);
  const { data: res, isLoading } = useTournaments({ sport: sport || undefined, status: status || undefined });
  const { data: sportsRes } = useSports();
  const apiSports: Array<{ id: number; name: string; displayName: string; rulebookTitle?: string | null; rulebookLines?: string[] | null }> =
    Array.isArray((sportsRes as any)?.data) ? (sportsRes as any).data : [];
  const selectedSportObj = apiSports.find(s => s.displayName === sport || s.name === sport.toLowerCase());

  const tournaments: any[] = (res as any)?.data ?? [];

  const selectSt: React.CSSProperties = {
    padding: "10px 12px", borderRadius: "10px", backgroundColor: "#1E293B",
    border: "1px solid rgba(255,255,255,0.06)", color: "#94A3B8", fontSize: "13px",
    appearance: "none", outline: "none",
  };

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>Tournaments</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}</p>
        </div>
        {isAuth && (
          <button onClick={() => navigate("/tournaments/create")}
            className="flex items-center gap-1.5 px-3 py-2"
            style={{ borderRadius: "10px", background: "linear-gradient(135deg,#3B82F6,#2563EB)", fontSize: "13px", fontWeight: "700", color: "#fff" }}>
            <Plus style={{ width: "14px", height: "14px" }} />
            Create
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide items-center">
        <div className="relative flex items-center gap-1.5">
          <select value={sport} onChange={(e) => setSport(e.target.value)} style={selectSt}>
            <option value="">All Sports</option>
            {(apiSports.length > 0 ? apiSports.map(s => s.displayName) : SPORT_OPTIONS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {selectedSportObj && <SportRulebook sport={selectedSportObj} />}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectSt}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        {isLoading && [1,2,3].map((i) => (
          <div key={i} className="animate-pulse h-32 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {!isLoading && tournaments.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Trophy style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "17px", fontWeight: "700" }}>No tournaments found</p>
            <p className="text-[#64748B]" style={{ fontSize: "13px" }}>Try adjusting your filters</p>
          </div>
        )}

        {!isLoading && tournaments.map((t) => {
          const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.draft;
          const emoji = SPORT_EMOJI[(t.sport ?? "").toLowerCase()] ?? "🏆";
          const teamCount = Array.isArray(t.teams) ? t.teams.length : 0;

          return (
            <button key={t.id} onClick={() => navigate(`/tournaments/${t.id}`)}
              className="w-full p-4 text-left hover:bg-white/5 transition-colors"
              style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: "44px", height: "44px", borderRadius: "12px",
                    backgroundColor: "rgba(245,158,11,0.1)", fontSize: "22px" }}>
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-white truncate pr-2" style={{ fontSize: "15px", fontWeight: "700" }}>
                      {t.name ?? "Unnamed"}
                    </p>
                    <div className="flex-shrink-0 px-2 py-0.5"
                      style={{ borderRadius: "6px", backgroundColor: ss.bg, fontSize: "10px", fontWeight: "800", color: ss.color }}>
                      {(t.status ?? "draft").replace("_"," ").toUpperCase()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 text-[#64748B]">
                      <Trophy style={{ width: "11px", height: "11px" }} />
                      <span style={{ fontSize: "12px" }}>{t.sport ?? "—"} · {t.format ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#64748B]">
                      <Users style={{ width: "11px", height: "11px" }} />
                      <span style={{ fontSize: "12px" }}>{teamCount} teams</span>
                    </div>
                    {t.startDate && (
                      <div className="flex items-center gap-1 text-[#64748B]">
                        <Calendar style={{ width: "11px", height: "11px" }} />
                        <span style={{ fontSize: "12px" }}>{format(new Date(t.startDate), "dd MMM yyyy")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight style={{ width: "16px", height: "16px", color: "#334155", flexShrink: 0 }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
