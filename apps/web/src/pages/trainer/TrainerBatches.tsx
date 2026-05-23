import { useNavigate } from "react-router-dom";
import { useBatches, useCurrentUser } from "@sportza/api-client";
import { Plus, Users, Calendar, ChevronRight, Dumbbell } from "lucide-react";

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", cricket: "🏏", badminton: "🏸", tennis: "🎾",
  padel: "🎾", basketball: "🏀", volleyball: "🏐", swimming: "🏊", pickleball: "🏓",
};

const LEVEL_COLOR: Record<string, { color: string; bg: string }> = {
  beginner:     { color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  intermediate: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  advanced:     { color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
};

function BatchCard({ batch, onClick }: { batch: any; onClick: () => void }) {
  const sport   = (batch.sport ?? "").toLowerCase();
  const emoji   = SPORT_EMOJI[sport] ?? "🎯";
  const enrolled = batch._count?.memberships ?? 0;
  const capacity = batch.capacity ?? 0;
  const pct      = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const level    = (batch.skillLevel ?? batch.level ?? "beginner").toLowerCase();
  const lc       = LEVEL_COLOR[level] ?? LEVEL_COLOR.beginner;
  const isFull   = enrolled >= capacity && capacity > 0;

  return (
    <button onClick={onClick} className="w-full p-4 text-left hover:bg-white/5 transition-colors"
      style={{ borderRadius: "16px", backgroundColor: "#1E293B", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center flex-shrink-0"
          style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.1)", fontSize: "22px" }}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white" style={{ fontSize: "15px", fontWeight: "700" }}>{batch.name ?? "Unnamed"}</span>
            <span className="px-2 py-0.5" style={{ borderRadius: "6px", backgroundColor: lc.bg, fontSize: "10px", fontWeight: "700", color: lc.color }}>
              {level.toUpperCase()}
            </span>
          </div>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{batch.sport ?? "—"}</p>
        </div>
        <ChevronRight style={{ width: "16px", height: "16px", color: "#475569", flexShrink: 0 }} />
      </div>

      {/* Capacity bar */}
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <div className="flex items-center gap-1 text-[#64748B]">
            <Users style={{ width: "12px", height: "12px" }} />
            <span style={{ fontSize: "12px" }}>{enrolled}/{capacity} enrolled</span>
          </div>
          <span style={{ fontSize: "12px", fontWeight: "700", color: isFull ? "#EF4444" : "#22C55E" }}>
            {isFull ? "Full" : `${capacity - enrolled} seats left`}
          </span>
        </div>
        <div className="w-full rounded-full" style={{ height: "5px", backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div className="rounded-full" style={{
            width: `${Math.min(pct, 100)}%`, height: "5px",
            backgroundColor: isFull ? "#EF4444" : "#22C55E",
          }} />
        </div>
      </div>

      {/* Schedule */}
      {batch.schedule && (
        <div className="flex items-center gap-1 text-[#64748B]">
          <Calendar style={{ width: "12px", height: "12px" }} />
          <span style={{ fontSize: "12px" }}>Schedule set</span>
        </div>
      )}
    </button>
  );
}

export default function TrainerBatches() {
  const navigate = useNavigate();
  const { data: userRes } = useCurrentUser();
  const trainerId = (userRes as any)?.user?.id;
  const { data: batchesRes, isLoading, isError } = useBatches({ trainerId, page: 1, limit: 50 });
  const batches: any[] = (batchesRes as any)?.data ?? [];

  return (
    <div className="min-h-screen bg-[#0F172A] pb-28">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white" style={{ fontSize: "22px", fontWeight: "800" }}>My Batches</h1>
          <p className="text-[#64748B]" style={{ fontSize: "12px" }}>{batches.length} active program{batches.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => navigate("/trainer/batches/create")}
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ borderRadius: "10px", background: "linear-gradient(135deg,#22C55E,#16A34A)", fontSize: "13px", fontWeight: "700", color: "#fff" }}>
          <Plus style={{ width: "15px", height: "15px" }} />
          New
        </button>
      </div>

      <div className="px-4 space-y-3 max-w-md mx-auto">
        {isLoading && [1,2,3].map((i) => (
          <div key={i} className="animate-pulse h-32 rounded-2xl" style={{ backgroundColor: "#1E293B" }} />
        ))}

        {isError && (
          <div className="p-10 text-center" style={{ borderRadius: "16px", backgroundColor: "#1E293B" }}>
            <p className="text-[#EF4444]">Failed to load batches.</p>
          </div>
        )}

        {!isLoading && !isError && batches.length === 0 && (
          <div className="p-12 text-center" style={{ borderRadius: "20px", backgroundColor: "#1E293B" }}>
            <Dumbbell style={{ width: "40px", height: "40px", color: "#334155", margin: "0 auto 12px" }} />
            <p className="text-white mb-1" style={{ fontSize: "18px", fontWeight: "700" }}>No batches yet</p>
            <p className="text-[#64748B] mb-5" style={{ fontSize: "14px" }}>Create your first training program</p>
            <button onClick={() => navigate("/trainer/batches/create")} className="px-5 py-3"
              style={{ borderRadius: "12px", background: "linear-gradient(135deg,#22C55E,#16A34A)", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
              Create Batch
            </button>
          </div>
        )}

        {!isLoading && !isError && batches.map((b) => (
          <BatchCard key={b.id} batch={b} onClick={() => navigate(`/trainer/batches/${b.id}`)} />
        ))}
      </div>
    </div>
  );
}
