import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuideDef } from "../types";
import GuideStepCard from "./GuideStep";

interface GuideOverlayProps {
  guide: GuideDef;
  stepIndex: number;
  reducedMotion: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export default function GuideOverlay({
  guide,
  stepIndex,
  reducedMotion,
  onNext,
  onBack,
  onSkip,
}: GuideOverlayProps) {
  const step = guide.steps[stepIndex];
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : true
  );
  const skipAttempts = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      skipAttempts.current += 1;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[guide] target not found: ${step.target}`);
      }
      if (step.optional || skipAttempts.current >= 2) {
        skipAttempts.current = 0;
        onNext();
      }
      setRect(null);
      return;
    }
    skipAttempts.current = 0;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
    try {
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    } catch {
      // ignore
    }
  }, [onNext, reducedMotion, step]);

  useLayoutEffect(() => {
    measure();
  }, [measure, stepIndex]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      measure();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    // Don't lock scroll entirely so target can scroll into view; trap focus in panel
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onBack, onNext, onSkip, stepIndex]);

  if (!step) return null;

  const hole = rect
    ? {
        top: Math.max(0, rect.top),
        left: Math.max(0, rect.left),
        width: Math.min(rect.width, window.innerWidth),
        height: Math.min(rect.height, window.innerHeight),
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={`${guide.title}: ${step.title}`}
    >
      {/* Spotlight overlay via box-shadow hole */}
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.72)",
            transition: reducedMotion ? undefined : "top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease",
            outline: "2px solid rgba(59,130,246,0.85)",
            outlineOffset: 2,
            zIndex: 201,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/70" aria-hidden style={{ zIndex: 201 }} />
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed z-[202] outline-none"
        style={
          isMobile
            ? { left: 0, right: 0, bottom: 0 }
            : positionDesktop(hole, step.placement ?? "bottom")
        }
      >
        <GuideStepCard
          title={step.title}
          description={step.description}
          stepIndex={stepIndex}
          totalSteps={guide.steps.length}
          isMobile={isMobile}
          onBack={stepIndex > 0 ? onBack : undefined}
          onNext={onNext}
          onSkip={onSkip}
          isLast={stepIndex >= guide.steps.length - 1}
        />
      </div>
    </div>
  );
}

function positionDesktop(
  hole: SpotlightRect | null,
  placement: string
): React.CSSProperties {
  if (!hole) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 340 };
  }
  const width = 340;
  if (placement === "top") {
    return {
      left: Math.min(Math.max(12, hole.left), window.innerWidth - width - 12),
      top: Math.max(12, hole.top - 12),
      transform: "translateY(-100%)",
      width,
    };
  }
  if (placement === "left") {
    return {
      left: Math.max(12, hole.left - 12),
      top: hole.top,
      transform: "translateX(-100%)",
      width,
    };
  }
  if (placement === "right") {
    return {
      left: Math.min(window.innerWidth - width - 12, hole.left + hole.width + 12),
      top: hole.top,
      width,
    };
  }
  // bottom / default
  return {
    left: Math.min(Math.max(12, hole.left), window.innerWidth - width - 12),
    top: Math.min(window.innerHeight - 12, hole.top + hole.height + 12),
    width,
  };
}
