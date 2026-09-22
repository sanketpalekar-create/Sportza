import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/** Allowed product guide IDs — keep in sync with apps/web guide registry. */
export const ALLOWED_GUIDE_IDS = [
  "welcome",
  "dashboard",
  "venue-booking",
  "open-play",
  "training",
  "match",
  "stats",
  "tournament",
] as const;

export type AllowedGuideId = (typeof ALLOWED_GUIDE_IDS)[number];

export const guideIdParamSchema = z.object({
  guideId: z
    .string()
    .min(1)
    .max(50)
    .refine((id): id is AllowedGuideId => (ALLOWED_GUIDE_IDS as readonly string[]).includes(id), {
      message: "Unknown guide ID",
    }),
});

export const guideProgressUpdateSchema = z.object({
  version: z.coerce.number().int().min(1).max(100).optional().default(1),
  currentStep: z.coerce.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export const guideStartSchema = z.object({
  version: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export const guideVersionQuerySchema = z.object({
  version: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export type GuideIdParam = z.infer<typeof guideIdParamSchema>;
export type GuideProgressUpdate = z.infer<typeof guideProgressUpdateSchema>;
export type GuideStartBody = z.infer<typeof guideStartSchema>;
