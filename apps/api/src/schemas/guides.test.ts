import { describe, expect, it } from "vitest";
import {
  ALLOWED_GUIDE_IDS,
  guideIdParamSchema,
  guideProgressUpdateSchema,
  guideStartSchema,
} from "../schemas/guides";

describe("guide schemas", () => {
  it("accepts known guide IDs", () => {
    for (const id of ALLOWED_GUIDE_IDS) {
      expect(guideIdParamSchema.safeParse({ guideId: id }).success).toBe(true);
    }
  });

  it("rejects unknown guide IDs", () => {
    const result = guideIdParamSchema.safeParse({ guideId: "not-a-real-guide" });
    expect(result.success).toBe(false);
  });

  it("validates progress update payloads", () => {
    expect(
      guideProgressUpdateSchema.safeParse({
        version: 1,
        currentStep: 2,
        completed: false,
      }).success
    ).toBe(true);
  });

  it("rejects negative currentStep", () => {
    expect(
      guideProgressUpdateSchema.safeParse({ currentStep: -1 }).success
    ).toBe(false);
  });

  it("defaults version on start", () => {
    const parsed = guideStartSchema.parse({});
    expect(parsed.version).toBe(1);
  });
});
