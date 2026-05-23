import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const successResponse = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

export const errorResponse = z.object({
  success: z.literal(false),
  code: z.string(),
  message: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const locationInputSchema = z.object({
  country: z.string().default("India"),
  state:   z.string().min(1),
  city:    z.string().min(1),
  pincode: z.string().max(10).optional(),
  address: z.string().max(500).optional(),
  lat:     z.number().optional(),
  lng:     z.number().optional(),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;
