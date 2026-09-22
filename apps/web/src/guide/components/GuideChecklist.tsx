import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { trackProductEvent } from "../analytics";
import { useChecklist } from "../hooks/useChecklist";
import { useGuideOptional } from "../hooks/useGuide";
import { isChecklistDismissed, setChecklistDismissed } from "../lib/storage";

export default function GuideChecklist() {
  const navigate = useNavigate();
  const guide = useGuideOptional();
  const { items, completedCount, total } = useChecklist();
  const [dismissed, setDismissed] = useState(() => isChecklistDismissed());

  if (dismissed) return null;
  if (completedCount >= total) return null;

  const pct = Math.round((completedCount / total) * 100);

  return (
    <section
      data-guide="get-started-checklist"
      className="mx-4 mb-5 overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(30,41,59,0.9)",
        border: "1px solid rgba(59,130,246,0.22)",
      }}
      aria-label="Get Started with Sportza"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: "#F8FAFC" }}>
            Get Started with Sportza
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "#94A3B8" }}>
            {completedCount} of {total} completed
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss checklist"
          onClick={() => {
            setChecklistDismissed(true);
            setDismissed(true);
            trackProductEvent("checklist_dismissed");
          }}
          className="rounded-md p-1 text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "#0F172A" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "#3B82F6", transition: "width 0.3s ease" }}
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>

      <ul className="mt-3 pb-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                trackProductEvent("checklist_item_clicked", { itemId: item.id });
                if (!item.done && item.guideId && guide) {
                  // navigate first; optional tour can be started from Help
                }
                navigate(item.to);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: item.done ? "rgba(34,197,94,0.2)" : "rgba(15,23,42,0.9)",
                  border: item.done ? "none" : "1px solid rgba(100,116,139,0.5)",
                }}
                aria-hidden
              >
                {item.done && <Check className="h-3 w-3" style={{ color: "#22C55E" }} />}
              </span>
              <span
                className="flex-1 text-sm"
                style={{
                  color: item.done ? "#64748B" : "#E2E8F0",
                  textDecoration: item.done ? "line-through" : "none",
                }}
              >
                {item.label}
              </span>
              {!item.done && (
                <ChevronRight className="h-4 w-4" style={{ color: "#475569" }} aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t px-4 py-3" style={{ borderColor: "rgba(148,163,184,0.1)" }}>
        <button
          type="button"
          onClick={() => {
            const next = items.find((i) => !i.done);
            if (next) navigate(next.to);
          }}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          style={{ backgroundColor: "#3B82F6" }}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
