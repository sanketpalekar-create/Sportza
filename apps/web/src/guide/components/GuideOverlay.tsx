import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GuideDef } from "../types";
import GuideStepCard from "./GuideStep";

interface GuideOverlayProps {
  guide: GuideDef;
  stepIndex: number;
  reducedMotion: boolean;
  open: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onExited?: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const EXIT_MS = 220;
const TARGET_RETRY_MS = 500;
const TARGET_RETRY_INTERVAL = 80;

export default function GuideOverlay({
  guide,
  stepIndex,
  reducedMotion,
  open,
  onNext,
  onBack,
  onSkip,
  onExited,
}: GuideOverlayProps) {
  const step = guide.steps[stepIndex];
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : true
  );
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryStartedRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // Enter / exit animation
  useEffect(() => {
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (open) {
      // Double-rAF so the browser paints the initial hidden state first
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const ms = reducedMotion ? 0 : EXIT_MS;
    exitTimerRef.current = window.setTimeout(() => {
      onExited?.();
    }, ms);
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, [open, onExited, reducedMotion]);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      if (!retryStartedRef.current) {
        retryStartedRef.current = Date.now();
      }
      const elapsed = Date.now() - retryStartedRef.current;
      if (elapsed < TARGET_RETRY_MS) {
        clearRetry();
        retryTimerRef.current = window.setTimeout(measure, TARGET_RETRY_INTERVAL);
        // Keep a centered zero-size hole so the dim backdrop stays consistent
        setRect(null);
        return;
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[guide] target not found after retry: ${step.target}`);
      }
      retryStartedRef.current = 0;
      if (step.optional) {
        onNextRef.current();
      }
      setRect(null);
      return;
    }
    retryStartedRef.current = 0;
    clearRetry();
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
  }, [clearRetry, reducedMotion, step]);

  useLayoutEffect(() => {
    retryStartedRef.current = 0;
    clearRetry();
    measure();
    return clearRetry;
  }, [measure, stepIndex, clearRetry]);

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
    if (!open) return;
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
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onBack, onNext, onSkip, stepIndex, open]);

  if (!step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 667;

  // Unified spotlight: when no target, use a zero-size hole at center (full dim, no DOM swap)
  const hole = rect
    ? {
        top: Math.max(0, rect.top),
        left: Math.max(0, rect.left),
        width: Math.min(rect.width, vw),
        height: Math.min(rect.height, vh),
      }
    : {
        top: vh / 2,
        left: vw / 2,
        width: 0,
        height: 0,
      };

  const transitionMs = reducedMotion ? 0 : EXIT_MS;
  const posTransition = reducedMotion
    ? undefined
    : `top ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), left ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), width ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), height ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), box-shadow ${EXIT_MS}ms ease, opacity ${EXIT_MS}ms ease`;

  const spotlightStyle: CSSProperties = {
    top: hole.top,
    left: hole.left,
    width: hole.width,
    height: hole.height,
    borderRadius: hole.width === 0 ? 0 : 12,
    boxShadow:
      "0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 0 2px rgba(59,130,246,0.9), 0 0 24px 4px rgba(59,130,246,0.35)",
    transition: posTransition,
    zIndex: 201,
    opacity: visible ? 1 : 0,
  };

  const panelBase: CSSProperties = isMobile
    ? { left: 0, right: 0, bottom: 0 }
    : positionDesktop(hole, step.placement ?? "bottom");

  const panelStyle: CSSProperties = {
    ...panelBase,
    opacity: visible ? 1 : 0,
    transform: [
      (panelBase.transform as string) || "",
      visible
        ? isMobile
          ? "translateY(0)"
          : "scale(1)"
        : isMobile
          ? "translateY(12px)"
          : "scale(0.96)",
    ]
      .filter(Boolean)
      .join(" "),
    transition: reducedMotion
      ? undefined
      : `opacity ${transitionMs}ms ease, transform ${transitionMs}ms cubic-bezier(0.22,1,0.36,1), top ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), left ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`,
  };

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={`${guide.title}: ${step.title}`}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div aria-hidden className="pointer-events-none fixed rounded-xl" style={spotlightStyle} />

      <div ref={panelRef} tabIndex={-1} className="fixed z-[202] outline-none" style={panelStyle}>
        <GuideStepCard
          title={step.title}
          description={step.description}
          stepIndex={stepIndex}
          totalSteps={guide.steps.length}
          stepId={step.id}
          isMobile={isMobile}
          reducedMotion={reducedMotion}
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
  hole: SpotlightRect,
  placement: string
): CSSProperties {
  const width = 340;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  if (hole.width === 0 && hole.height === 0) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  }
  if (placement === "top") {
    return {
      left: Math.min(Math.max(12, hole.left), vw - width - 12),
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
      left: Math.min(vw - width - 12, hole.left + hole.width + 12),
      top: hole.top,
      width,
    };
  }
  // bottom / default
  return {
    left: Math.min(Math.max(12, hole.left), vw - width - 12),
    top: Math.min(vh - 12, hole.top + hole.height + 12),
    width,
  };
}
