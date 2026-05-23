import { Router, Request, Response } from "express";

const router: Router = Router();

const NOMINATIM_UA = "Sportza/1.0 (contact@sportza.in)";

// ─── GET /api/places/search?q= ───────────────────────────────────────────────
// Proxies Nominatim (OpenStreetMap) search server-side — free, no key needed.
// Returns { data: Suggestion[] } shaped to match the frontend Suggestion type.

router.get("/search", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) {
    return res.json({ data: [] });
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=in&limit=8`;

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": NOMINATIM_UA },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `Nominatim error ${upstream.status}`, data: [] });
    }

    const json = await upstream.json() as any[];

    // Map Nominatim response → frontend Suggestion shape
    const results = (Array.isArray(json) ? json : []).map((item: any, i: number) => {
      const addr = item.address ?? {};
      const city =
        addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
      const state = addr.state ?? "";
      // Build a short display address
      const parts = [city, state, "India"].filter(Boolean);
      const placeAddress = parts.slice(1).join(", ");

      return {
        eLoc: item.place_id?.toString() ?? String(i),
        placeName: addr.city || addr.town || addr.village || item.display_name?.split(",")[0] || q,
        placeAddress,
        latitude: item.lat,
        longitude: item.lon,
        addressTokens: {
          city,
          state,
          pincode: addr.postcode ?? "",
          locality: addr.suburb ?? addr.neighbourhood ?? "",
          subLocality: addr.road ?? "",
        },
      };
    });

    return res.json({ data: results });
  } catch (err) {
    return res.status(502).json({ error: "Search proxy failed", data: [] });
  }
});

// ─── GET /api/places/reverse?lat=&lng= ───────────────────────────────────────
// Proxies Nominatim reverse geocoding server-side.
// Returns { city, state }

router.get("/reverse", async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": NOMINATIM_UA },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `Nominatim error ${upstream.status}` });
    }

    const json = await upstream.json() as any;
    const addr = json?.address ?? {};

    const city  = addr.city  || addr.town  || addr.village || addr.suburb || addr.county || null;
    const state = addr.state || null;

    return res.json({ city, state });
  } catch (err) {
    return res.status(502).json({ error: "Reverse geocode proxy failed" });
  }
});

export default router;
