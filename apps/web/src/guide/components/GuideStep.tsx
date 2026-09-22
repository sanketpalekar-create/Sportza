import { useEffect, useState } from "react";

interface GuideStepCardProps {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  stepId: string;
  isMobile: boolean;
  isLast: boolean;
  reducedMotion?: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function GuideStepCard({
  title,
  description,
  stepIndex,
  totalSteps,
  stepId,
  isMobile,
  isLast,
  reducedMotion = false,
  onBack,
  onNext,
  onSkip,
}: GuideStepCardProps) {
  const [contentVisible, setContentVisible] = useState(true);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displayDescription, setDisplayDescription] = useState(description);
  const [displayIndex, setDisplayIndex] = useState(stepIndex);

  // Crossfade content when the step changes
  useEffect(() => {
    if (reducedMotion) {
      setDisplayTitle(title);
      setDisplayDescription(description);
      setDisplayIndex(stepIndex);
      setContentVisible(true);
      return;
    }
    setContentVisible(false);
    const t = window.setTimeout(() => {
      setDisplayTitle(title);
      setDisplayDescription(description);
      setDisplayIndex(stepIndex);
      setContentVisible(true);
    }, 120);
    return () => window.clearTimeout(t);
  }, [stepId, title, description, stepIndex, reducedMotion]);

  return (
    <div
      className={isMobile ? "rounded-t-2xl px-5 pb-6 pt-4" : "rounded-2xl px-5 py-4 shadow-xl"}
      style={{
        backgroundColor: "#1E293B",
        border: "1px solid rgba(148,163,184,0.2)",
        paddingBottom: isMobile ? "calc(1.5rem + env(safe-area-inset-bottom))" : undefined,
      }}
    >
      {isMobile && (
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full"
          style={{ backgroundColor: "#475569" }}
          aria-hidden
        />
      )}

      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "translateY(0)" : "translateY(4px)",
          transition: reducedMotion
            ? undefined
            : "opacity 0.15s ease, transform 0.15s ease",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#60A5FA" }}>
          Step {displayIndex + 1} of {totalSteps}
        </p>

        {/* Progress dots */}
        <div className="mt-2 flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full"
              style={{
                width: i === displayIndex ? 16 : 6,
                backgroundColor: i === displayIndex ? "#3B82F6" : "#334155",
                transition: reducedMotion ? undefined : "width 0.2s ease, background-color 0.2s ease",
              }}
            />
          ))}
        </div>

        <h2 className="mt-2.5 text-lg font-bold" style={{ color: "#F8FAFC" }}>
          {displayTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
          {displayDescription}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          style={{ color: "#64748B" }}
        >
          Skip Tour
        </button>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{
                color: "#E2E8F0",
                border: "1px solid rgba(148,163,184,0.25)",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            style={{ backgroundColor: "#3B82F6" }}
          >
            {isLast ? "Done" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
