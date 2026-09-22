import { useEffect, useRef, useState } from "react";
import Logo from "../../components/Logo";
import { prefersReducedMotion } from "../lib/storage";

interface GuideWelcomeModalProps {
  open: boolean;
  onTour: () => void;
  onSkip: () => void;
}

const EXIT_MS = 220;

export default function GuideWelcomeModal({ open, onTour, onSkip }: GuideWelcomeModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const reducedMotion = prefersReducedMotion();
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const ms = reducedMotion ? 0 : EXIT_MS;
    exitTimerRef.current = window.setTimeout(() => setMounted(false), ms);
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, [open, reducedMotion]);

  if (!mounted) return null;

  const transition = reducedMotion
    ? undefined
    : `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sportza-welcome-title"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Dismiss welcome"
        onClick={onSkip}
        style={{
          backgroundColor: "rgba(2, 6, 23, 0.75)",
          opacity: visible ? 1 : 0,
          transition: reducedMotion ? undefined : `opacity ${EXIT_MS}ms ease`,
        }}
      />
      <div
        className="relative z-10 mx-4 mb-4 w-full max-w-md rounded-2xl px-6 py-7 sm:mb-0"
        style={{
          background: "linear-gradient(165deg, #1E3A8A 0%, #0F172A 55%, #0B1220 100%)",
          border: "1px solid rgba(59,130,246,0.35)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.96)",
          transition,
        }}
      >
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <h2
          id="sportza-welcome-title"
          className="text-center text-2xl font-bold"
          style={{ color: "#F8FAFC" }}
        >
          Welcome to Sportza
        </h2>
        <p className="mt-1 text-center text-sm font-semibold" style={{ color: "#60A5FA" }}>
          हर दिन. Game On.
        </p>
        <p className="mt-4 text-center text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
          Your game starts here. Discover venues. Find people to play with. Train. Track your
          performance. Compete.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onTour}
            className="rounded-xl px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            style={{ backgroundColor: "#3B82F6" }}
          >
            Take a quick tour
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            style={{ color: "#94A3B8" }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
