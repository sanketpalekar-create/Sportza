/**
 * SportRulebook — small info icon + lightweight popup modal
 *
 * Usage:
 *   <SportRulebook sport={sport} />
 *
 * Where `sport` has the shape returned by GET /api/sports:
 *   { name, displayName, rulebookTitle?, rulebookLines? }
 *
 * The component handles its own open/close state.
 * Renders nothing if the sport has no rulebook content.
 */

import { useState } from "react";
import { X, Info } from "lucide-react";

export interface SportRulebookData {
  name: string;
  displayName?: string | null;
  rulebookTitle?: string | null;
  rulebookLines?: string[] | null;
}

// ─── Helper: normalise rulebookLines from DB (can be parsed JSON string) ───────
function parseLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((l): l is string => typeof l === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((l): l is string => typeof l === "string");
    } catch {
      // ignore
    }
  }
  return [];
}

// ─── Popup modal ──────────────────────────────────────────────────────────────
function SportRulebookModal({
  sport,
  onClose,
}: {
  sport: SportRulebookData;
  onClose: () => void;
}) {
  const lines = parseLines(sport.rulebookLines);
  const title = sport.rulebookTitle || `${sport.displayName ?? sport.name} — Quick Rules`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          zIndex: 9998,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "448px",
          backgroundColor: "#1E293B",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 32px",
          zIndex: 9999,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: "36px",
            height: "4px",
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: "2px",
            margin: "0 auto 20px",
          }}
        />

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                backgroundColor: "rgba(59,130,246,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Info style={{ width: "17px", height: "17px", color: "#3B82F6" }} />
            </div>
            <div>
              <p
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: "700",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Quick Rule Book
              </p>
              <h2 style={{ color: "#F1F5F9", fontSize: "16px", fontWeight: "700", lineHeight: 1.3 }}>
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close rulebook"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              backgroundColor: "rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "none",
              cursor: "pointer",
            }}
          >
            <X style={{ width: "15px", height: "15px", color: "#94A3B8" }} />
          </button>
        </div>

        {/* Rule lines */}
        {lines.length > 0 ? (
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
            {lines.map((line, i) => (
              <li
                key={i}
                style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
              >
                <span
                  style={{
                    minWidth: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(59,130,246,0.15)",
                    color: "#60A5FA",
                    fontSize: "11px",
                    fontWeight: "800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: "#CBD5E1", fontSize: "14px", lineHeight: "1.5" }}>
                  {line}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ color: "#64748B", fontSize: "14px" }}>
            No rule content available for this sport yet.
          </p>
        )}

        {/* Dismiss CTA */}
        <button
          onClick={onClose}
          style={{
            marginTop: "24px",
            width: "100%",
            height: "48px",
            borderRadius: "14px",
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: "#94A3B8",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </>
  );
}

// ─── Info icon trigger ─────────────────────────────────────────────────────────
export function SportRulebook({ sport }: { sport: SportRulebookData }) {
  const [open, setOpen] = useState(false);
  const lines = parseLines(sport.rulebookLines);

  // Render nothing if no rulebook content exists
  if (!sport.rulebookTitle && lines.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${sport.displayName ?? sport.name} rules`}
        title={`${sport.displayName ?? sport.name} quick rules`}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: "rgba(59,130,246,0.2)",
          border: "1.5px solid rgba(59,130,246,0.4)",
          color: "#60A5FA",
          fontSize: "10px",
          fontWeight: "800",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        i
      </button>

      {open && (
        <SportRulebookModal sport={sport} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
