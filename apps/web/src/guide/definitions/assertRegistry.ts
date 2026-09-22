import type { GuideDef } from "../types";
import { getFirstVisitGuide, getGuide, GUIDE_DEFINITIONS } from "./registry";

/** Lightweight guide registry checks (no vitest dependency in web). */
export function assertGuideRegistryHealthy(): void {
  if (GUIDE_DEFINITIONS.length < 5) {
    throw new Error("Expected at least 5 guide definitions");
  }
  for (const guide of GUIDE_DEFINITIONS) {
    assertGuide(guide);
  }
  if (!getGuide("welcome")) throw new Error("welcome guide missing");
  if (!getFirstVisitGuide("/venues", "player")) {
    throw new Error("venue-booking first_visit guide missing");
  }
}

function assertGuide(guide: GuideDef): void {
  if (!guide.id || !guide.version || !guide.steps.length) {
    throw new Error(`Invalid guide: ${guide.id}`);
  }
  for (const step of guide.steps) {
    if (!step.target.startsWith("[data-guide=")) {
      throw new Error(`Guide ${guide.id} step ${step.id} should use data-guide selector`);
    }
  }
}
