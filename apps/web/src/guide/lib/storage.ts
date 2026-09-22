const STORAGE_KEY = "sportza_guide_progress_v1";
const CHECKLIST_DISMISSED_KEY = "sportza_checklist_dismissed";
const WELCOME_SEEN_KEY = "sportza_welcome_seen";

import type { GuideProgressRecord } from "../types";

export function loadLocalGuideProgress(): GuideProgressRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalGuideProgress(rows: GuideProgressRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota / private mode
  }
}

export function upsertLocalProgress(row: GuideProgressRecord): GuideProgressRecord[] {
  const rows = loadLocalGuideProgress();
  const idx = rows.findIndex(
    (r) => r.guideId === row.guideId && r.version === row.version
  );
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.push(row);
  saveLocalGuideProgress(rows);
  return rows;
}

export function getLocalProgress(
  guideId: string,
  version: number
): GuideProgressRecord | undefined {
  return loadLocalGuideProgress().find(
    (r) => r.guideId === guideId && r.version === version
  );
}

export function isChecklistDismissed(): boolean {
  return localStorage.getItem(CHECKLIST_DISMISSED_KEY) === "1";
}

export function setChecklistDismissed(dismissed: boolean): void {
  if (dismissed) localStorage.setItem(CHECKLIST_DISMISSED_KEY, "1");
  else localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
}

export function isWelcomeSeen(): boolean {
  return localStorage.getItem(WELCOME_SEEN_KEY) === "1";
}

export function setWelcomeSeen(seen: boolean): void {
  if (seen) localStorage.setItem(WELCOME_SEEN_KEY, "1");
  else localStorage.removeItem(WELCOME_SEEN_KEY);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
