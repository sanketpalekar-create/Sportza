export type GuideRole =
  | "player"
  | "coach"
  | "trainer"
  | "venue_owner"
  | "admin"
  | "all";

export type GuidePlacement = "top" | "bottom" | "left" | "right" | "center";

export type GuideTriggerType =
  | "first_login"
  | "first_visit"
  | "manual"
  | "feature_first_use";

export interface GuideStep {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: GuidePlacement;
  optional?: boolean;
}

export interface GuideTrigger {
  type: GuideTriggerType;
  route?: string;
}

export interface GuideDef {
  id: string;
  version: number;
  title: string;
  description: string;
  roles: GuideRole[];
  trigger: GuideTrigger;
  steps: GuideStep[];
  priority?: number;
}

export interface GuideProgressRecord {
  id?: number;
  userId?: number;
  guideId: string;
  version: number;
  currentStep: number;
  completed: boolean;
  skipped: boolean;
  startedAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
}

export interface ActiveGuideState {
  guideId: string;
  version: number;
  stepIndex: number;
}
