import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  useCompleteGuide,
  useGuideProgress,
  useSkipGuide,
  useStartGuide,
  useUpdateGuideProgress,
} from "@sportza/api-client";
import { useRole } from "../../context/RoleContext";
import { trackProductEvent } from "../analytics";
import {
  getFirstVisitGuide,
  getGuide,
} from "../definitions/registry";
import {
  getLocalProgress,
  isWelcomeSeen,
  loadLocalGuideProgress,
  prefersReducedMotion,
  setWelcomeSeen,
  upsertLocalProgress,
} from "../lib/storage";
import type { ActiveGuideState, GuideDef, GuideProgressRecord } from "../types";
import GuideOverlay from "./GuideOverlay";
import GuideWelcomeModal from "./GuideWelcomeModal";

export interface GuideContextValue {
  active: ActiveGuideState | null;
  progress: GuideProgressRecord[];
  reducedMotion: boolean;
  startGuide: (guideId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipGuide: () => void;
  completeGuide: () => void;
  dismissGuide: () => void;
  showWelcome: boolean;
  acceptWelcomeTour: () => void;
  skipWelcome: () => void;
  isGuideDone: (guideId: string, version?: number) => boolean;
}

export const GuideContext = createContext<GuideContextValue | null>(null);

function hasAuthToken(): boolean {
  return !!(
    localStorage.getItem("auth_token") || localStorage.getItem("sportza_token")
  );
}

interface RenderedGuide {
  def: GuideDef;
  stepIndex: number;
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { activeRole } = useRole();
  const [active, setActive] = useState<ActiveGuideState | null>(null);
  const [renderedGuide, setRenderedGuide] = useState<RenderedGuide | null>(null);
  const [localProgress, setLocalProgress] = useState<GuideProgressRecord[]>(() =>
    loadLocalGuideProgress()
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const firstVisitFired = useRef<Set<string>>(new Set());
  const welcomeHandoffRef = useRef<number | null>(null);
  const authenticated = hasAuthToken();

  const { data: progressRes } = useGuideProgress({ enabled: authenticated });
  const startMutation = useStartGuide();
  const updateMutation = useUpdateGuideProgress();
  const completeMutation = useCompleteGuide();
  const skipMutation = useSkipGuide();

  const remoteProgress: GuideProgressRecord[] = useMemo(() => {
    const raw = progressRes?.data ?? progressRes;
    return Array.isArray(raw) ? raw : [];
  }, [progressRes]);

  const progress = useMemo(() => {
    const map = new Map<string, GuideProgressRecord>();
    for (const row of localProgress) {
      map.set(`${row.guideId}:${row.version}`, row);
    }
    for (const row of remoteProgress) {
      map.set(`${row.guideId}:${row.version}`, row);
    }
    return Array.from(map.values());
  }, [localProgress, remoteProgress]);

  const isGuideDone = useCallback(
    (guideId: string, version = 1) => {
      const row =
        progress.find((p) => p.guideId === guideId && p.version === version) ??
        getLocalProgress(guideId, version);
      return !!(row && (row.completed || row.skipped));
    },
    [progress]
  );

  const syncLocal = useCallback((row: GuideProgressRecord) => {
    setLocalProgress(upsertLocalProgress(row));
  }, []);

  // Keep a snapshot for exit animation after `active` becomes null
  useLayoutEffect(() => {
    if (active) {
      const def = getGuide(active.guideId);
      if (def) setRenderedGuide({ def, stepIndex: active.stepIndex });
    }
  }, [active]);

  const startGuide = useCallback(
    (guideId: string) => {
      const def = getGuide(guideId);
      if (!def) return;
      const roleOk =
        def.roles.includes("all") ||
        def.roles.includes(activeRole as any) ||
        (activeRole === "coach" && def.roles.includes("trainer"));
      if (!roleOk) return;

      setActive({ guideId: def.id, version: def.version, stepIndex: 0 });
      const row: GuideProgressRecord = {
        guideId: def.id,
        version: def.version,
        currentStep: 0,
        completed: false,
        skipped: false,
        startedAt: new Date().toISOString(),
      };
      syncLocal(row);
      trackProductEvent("guide_started", { guideId: def.id, version: def.version });
      if (authenticated) {
        startMutation.mutate({ guideId: def.id, version: def.version });
      }
    },
    [activeRole, authenticated, startMutation, syncLocal]
  );

  const dismissGuide = useCallback(() => {
    if (active) {
      trackProductEvent("guide_dismissed", {
        guideId: active.guideId,
        version: active.version,
        step: active.stepIndex,
      });
    }
    setActive(null);
  }, [active]);

  const completeGuide = useCallback(() => {
    if (!active) return;
    const { guideId, version, stepIndex } = active;
    const row: GuideProgressRecord = {
      guideId,
      version,
      currentStep: stepIndex,
      completed: true,
      skipped: false,
      completedAt: new Date().toISOString(),
    };
    syncLocal(row);
    trackProductEvent("guide_completed", { guideId, version });
    if (authenticated) {
      completeMutation.mutate({ guideId, version });
    }
    setActive(null);
  }, [active, authenticated, completeMutation, syncLocal]);

  const skipGuide = useCallback(() => {
    if (!active) {
      setActive(null);
      return;
    }
    const { guideId, version, stepIndex } = active;
    const row: GuideProgressRecord = {
      guideId,
      version,
      currentStep: stepIndex,
      completed: false,
      skipped: true,
      completedAt: new Date().toISOString(),
    };
    syncLocal(row);
    trackProductEvent("guide_skipped", { guideId, version });
    if (authenticated) {
      skipMutation.mutate({ guideId, version });
    }
    setActive(null);
  }, [active, authenticated, skipMutation, syncLocal]);

  const nextStep = useCallback(() => {
    if (!active) return;
    const def = getGuide(active.guideId);
    if (!def) return;
    const nextIndex = active.stepIndex + 1;
    if (nextIndex >= def.steps.length) {
      completeGuide();
      return;
    }
    setActive({ ...active, stepIndex: nextIndex });
    syncLocal({
      guideId: active.guideId,
      version: active.version,
      currentStep: nextIndex,
      completed: false,
      skipped: false,
    });
    trackProductEvent("guide_step_viewed", {
      guideId: active.guideId,
      version: active.version,
      step: nextIndex,
    });
    if (authenticated) {
      updateMutation.mutate({
        guideId: active.guideId,
        version: active.version,
        currentStep: nextIndex,
      });
    }
  }, [active, authenticated, completeGuide, syncLocal, updateMutation]);

  const prevStep = useCallback(() => {
    if (!active || active.stepIndex <= 0) return;
    setActive({ ...active, stepIndex: active.stepIndex - 1 });
  }, [active]);

  const skipWelcome = useCallback(() => {
    setWelcomeSeen(true);
    setShowWelcome(false);
    const def = getGuide("welcome");
    if (def) {
      const row: GuideProgressRecord = {
        guideId: "welcome",
        version: def.version,
        currentStep: 0,
        completed: false,
        skipped: true,
        completedAt: new Date().toISOString(),
      };
      syncLocal(row);
      if (authenticated) skipMutation.mutate({ guideId: "welcome", version: def.version });
    }
    trackProductEvent("guide_skipped", { guideId: "welcome", version: 1 });
  }, [authenticated, skipMutation, syncLocal]);

  const acceptWelcomeTour = useCallback(() => {
    setWelcomeSeen(true);
    setShowWelcome(false);
    if (welcomeHandoffRef.current) window.clearTimeout(welcomeHandoffRef.current);
    // Let the welcome modal exit animation finish before the tour spotlight fades in
    welcomeHandoffRef.current = window.setTimeout(
      () => startGuide("welcome"),
      reducedMotion ? 0 : 220
    );
  }, [startGuide, reducedMotion]);

  useEffect(() => {
    return () => {
      if (welcomeHandoffRef.current) window.clearTimeout(welcomeHandoffRef.current);
    };
  }, []);

  // First-login welcome
  useEffect(() => {
    if (!authenticated) return;
    if (isWelcomeSeen()) return;
    if (isGuideDone("welcome")) {
      setWelcomeSeen(true);
      return;
    }
    const t = window.setTimeout(() => setShowWelcome(true), 600);
    return () => window.clearTimeout(t);
  }, [authenticated, isGuideDone]);

  // First-visit route triggers (avoid tutorial fatigue — only if not done)
  useEffect(() => {
    if (!authenticated || active || showWelcome) return;
    const guide = getFirstVisitGuide(location.pathname, activeRole);
    if (!guide) return;
    const key = `${guide.id}:${guide.version}:${location.pathname}`;
    if (firstVisitFired.current.has(key)) return;
    if (isGuideDone(guide.id, guide.version)) return;
    firstVisitFired.current.add(key);
    const t = window.setTimeout(() => startGuide(guide.id), 800);
    return () => window.clearTimeout(t);
  }, [
    active,
    activeRole,
    authenticated,
    isGuideDone,
    location.pathname,
    showWelcome,
    startGuide,
  ]);

  // Dismiss when navigating away mid-guide if route-bound
  useEffect(() => {
    if (!active) return;
    const def = getGuide(active.guideId);
    if (def?.trigger.type === "first_visit" && def.trigger.route) {
      const base = location.pathname.replace(/\/$/, "") || "/";
      if (base !== def.trigger.route && !location.pathname.startsWith(def.trigger.route + "/")) {
        // allow venue detail during venue-booking
        if (def.id === "venue-booking" && location.pathname.startsWith("/venues")) return;
        dismissGuide();
      }
    }
  }, [active, dismissGuide, location.pathname]);

  const value: GuideContextValue = {
    active,
    progress,
    reducedMotion,
    startGuide,
    nextStep,
    prevStep,
    skipGuide,
    completeGuide,
    dismissGuide,
    showWelcome,
    acceptWelcomeTour,
    skipWelcome,
    isGuideDone,
  };

  return (
    <GuideContext.Provider value={value}>
      {children}
      <GuideWelcomeModal
        open={showWelcome}
        onTour={acceptWelcomeTour}
        onSkip={skipWelcome}
      />
      {renderedGuide && (
        <GuideOverlay
          guide={renderedGuide.def}
          stepIndex={active ? active.stepIndex : renderedGuide.stepIndex}
          reducedMotion={reducedMotion}
          open={!!active}
          onNext={nextStep}
          onBack={prevStep}
          onSkip={skipGuide}
          onExited={() => setRenderedGuide(null)}
        />
      )}
    </GuideContext.Provider>
  );
}
