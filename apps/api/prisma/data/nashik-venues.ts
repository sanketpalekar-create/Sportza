/**
 * Nashik venue directory — sourced from:
 * - Sportza_Nashik_Pickleball_Venues.xlsx
 * - Sportza_Nashik_Cricket_Turfs.xlsx
 * - Google Maps CSV exports (prisma/data/google-maps/*.csv) for images
 */

import { imageMapByPlaceId } from "./load-google-maps-images";

export interface NashikVenueRow {
  venueId: string;
  name: string;
  sport: "pickleball" | "cricket";
  address: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  openingHours: string;
  googlePlaceId: string;
  mapsUrl: string;
  status: string;
}

export const NASHIK_PICKLEBALL_VENUES: NashikVenueRow[] = [
  {
    venueId: "NSKP001",
    name: "GUTSHOT PICKLEBALL",
    sport: "pickleball",
    address: "College Rd, Yeolekar Mala, Nashik",
    phone: "+917517507373",
    rating: 4.7,
    reviewCount: 14,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJ4_IabTXr3TsRQr5MCOskYgU",
    mapsUrl: "https://maps.google.com/?q=GUTSHOT+PICKLEBALL+Nashik",
    status: "Active",
  },
  {
    venueId: "NSKP002",
    name: "The Pickleball Club Devlali",
    sport: "pickleball",
    address: "Lam Rd, Devlali, Nashik",
    phone: "+919158500196",
    rating: 4.9,
    reviewCount: 12,
    openingHours: "07:00-23:30",
    googlePlaceId: "ChIJj7Q3nXyV3TsRMVmg1i7AAX8",
    mapsUrl: "https://maps.google.com/?q=The+Pickleball+Club+Devlali+Nashik",
    status: "Active",
  },
  {
    venueId: "NSKP003",
    name: "Pickleball Paradise by Ages Ventures",
    sport: "pickleball",
    address: "Govind Nagar, Nashik",
    rating: 4.8,
    reviewCount: 24,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJvYHCYADr3TsRsoxop5ODeD4",
    mapsUrl: "https://maps.google.com/?q=Pickleball+Paradise+Nashik",
    status: "Active",
  },
  {
    venueId: "NSKP004",
    name: "The Spinshot - Padel, Pickleball Club",
    sport: "pickleball",
    address: "Chandshi, Nashik",
    rating: 5,
    reviewCount: 9,
    openingHours: "06:00-00:00",
    googlePlaceId: "ChIJZ-REWQDt3TsRrXj_GRbXZ3k",
    mapsUrl: "https://maps.google.com/?q=Spinshot+Pickleball+Club+Nashik",
    status: "Active",
  },
  {
    venueId: "NSKP005",
    name: "NSK (Nashik Sports Klub)",
    sport: "pickleball",
    address: "Makhmalabad Rd, Nashik",
    phone: "+919769765125",
    rating: 4.8,
    reviewCount: 46,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJtTJvbtTr3TsR51Or33qMSyQ",
    mapsUrl: "https://maps.google.com/?q=Nashik+Sports+Klub",
    status: "Active",
  },
  {
    venueId: "NSKP006",
    name: "Paradise Pickleball Hub",
    sport: "pickleball",
    address: "Chandshi, Nashik",
    rating: 4.9,
    reviewCount: 41,
    openingHours: "16:00-22:00",
    googlePlaceId: "ChIJf3IFLADr3TsRnKdALfVhJmU",
    mapsUrl: "https://maps.google.com/?q=Paradise+Pickleball+Hub+Nashik",
    status: "Active",
  },
  {
    venueId: "NSKP007",
    name: "Big Bounce Sports Arena",
    sport: "pickleball",
    address: "Link Road, near Shamsundar missal, Pundlik nagar, Makhmalabad, Nashik, Maharashtra 422003",
    rating: 4.9,
    reviewCount: 56,
    openingHours: "24 Hours",
    googlePlaceId: "ChIJ9cEZOUbr3TsRxhuIrUtRGIg",
    mapsUrl: "https://maps.google.com/?q=Big+Bounce+Sports+Arena+Nashik",
    status: "Active",
  },
];

export const NASHIK_CRICKET_VENUES: NashikVenueRow[] = [
  {
    venueId: "NSK001",
    name: "BIG BOUNCE TURF",
    sport: "cricket",
    address: "New Tidke Colony Rd, Govind Nagar, Nashik",
    phone: "+917030630600",
    rating: 4.4,
    reviewCount: 473,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJ8ZINC9Tr3TsRq1WnrWuojuc",
    mapsUrl: "https://maps.google.com/?q=BIG+BOUNCE+TURF+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK002",
    name: "Inside Edge",
    sport: "cricket",
    address: "Makhmalabad Rd, Panchavati, Nashik",
    phone: "+919175951741",
    rating: 4.5,
    reviewCount: 293,
    openingHours: "06:00-22:00",
    googlePlaceId: "ChIJSWsFWRPr3TsResdoXAanUp0",
    mapsUrl: "https://maps.google.com/?q=Inside+Edge+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK003",
    name: "Champion's Turf",
    sport: "cricket",
    address: "Amrutdham Rd, Nashik",
    phone: "+918600666237",
    rating: 4.7,
    reviewCount: 226,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJTUB1wx_r3TsRW8ZkWrVGg1E",
    mapsUrl: "https://maps.google.com/?q=Champions+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK004",
    name: "Yorker Box Cricket Turf",
    sport: "cricket",
    address: "Sneha Nagar, Nashik",
    phone: "+919403636354",
    rating: 4.3,
    reviewCount: 288,
    openingHours: "07:00-22:00",
    googlePlaceId: "ChIJRU4fODLq3TsRxz-m0djKbB8",
    mapsUrl: "https://maps.google.com/?q=Yorker+Box+Cricket+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK005",
    name: "Kridabhumi Turf",
    sport: "cricket",
    address: "Tigrania Rd, Nashik",
    phone: "+919028960311",
    rating: 4.4,
    reviewCount: 144,
    openingHours: "06:00-23:30",
    googlePlaceId: "ChIJyVJCWuzr3TsRUwuCnXoSAnI",
    mapsUrl: "https://maps.google.com/?q=Kridabhumi+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK006",
    name: "Chak De Turf",
    sport: "cricket",
    address: "Pakhal Rd, Nashik",
    phone: "+918602820282",
    rating: 4.3,
    reviewCount: 131,
    openingHours: "06:00-23:30",
    googlePlaceId: "ChIJ5xkQrwnr3TsR2nzCYIKRAko",
    mapsUrl: "https://maps.google.com/?q=Chak+De+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK007",
    name: "The Home Ground Turf",
    sport: "cricket",
    address: "Asaram Bapu Bridge, Nashik",
    phone: "+917709177753",
    rating: 4.5,
    reviewCount: 270,
    openingHours: "06:00-22:00",
    googlePlaceId: "ChIJPTNQRhbr3TsRORt5TqTjmYo",
    mapsUrl: "https://maps.google.com/?q=The+Home+Ground+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK008",
    name: "Aarambh Turf",
    sport: "cricket",
    address: "Pipeline Rd, Kale Mala, Nashik",
    phone: "+919823055488",
    rating: 4.2,
    reviewCount: 139,
    openingHours: "05:00-23:30",
    googlePlaceId: "ChIJCSazr3Tt3TsRq7g6WI46EIQ",
    mapsUrl: "https://maps.google.com/?q=Aarambh+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK009",
    name: "Kage Multisports Turf",
    sport: "cricket",
    address: "Pathardi Phata, Nashik",
    phone: "+919021238172",
    rating: 4.3,
    reviewCount: 317,
    openingHours: "19:00-22:00",
    googlePlaceId: "ChIJAc6ViCyV3TsReGaDFbrLC6g",
    mapsUrl: "https://maps.google.com/?q=Kage+Multisports+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK010",
    name: "Ranangan Multisports Turf",
    sport: "cricket",
    address: "Trambakeshwar Rd, Nashik",
    phone: "+919850958427",
    rating: 4.8,
    reviewCount: 32,
    openingHours: "07:00-00:00",
    googlePlaceId: "ChIJ-Rvk5czt3TsRmlsKH0-qFJY",
    mapsUrl: "https://maps.google.com/?q=Ranangan+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK011",
    name: "Hattrick Multisports Turf",
    sport: "cricket",
    address: "Gangapur Rd, Nashik",
    phone: "+919146003500",
    rating: 4,
    reviewCount: 248,
    openingHours: "06:00-22:00",
    googlePlaceId: "ChIJVcSHru7r3TsRhs_YGTLIW_A",
    mapsUrl: "https://maps.google.com/?q=Hattrick+Multisports+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK012",
    name: "Cricket Crest Multisports Turf",
    sport: "cricket",
    address: "Deolali Gaon, Nashik",
    phone: "+918999400412",
    rating: 4.5,
    reviewCount: 17,
    openingHours: "06:00-00:00",
    googlePlaceId: "ChIJ5YW9SSOV3TsRAcB88T6sYG4",
    mapsUrl: "https://maps.google.com/?q=Cricket+Crest+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK013",
    name: "Chhatrapati Shivaji Maharaj turf",
    sport: "cricket",
    address: "80/7/66, Dattanagar, Naikwadipura, Nashik",
    phone: "+919689756686",
    rating: 4.9,
    reviewCount: 177,
    openingHours: "06:00-23:00",
    googlePlaceId: "ChIJodKDzMfr3TsR6buaw8p6n8o",
    mapsUrl: "https://maps.google.com/?q=Chhatrapati+Shivaji+Maharaj+turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK014",
    name: "Turf Rush",
    sport: "cricket",
    address: "Damodar Nagar, Pathardi Phata, Nashik",
    phone: "+919730602348",
    rating: 4.8,
    reviewCount: 21,
    openingHours: "24 Hours",
    googlePlaceId: "ChIJBwwDmrGV3TsRuAZP8Xo7Mn4",
    mapsUrl: "https://maps.google.com/?q=Turf+Rush+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK015",
    name: "Shaurya Bhumi Multi-Sports Turf",
    sport: "cricket",
    address: "Gavali Nagar, Pathardi-Gaulane Rd, Pathardi Gaon, Nashik",
    phone: "+918806919617",
    rating: 5,
    reviewCount: 74,
    openingHours: "06:00-00:00",
    googlePlaceId: "ChIJFaZ_3XuV3TsRGSir_QnuKmY",
    mapsUrl: "https://maps.google.com/?q=Shaurya+Bhumi+Multi-Sports+Turf+Nashik",
    status: "Active",
  },
  {
    venueId: "NSK016",
    name: "The Lords multisports turf",
    sport: "cricket",
    address: "Gandhi Nagar Airport Area, Wadala Gaon, Nashik",
    rating: 5,
    reviewCount: 37,
    openingHours: "24 Hours",
    googlePlaceId: "ChIJQSILEADr3TsRlxHHurEe_HM",
    mapsUrl: "https://maps.google.com/?q=The+Lords+multisports+turf+Nashik",
    status: "Active",
  },
];

/** Known coordinates from Google Maps CSV exports */
const KNOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  "Pickleball Paradise by Ages Ventures": { lat: 19.9904599, lng: 73.7677937 },
  "Big Bounce Sports Arena": { lat: 20.0391485, lng: 73.7701022 },
  "The Nova Club": { lat: 20.0067931, lng: 73.7422276 },
  "GUTSHOT PICKLEBALL": { lat: 20.0010325, lng: 73.7617929 },
  "The Pickleball Club Devlali": { lat: 19.9295586, lng: 73.830602 },
  "The Spinshot - Padel, Pickleball Club": { lat: 20.0270101, lng: 73.7429615 },
  "Paradise Pickleball Hub": { lat: 20.0274096, lng: 73.7531587 },
  "BIG BOUNCE TURF": { lat: 19.9883104, lng: 73.7699677 },
  "Chhatrapati Shivaji Maharaj turf": { lat: 20.0213406, lng: 73.7917841 },
  "Turf Rush": { lat: 19.9452154, lng: 73.7699201 },
  "Shaurya Bhumi Multi-Sports Turf": { lat: 19.9344986, lng: 73.766805 },
  "The Lords multisports turf": { lat: 19.9602703, lng: 73.7943947 },
};

const NASHIK_CENTER = { lat: 20.005, lng: 73.76 };

export interface NashikVenueDefInput {
  name: string;
  addr: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  sportNames: string[];
  capacity: number;
  image: string;
  extraImages?: string[];
  amenities: string[];
  courts: Array<{ name: string; surface: string; count: number }>;
  externalId: string;
  phone?: string;
  openingHours: string;
  googlePlaceId: string;
  mapsUrl: string;
  seedRating: number;
  seedReviewCount: number;
}

function coordsForRow(row: NashikVenueRow, index: number): { lat: number; lng: number } {
  const known = KNOWN_COORDS[row.name];
  if (known) return known;
  return {
    lat: NASHIK_CENTER.lat + (index % 6) * 0.0035,
    lng: NASHIK_CENTER.lng + Math.floor(index / 6) * 0.0035,
  };
}

function sportNamesForRow(row: NashikVenueRow): string[] {
  if (row.sport === "cricket") return ["cricket", "football"];
  if (/padel/i.test(row.name)) return ["pickleball", "padel"];
  return ["pickleball"];
}

function courtsForRow(row: NashikVenueRow): Array<{ name: string; surface: string; count: number }> {
  if (row.sport === "cricket") {
    return [{ name: "Box Cricket Turf", surface: "Artificial Turf", count: 1 }];
  }
  if (/padel/i.test(row.name)) {
    return [
      { name: "Pickleball Court", surface: "Cushioned Acrylic", count: 2 },
      { name: "Padel Court", surface: "Artificial Grass", count: 2 },
    ];
  }
  return [{ name: "Pickleball Court", surface: "Cushioned Acrylic", count: 2 }];
}

const PICKLEBALL_IMAGE =
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=480&q=80";
const CRICKET_IMAGE =
  "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=480&q=80";

export function nashikRowToVenueDef(row: NashikVenueRow, index: number): NashikVenueDefInput {
  const { lat, lng } = coordsForRow(row, index);
  const isCricket = row.sport === "cricket";
  const googleImages = imageMapByPlaceId().get(row.googlePlaceId);
  const fallbackImage = isCricket ? CRICKET_IMAGE : PICKLEBALL_IMAGE;
  const primaryImage = googleImages?.[0] ?? fallbackImage;
  const extraImages = googleImages && googleImages.length > 1 ? googleImages.slice(1) : undefined;
  return {
    name: row.name,
    addr: row.address,
    city: "Nashik",
    state: "Maharashtra",
    lat,
    lng,
    sportNames: sportNamesForRow(row),
    capacity: isCricket ? 120 : 60,
    image: primaryImage,
    ...(extraImages ? { extraImages } : {}),
    amenities: isCricket
      ? ["Parking", "Changing Room", "Drinking Water", "Floodlights", "Scoreboard"]
      : ["Parking", "Changing Room", "Drinking Water", "Floodlights", "Coaching Area"],
    courts: courtsForRow(row),
    externalId: row.venueId,
    phone: row.phone,
    openingHours: row.openingHours,
    googlePlaceId: row.googlePlaceId,
    mapsUrl: row.mapsUrl,
    seedRating: row.rating,
    seedReviewCount: row.reviewCount,
  };
}

export function buildNashikVenueDefs(): NashikVenueDefInput[] {
  const pickleball = NASHIK_PICKLEBALL_VENUES.map((r, i) => nashikRowToVenueDef(r, i));
  const cricket = NASHIK_CRICKET_VENUES.map((r, i) =>
    nashikRowToVenueDef(r, i + NASHIK_PICKLEBALL_VENUES.length)
  );
  return [...pickleball, ...cricket];
}

/** Merge spreadsheet rows into venue list; updates addr/metadata when name already exists */
export function mergeNashikIntoVenueDefs<T extends { name: string; addr: string; sportNames: string[] }>(
  base: T[],
  nashik: NashikVenueDefInput[]
): T[] {
  const byName = new Map(base.map((v) => [v.name.toLowerCase(), v]));
  const merged = [...base];

  for (const n of nashik) {
    const key = n.name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.addr = n.addr;
      for (const sport of n.sportNames) {
        if (!existing.sportNames.includes(sport)) {
          existing.sportNames.push(sport);
        }
      }
      Object.assign(existing, {
        externalId: n.externalId,
        phone: n.phone,
        openingHours: n.openingHours,
        googlePlaceId: n.googlePlaceId,
        mapsUrl: n.mapsUrl,
        seedRating: n.seedRating,
        seedReviewCount: n.seedReviewCount,
      });
      continue;
    }
    merged.push(n as T);
    byName.set(key, n as T);
  }

  return merged;
}
