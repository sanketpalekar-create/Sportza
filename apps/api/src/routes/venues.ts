import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth, requireRole } from "../middleware/auth";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors";
import { upload, uploadFile, generateFileKey } from "../lib/storage";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { upsertLocation } from "../lib/location";
const router: Router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────

const venueListQuerySchema = paginationSchema.extend({
  city: z.string().optional(),
  sport: z.string().optional(),
  ownerId: z.coerce.number().int().positive().optional(),
});

const nearbyQuerySchema = z.object({
  lat:      z.coerce.number().optional(),
  lng:      z.coerce.number().optional(),
  radius:   z.coerce.number().min(0.1).max(200).default(10),
  sport:    z.string().optional(),
  city:     z.string().optional(),
  state:    z.string().optional(),
  fallback: z.coerce.boolean().default(true),
});

const facilityCreateSchema = z.object({
  name: z.string().min(1).max(255),
  surfaceType: z.string().optional(),
  sports: z.array(z.string()).optional(),
  courtCount: z.coerce.number().int().min(1).optional(),
});

const facilityUpdateSchema = facilityCreateSchema.partial();

const facilityIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  facilityId: z.coerce.number().int().positive(),
});

const venueCreateSchema = z.object({
  name: z.string().min(1).max(255),
  sports: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  location: z.object({
    country: z.string().default("India"),
    state:   z.string().min(1),
    city:    z.string().min(1),
    pincode: z.string().max(10).optional(),
    address: z.string().max(500).optional(),
    lat:     z.number().optional(),
    lng:     z.number().optional(),
  }).optional(),
  facilities: z.record(z.unknown()).optional(),
  capacity: z.number().int().min(1),
  pricePerHour: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  commissionPercent: z.number().min(0).optional(),
});

const venueUpdateSchema = venueCreateSchema.partial();

const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

const pricingRuleBodySchema = z.object({
  facilityId: z.number().int().positive(),
  ruleType: z.string().min(1).max(50),
  ruleValue: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

const pricingRuleUpdateSchema = z.object({
  ruleType: z.string().min(1).max(50).optional(),
  ruleValue: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const venueIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const ruleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  ruleId: z.coerce.number().int().positive(),
});

// ─── OpenAPI Registration ───────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/venues",
  summary: "List venues with pagination and filters",
  request: { query: venueListQuerySchema },
  responses: { 200: { description: "List of venues" } },
});

registry.registerPath({
  method: "get",
  path: "/venues/nearby",
  summary: "Discover venues by geo radius (with city/state fallback when no coords or no results)",
  request: { query: nearbyQuerySchema },
  responses: { 200: { description: "Nearby venues sorted by distance, or city-filtered venues as fallback" } },
});

registry.registerPath({
  method: "get",
  path: "/venues/{id}",
  summary: "Get venue details",
  request: { params: venueIdParamSchema },
  responses: { 200: { description: "Venue details" } },
});

registry.registerPath({
  method: "post",
  path: "/venues",
  summary: "Create venue",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: venueCreateSchema } } } },
  responses: { 201: { description: "Venue created" } },
});

registry.registerPath({
  method: "put",
  path: "/venues/{id}",
  summary: "Update venue",
  security: [{ bearerAuth: [] }],
  request: { params: venueIdParamSchema, body: { content: { "application/json": { schema: venueUpdateSchema } } } },
  responses: { 200: { description: "Venue updated" } },
});

registry.registerPath({
  method: "delete",
  path: "/venues/{id}",
  summary: "Delete venue",
  security: [{ bearerAuth: [] }],
  request: { params: venueIdParamSchema },
  responses: { 200: { description: "Venue deleted" } },
});

registry.registerPath({
  method: "post",
  path: "/venues/{id}/reviews",
  summary: "Add venue review",
  security: [{ bearerAuth: [] }],
  request: { params: venueIdParamSchema, body: { content: { "application/json": { schema: reviewBodySchema } } } },
  responses: { 201: { description: "Review added" } },
});

registry.registerPath({
  method: "get",
  path: "/venues/{id}/reviews",
  summary: "List venue reviews",
  request: { params: venueIdParamSchema, query: paginationSchema },
  responses: { 200: { description: "List of reviews" } },
});

registry.registerPath({
  method: "get",
  path: "/venues/{id}/pricing-rules",
  summary: "List pricing rules",
  request: { params: venueIdParamSchema },
  responses: { 200: { description: "Pricing rules" } },
});

registry.registerPath({
  method: "post",
  path: "/venues/{id}/pricing-rules",
  summary: "Create pricing rule",
  security: [{ bearerAuth: [] }],
  request: { params: venueIdParamSchema, body: { content: { "application/json": { schema: pricingRuleBodySchema } } } },
  responses: { 201: { description: "Pricing rule created" } },
});

registry.registerPath({
  method: "put",
  path: "/venues/{id}/pricing-rules/{ruleId}",
  summary: "Update pricing rule",
  security: [{ bearerAuth: [] }],
  request: { params: ruleIdParamSchema, body: { content: { "application/json": { schema: pricingRuleUpdateSchema } } } },
  responses: { 200: { description: "Pricing rule updated" } },
});

registry.registerPath({
  method: "delete",
  path: "/venues/{id}/pricing-rules/{ruleId}",
  summary: "Delete pricing rule",
  security: [{ bearerAuth: [] }],
  request: { params: ruleIdParamSchema },
  responses: { 200: { description: "Pricing rule deleted" } },
});

registry.registerPath({
  method: "post",
  path: "/venues/{id}/images",
  summary: "Upload venue images",
  security: [{ bearerAuth: [] }],
  request: { params: venueIdParamSchema },
  responses: { 201: { description: "Images uploaded" } },
});

// ─── Helpers ─────────────────────────────────────────────────────────────

async function ensureVenueOwner(req: Request, venueId: number) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) throw new NotFoundError("Venue");
  if (venue.ownerId !== req.userId) throw new ForbiddenError("Not venue owner");
  return venue;
}

/** Robust sport matching against the JSON sports field (array or object). */
function matchesSport(sports: unknown, sport: string): boolean {
  if (!sports) return false;
  const lower = sport.toLowerCase();
  if (Array.isArray(sports)) {
    return sports.some((s) => typeof s === "string" && s.toLowerCase() === lower);
  }
  if (typeof sports === "object" && sports !== null) {
    return Object.keys(sports as Record<string, unknown>).some(
      (k) => k.toLowerCase() === lower,
    );
  }
  if (typeof sports === "string") {
    try {
      const parsed = JSON.parse(sports);
      return matchesSport(parsed, sport);
    } catch {
      return sports.toLowerCase().includes(lower);
    }
  }
  return false;
}

/** Include the full nested location object on a Prisma venue row. */
async function withLocation<T extends { locationId: number | null }>(
  venue: T,
): Promise<T & { location: Record<string, unknown> | null }> {
  if (!venue.locationId) return { ...venue, location: null };
  const loc = await prisma.location.findUnique({
    where: { id: venue.locationId },
    select: { id: true, country: true, state: true, city: true, address: true, pincode: true, lat: true, lng: true },
  });
  return { ...venue, location: loc ?? null };
}

/** Batch-attach locations to many venue rows in a single DB query. */
async function withLocations<T extends { locationId: number | null }>(
  venues: T[],
): Promise<Array<T & { location: Record<string, unknown> | null }>> {
  const ids = [...new Set(venues.map((v) => v.locationId).filter((id): id is number => id !== null))];
  if (ids.length === 0) return venues.map((v) => ({ ...v, location: null }));
  const locs = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, country: true, state: true, city: true, address: true, pincode: true, lat: true, lng: true },
  });
  const locMap = new Map(locs.map((l) => [l.id, l]));
  return venues.map((v) => ({
    ...v,
    location: v.locationId ? (locMap.get(v.locationId) ?? null) : null,
  }));
}

// ─── Routes ──────────────────────────────────────────────────────────────

router.get(
  "/nearby",
  validate({ query: nearbyQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng, radius, sport, city, state, fallback } =
        req.query as unknown as z.infer<typeof nearbyQuerySchema>;

      const hasCoords = lat !== undefined && lng !== undefined;
      let venues: any[] = [];
      let strategy: "geo" | "city" | "global" = "global";
      let center: { lat: number; lng: number } | null = null;

      if (hasCoords) {
        // ── Haversine radius search ───────────────────────────────────────────
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            v.*,
            l.country, l.state, l.city, l.address, l.pincode, l.lat, l.lng,
            (6371 * acos(
              LEAST(1.0, cos(radians(?)) * cos(radians(l.lat))
                * cos(radians(l.lng) - radians(?))
                + sin(radians(?)) * sin(radians(l.lat)))
            )) AS distance_km
          FROM venues v
          JOIN locations l ON v.locationId = l.id
          WHERE v.isActive = 1
            AND l.lat IS NOT NULL
            AND l.lng IS NOT NULL
          HAVING distance_km < ?
          ORDER BY distance_km ASC
          LIMIT 50
          `,
          lat, lng, lat, radius,
        );

        venues = rows
          .map((row: any) => {
            const { country, state: rState, city: rCity, address, pincode, lat: rLat, lng: rLng, distance_km, ...rest } = row;
            return {
              ...rest,
              distance_km: typeof distance_km === "object" ? Number(distance_km) : distance_km,
              location: { country, state: rState, city: rCity, address, pincode, lat: rLat, lng: rLng },
            };
          })
          .filter((v: any) => !sport || matchesSport(v.sports, sport));

        if (venues.length > 0) {
          strategy = "geo";
          center = { lat: lat!, lng: lng! };
        }
      }

      // ── City/state fallback (when no coords, or geo returned nothing and fallback=true) ──
      if (venues.length === 0 && (city || state) && (fallback || !hasCoords)) {
        const where: Record<string, unknown> = { isActive: true };
        if (city || state) {
          where.location = {
            ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
            ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
          };
        }
        const cityVenues = await prisma.venue.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        const filtered = sport
          ? cityVenues.filter((v) => matchesSport(v.sports, sport))
          : cityVenues;
        venues = (await withLocations(filtered)).map((v) => ({ ...v, distance_km: null }));
        strategy = "city";
      }

      res.json({
        success: true,
        data: venues,
        total: venues.length,
        meta: {
          strategy,
          radiusKm: hasCoords ? radius : null,
          center,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/",
  validate({ query: venueListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, city, sport, ownerId } =
        req.query as unknown as z.infer<typeof venueListQuerySchema>;
      const where: Record<string, unknown> = {};
      if (!ownerId) where.isActive = true;
      if (city) where.location = { city: { equals: city, mode: "insensitive" } };
      if (ownerId) where.ownerId = ownerId;
      const allVenues = await prisma.venue.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      let filtered = allVenues;
      if (sport) {
        filtered = filtered.filter((v) => matchesSport(v.sports, sport));
      }

      const total = filtered.length;
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      const withLoc = await withLocations(paginated);
      res.json({ success: true, data: withLoc, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const venue = await prisma.venue.findUnique({
        where: { id },
        include: {
          sportFacilities: true,
          sportRates: true,
          addOns: true,
          pricingRules: true,
          dbFacilities: true,
        },
      });
      if (!venue) throw new NotFoundError("Venue");
      const venueWithLocation = await withLocation(venue);
      res.json({ success: true, data: venueWithLocation });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  requireRole("venue_owner", "admin"),
  validate({ body: venueCreateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof venueCreateSchema>;
      let locationId: number | undefined;
      if (data.location) {
        locationId = await upsertLocation(data.location);
      }
      const { location: _loc, ...venueData } = data;
      const venue = await prisma.venue.create({
        data: {
          ...venueData,
          ownerId: req.userId!,
          sports: data.sports as object | undefined,
          facilities: data.facilities as object | undefined,
          ...(locationId !== undefined && { locationId }),
        },
      });
      res.status(201).json({ success: true, data: venue });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: venueUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      await ensureVenueOwner(req, id);
      const data = req.body as z.infer<typeof venueUpdateSchema>;
      let locationId: number | undefined;
      if (data.location) {
        locationId = await upsertLocation(data.location);
      }
      const { location: _loc, ...venueData } = data;
      const venue = await prisma.venue.update({
        where: { id },
        data: {
          ...venueData,
          sports: data.sports as object | undefined,
          facilities: data.facilities as object | undefined,
          ...(locationId !== undefined && { locationId }),
        },
      });
      res.json({ success: true, data: venue });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      await ensureVenueOwner(req, id);
      await prisma.venue.update({ where: { id }, data: { isActive: false } });
      res.json({ success: true, message: "Venue deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/reviews",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: reviewBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { rating, review } = req.body as z.infer<typeof reviewBodySchema>;
      const venue = await prisma.venue.findUnique({ where: { id } });
      if (!venue) throw new NotFoundError("Venue");
      const created = await prisma.venueReview.upsert({
        where: { venueId_userId: { venueId: id, userId: req.userId! } },
        create: { venueId: id, userId: req.userId!, rating, review },
        update: { rating, review },
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/reviews",
  validate({ params: idParamSchema, query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const [reviews, total] = await Promise.all([
        prisma.venueReview.findMany({
          where: { venueId: id },
          include: { user: { select: { id: true, name: true, avatar: true } } },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.venueReview.count({ where: { venueId: id } }),
      ]);
      res.json({ success: true, data: reviews, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/pricing-rules",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const rules = await prisma.facilityPricingRule.findMany({
        where: { venueId: id },
        include: { facility: true },
      });
      res.json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/pricing-rules",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: pricingRuleBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      await ensureVenueOwner(req, id);
      const { facilityId, ruleType, ruleValue, metadata } = req.body as z.infer<typeof pricingRuleBodySchema>;
      const facility = await prisma.sportFacility.findFirst({
        where: { id: facilityId, venueId: id },
      });
      if (!facility) throw new BadRequestError("Facility not found for this venue");
      const rule = await prisma.facilityPricingRule.create({
        data: { facilityId, venueId: id, ruleType, ruleValue, metadata: metadata as object | undefined },
      });
      res.status(201).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id/pricing-rules/:ruleId",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: ruleIdParamSchema, body: pricingRuleUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, ruleId } = req.params as unknown as z.infer<typeof ruleIdParamSchema>;
      await ensureVenueOwner(req, id);
      const data = req.body as z.infer<typeof pricingRuleUpdateSchema>;
      const rule = await prisma.facilityPricingRule.findFirst({
        where: { id: ruleId, venueId: id },
      });
      if (!rule) throw new NotFoundError("Pricing rule");
      const updated = await prisma.facilityPricingRule.update({
        where: { id: ruleId },
        data: {
          ...data,
          metadata: data.metadata as object | undefined,
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id/pricing-rules/:ruleId",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: ruleIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, ruleId } = req.params as unknown as z.infer<typeof ruleIdParamSchema>;
      await ensureVenueOwner(req, id);
      const rule = await prisma.facilityPricingRule.findFirst({
        where: { id: ruleId, venueId: id },
      });
      if (!rule) throw new NotFoundError("Pricing rule");
      await prisma.facilityPricingRule.delete({ where: { id: ruleId } });
      res.json({ success: true, message: "Pricing rule deleted" });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id/facilities - List facilities for a venue
router.get(
  "/:id/facilities",
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const venue = await prisma.venue.findUnique({ where: { id } });
      if (!venue) throw new NotFoundError("Venue");
      const facilities = await prisma.facility.findMany({
        where: { venueId: id },
        orderBy: { createdAt: "asc" },
      });
      res.json({ success: true, data: facilities });
    } catch (err) {
      next(err);
    }
  }
);

// POST /:id/facilities - Create a facility
router.post(
  "/:id/facilities",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema, body: facilityCreateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      await ensureVenueOwner(req, id);
      const { name, surfaceType, sports, courtCount } =
        req.body as z.infer<typeof facilityCreateSchema>;
      const facility = await prisma.facility.create({
        data: {
          venueId: id,
          name,
          surfaceType,
          sports: sports as object | undefined,
          count: courtCount ?? 1,
        },
      });
      res.status(201).json({ success: true, data: facility });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /:id/facilities/:facilityId - Update a facility
router.put(
  "/:id/facilities/:facilityId",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: facilityIdParamSchema, body: facilityUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, facilityId } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;
      await ensureVenueOwner(req, id);
      const { name, surfaceType, sports, courtCount } = req.body as z.infer<typeof facilityUpdateSchema>;
      const existing = await prisma.facility.findFirst({ where: { id: facilityId, venueId: id } });
      if (!existing) throw new NotFoundError("Facility");
      const facility = await prisma.facility.update({
        where: { id: facilityId },
        data: {
          ...(name !== undefined && { name }),
          ...(surfaceType !== undefined && { surfaceType }),
          ...(sports !== undefined && { sports: sports as object }),
          ...(courtCount !== undefined && { count: courtCount }),
        },
      });
      res.json({ success: true, data: facility });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id/facilities/:facilityId - Delete a facility
router.delete(
  "/:id/facilities/:facilityId",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: facilityIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, facilityId } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;
      await ensureVenueOwner(req, id);
      const existing = await prisma.facility.findFirst({ where: { id: facilityId, venueId: id } });
      if (!existing) throw new NotFoundError("Facility");
      await prisma.facility.delete({ where: { id: facilityId } });
      res.json({ success: true, message: "Facility deleted" });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/images",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ params: idParamSchema }),
  upload.array("images", 5),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      await ensureVenueOwner(req, id);
      const files = req.files as Express.Multer.File[];
      if (!files?.length) throw new BadRequestError("No images provided");
      const urls: string[] = [];
      for (const file of files) {
        const key = generateFileKey(`venues/${id}`, file.originalname);
        const url = await uploadFile(key, file.buffer, file.mimetype);
        urls.push(url);
      }
      const venue = await prisma.venue.findUnique({ where: { id } });
      const images = ((venue?.images as string[]) || []).concat(urls);
      await prisma.venue.update({ where: { id }, data: { images: images as object } });
      res.status(201).json({ success: true, data: { urls, images } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
