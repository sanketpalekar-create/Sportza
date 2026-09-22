interface GuideStepCardProps {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  isMobile: boolean;
  isLast: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function GuideStepCard({
  title,
  description,
  stepIndex,
  totalSteps,
  isMobile,
  isLast,
  onBack,
  onNext,
  onSkip,
}: GuideStepCardProps) {
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
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#60A5FA" }}>
        Step {stepIndex + 1} of {totalSteps}
      </p>
      <h2 className="mt-1 text-lg font-bold" style={{ color: "#F8FAFC" }}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
        {description}
      </p>
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
