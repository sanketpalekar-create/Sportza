/**
 * Sportza — Comprehensive Development Seed
 * Run: pnpm --filter @sportza/api db:seed
 *
 * Covers every feature:
 *   Users · Sports · SportFormats · Venues · Facilities · Slots · PricingRules
 *   Bookings · BookingPayments · Matches · MatchEvents · PlayerStats
 *   OpenPlay · Training Batches · BatchSessions · SessionAttendance
 *   BatchPayments · BatchAnnouncements · TrainerReviews · VenueReviews
 *   Tournaments · TournamentFixtures · Leaderboard data
 *
 * Safe to run multiple times — never forces a primary key.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildNashikVenueDefs, mergeNashikIntoVenueDefs } from "./data/nashik-venues";

const prisma = new PrismaClient();

const DEV_PASSWORD_HASH = bcrypt.hashSync("Sportza@123", 12);

// ── helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(
  email: string,
  data: Parameters<typeof prisma.user.create>[0]["data"]
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { email },
      data: { password: DEV_PASSWORD_HASH },
    });
  }
  return prisma.user.create({ data: { ...data, email, password: DEV_PASSWORD_HASH } });
}

async function upsertSport(
  name: string,
  data: Parameters<typeof prisma.sport.create>[0]["data"]
) {
  return prisma.sport.upsert({
    where: { name },
    update: {},
    create: { ...data, name },
  });
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding Sportza dev database…");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. USERS
  // ─────────────────────────────────────────────────────────────────────────
  const arjun = await upsertUser("arjun@sportza.dev", {
    name: "Arjun Mehta",
    role: "player",
    phone: "+919876543210",
  });
  const priya = await upsertUser("priya@sportza.dev", {
    name: "Priya Sharma",
    role: "player",
    phone: "+919812345678",
  });
  const vikram = await upsertUser("vikram@sportza.dev", {
    name: "Vikram Nair",
    role: "player",
    phone: "+919811223344",
  });
  const sneha = await upsertUser("sneha@sportza.dev", {
    name: "Sneha Patil",
    role: "player",
    phone: "+919822334455",
  });
  const rohit = await upsertUser("rohit@sportza.dev", {
    name: "Rohit Das",
    role: "player",
    phone: "+919833445560",
  });
  const coach = await upsertUser("coach@sportza.dev", {
    name: "Rahul Sinha",
    role: "trainer",
    phone: "+919845001122",
  });
  // Ensure existing users have the correct role (idempotent fix)
  await prisma.user.update({ where: { id: coach.id }, data: { role: "trainer" } });

  const coach2 = await upsertUser("coach2@sportza.dev", {
    name: "Meera Iyer",
    role: "trainer",
    phone: "+919856002233",
  });
  await prisma.user.update({ where: { id: coach2.id }, data: { role: "trainer" } });

  // Additional trainer users
  const trainer3 = await upsertUser("trainer3@sportza.dev", {
    name: "Kiran Rao",
    role: "trainer",
    phone: "+919867001133",
  });
  await prisma.user.update({ where: { id: trainer3.id }, data: { role: "trainer" } });

  const trainer4 = await upsertUser("trainer4@sportza.dev", {
    name: "Amit Kulkarni",
    role: "trainer",
    phone: "+919867002244",
  });
  await prisma.user.update({ where: { id: trainer4.id }, data: { role: "trainer" } });

  const trainer5 = await upsertUser("trainer5@sportza.dev", {
    name: "Divya Nair",
    role: "trainer",
    phone: "+919867003355",
  });
  await prisma.user.update({ where: { id: trainer5.id }, data: { role: "trainer" } });
  const owner = await upsertUser("owner@sportza.dev", {
    name: "Neha Kapoor",
    role: "venue_owner",
    phone: "+919833445566",
  });

  const admin = await upsertUser("admin@sportza.in", {
    name: "Sportza Admin",
    role: "admin",
    phone: "+919800000001",
  });
  // Always restore admin role on re-seed (upsertUser only updates password for existing rows)
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      role: "admin",
      isActive: true,
      onboardingStatus: null,
      onboardingNote: null,
    },
  });

  process.env.DEV_FALLBACK_USER_ID = String(arjun.id);
  console.log(`  ✓ Users  (arjun.id=${arjun.id})`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SPORTS + FORMATS
  // ─────────────────────────────────────────────────────────────────────────
  const sportDefs = [
    { name: "badminton",  displayName: "Badminton",  price: 400,  rates: { morning: 400,  afternoon: 500,  evening: 600  } },
    { name: "cricket",    displayName: "Cricket",    price: 2000, rates: { morning: 2000, afternoon: 2000, evening: 2500 } },
    { name: "football",   displayName: "Football",   price: 1500, rates: { morning: 1500, afternoon: 1500, evening: 2000 } },
    { name: "tennis",     displayName: "Tennis",     price: 600,  rates: { morning: 600,  afternoon: 700,  evening: 900  } },
    { name: "padel",      displayName: "Padel",      price: 700,  rates: { morning: 700,  afternoon: 800,  evening: 1000 } },
    { name: "basketball", displayName: "Basketball", price: 800,  rates: { morning: 800,  afternoon: 900,  evening: 1100 } },
    { name: "swimming",   displayName: "Swimming",   price: 300,  rates: { morning: 300,  afternoon: 300,  evening: 400  } },
    { name: "pickleball", displayName: "Pickleball", price: 500,  rates: { morning: 500,  afternoon: 600,  evening: 750  } },
  ];

  const sports: Record<string, { id: number }> = {};
  for (const s of sportDefs) {
    sports[s.name] = await upsertSport(s.name, {
      displayName: s.displayName,
      defaultPricePerHour: s.price,
      defaultRates: s.rates,
      defaultMinBookingHrs: 1,
      isActive: true,
    });
  }

  // Rulebook popup content — upsert after sports exist so existing rows are updated too
  const rulebookData: Array<{ name: string; rulebookTitle: string; rulebookLines: string[] }> = [
    {
      name: "badminton",
      rulebookTitle: "How to Play Badminton",
      rulebookLines: [
        "Every rally = 1 point to the rally winner.",
        "First to 21 points wins the game, must win by 2.",
        "At 29-29 next point wins (sudden death cap).",
        "Match is best of 3 games.",
      ],
    },
    {
      name: "cricket",
      rulebookTitle: "How to Play Cricket",
      rulebookLines: [
        "Batting team scores runs each ball.",
        "Innings ends when overs run out or team is all out (10 wickets).",
        "Team with the most runs at the end wins.",
        "T10 = 10 overs per side · T20 = 20 overs per side.",
      ],
    },
    {
      name: "football",
      rulebookTitle: "How to Play Football",
      rulebookLines: [
        "Score by putting the ball into the opponent's goal.",
        "Each goal = 1 point.",
        "Team with more goals at full time wins (draw is possible).",
        "Match has 2 halves; played as 5-a-side, 7-a-side, or 11-a-side.",
      ],
    },
    {
      name: "tennis",
      rulebookTitle: "How to Play Tennis",
      rulebookLines: [
        "Points go: 0 → 15 → 30 → 40 → Game.",
        "At deuce (40-40) you must win 2 points in a row.",
        "First to 6 games wins the set (must lead by 2; tiebreak at 6-6).",
        "Match is best of sets — usually best of 3.",
      ],
    },
    {
      name: "padel",
      rulebookTitle: "How to Play Padel",
      rulebookLines: [
        "Padel is usually played as doubles on an enclosed court.",
        "Scoring follows tennis: 15, 30, 40, game (deuce/advantage at 40-40).",
        "Players can use the walls after the ball bounces, but not before.",
        "Sets are typically first to 6 games with a 2-game lead.",
      ],
    },
    {
      name: "basketball",
      rulebookTitle: "How to Play Basketball",
      rulebookLines: [
        "Score by shooting the ball through the hoop.",
        "Free throw = 1 pt · Normal shot = 2 pts · Beyond arc = 3 pts.",
        "Team with more points at the final buzzer wins.",
        "Played in 4 quarters or 2 halves.",
      ],
    },
    {
      name: "pickleball",
      rulebookTitle: "How to Play Pickleball",
      rulebookLines: [
        "Rally scoring: every rally = 1 point for the winner.",
        "Service scoring: only the serving team can score; fault = side-out.",
        "First to 11 points, win by 2 (best of 3 games).",
        "Volleying inside the kitchen (non-volley zone) is a fault.",
      ],
    },
    {
      name: "swimming",
      rulebookTitle: "How to Compete in Swimming",
      rulebookLines: [
        "Fastest time to complete the distance wins.",
        "Each race has a fixed stroke (freestyle, backstroke, etc.).",
        "False start = disqualification.",
        "Official timer result is final.",
      ],
    },
  ];

  for (const rb of rulebookData) {
    await (prisma.sport as any).updateMany({
      where: { name: rb.name },
      data: { rulebookTitle: rb.rulebookTitle, rulebookLines: rb.rulebookLines as any },
    });
  }
  console.log("  ✓ Sport rulebook popup content");

  // Sport formats (needed by CreateOpenPlay, LiveMatch, Scoreboard, ClaimDisplay)
  const formatDefs: Array<{
    sportName: string;
    name: string;
    playersPerTeam: number;
    desc?: string;
    config?: { scoringType?: string; pointsToWin?: number };
  }> = [
    { sportName: "badminton",  name: "Singles",     playersPerTeam: 1 },
    { sportName: "badminton",  name: "Doubles",     playersPerTeam: 2 },
    { sportName: "cricket",    name: "T10",         playersPerTeam: 6,  desc: "10-over format" },
    { sportName: "cricket",    name: "T20",         playersPerTeam: 11, desc: "20-over format" },
    { sportName: "football",   name: "5-a-side",    playersPerTeam: 5 },
    { sportName: "football",   name: "7-a-side",    playersPerTeam: 7 },
    { sportName: "football",   name: "11-a-side",   playersPerTeam: 11 },
    { sportName: "tennis",     name: "Singles",     playersPerTeam: 1 },
    { sportName: "tennis",     name: "Doubles",     playersPerTeam: 2 },
    { sportName: "padel",      name: "Singles",     playersPerTeam: 1 },
    { sportName: "padel",      name: "Doubles",     playersPerTeam: 2 },
    { sportName: "basketball", name: "3×3",         playersPerTeam: 3 },
    { sportName: "basketball", name: "5×5",         playersPerTeam: 5 },
    {
      sportName: "pickleball",
      name: "Singles",
      playersPerTeam: 1,
      desc: "Rally scoring — every rally wins a point for the side you tap.",
      config: { scoringType: "pickleball_rally", pointsToWin: 11 },
    },
    {
      sportName: "pickleball",
      name: "Doubles",
      playersPerTeam: 2,
      desc: "Rally scoring — every rally wins a point for the side you tap.",
      config: { scoringType: "pickleball_rally", pointsToWin: 11 },
    },
    {
      sportName: "pickleball",
      name: "Doubles (service)",
      playersPerTeam: 2,
      desc: "Side-out scoring, Server 1/2 — optional court setup on live screen, or skip without player-side tracking.",
      config: { scoringType: "pickleball_service", pointsToWin: 11 },
    },
    {
      sportName: "pickleball",
      name: "Singles (service)",
      playersPerTeam: 1,
      desc: "Side-out scoring — only the server can add points.",
      config: { scoringType: "pickleball_service", pointsToWin: 11 },
    },
  ];

  for (const f of formatDefs) {
    const exists = await prisma.sportFormat.findFirst({
      where: { sportId: sports[f.sportName].id, name: f.name },
    });
    if (!exists) {
      await prisma.sportFormat.create({
        data: {
          sportId: sports[f.sportName].id,
          name: f.name,
          playersPerTeam: f.playersPerTeam,
          description: f.desc,
          ...(f.config ? { config: f.config as object } : {}),
        },
      });
    }
  }

  const pickleballId = sports["pickleball"].id;
  const pbFormatDesc: Array<{ name: string; description: string }> = [
    { name: "Singles", description: "Rally scoring — every rally wins a point for the side you tap." },
    { name: "Doubles", description: "Rally scoring — every rally wins a point for the side you tap." },
    {
      name: "Doubles (service)",
      description: "Side-out scoring, Server 1/2 — optional court setup on live screen, or skip without player-side tracking.",
    },
    { name: "Singles (service)", description: "Side-out scoring — only the server can add points." },
  ];
  for (const row of pbFormatDesc) {
    await prisma.sportFormat.updateMany({
      where: { sportId: pickleballId, name: row.name },
      data: { description: row.description },
    });
  }

  await prisma.sportFormat.deleteMany({
    where: {
      sportId: pickleballId,
      name: { in: ["Mixed Doubles", "Mixed Doubles (service)"] },
    },
  });

  console.log("  ✓ Sports + formats");

  // ─────────────────────────────────────────────────────────────────────────
  // 3. VENUES + FACILITIES + PRICING RULES
  // ─────────────────────────────────────────────────────────────────────────
  interface VenueDef {
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
    externalId?: string;
    phone?: string;
    openingHours?: string;
    googlePlaceId?: string;
    mapsUrl?: string;
    seedRating?: number;
    seedReviewCount?: number;
  }

  function venueAvailabilityMeta(v: VenueDef): object | undefined {
    if (!v.externalId && !v.openingHours && !v.googlePlaceId) return undefined;
    return {
      ...(v.externalId ? { externalId: v.externalId } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
      ...(v.openingHours ? { openingHours: v.openingHours } : {}),
      ...(v.googlePlaceId ? { googlePlaceId: v.googlePlaceId } : {}),
      ...(v.mapsUrl ? { mapsUrl: v.mapsUrl } : {}),
      ...(v.seedRating != null ? { directoryRating: v.seedRating } : {}),
      ...(v.seedReviewCount != null ? { directoryReviewCount: v.seedReviewCount } : {}),
    };
  }

  const coreVenueDefs: VenueDef[] = [
    {
      name: "Elite Sports Arena",
      addr: "Survey No. 14, Koregaon Park, Pune – 411001",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.5362,
      lng: 73.8938,
      sportNames: ["badminton", "tennis"],
      capacity: 80,
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Cafeteria", "WiFi"],
      courts: [
        { name: "Badminton Court A", surface: "Synthetic PU",     count: 4 },
        { name: "Badminton Court B", surface: "Wooden Sprung",    count: 2 },
        { name: "Tennis Court",      surface: "Acrylic Hard",     count: 2 },
      ],
    },
    {
      name: "Phoenix Cricket Ground",
      addr: "Baner Road, Baner, Pune – 411045",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.5591,
      lng: 73.7868,
      sportNames: ["cricket", "football"],
      capacity: 200,
      image: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Floodlights", "Scoreboard"],
      courts: [
        { name: "Main Cricket Ground", surface: "Natural Grass",   count: 1 },
        { name: "Football Turf",       surface: "Artificial Turf", count: 1 },
      ],
    },
    {
      name: "City Sports Hub",
      addr: "FC Road, Shivajinagar, Pune – 411005",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.5167,
      lng: 73.8469,
      sportNames: ["badminton", "basketball", "football"],
      capacity: 120,
      image: "https://images.unsplash.com/photo-1546519638-68955109f2f0?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Gym", "First Aid"],
      courts: [
        { name: "Badminton Hall",     surface: "Synthetic PU",    count: 3 },
        { name: "Basketball Court",   surface: "Wooden Hardwood", count: 1 },
        { name: "Football Mini Turf", surface: "Artificial Turf", count: 1 },
      ],
    },
    {
      name: "Sunrise Badminton Centre",
      addr: "Aundh, Pune – 411007",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.5584,
      lng: 73.8082,
      sportNames: ["badminton"],
      capacity: 60,
      image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Coaching Area"],
      courts: [
        { name: "Court 1", surface: "Synthetic PU", count: 2 },
        { name: "Court 2", surface: "Synthetic PU", count: 2 },
      ],
    },
    {
      name: "Mumbai Sports Complex",
      addr: "Andheri West, Mumbai – 400053",
      city: "Mumbai",
      state: "Maharashtra",
      lat: 19.1377,
      lng: 72.8296,
      sportNames: ["cricket", "tennis", "badminton"],
      capacity: 300,
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Restaurant", "AC Lobby"],
      courts: [
        { name: "Cricket Net A", surface: "Artificial Turf", count: 3 },
        { name: "Tennis Court",  surface: "Acrylic Hard",    count: 4 },
        { name: "Badminton",     surface: "Synthetic PU",    count: 6 },
      ],
    },
    {
      name: "Pune Pickleball Hub",
      addr: "Kalyani Nagar, Pune – 411006",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.5426,
      lng: 73.9005,
      sportNames: ["pickleball", "tennis", "badminton"],
      capacity: 60,
      image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Pro Shop", "Coaching Area"],
      courts: [
        { name: "Pickleball Court 1", surface: "Cushioned Acrylic", count: 3 },
        { name: "Pickleball Court 2", surface: "Cushioned Acrylic", count: 3 },
        { name: "Multi-Sport Court",  surface: "Synthetic PU",      count: 1 },
      ],
    },
    {
      name: "Pune Padel Club",
      addr: "NIBM Road, Kondhwa, Pune – 411048",
      city: "Pune",
      state: "Maharashtra",
      lat: 18.4734,
      lng: 73.8884,
      sportNames: ["padel", "tennis"],
      capacity: 80,
      image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Pro Shop", "Lounge Area", "WiFi"],
      courts: [
        { name: "Padel Court 1", surface: "Artificial Grass", count: 2 },
        { name: "Padel Court 2", surface: "Artificial Grass", count: 2 },
        { name: "Tennis Court",  surface: "Acrylic Hard",     count: 1 },
      ],
    },
    {
      name: "Big Bounce Sports Arena",
      addr: "Link Road, near Shamsundar missal, Pundlik nagar, Makhmalabad, Nashik, Maharashtra 422003",
      city: "Nashik",
      state: "Maharashtra",
      lat: 20.0391485,
      lng: 73.7701022,
      sportNames: ["badminton", "basketball", "football", "cricket"],
      capacity: 200,
      image: "https://images.unsplash.com/photo-1546519638-68955109f2f0?w=480&q=80",
      amenities: ["Parking", "Changing Room", "Drinking Water", "Cafeteria", "Floodlights", "First Aid"],
      courts: [
        { name: "Badminton Hall A",   surface: "Synthetic PU",    count: 4 },
        { name: "Basketball Court",   surface: "Wooden Hardwood", count: 2 },
        { name: "Football Turf",      surface: "Artificial Turf", count: 1 },
        { name: "Cricket Net Zone",   surface: "Artificial Turf", count: 3 },
      ],
    },
    {
      name: "The Nova Club",
      addr: "Gangapur Road, Nashik – 422013",
      city: "Nashik",
      state: "Maharashtra",
      lat: 20.0067931,
      lng: 73.7422276,
      sportNames: ["pickleball", "badminton", "tennis"],
      capacity: 80,
      image: "/venues/nova-club/aerial-courts.png",
      extraImages: [
        "/venues/nova-club/indoor-courts.png",
        "/venues/nova-club/logo-court.png",
      ],
      amenities: ["Parking", "Changing Room", "Drinking Water", "Floodlights", "Lounge Area", "Pro Shop"],
      courts: [
        { name: "Pickleball Court 1", surface: "Cushioned Acrylic", count: 2 },
        { name: "Pickleball Court 2", surface: "Cushioned Acrylic", count: 2 },
        { name: "Badminton Hall",      surface: "Synthetic PU",      count: 2 },
        { name: "Tennis Court",        surface: "Acrylic Hard",      count: 1 },
      ],
    },
  ];

  const nashikVenueDefs = buildNashikVenueDefs();
  const venueDefs: VenueDef[] = mergeNashikIntoVenueDefs(coreVenueDefs, nashikVenueDefs);
  console.log(
    `  ✓ Nashik directory venues merged (${nashikVenueDefs.length} from spreadsheets)`
  );

  const venueRows: Array<{ id: number; name: string; sportNames: string[]; facilities: Array<{ id: number; name: string }> }> = [];

  for (const v of venueDefs) {
    let venue = await prisma.venue.findFirst({ where: { name: v.name, ownerId: owner.id } });

    if (!venue) {
      // Create a fresh location row for this venue with full coords
      const location = await prisma.location.create({
        data: {
          country: "India",
          state: v.state,
          city: v.city,
          address: v.addr,
          lat: v.lat,
          lng: v.lng,
        },
      });
      venue = await prisma.venue.create({
        data: {
          name: v.name,
          ownerId: owner.id,
          locationId: location.id,
          sports: v.sportNames,
          capacity: v.capacity,
          gstRate: 18,
          images: [v.image, ...(v.extraImages ?? [])],
          facilities: v.amenities,
          availability: venueAvailabilityMeta(v),
          isActive: true,
        },
      });
    } else {
      // Venue already exists — ensure its linked location has coordinates.
      // If locationId is null, create a fresh location and link it.
      // If locationId exists but lat/lng are missing, update the location in-place.
      if (!venue.locationId) {
        const location = await prisma.location.create({
          data: {
            country: "India",
            state: v.state,
            city: v.city,
            address: v.addr,
            lat: v.lat,
            lng: v.lng,
          },
        });
        await prisma.venue.update({ where: { id: venue.id }, data: { locationId: location.id } });
      } else {
        // Always stamp lat/lng onto the linked location so geo queries work
        await prisma.location.update({
          where: { id: venue.locationId },
          data: { lat: v.lat, lng: v.lng, state: v.state, address: v.addr },
        });
      }
      // Refresh images / directory metadata on re-seed
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          images: [v.image, ...(v.extraImages ?? [])],
          sports: v.sportNames,
          availability: venueAvailabilityMeta(v),
        },
      });
    }

    // Sport rates
    for (const sn of v.sportNames) {
      const def = sportDefs.find((s) => s.name === sn)!;
      const rateExists = await prisma.sportRate.findFirst({ where: { venueId: venue.id, sport: sn } });
      if (!rateExists) {
        await prisma.sportRate.create({
          data: {
            venueId: venue.id,
            sport: sn,
            sportId: sports[sn].id,
            rates: def.rates,
            minBookingHours: 1,
          },
        });
      }
    }

    // Facilities
    const facilityIds: Array<{ id: number; name: string }> = [];
    for (const c of v.courts) {
      let fac = await prisma.facility.findFirst({ where: { venueId: venue.id, name: c.name } });
      if (!fac) {
        fac = await prisma.facility.create({
          data: {
            venueId: venue.id,
            name: c.name,
            surfaceType: c.surface,
            sports: v.sportNames,
            count: c.count,
          },
        });
      }
      facilityIds.push({ id: fac.id, name: fac.name });

      // Pricing rules per facility
      const priceExists = await prisma.facilityPricingRule.findFirst({
        where: { venueId: venue.id, facilityId: fac.id, ruleType: "peak_hour" },
      });
      if (!priceExists) {
        // Using SportFacility (sport_facilities) for FacilityPricingRule relation
        const sportFacExists = await prisma.sportFacility.findFirst({ where: { venueId: venue.id, name: c.name } });
        let sportFac = sportFacExists;
        if (!sportFac) {
          sportFac = await prisma.sportFacility.create({
            data: {
              venueId: venue.id,
              name: c.name,
              surfaceType: c.surface,
              count: c.count,
              sports: v.sportNames,
            },
          });
        }
        await prisma.facilityPricingRule.create({
          data: {
            facilityId: sportFac.id,
            venueId: venue.id,
            ruleType: "peak_hour",
            ruleValue: 25,
            metadata: { description: "25% surcharge 6–9 PM weekdays" },
            isActive: true,
          },
        });
        await prisma.facilityPricingRule.create({
          data: {
            facilityId: sportFac.id,
            venueId: venue.id,
            ruleType: "weekend_surcharge",
            ruleValue: 15,
            metadata: { description: "15% surcharge Saturday & Sunday" },
            isActive: true,
          },
        });
      }
    }

    venueRows.push({ id: venue.id, name: v.name, sportNames: v.sportNames, facilities: facilityIds });
  }

  // ── Ensure each venue has its own dedicated Location row with correct lat/lng ──
  // Re-iterate venueDefs to guarantee per-venue unique location rows.
  for (const v of venueDefs) {
    const dbVenue = await prisma.venue.findFirst({
      where: { name: v.name, ownerId: owner.id },
      select: { id: true, locationId: true },
    });
    if (!dbVenue) continue;

    // Check if another venue shares the same locationId
    const sibling = dbVenue.locationId
      ? await prisma.venue.findFirst({
          where: { locationId: dbVenue.locationId, NOT: { id: dbVenue.id } },
          select: { id: true },
        })
      : null;

    if (sibling || !dbVenue.locationId) {
      // Create a dedicated location row for this venue
      const dedicated = await prisma.location.create({
        data: {
          country: "India",
          state: v.state,
          city: v.city,
          address: v.addr,
          lat: v.lat,
          lng: v.lng,
        },
      });
      await prisma.venue.update({
        where: { id: dbVenue.id },
        data: { locationId: dedicated.id },
      });
    } else {
      // Sole owner — just stamp the correct coords
      await prisma.location.update({
        where: { id: dbVenue.locationId! },
        data: { lat: v.lat, lng: v.lng, state: v.state, address: v.addr },
      });
    }
  }

  console.log("  ✓ Venues + facilities + pricing rules");

  // Shortcuts — looked up by name so array order doesn't matter
  const venueElite      = venueRows.find((r) => r.name === "Elite Sports Arena")!;
  const venuePhoenix    = venueRows.find((r) => r.name === "Phoenix Cricket Ground")!;
  const venueCity       = venueRows.find((r) => r.name === "City Sports Hub")!;
  const venueSunrise    = venueRows.find((r) => r.name === "Sunrise Badminton Centre")!;
  const venueMumbai     = venueRows.find((r) => r.name === "Mumbai Sports Complex")!;
  const venuePickleball = venueRows.find((r) => r.name === "Pune Pickleball Hub")!;
  const venueParadise   = venueRows.find((r) => r.name === "Pickleball Paradise by Ages Ventures")!;
  const venuePadel      = venueRows.find((r) => r.name === "Pune Padel Club")!;
  const venueBigBounce  = venueRows.find((r) => r.name === "Big Bounce Sports Arena")!;
  const venueNova       = venueRows.find((r) => r.name === "The Nova Club")!;

  // ─────────────────────────────────────────────────────────────────────────
  // 3b. SLOTS — time-based pricing per facility
  //     Generates today ±7 days, 06:00–21:00, 1-hr blocks
  //     Morning 06–09: base | Afternoon 09–17: +10% | Peak 17–21: +35%
  // ─────────────────────────────────────────────────────────────────────────
  const SLOT_BASE_PRICE: Record<string, number> = {
    badminton: 400, cricket: 2000, football: 1500,
    tennis: 600, padel: 700, basketball: 800, swimming: 300, pickleball: 500,
  };

  function slotPrice(sport: string, hourOfDay: number): number {
    const base = SLOT_BASE_PRICE[sport] ?? 500;
    if (hourOfDay < 9)  return base;
    if (hourOfDay < 17) return Math.round(base * 1.1);
    return Math.round(base * 1.35);
  }

  function dateAtHour(base: Date, h: number): Date {
    const d = new Date(base);
    d.setHours(h, 0, 0, 0);
    return d;
  }

  // Facility → primary sport for pricing
  const facilityPrimarySport: Record<number, string> = {};

  interface FacilitySlotMeta { id: number; name: string; primarySport: string; venueId: number }
  const allFacilitiesForSlots: FacilitySlotMeta[] = [];

  for (const vr of venueRows) {
    for (let fi = 0; fi < vr.facilities.length; fi++) {
      const f = vr.facilities[fi];
      const sport = vr.sportNames[Math.min(fi, vr.sportNames.length - 1)];
      facilityPrimarySport[f.id] = sport;
      allFacilitiesForSlots.push({ id: f.id, name: f.name, primarySport: sport, venueId: vr.id });
    }
  }

  // Generate slots for 7 days back + 14 days forward
  const slotDayOffsets = Array.from({ length: 22 }, (_, i) => i - 7);
  const SLOT_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  for (const f of allFacilitiesForSlots) {
    for (const dayOffset of slotDayOffsets) {
      const dayBase = new Date();
      dayBase.setDate(dayBase.getDate() + dayOffset);
      dayBase.setHours(0, 0, 0, 0);

      for (const h of SLOT_HOURS) {
        const start = dateAtHour(dayBase, h);
        const end   = dateAtHour(dayBase, h + 1);
        const price = slotPrice(f.primarySport, h);

        const exists = await prisma.slot.findFirst({
          where: { facilityId: f.id, startTime: start },
        });
        if (!exists) {
          await prisma.slot.create({
            data: {
              facilityId: f.id,
              venueId:    f.venueId,
              startTime:  start,
              endTime:    end,
              price,
              status: "available",
            },
          });
        }
      }
    }
  }
  console.log("  ✓ Slots with time-based pricing");
  const eliteFacBad = venueElite.facilities[0];
  const eliteFacTen = venueElite.facilities[2];
  const phoenixFacCri = venuePhoenix.facilities[0];
  const phoenixFacFoot = venuePhoenix.facilities[1];
  const cityFacBad = venueCity.facilities[0];
  const cityFacFoot = venueCity.facilities[2];
  const padelFacCourt1 = venuePadel.facilities[0];
  const padelFacCourt2 = venuePadel.facilities[1] ?? venuePadel.facilities[0];

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TRAINER PROFILES
  // ─────────────────────────────────────────────────────────────────────────
  const tp1Exists = await prisma.trainerProfile.findUnique({ where: { userId: coach.id } });
  if (!tp1Exists) {
    await prisma.trainerProfile.create({
      data: {
        userId: coach.id,
        bio: "National-level badminton player turned certified coach. 10+ years coaching players from beginner to advanced. Former State Champion. Also coaches tennis and padel.",
        yearsExperience: 10,
        sports: ["badminton", "tennis", "padel"],
        certifications: ["BWF Level 2 Coach", "Sports Nutrition Certificate", "WPT Padel Instructor Level 1"],
        achievements: ["State Champion 2015", "District Coach of the Year 2022"],
        rating: 4.8,
        reviewCount: 34,
      },
    });
  }

  const tp2Exists = await prisma.trainerProfile.findUnique({ where: { userId: coach2.id } });
  if (!tp2Exists) {
    await prisma.trainerProfile.create({
      data: {
        userId: coach2.id,
        bio: "Professional football coach with UEFA B licence. Specialises in youth development and advanced tactical training.",
        yearsExperience: 7,
        sports: ["football", "basketball"],
        certifications: ["UEFA B Licence", "AIFF D Licence"],
        achievements: ["City League Winners 2021", "Best Youth Coach 2023"],
        rating: 4.6,
        reviewCount: 18,
      },
    });
  }

  // Link coaches to venues
  for (const [coachUser, venueRow] of [
    [coach, venueElite],
    [coach, venueSunrise],
    [coach, venuePadel],
    [coach2, venueCity],
    [coach2, venuePhoenix],
  ] as Array<[typeof coach, typeof venueElite]>) {
    const tvExists = await prisma.trainerVenue.findUnique({
      where: { userId_venueId: { userId: coachUser.id, venueId: venueRow.id } },
    });
    if (!tvExists) {
      await prisma.trainerVenue.create({ data: { userId: coachUser.id, venueId: venueRow.id } });
    }
  }
  console.log("  ✓ Trainer profiles + venue links");

  // ─────────────────────────────────────────────────────────────────────────
  // 5. BOOKINGS + BOOKING PAYMENTS
  // ─────────────────────────────────────────────────────────────────────────
  interface BookingSpec {
    user: typeof arjun;
    venue: typeof venueElite;
    fac: { id: number; name: string };
    sport: string;
    date: Date;
    start: string;
    end: string;
    hours: number;
    ratePerHour: number;
    status: string;
    paymentStatus: string;
  }

  // Helper: find booked slots for a facility on a date+time range
  async function linkSlotsToBooking(
    bookingId: number,
    facilityId: number,
    date: Date,
    startHr: number,
    endHr: number
  ) {
    for (let h = startHr; h < endHr; h++) {
      const slotStart = new Date(date);
      slotStart.setHours(h, 0, 0, 0);
      const slot = await prisma.slot.findFirst({
        where: { facilityId, startTime: slotStart },
      });
      if (slot) {
        await prisma.slot.update({
          where: { id: slot.id },
          data: { status: "booked", bookingId },
        });
      }
    }
  }

  async function ensureBooking(spec: BookingSpec) {
    let bk = await prisma.booking.findFirst({
      where: {
        userId: spec.user.id,
        venueId: spec.venue.id,
        sport: spec.sport,
        status: spec.status,
        startTime: spec.start,
      },
    });
    if (!bk) {
      const subtotal = spec.ratePerHour * spec.hours;
      const gstAmount = +(subtotal * 0.18).toFixed(2);
      const totalAmount = +(subtotal + gstAmount).toFixed(2);
      bk = await prisma.booking.create({
        data: {
          userId: spec.user.id,
          venueId: spec.venue.id,
          sport: spec.sport,
          sportId: sports[spec.sport].id,
          facilityId: spec.fac.id,
          facilityName: spec.fac.name,
          bookingDate: spec.date,
          startTime: spec.start,
          endTime: spec.end,
          totalHours: spec.hours,
          subtotal,
          gstRate: 18,
          gstAmount,
          totalAmount,
          paymentStatus: spec.paymentStatus,
          paidAmount: spec.paymentStatus === "paid" ? totalAmount : 0,
          status: spec.status,
        },
      });
    }

    // Link individual Slot rows to this booking (marks them "booked")
    const [startHr] = spec.start.split(":").map(Number);
    const endHr = startHr + spec.hours;
    await linkSlotsToBooking(bk.id, spec.fac.id, spec.date, startHr, Math.round(endHr));

    // BookingPayment record
    const payExists = await prisma.bookingPayment.findFirst({ where: { bookingId: bk.id } });
    if (!payExists && spec.paymentStatus === "paid") {
      const subtotal = spec.ratePerHour * spec.hours;
      const gstAmount = +(subtotal * 0.18).toFixed(2);
      const totalAmount = +(subtotal + gstAmount).toFixed(2);
      await prisma.bookingPayment.create({
        data: {
          bookingId: bk.id,
          userId: spec.user.id,
          amount: totalAmount,
          paymentMethod: "online",
          status: "paid",
        },
      });
    }
    return bk;
  }

  // --- Arjun bookings ---
  const bArjunBadUpcoming = await ensureBooking({
    user: arjun, venue: venueElite, fac: eliteFacBad, sport: "badminton",
    date: daysFromNow(2), start: "07:00", end: "08:00", hours: 1, ratePerHour: 400,
    status: "confirmed", paymentStatus: "paid",
  });
  const bArjunCriCompleted = await ensureBooking({
    user: arjun, venue: venuePhoenix, fac: phoenixFacCri, sport: "cricket",
    date: daysAgo(5), start: "16:00", end: "18:00", hours: 2, ratePerHour: 2000,
    status: "completed", paymentStatus: "paid",
  });
  const bArjunBadCompleted2 = await ensureBooking({
    user: arjun, venue: venueElite, fac: eliteFacBad, sport: "badminton",
    date: daysAgo(12), start: "08:00", end: "09:00", hours: 1, ratePerHour: 400,
    status: "completed", paymentStatus: "paid",
  });
  const bArjunTenUpcoming = await ensureBooking({
    user: arjun, venue: venueElite, fac: eliteFacTen, sport: "tennis",
    date: daysFromNow(5), start: "09:00", end: "10:00", hours: 1, ratePerHour: 600,
    status: "confirmed", paymentStatus: "paid",
  });
  await ensureBooking({
    user: arjun, venue: venueCity, fac: cityFacBad, sport: "badminton",
    date: daysAgo(20), start: "06:00", end: "07:00", hours: 1, ratePerHour: 400,
    status: "cancelled", paymentStatus: "refunded",
  });

  // --- Priya bookings ---
  const bPriyaFoot = await ensureBooking({
    user: priya, venue: venueCity, fac: cityFacFoot, sport: "football",
    date: daysFromNow(1), start: "17:00", end: "18:30", hours: 1.5, ratePerHour: 1500,
    status: "confirmed", paymentStatus: "paid",
  });
  await ensureBooking({
    user: priya, venue: venuePhoenix, fac: phoenixFacFoot, sport: "football",
    date: daysAgo(8), start: "18:00", end: "19:00", hours: 1, ratePerHour: 1500,
    status: "completed", paymentStatus: "paid",
  });

  // --- Vikram bookings ---
  await ensureBooking({
    user: vikram, venue: venueElite, fac: eliteFacBad, sport: "badminton",
    date: daysAgo(3), start: "10:00", end: "11:00", hours: 1, ratePerHour: 500,
    status: "completed", paymentStatus: "paid",
  });
  await ensureBooking({
    user: vikram, venue: venueMumbai, fac: venueMumbai.facilities[2], sport: "badminton",
    date: daysFromNow(3), start: "11:00", end: "12:00", hours: 1, ratePerHour: 400,
    status: "confirmed", paymentStatus: "paid",
  });

  // --- Sneha bookings ---
  await ensureBooking({
    user: sneha, venue: venueElite, fac: eliteFacTen, sport: "tennis",
    date: daysAgo(6), start: "09:00", end: "10:30", hours: 1.5, ratePerHour: 700,
    status: "completed", paymentStatus: "paid",
  });

  // --- Padel bookings ---
  const bArjunPadelUpcoming = await ensureBooking({
    user: arjun, venue: venuePadel, fac: padelFacCourt1, sport: "padel",
    date: daysFromNow(3), start: "08:00", end: "09:00", hours: 1, ratePerHour: 700,
    status: "confirmed", paymentStatus: "paid",
  });
  await ensureBooking({
    user: priya, venue: venuePadel, fac: padelFacCourt1, sport: "padel",
    date: daysAgo(4), start: "09:00", end: "10:00", hours: 1, ratePerHour: 770,
    status: "completed", paymentStatus: "paid",
  });
  await ensureBooking({
    user: vikram, venue: venuePadel, fac: padelFacCourt2, sport: "padel",
    date: daysFromNow(6), start: "17:00", end: "18:00", hours: 1, ratePerHour: 945,
    status: "confirmed", paymentStatus: "paid",
  });

  // ── Multi-slot booking: Arjun books 3-hour badminton (06:00–09:00, peak morning) ──
  // This single booking spans 3 consecutive slots at different morning rates
  const multiSlotDate = daysFromNow(4);
  const multiSlotDateMidnight = new Date(multiSlotDate);
  multiSlotDateMidnight.setHours(0, 0, 0, 0);

  const existingMultiSlot = await prisma.booking.findFirst({
    where: { userId: arjun.id, venueId: venueSunrise.id, startTime: "06:00", bookingDate: multiSlotDateMidnight },
  });
  if (!existingMultiSlot) {
    // 3 hours × ₹400/hr (morning flat rate) = ₹1200 subtotal
    const msSubtotal = 400 * 3;
    const msGst      = +(msSubtotal * 0.18).toFixed(2);
    const msTotal    = +(msSubtotal + msGst).toFixed(2);
    const msBooking  = await prisma.booking.create({
      data: {
        userId:      arjun.id,
        venueId:     venueSunrise.id,
        sport:       "badminton",
        sportId:     sports["badminton"].id,
        facilityId:  venueSunrise.facilities[0].id,
        facilityName: venueSunrise.facilities[0].name,
        bookingDate: multiSlotDateMidnight,
        startTime:   "06:00",
        endTime:     "09:00",
        totalHours:  3,
        subtotal:    msSubtotal,
        gstRate:     18,
        gstAmount:   msGst,
        totalAmount: msTotal,
        paymentStatus: "paid",
        paidAmount:  msTotal,
        status:      "confirmed",
      },
    });
    // Link all 3 individual hour-slots (06–07, 07–08, 08–09)
    await linkSlotsToBooking(msBooking.id, venueSunrise.facilities[0].id, multiSlotDateMidnight, 6, 9);
    await prisma.bookingPayment.create({
      data: { bookingId: msBooking.id, userId: arjun.id, amount: msTotal, paymentMethod: "online", status: "paid" },
    });
  }

  // ── Multi-court group booking: Vikram books 2 badminton courts simultaneously ──
  // Court 1 + Court 2 at Sunrise, same date+time, linked by groupId
  const groupDate   = daysFromNow(7);
  const groupDateMN = new Date(groupDate);
  groupDateMN.setHours(0, 0, 0, 0);
  const groupId = `group-vikram-sunrise-${groupDateMN.toISOString().slice(0, 10)}`;

  for (let courtIdx = 0; courtIdx < Math.min(2, venueSunrise.facilities.length); courtIdx++) {
    const courtFac = venueSunrise.facilities[courtIdx];
    const courtExists = await prisma.booking.findFirst({
      where: { userId: vikram.id, venueId: venueSunrise.id, facilityId: courtFac.id, bookingDate: groupDateMN, startTime: "10:00" },
    });
    if (!courtExists) {
      // Peak morning → ₹400 * 1.1 = ₹440/hr × 2 hrs
      const sub   = 440 * 2;
      const gst   = +(sub * 0.18).toFixed(2);
      const total = +(sub + gst).toFixed(2);
      const cb    = await prisma.booking.create({
        data: {
          userId:      vikram.id,
          venueId:     venueSunrise.id,
          sport:       "badminton",
          sportId:     sports["badminton"].id,
          facilityId:  courtFac.id,
          facilityName: courtFac.name,
          bookingDate: groupDateMN,
          startTime:   "10:00",
          endTime:     "12:00",
          totalHours:  2,
          subtotal:    sub,
          gstRate:     18,
          gstAmount:   gst,
          totalAmount: total,
          paymentStatus: "paid",
          paidAmount:  total,
          status:      "confirmed",
          groupId,
          bookingType: "group",
        },
      });
      await linkSlotsToBooking(cb.id, courtFac.id, groupDateMN, 10, 12);
      await prisma.bookingPayment.create({
        data: { bookingId: cb.id, userId: vikram.id, amount: total, paymentMethod: "online", status: "paid" },
      });
    }
  }

  // ── Multi-turf football: Priya books both turfs at Phoenix & City (peak evening) ──
  const turfDate   = daysFromNow(6);
  const turfDateMN = new Date(turfDate);
  turfDateMN.setHours(0, 0, 0, 0);
  const turfGroupId = `group-priya-football-${turfDateMN.toISOString().slice(0, 10)}`;

  for (const [turfVenue, turfFac] of [
    [venuePhoenix, phoenixFacFoot],
    [venueCity,    cityFacFoot   ],
  ] as Array<[typeof venuePhoenix, typeof phoenixFacFoot]>) {
    const turfExists = await prisma.booking.findFirst({
      where: { userId: priya.id, venueId: turfVenue.id, facilityId: turfFac.id, bookingDate: turfDateMN, startTime: "18:00" },
    });
    if (!turfExists) {
      // Peak evening → ₹1500 * 1.35 = ₹2025/hr × 2 hrs = ₹4050
      const sub   = 2025 * 2;
      const gst   = +(sub * 0.18).toFixed(2);
      const total = +(sub + gst).toFixed(2);
      const tb    = await prisma.booking.create({
        data: {
          userId:       priya.id,
          venueId:      turfVenue.id,
          sport:        "football",
          sportId:      sports["football"].id,
          facilityId:   turfFac.id,
          facilityName: turfFac.name,
          bookingDate:  turfDateMN,
          startTime:    "18:00",
          endTime:      "20:00",
          totalHours:   2,
          subtotal:     sub,
          gstRate:      18,
          gstAmount:    gst,
          totalAmount:  total,
          paymentStatus: "paid",
          paidAmount:   total,
          status:       "confirmed",
          groupId:      turfGroupId,
          bookingType:  "group",
        },
      });
      await linkSlotsToBooking(tb.id, turfFac.id, turfDateMN, 18, 20);
      await prisma.bookingPayment.create({
        data: { bookingId: tb.id, userId: priya.id, amount: total, paymentMethod: "online", status: "paid" },
      });
    }
  }

  console.log("  ✓ Bookings + payments (incl. multi-slot + multi-court group bookings)");

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MATCHES + MATCH EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  async function ensureMatch(
    bookingId: number | null,
    sportName: string,
    format: string,
    ppt: number,
    venue: typeof venueElite,
    date: Date,
    status: string,
    teams: object,
    scores: object,
    winner: string | null,
    createdBy: typeof arjun
  ) {
    const where = bookingId
      ? await prisma.match.findFirst({ where: { bookingId } })
      : await prisma.match.findFirst({ where: { sportName, status, createdById: createdBy.id, matchDate: date } });

    if (where) return where;

    return prisma.match.create({
      data: {
        bookingId: bookingId ?? undefined,
        sportId: sports[sportName].id,
        sportName,
        formatName: format,
        playersPerTeam: ppt,
        venueId: venue.id,
        matchDate: date,
        matchType: "COMPETITIVE",
        loggingMode: "QUICK_RESULT",
        status,
        winnerTeam: winner ?? undefined,
        teams,
        scores,
        createdById: createdBy.id,
      },
    });
  }

  // Upcoming scheduled match (linked to Arjun's badminton booking)
  const mUpcomingBad = await ensureMatch(
    bArjunBadUpcoming.id, "badminton", "Singles", 1, venueElite, daysFromNow(2),
    "scheduled",
    { A: { name: "Arjun Mehta",  players: [{ id: arjun.id,  name: arjun.name  }] },
      B: { name: "Priya Sharma", players: [{ id: priya.id,  name: priya.name  }] } },
    { A: 0, B: 0 }, null, arjun
  );

  // Live match (no booking needed — standalone)
  const mLive = await ensureMatch(
    null, "badminton", "Doubles", 2, venueElite, new Date(),
    "live",
    { A: { name: "Eagles", players: [{ id: arjun.id, name: arjun.name }, { id: vikram.id, name: vikram.name }] },
      B: { name: "Falcons", players: [{ id: priya.id, name: priya.name }, { id: sneha.id, name: sneha.name }] } },
    { A: 14, B: 11 }, null, arjun
  );

  // Completed cricket match (linked to Arjun's cricket booking)
  const mCriCompleted = await ensureMatch(
    bArjunCriCompleted.id, "cricket", "T10", 6, venuePhoenix, daysAgo(5),
    "completed",
    { A: { name: "Phoenix XI",  players: [{ id: arjun.id, name: arjun.name }, { id: vikram.id, name: vikram.name }] },
      B: { name: "Challengers", players: [{ id: priya.id, name: priya.name }, { id: sneha.id, name: sneha.name }] } },
    { A: 98, B: 76 }, "A", arjun
  );

  // Completed football match
  const mFootCompleted = await ensureMatch(
    null, "football", "5-a-side", 5, venueCity, daysAgo(8),
    "completed",
    { A: { name: "City FC", players: [{ id: priya.id, name: priya.name }] },
      B: { name: "United",  players: [{ id: rohit.id, name: rohit.name  }] } },
    { A: 3, B: 2 }, "A", priya
  );

  // Completed tennis match
  const mTenCompleted = await ensureMatch(
    null, "tennis", "Singles", 1, venueElite, daysAgo(6),
    "completed",
    { A: { name: "Sneha Patil", players: [{ id: sneha.id, name: sneha.name }] },
      B: { name: "Vikram Nair", players: [{ id: vikram.id, name: vikram.name }] } },
    { A: 6, B: 4 }, "A", sneha
  );

  // Another scheduled badminton match
  await ensureMatch(
    bArjunTenUpcoming.id, "tennis", "Singles", 1, venueElite, daysFromNow(5),
    "scheduled",
    { A: { name: "Arjun Mehta", players: [{ id: arjun.id, name: arjun.name }] },
      B: { name: "Rohit Das",   players: [{ id: rohit.id,  name: rohit.name  }] } },
    { A: 0, B: 0 }, null, arjun
  );

  // Completed pickleball match
  await ensureMatch(
    null, "pickleball", "Doubles", 2, venuePickleball, daysAgo(4),
    "completed",
    { A: { name: "Arjun & Priya", players: [{ id: arjun.id, name: arjun.name }, { id: priya.id, name: priya.name }] },
      B: { name: "Vikram & Sneha", players: [{ id: vikram.id, name: vikram.name }, { id: sneha.id, name: sneha.name }] } },
    { A: 2, B: 1 }, "A", arjun
  );

  // Live pickleball singles match
  await ensureMatch(
    null, "pickleball", "Singles", 1, venuePickleball, new Date(),
    "scheduled",
    { A: { name: "Rohit Das",  players: [{ id: rohit.id,  name: rohit.name  }] },
      B: { name: "Vikram Nair", players: [{ id: vikram.id, name: vikram.name }] } },
    { A: 0, B: 0 }, null, rohit
  );

  // Completed padel doubles match
  const mPadelCompleted = await ensureMatch(
    null, "padel", "Doubles", 2, venuePadel, daysAgo(4),
    "completed",
    { A: { name: "Arjun & Priya",  players: [{ id: arjun.id, name: arjun.name }, { id: priya.id, name: priya.name }] },
      B: { name: "Vikram & Sneha", players: [{ id: vikram.id, name: vikram.name }, { id: sneha.id, name: sneha.name }] } },
    { setsWon: { A: 2, B: 1 }, completedSets: [{ A: 6, B: 4 }, { A: 3, B: 6 }, { A: 6, B: 3 }] },
    "A", arjun
  );

  // Upcoming scheduled padel singles match (linked to Arjun's padel booking)
  await ensureMatch(
    bArjunPadelUpcoming.id, "padel", "Singles", 1, venuePadel, daysFromNow(3),
    "scheduled",
    { A: { name: "Arjun Mehta", players: [{ id: arjun.id, name: arjun.name }] },
      B: { name: "Rohit Das",   players: [{ id: rohit.id,  name: rohit.name  }] } },
    { A: 0, B: 0 }, null, arjun
  );

  // Match events for the live match
  const eventsExist = await prisma.matchEvent.findFirst({ where: { matchId: mLive.id } });
  if (!eventsExist) {
    const eventDefs = [
      { team: "A", playerId: arjun.id,  eventType: "point", eventValue: 1 },
      { team: "B", playerId: priya.id,  eventType: "point", eventValue: 1 },
      { team: "A", playerId: vikram.id, eventType: "point", eventValue: 1 },
      { team: "A", playerId: arjun.id,  eventType: "point", eventValue: 1 },
      { team: "B", playerId: sneha.id,  eventType: "point", eventValue: 1 },
    ];
    for (const e of eventDefs) {
      await prisma.matchEvent.create({
        data: { matchId: mLive.id, ...e },
      });
    }
  }
  console.log("  ✓ Matches + events");

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PLAYER STATS (feeds StatsOverview, SportDashboard, Leaderboard)
  // ─────────────────────────────────────────────────────────────────────────
  const statsData: Array<{ player: typeof arjun; sport: string; total: number; won: number }> = [
    { player: arjun,   sport: "badminton",  total: 18, won: 12 },
    { player: arjun,   sport: "cricket",    total: 9,  won: 6  },
    { player: arjun,   sport: "tennis",     total: 6,  won: 3  },
    { player: priya,   sport: "badminton",  total: 14, won: 9  },
    { player: priya,   sport: "football",   total: 11, won: 8  },
    { player: priya,   sport: "cricket",    total: 5,  won: 2  },
    { player: vikram,  sport: "badminton",  total: 20, won: 14 },
    { player: vikram,  sport: "tennis",     total: 8,  won: 5  },
    { player: sneha,   sport: "tennis",     total: 12, won: 9  },
    { player: sneha,   sport: "badminton",  total: 7,  won: 4  },
    { player: rohit,   sport: "football",   total: 15, won: 10 },
    { player: rohit,   sport: "cricket",    total: 10, won: 7  },
    { player: coach,   sport: "badminton",  total: 22, won: 17 },
    { player: arjun,   sport: "pickleball", total: 10, won: 7  },
    { player: priya,   sport: "pickleball", total: 8,  won: 5  },
    { player: vikram,  sport: "pickleball", total: 6,  won: 4  },
    { player: sneha,   sport: "pickleball", total: 5,  won: 3  },
    { player: arjun,   sport: "padel",      total: 8,  won: 5  },
    { player: priya,   sport: "padel",      total: 7,  won: 4  },
    { player: vikram,  sport: "padel",      total: 6,  won: 3  },
    { player: sneha,   sport: "padel",      total: 5,  won: 3  },
    { player: rohit,   sport: "padel",      total: 4,  won: 2  },
  ];

  for (const s of statsData) {
    const exists = await prisma.playerStats.findUnique({
      where: { playerId_sport: { playerId: s.player.id, sport: s.sport } },
    });
    if (!exists) {
      const lost = s.total - s.won;
      await prisma.playerStats.create({
        data: {
          playerId: s.player.id,
          sportId: sports[s.sport].id,
          sport: s.sport,
          totalMatches: s.total,
          matchesWon: s.won,
          matchesLost: lost,
          winPercentage: +((s.won / s.total) * 100).toFixed(1),
        },
      });
    }
  }
  console.log("  ✓ Player stats (leaderboard data)");

  // ─────────────────────────────────────────────────────────────────────────
  // 8. OPEN PLAY SESSIONS
  // ─────────────────────────────────────────────────────────────────────────
  interface OpenPlaySpec {
    user: typeof priya;
    venue: typeof venueCity;
    fac: { id: number; name: string };
    sport: string;
    format: string;
    ppt: number;
    max: number;
    title: string;
    date: Date;
    start: string;
    end: string;
    status: string;
    joiners: Array<typeof arjun>;
  }

  async function ensureOpenPlay(spec: OpenPlaySpec) {
    const subtotal = 1500 * 1.5;
    const gst = +(subtotal * 0.18).toFixed(2);
    const total = +(subtotal + gst).toFixed(2);

    // Find any existing open play for this user+venue+sport+title combination
    const existingOp = await prisma.openPlay.findFirst({
      where: { createdById: spec.user.id, venueId: spec.venue.id, title: spec.title },
      include: { booking: true },
    });

    const now = new Date();

    if (existingOp) {
      const sessionDate = new Date(existingOp.bookingDate);
      const isPast = sessionDate < now && spec.status !== "completed";

      if (isPast) {
        // Refresh the date to keep the session in the future
        await prisma.openPlay.update({
          where: { id: existingOp.id },
          data: { bookingDate: spec.date, status: spec.status },
        });
        await prisma.booking.update({
          where: { id: existingOp.bookingId },
          data: { bookingDate: spec.date },
        });
      }

      // Ensure all joiners are added
      const hostJoined = await prisma.openPlayPlayer.findUnique({
        where: { openPlayId_userId: { openPlayId: existingOp.id, userId: spec.user.id } },
      });
      if (!hostJoined) {
        await prisma.openPlayPlayer.create({ data: { openPlayId: existingOp.id, userId: spec.user.id } });
      }
      for (const joiner of spec.joiners) {
        const joined = await prisma.openPlayPlayer.findUnique({
          where: { openPlayId_userId: { openPlayId: existingOp.id, userId: joiner.id } },
        });
        if (!joined) {
          await prisma.openPlayPlayer.create({ data: { openPlayId: existingOp.id, userId: joiner.id } });
        }
      }
      return existingOp;
    }

    // Create a fresh booking + open play session
    const bk = await prisma.booking.create({
      data: {
        userId: spec.user.id,
        createdById: spec.user.id,
        bookingType: "open_play",
        venueId: spec.venue.id,
        sport: spec.sport,
        sportId: sports[spec.sport].id,
        facilityId: spec.fac.id,
        facilityName: spec.fac.name,
        bookingDate: spec.date,
        startTime: spec.start,
        endTime: spec.end,
        totalHours: 1.5,
        subtotal,
        gstRate: 18,
        gstAmount: gst,
        totalAmount: total,
        paymentStatus: "paid",
        paidAmount: total,
        status: "confirmed",
      },
    });

    const op = await prisma.openPlay.create({
      data: {
        bookingId: bk.id,
        venueId: spec.venue.id,
        sport: spec.sport,
        sportId: sports[spec.sport].id,
        formatName: spec.format,
        playersPerTeam: spec.ppt,
        maxPlayers: spec.max,
        createdById: spec.user.id,
        facilityId: spec.fac.id,
        facilityName: spec.fac.name,
        title: spec.title,
        status: spec.status,
        bookingDate: spec.date,
        startTime: spec.start,
        endTime: spec.end,
      },
    });

    // Add host as first player
    await prisma.openPlayPlayer.create({ data: { openPlayId: op.id, userId: spec.user.id } });

    for (const joiner of spec.joiners) {
      await prisma.openPlayPlayer.create({ data: { openPlayId: op.id, userId: joiner.id } });
    }
    return op;
  }

  // 1 — Open session, room for 4 more
  await ensureOpenPlay({
    user: priya, venue: venueCity, fac: cityFacFoot, sport: "football",
    format: "5-a-side", ppt: 5, max: 10,
    title: "Casual Football — Tomorrow Evening",
    date: daysFromNow(1), start: "17:00", end: "18:30",
    status: "open", joiners: [arjun, vikram],
  });

  // 2 — Almost full badminton (only 2 spots left)
  await ensureOpenPlay({
    user: arjun, venue: venueElite, fac: eliteFacBad, sport: "badminton",
    format: "Doubles", ppt: 2, max: 4,
    title: "Quick Doubles — Sunday Morning",
    date: daysFromNow(3), start: "09:00", end: "10:30",
    status: "open", joiners: [priya, vikram],
  });

  // 3 — Cricket session open next week
  await ensureOpenPlay({
    user: vikram, venue: venuePhoenix, fac: phoenixFacCri, sport: "cricket",
    format: "T10", ppt: 6, max: 12,
    title: "T10 Cricket — Weekend Blast",
    date: daysFromNow(6), start: "08:00", end: "10:00",
    status: "open", joiners: [arjun, rohit],
  });

  // 4 — Open tennis session, arjun NOT yet joined (good for testing join flow)
  await ensureOpenPlay({
    user: vikram, venue: venueElite, fac: eliteFacBad, sport: "tennis",
    format: "Singles", ppt: 1, max: 4,
    title: "Tennis Singles — Open Court",
    date: daysFromNow(2), start: "07:00", end: "08:30",
    status: "open", joiners: [sneha],
  });

  // 5 — Completed past session
  await ensureOpenPlay({
    user: sneha, venue: venueCity, fac: cityFacFoot, sport: "football",
    format: "5-a-side", ppt: 5, max: 10,
    title: "Weekend Football — Last Saturday",
    date: daysAgo(7), start: "16:00", end: "17:30",
    status: "completed", joiners: [arjun, priya, vikram, rohit],
  });

  // 6 — Pickleball open doubles session
  await ensureOpenPlay({
    user: arjun, venue: venuePickleball, fac: venuePickleball.facilities[0], sport: "pickleball",
    format: "Doubles", ppt: 2, max: 8,
    title: "Pickleball Doubles — Morning Rally",
    date: daysFromNow(2), start: "07:00", end: "08:30",
    status: "open", joiners: [priya],
  });

  // 7 — Pickleball doubles (almost full)
  await ensureOpenPlay({
    user: vikram, venue: venuePickleball, fac: venuePickleball.facilities[0], sport: "pickleball",
    format: "Doubles", ppt: 2, max: 4,
    title: "Pickleball Doubles — Weekend",
    date: daysFromNow(4), start: "09:00", end: "10:30",
    status: "open", joiners: [sneha, priya],
  });

  // 8 — Padel doubles open session (new partners welcome)
  await ensureOpenPlay({
    user: arjun, venue: venuePadel, fac: padelFacCourt1, sport: "padel",
    format: "Doubles", ppt: 2, max: 4,
    title: "Padel Doubles — Weekend Knock",
    date: daysFromNow(5), start: "08:00", end: "09:30",
    status: "open", joiners: [priya],
  });

  // 9 — Padel mixed doubles session (almost full)
  await ensureOpenPlay({
    user: sneha, venue: venuePadel, fac: padelFacCourt2, sport: "padel",
    format: "Doubles", ppt: 2, max: 4,
    title: "Padel Doubles — Evening Social",
    date: daysFromNow(2), start: "18:00", end: "19:30",
    status: "open", joiners: [vikram, rohit],
  });

  console.log("  ✓ Open Play sessions + players");

  // ─────────────────────────────────────────────────────────────────────────
  // 9. TRAINING BATCHES + SESSIONS + ATTENDANCE + PAYMENTS + ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  async function ensureBatch(
    trainer: typeof coach,
    venuRow: typeof venueElite,
    name: string,
    sport: string,
    skillLevel: string | null,
    schedule: object,
    capacity: number,
    monthlyFee: number,
    description: string
  ) {
    let batch = await prisma.batch.findFirst({ where: { trainerId: trainer.id, name } });
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          trainerId: trainer.id,
          name,
          description,
          venueId: venuRow.id,
          sport,
          sportId: sports[sport].id,
          capacity,
          joinType: "instant",
          schedule,
          sportFees: [{ sport, monthlyFee }],
          isActive: true,
        },
      });
    }
    return batch;
  }

  // Coach 1 — Badminton batches
  const batchBeginnerBad = await ensureBatch(
    coach, venueSunrise, "Beginner Badminton Batch — Morning", "badminton", "beginner",
    { days: ["Tue", "Thu", "Sat"], startTime: "06:00", endTime: "07:30" }, 10, 2500,
    "Perfect for those picking up a racket for the first time. Learn the basics of grip, serve, and court movement."
  );
  const batchIntermBad = await ensureBatch(
    coach, venueSunrise, "Intermediate Badminton Batch — Morning", "badminton", "intermediate",
    { days: ["Mon", "Wed", "Fri"], startTime: "06:30", endTime: "08:00" }, 12, 3500,
    "For players who know the basics and want to sharpen their game. Focus on footwork, net play and match strategy."
  );
  const batchAdvBad = await ensureBatch(
    coach, venueElite, "Advanced Badminton — Evening", "badminton", "advanced",
    { days: ["Mon", "Wed", "Fri"], startTime: "18:00", endTime: "19:30" }, 8, 5000,
    "High-intensity sessions for competitive players. Tournament preparation, video analysis and match simulations."
  );

  // Coach 2 — Football + Basketball batches
  const batchFootball = await ensureBatch(
    coach2, venueCity, "Youth Football Academy", "football", "beginner",
    { days: ["Sat", "Sun"], startTime: "07:00", endTime: "09:00" }, 20, 3000,
    "Skill development for young footballers aged 10–18. Dribbling, passing, positioning and small-sided games."
  );
  const batchBasketball = await ensureBatch(
    coach2, venueCity, "Basketball Fundamentals", "basketball", "beginner",
    { days: ["Tue", "Thu"], startTime: "17:00", endTime: "18:30" }, 15, 2800,
    "Learn the fundamentals of basketball — dribbling, shooting, defense and team play."
  );

  // Coach 1 — Pickleball batch at the new Pickleball Hub
  const batchPickleball = await ensureBatch(
    coach, venuePickleball, "Pickleball Beginners Clinic", "pickleball", "beginner",
    { days: ["Sat", "Sun"], startTime: "07:00", endTime: "08:30" }, 12, 2200,
    "New to pickleball? This clinic covers the dink, serve, third-shot drop and kitchen rules in a fun, structured environment."
  );

  // Coach 1 — Padel batch at the Padel Club
  const batchPadel = await ensureBatch(
    coach, venuePadel, "Padel Beginners Clinic", "padel", "beginner",
    { days: ["Sat", "Sun"], startTime: "08:30", endTime: "10:00" }, 10, 2500,
    "New to padel? Learn the enclosed-court rules, wall play, scoring and doubles positioning in a friendly structured environment."
  );

  // Memberships
  const membershipDefs: Array<{
    batch: typeof batchIntermBad; player: typeof arjun;
    status: string; paymentStatus: string;
  }> = [
    { batch: batchBeginnerBad,  player: sneha,   status: "active",    paymentStatus: "paid" },
    { batch: batchIntermBad,    player: arjun,   status: "active",    paymentStatus: "paid" },
    { batch: batchIntermBad,    player: priya,   status: "active",    paymentStatus: "paid" },
    { batch: batchAdvBad,       player: vikram,  status: "active",    paymentStatus: "paid" },
    { batch: batchAdvBad,       player: arjun,   status: "active",    paymentStatus: "paid" },
    { batch: batchFootball,     player: priya,   status: "active",    paymentStatus: "paid" },
    { batch: batchFootball,     player: rohit,   status: "active",    paymentStatus: "paid" },
    { batch: batchBasketball,   player: vikram,  status: "pending",   paymentStatus: "pending" },
    { batch: batchBeginnerBad,  player: rohit,   status: "active",    paymentStatus: "paid" },
    { batch: batchPickleball,   player: arjun,   status: "active",    paymentStatus: "paid" },
    { batch: batchPickleball,   player: priya,   status: "active",    paymentStatus: "paid" },
    { batch: batchPickleball,   player: rohit,   status: "active",    paymentStatus: "paid" },
    { batch: batchPadel,        player: arjun,   status: "active",    paymentStatus: "paid" },
    { batch: batchPadel,        player: priya,   status: "active",    paymentStatus: "paid" },
    { batch: batchPadel,        player: sneha,   status: "active",    paymentStatus: "paid" },
    { batch: batchPadel,        player: vikram,  status: "pending",   paymentStatus: "pending" },
  ];
  for (const m of membershipDefs) {
    const exists = await prisma.batchMembership.findUnique({
      where: { batchId_playerId: { batchId: m.batch.id, playerId: m.player.id } },
    });
    if (!exists) {
      await prisma.batchMembership.create({
        data: { batchId: m.batch.id, playerId: m.player.id, status: m.status, paymentStatus: m.paymentStatus },
      });
    }
  }

  // Sessions — 4 past + 2 upcoming per batch
  async function ensureSessions(batch: typeof batchIntermBad) {
    const pastDates   = [daysAgo(14), daysAgo(12), daysAgo(7), daysAgo(5), daysAgo(2)];
    const futureDates = [daysFromNow(2), daysFromNow(5)];
    const allDates    = [...pastDates, ...futureDates];
    const sessions: typeof batchIntermBad[] = [];

    for (const d of allDates) {
      const existing = await prisma.batchSession.findFirst({
        where: { batchId: batch.id, date: d },
      });
      if (!existing) {
        const sched = batch.schedule as { startTime: string; endTime: string } | null;
        const s = await prisma.batchSession.create({
          data: {
            batchId: batch.id,
            date: d,
            startTime: sched?.startTime ?? "06:30",
            endTime: sched?.endTime ?? "08:00",
            status: d < new Date() ? "completed" : "scheduled",
          },
        });
        sessions.push(s as unknown as typeof batchIntermBad);
      } else {
        sessions.push(existing as unknown as typeof batchIntermBad);
      }
    }
    return sessions;
  }

  const sessionsInterm     = await ensureSessions(batchIntermBad);
  const sessionsAdv        = await ensureSessions(batchAdvBad);
  const sessionsBeg        = await ensureSessions(batchBeginnerBad);
  const sessionsPickleball = await ensureSessions(batchPickleball);
  const sessionsPadel      = await ensureSessions(batchPadel);

  // Attendance for past sessions
  type SessionRow = { id: number; date: Date };

  async function markAttendance(sessions: SessionRow[], player: typeof arjun, presentIndices: number[]) {
    for (let i = 0; i < sessions.length; i++) {
      const sess = sessions[i];
      if (sess.date > new Date()) continue;
      const exists = await prisma.sessionAttendance.findUnique({
        where: { sessionId_playerId: { sessionId: sess.id, playerId: player.id } },
      });
      if (!exists) {
        await prisma.sessionAttendance.create({
          data: {
            sessionId: sess.id,
            playerId: player.id,
            status: presentIndices.includes(i) ? "present" : "absent",
          },
        });
      }
    }
  }

  await markAttendance(sessionsInterm     as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsInterm     as unknown as SessionRow[], priya,  [0,1,3,4]);
  await markAttendance(sessionsAdv        as unknown as SessionRow[], vikram, [0,1,2,3,4]);
  await markAttendance(sessionsAdv        as unknown as SessionRow[], arjun,  [0,2,3,4]);
  await markAttendance(sessionsBeg        as unknown as SessionRow[], sneha,  [0,1,2,4]);
  await markAttendance(sessionsBeg        as unknown as SessionRow[], rohit,  [0,1,3,4]);
  await markAttendance(sessionsPickleball as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsPickleball as unknown as SessionRow[], priya,  [0,1,2,4]);
  await markAttendance(sessionsPickleball as unknown as SessionRow[], rohit,  [0,2,3,4]);
  await markAttendance(sessionsPadel     as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsPadel     as unknown as SessionRow[], priya,  [0,1,3,4]);
  await markAttendance(sessionsPadel     as unknown as SessionRow[], sneha,  [0,2,3,4]);

  // Batch payments (TrainerPayments + BatchDetail payments tab)
  const now = new Date();
  const paymentDefs: Array<{
    batch: typeof batchIntermBad; player: typeof arjun;
    month: number; year: number; amount: number; status: string;
  }> = [
    { batch: batchIntermBad,   player: arjun,  month: now.getMonth(),     year: now.getFullYear(), amount: 3500, status: "completed" },
    { batch: batchIntermBad,   player: priya,  month: now.getMonth(),     year: now.getFullYear(), amount: 3500, status: "completed" },
    { batch: batchIntermBad,   player: arjun,  month: now.getMonth() - 1, year: now.getFullYear(), amount: 3500, status: "completed" },
    { batch: batchAdvBad,      player: vikram, month: now.getMonth(),     year: now.getFullYear(), amount: 5000, status: "completed" },
    { batch: batchAdvBad,      player: arjun,  month: now.getMonth(),     year: now.getFullYear(), amount: 5000, status: "pending" },
    { batch: batchFootball,    player: priya,  month: now.getMonth(),     year: now.getFullYear(), amount: 3000, status: "completed" },
    { batch: batchFootball,    player: rohit,  month: now.getMonth(),     year: now.getFullYear(), amount: 3000, status: "pending" },
    { batch: batchBeginnerBad, player: sneha,  month: now.getMonth(),     year: now.getFullYear(), amount: 2500, status: "completed" },
    { batch: batchPickleball,  player: arjun,  month: now.getMonth(),     year: now.getFullYear(), amount: 2200, status: "completed" },
    { batch: batchPickleball,  player: priya,  month: now.getMonth(),     year: now.getFullYear(), amount: 2200, status: "completed" },
    { batch: batchPickleball,  player: rohit,  month: now.getMonth(),     year: now.getFullYear(), amount: 2200, status: "pending"   },
    { batch: batchPadel,       player: arjun,  month: now.getMonth(),     year: now.getFullYear(), amount: 2500, status: "completed" },
    { batch: batchPadel,       player: priya,  month: now.getMonth(),     year: now.getFullYear(), amount: 2500, status: "completed" },
    { batch: batchPadel,       player: sneha,  month: now.getMonth(),     year: now.getFullYear(), amount: 2500, status: "completed" },
    { batch: batchPadel,       player: vikram, month: now.getMonth(),     year: now.getFullYear(), amount: 2500, status: "pending"   },
  ];

  for (const p of paymentDefs) {
    const exists = await prisma.batchPayment.findFirst({
      where: { batchId: p.batch.id, playerId: p.player.id, cycleMonth: p.month, cycleYear: p.year },
    });
    if (!exists) {
      await prisma.batchPayment.create({
        data: {
          batchId: p.batch.id,
          playerId: p.player.id,
          payerId: p.player.id,
          cycleMonth: p.month,
          cycleYear: p.year,
          amount: p.amount,
          trainerNetAmount: +(p.amount * 0.9).toFixed(2),
          platformCommissionPercent: 10,
          platformCommissionAmount: +(p.amount * 0.1).toFixed(2),
          status: p.status,
          paymentMode: "online",
        },
      });
    }
  }

  // Batch announcements (BatchDetail announcements tab)
  const announcementDefs: Array<{ batch: typeof batchIntermBad; trainer: typeof coach; msg: string }> = [
    { batch: batchIntermBad,   trainer: coach,  msg: "This Friday's session is moved to 7:00 AM due to a court booking conflict. Please plan accordingly." },
    { batch: batchIntermBad,   trainer: coach,  msg: "Great progress everyone! We will start match simulations from next week. Please bring extra shuttlecocks." },
    { batch: batchAdvBad,      trainer: coach,  msg: "State tournament registrations open. Interested players please confirm by Thursday." },
    { batch: batchAdvBad,      trainer: coach,  msg: "Video analysis session scheduled for Saturday 8 AM. Please review last week's match recordings beforehand." },
    { batch: batchFootball,    trainer: coach2, msg: "New drill equipment has arrived! We'll introduce ladder drills and agility cones from next session." },
    { batch: batchBasketball,  trainer: coach2, msg: "First inter-batch scrimmage on Sunday. Both basketball batches will compete. Gear up!" },
    { batch: batchPickleball,  trainer: coach,  msg: "We'll be focusing on the third-shot drop this weekend. Please arrive 10 minutes early to warm up." },
    { batch: batchPickleball,  trainer: coach,  msg: "Paddles and pickleballs are available for loan in the pro shop. Beginners don't need to buy their own gear yet!" },
    { batch: batchPadel,       trainer: coach,  msg: "Welcome to the Padel Beginners Clinic! Rackets are available for loan. First session covers court rules, scoring and the basics of the serve." },
    { batch: batchPadel,       trainer: coach,  msg: "This weekend we'll practise the bandeja (overhead lob) and basic wall play. Watch the reference video I sent on WhatsApp before Saturday." },
  ];

  for (const a of announcementDefs) {
    const exists = await prisma.batchAnnouncement.findFirst({
      where: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
    });
    if (!exists) {
      await prisma.batchAnnouncement.create({
        data: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
      });
    }
  }
  console.log("  ✓ Batches + sessions + attendance + payments + announcements");

  // ─────────────────────────────────────────────────────────────────────────
  // 10. TRAINER REVIEWS
  // ─────────────────────────────────────────────────────────────────────────
  const trainerReviewDefs: Array<{
    author: typeof arjun; trainer: typeof coach; rating: number; review: string;
  }> = [
    { author: arjun,   trainer: coach,  rating: 5, review: "Rahul is an exceptional coach. His attention to technique and footwork improved my game significantly within just a month." },
    { author: priya,   trainer: coach,  rating: 5, review: "Brilliant coach! Very patient with beginners but also pushes advanced players hard. Highly recommend." },
    { author: vikram,  trainer: coach,  rating: 4, review: "Great sessions, very methodical approach. Would love more match simulation time." },
    { author: sneha,   trainer: coach,  rating: 5, review: "The best badminton coach in Pune! Joined as an intermediate and now competing at district level." },
    { author: priya,   trainer: coach2, rating: 4, review: "Meera is very energetic and motivating. The football drills are fun and effective." },
    { author: rohit,   trainer: coach2, rating: 5, review: "Fantastic football coach. Really understands tactical positioning and has improved my game a lot." },
  ];

  for (const r of trainerReviewDefs) {
    const trainerProfileRow = await prisma.trainerProfile.findUnique({ where: { userId: r.trainer.id } });
    const exists = await prisma.trainerReview.findUnique({
      where: { trainerId_userId: { trainerId: r.trainer.id, userId: r.author.id } },
    });
    if (!exists) {
      await prisma.trainerReview.create({
        data: {
          userId: r.author.id,
          trainerId: r.trainer.id,
          trainerProfileId: trainerProfileRow?.id,
          rating: r.rating,
          review: r.review,
        },
      });
    }
  }
  console.log("  ✓ Trainer reviews");

  // ─────────────────────────────────────────────────────────────────────────
  // 11. VENUE REVIEWS
  // ─────────────────────────────────────────────────────────────────────────
  const venueReviewDefs: Array<{
    venue: typeof venueElite; user: typeof arjun; rating: number; review: string;
  }> = [
    { venue: venueElite,   user: arjun,   rating: 5, review: "Top-notch courts, great lighting for evening sessions. The synthetic surface is excellent and well-maintained." },
    { venue: venueElite,   user: priya,   rating: 4, review: "Excellent facility with multiple sport options. Parking can be tight during peak hours." },
    { venue: venueElite,   user: vikram,  rating: 5, review: "Best badminton courts in Pune. Proper BWF-standard synthetic floor. Worth every rupee." },
    { venue: venuePhoenix, user: arjun,   rating: 4, review: "Great cricket ground. The pitch could be better maintained but the overall experience is very good." },
    { venue: venuePhoenix, user: rohit,   rating: 4, review: "Good facility for cricket practice. Floodlights are great for evening sessions." },
    { venue: venueCity,    user: priya,   rating: 4, review: "Very convenient location near FC Road. Multiple sports available and friendly staff." },
    { venue: venueCity,    user: sneha,   rating: 3, review: "Decent courts but changing rooms need an upgrade. Location is the main plus." },
    { venue: venueSunrise, user: arjun,   rating: 5, review: "Quiet, focused environment for badminton practice. Coach Rahul's classes here are excellent." },
    { venue: venueSunrise, user: sneha,   rating: 5, review: "Love this centre! Clean courts, professional coaching and great atmosphere." },
  ];

  for (const r of venueReviewDefs) {
    const exists = await prisma.venueReview.findUnique({
      where: { venueId_userId: { venueId: r.venue.id, userId: r.user.id } },
    });
    if (!exists) {
      await prisma.venueReview.create({
        data: { venueId: r.venue.id, userId: r.user.id, rating: r.rating, review: r.review },
      });
    }
  }

  // Directory ratings from Nashik pickleball / cricket spreadsheets
  for (const nd of nashikVenueDefs) {
    const row = venueRows.find((vr) => vr.name === nd.name);
    if (!row) continue;
    const exists = await prisma.venueReview.findUnique({
      where: { venueId_userId: { venueId: row.id, userId: arjun.id } },
    });
    if (!exists) {
      await prisma.venueReview.create({
        data: {
          venueId: row.id,
          userId: arjun.id,
          rating: Math.min(5, Math.max(1, Math.round(nd.seedRating))),
          review: `Nashik venue directory (${nd.externalId}). ${nd.seedReviewCount} reviews on Google Maps.`,
        },
      });
    }
  }
  console.log("  ✓ Venue reviews");

  // ─────────────────────────────────────────────────────────────────────────
  // 12. TOURNAMENTS + FIXTURES
  // ─────────────────────────────────────────────────────────────────────────
  // --- Tournament 1: Upcoming badminton cup ---
  const tUpcomingExists = await prisma.tournament.findFirst({ where: { name: "Sportza Badminton Cup 2026" } });
  if (!tUpcomingExists) {
    await prisma.tournament.create({
      data: {
        name: "Sportza Badminton Cup 2026",
        description: "Open singles & doubles tournament. All levels welcome. Prizes for top 3 in each category.",
        sport: "badminton",
        sportId: sports["badminton"].id,
        format: "league",
        venueId: venueElite.id,
        createdById: arjun.id,
        maxTeams: 16,
        status: "upcoming",
        startDate: daysFromNow(7),
        endDate: daysFromNow(9),
        teams: [
          { name: "Arjun Mehta",  players: [arjun.id]  },
          { name: "Priya Sharma", players: [priya.id]  },
          { name: "Vikram Nair",  players: [vikram.id] },
          { name: "Sneha Patil",  players: [sneha.id]  },
          { name: "Rahul Sinha",  players: [coach.id]  },
        ],
      },
    });
  }

  // --- Tournament 2: Ongoing cricket tournament with fixtures and standings ---
  let tCricket = await prisma.tournament.findFirst({ where: { name: "Pune Premier Cricket League" } });
  if (!tCricket) {
    tCricket = await prisma.tournament.create({
      data: {
        name: "Pune Premier Cricket League",
        description: "A 6-team round-robin T10 cricket tournament for amateur players. Top 2 teams advance to the final.",
        sport: "cricket",
        sportId: sports["cricket"].id,
        format: "league",
        venueId: venuePhoenix.id,
        createdById: arjun.id,
        maxTeams: 6,
        status: "ongoing",
        startDate: daysAgo(3),
        endDate: daysFromNow(4),
        teams: [
          { id: "t1", name: "Phoenix XI",    players: [arjun.id, vikram.id]  },
          { id: "t2", name: "Challengers",   players: [priya.id, sneha.id]  },
          { id: "t3", name: "Strike Force",  players: [rohit.id]            },
          { id: "t4", name: "Royal Smash",   players: [coach.id]            },
        ],
      },
    });
  }

  // Fixtures for ongoing tournament
  const fixturesDefs: Array<{
    round: number; matchOrder: number;
    team1: object; team2: object;
    matchId: number | null; status: string;
  }> = [
    { round: 1, matchOrder: 1, team1: { name: "Phoenix XI" },   team2: { name: "Challengers" },  matchId: mCriCompleted.id, status: "completed" },
    { round: 1, matchOrder: 2, team1: { name: "Strike Force" }, team2: { name: "Royal Smash" },  matchId: null, status: "completed" },
    { round: 2, matchOrder: 1, team1: { name: "Phoenix XI" },   team2: { name: "Strike Force" }, matchId: null, status: "pending" },
    { round: 2, matchOrder: 2, team1: { name: "Challengers" },  team2: { name: "Royal Smash" },  matchId: null, status: "pending" },
  ];

  for (const f of fixturesDefs) {
    const exists = await prisma.tournamentFixture.findFirst({
      where: { tournamentId: tCricket.id, round: f.round, matchOrder: f.matchOrder },
    });
    if (!exists) {
      await prisma.tournamentFixture.create({
        data: {
          tournamentId: tCricket.id,
          round: f.round,
          matchOrder: f.matchOrder,
          team1Type: "team",
          team1Ref: f.team1,
          team2Type: "team",
          team2Ref: f.team2,
          matchId: f.matchId ?? undefined,
          status: f.status,
        },
      });
    }
  }

  // --- Tournament 3: Upcoming pickleball tournament ---
  const tPickleballExists = await prisma.tournament.findFirst({ where: { name: "Pune Pickleball Open 2026" } });
  if (!tPickleballExists) {
    await prisma.tournament.create({
      data: {
        name: "Pune Pickleball Open 2026",
        description: "Open doubles pickleball tournament for all skill levels. Kitchen rules strictly enforced. Prizes for top 3 pairs.",
        sport: "pickleball",
        sportId: sports["pickleball"].id,
        format: "knockout",
        venueId: venuePickleball.id,
        createdById: arjun.id,
        maxTeams: 8,
        status: "upcoming",
        startDate: daysFromNow(10),
        endDate: daysFromNow(11),
        teams: [
          { name: "Arjun & Priya",   players: [arjun.id, priya.id]   },
          { name: "Vikram & Sneha",  players: [vikram.id, sneha.id]  },
          { name: "Rohit & Meera",   players: [rohit.id, coach2.id]  },
          { name: "Rahul & Partner", players: [coach.id]             },
        ],
      },
    });
  }

  // --- Tournament 4: Upcoming padel doubles tournament ---
  const tPadelExists = await prisma.tournament.findFirst({ where: { name: "Pune Padel Open 2026" } });
  if (!tPadelExists) {
    await prisma.tournament.create({
      data: {
        name: "Pune Padel Open 2026",
        description: "Open doubles padel tournament for all skill levels. Wall play rules strictly enforced. Prizes for top 3 pairs.",
        sport: "padel",
        sportId: sports["padel"].id,
        format: "knockout",
        venueId: venuePadel.id,
        createdById: arjun.id,
        maxTeams: 8,
        status: "upcoming",
        startDate: daysFromNow(12),
        endDate: daysFromNow(13),
        teams: [
          { name: "Arjun & Priya",  players: [arjun.id, priya.id]  },
          { name: "Vikram & Sneha", players: [vikram.id, sneha.id] },
          { name: "Rohit & Rahul",  players: [rohit.id, coach.id]  },
        ],
      },
    });
  }

  // --- Tournament 5: Completed football tournament ---
  const tFootExists = await prisma.tournament.findFirst({ where: { name: "City 5-a-Side Football Cup" } });
  if (!tFootExists) {
    await prisma.tournament.create({
      data: {
        name: "City 5-a-Side Football Cup",
        description: "Fast-paced 5-a-side knockout tournament. Competed over a single weekend.",
        sport: "football",
        sportId: sports["football"].id,
        format: "knockout",
        venueId: venueCity.id,
        createdById: priya.id,
        maxTeams: 8,
        status: "completed",
        startDate: daysAgo(14),
        endDate: daysAgo(13),
        winner: { name: "City FC", players: [priya.id] },
        runnerUp: { name: "United", players: [rohit.id] },
        teams: [
          { name: "City FC",     players: [priya.id]  },
          { name: "United",      players: [rohit.id]  },
          { name: "Strikers",    players: [arjun.id]  },
          { name: "Blazers",     players: [vikram.id] },
        ],
      },
    });
  }
  console.log("  ✓ Tournaments + fixtures");

  // Shared month helpers (used by sections 13 and 15)
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  function monthOffset(n: number): { month: number; year: number } {
    let m = currentMonth - n;
    let y = currentYear;
    while (m < 0) { m += 12; y -= 1; }
    return { month: m, year: y };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. EXTRA COACH DATA
  //     • 3 more batches (Tennis for Rahul; Advanced Football + Cricket for Meera)
  //     • Fills up existing batches with more students (incl. "left" churn)
  //     • Pending payments so TrainerPayments "Pending" tab is populated
  //     • More reviews across all star ratings for the distribution chart
  //     • More announcements across all batches
  // ─────────────────────────────────────────────────────────────────────────

  // ── 13a. New batches ──────────────────────────────────────────────────────
  const batchTennis = await ensureBatch(
    coach, venueElite, "Tennis Coaching — Intermediate", "tennis", "intermediate",
    { days: ["Mon", "Wed", "Fri"], startTime: "17:00", endTime: "18:30" }, 8, 4500,
    "Sharpen your groundstrokes, net game and match tactics. Suitable for players who can already rally."
  );

  const batchAdvFootball = await ensureBatch(
    coach2, venuePhoenix, "Advanced Football — Tactical Training", "football", "advanced",
    { days: ["Tue", "Thu", "Sat"], startTime: "17:00", endTime: "19:00" }, 12, 4000,
    "High-intensity tactical sessions: pressing, transitions, set-pieces and positional play for competitive players."
  );

  const batchCricket = await ensureBatch(
    coach2, venuePhoenix, "Cricket Batting Clinic", "cricket", "intermediate",
    { days: ["Sun"], startTime: "08:00", endTime: "10:30" }, 10, 3500,
    "Focused batting technique sessions — defence, drives, pulls and playing spin. Video analysis each session."
  );
  console.log("  ✓ 3 extra batches (Tennis / Adv. Football / Cricket)");

  // ── 13b. More memberships (fill up existing & new batches) ───────────────
  const extraMembershipDefs: Array<{
    batch: typeof batchTennis; player: typeof arjun; status: string; paymentStatus: string;
  }> = [
    // Fill existing batches — more active students
    { batch: batchBeginnerBad,  player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchBeginnerBad,  player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchIntermBad,    player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchIntermBad,    player: rohit,  status: "left",    paymentStatus: "paid"    },
    { batch: batchAdvBad,       player: priya,  status: "pending", paymentStatus: "pending" },
    { batch: batchAdvBad,       player: sneha,  status: "active",  paymentStatus: "paid"    },
    { batch: batchFootball,     player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchFootball,     player: vikram, status: "left",    paymentStatus: "paid"    },
    { batch: batchBasketball,   player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchBasketball,   player: priya,  status: "active",  paymentStatus: "paid"    },
    // New batches — initial cohort
    { batch: batchTennis,       player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchTennis,       player: sneha,  status: "active",  paymentStatus: "paid"    },
    { batch: batchTennis,       player: rohit,  status: "active",  paymentStatus: "paid"    },
    { batch: batchTennis,       player: priya,  status: "pending", paymentStatus: "pending" },
    { batch: batchAdvFootball,  player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAdvFootball,  player: priya,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAdvFootball,  player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchAdvFootball,  player: rohit,  status: "pending", paymentStatus: "pending" },
    { batch: batchCricket,      player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchCricket,      player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchCricket,      player: rohit,  status: "active",  paymentStatus: "paid"    },
    { batch: batchCricket,      player: sneha,  status: "pending", paymentStatus: "pending" },
  ];

  for (const m of extraMembershipDefs) {
    const exists = await prisma.batchMembership.findUnique({
      where: { batchId_playerId: { batchId: m.batch.id, playerId: m.player.id } },
    });
    if (!exists) {
      await prisma.batchMembership.create({
        data: { batchId: m.batch.id, playerId: m.player.id, status: m.status, paymentStatus: m.paymentStatus },
      });
    }
  }
  console.log("  ✓ Extra memberships (incl. left/pending churn)");

  // ── 13c. Sessions + attendance for the 3 new batches ─────────────────────
  const sessionsTennis       = await ensureSessions(batchTennis);
  const sessionsAdvFootball  = await ensureSessions(batchAdvFootball);
  const sessionsCricket      = await ensureSessions(batchCricket);

  await markAttendance(sessionsTennis      as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsTennis      as unknown as SessionRow[], sneha,  [0,1,3,4]);
  await markAttendance(sessionsTennis      as unknown as SessionRow[], rohit,  [0,2,3,4]);
  await markAttendance(sessionsAdvFootball as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsAdvFootball as unknown as SessionRow[], priya,  [0,1,2,4]);
  await markAttendance(sessionsAdvFootball as unknown as SessionRow[], vikram, [0,1,3,4]);
  await markAttendance(sessionsCricket     as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessionsCricket     as unknown as SessionRow[], vikram, [0,2,3,4]);
  await markAttendance(sessionsCricket     as unknown as SessionRow[], rohit,  [0,1,2,3]);
  console.log("  ✓ Sessions + attendance for new batches");

  // ── 13d. Payments for new batches (current month + 2 prior months) ────────
  const newBatchPaymentDefs: Array<{
    batch: typeof batchTennis; player: typeof arjun; monthsAgo: number; amount: number; status: string;
  }> = [
    // Tennis (Rahul) — current month
    { batch: batchTennis,      player: arjun,  monthsAgo: 0, amount: 4500, status: "completed" },
    { batch: batchTennis,      player: sneha,  monthsAgo: 0, amount: 4500, status: "completed" },
    { batch: batchTennis,      player: rohit,  monthsAgo: 0, amount: 4500, status: "completed" },
    { batch: batchTennis,      player: priya,  monthsAgo: 0, amount: 4500, status: "pending"   },
    // Tennis — prior month
    { batch: batchTennis,      player: arjun,  monthsAgo: 1, amount: 4500, status: "completed" },
    { batch: batchTennis,      player: sneha,  monthsAgo: 1, amount: 4500, status: "completed" },
    { batch: batchTennis,      player: rohit,  monthsAgo: 1, amount: 4500, status: "completed" },
    // Advanced Football (Meera) — current month
    { batch: batchAdvFootball, player: arjun,  monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAdvFootball, player: priya,  monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAdvFootball, player: vikram, monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAdvFootball, player: rohit,  monthsAgo: 0, amount: 4000, status: "pending"   },
    // Advanced Football — prior month
    { batch: batchAdvFootball, player: arjun,  monthsAgo: 1, amount: 4000, status: "completed" },
    { batch: batchAdvFootball, player: priya,  monthsAgo: 1, amount: 4000, status: "completed" },
    { batch: batchAdvFootball, player: vikram, monthsAgo: 1, amount: 4000, status: "completed" },
    // Cricket (Meera) — current month
    { batch: batchCricket,     player: arjun,  monthsAgo: 0, amount: 3500, status: "completed" },
    { batch: batchCricket,     player: vikram, monthsAgo: 0, amount: 3500, status: "completed" },
    { batch: batchCricket,     player: rohit,  monthsAgo: 0, amount: 3500, status: "completed" },
    { batch: batchCricket,     player: sneha,  monthsAgo: 0, amount: 3500, status: "pending"   },
    // Cricket — prior month
    { batch: batchCricket,     player: arjun,  monthsAgo: 1, amount: 3500, status: "completed" },
    { batch: batchCricket,     player: vikram, monthsAgo: 1, amount: 3500, status: "completed" },
    { batch: batchCricket,     player: rohit,  monthsAgo: 1, amount: 3500, status: "completed" },
    // Pending payments on existing batches (populate Pending tab)
    { batch: batchIntermBad,   player: vikram, monthsAgo: 0, amount: 3500, status: "pending"   },
    { batch: batchAdvBad,      player: sneha,  monthsAgo: 0, amount: 5000, status: "pending"   },
    { batch: batchBasketball,  player: arjun,  monthsAgo: 0, amount: 2800, status: "pending"   },
    { batch: batchBasketball,  player: priya,  monthsAgo: 0, amount: 2800, status: "pending"   },
  ];

  for (const p of newBatchPaymentDefs) {
    const { month, year } = monthOffset(p.monthsAgo);
    const exists = await prisma.batchPayment.findFirst({
      where: { batchId: p.batch.id, playerId: p.player.id, cycleMonth: month, cycleYear: year },
    });
    if (!exists) {
      await prisma.batchPayment.create({
        data: {
          batchId:                   p.batch.id,
          playerId:                  p.player.id,
          payerId:                   p.player.id,
          cycleMonth:                month,
          cycleYear:                 year,
          amount:                    p.amount,
          trainerNetAmount:          +(p.amount * 0.9).toFixed(2),
          platformCommissionPercent: 10,
          platformCommissionAmount:  +(p.amount * 0.1).toFixed(2),
          status:                    p.status,
          paymentMode:               "online",
        },
      });
    }
  }
  console.log("  ✓ Payments for new batches + pending payments on existing batches");

  // ── 13e. More trainer reviews (full rating distribution for both coaches) ──
  const extraReviewDefs: Array<{
    author: typeof arjun; trainer: typeof coach; rating: number; review: string;
  }> = [
    // Coach 1 (Rahul) — missing reviewers: rohit
    { author: rohit,  trainer: coach,  rating: 4, review: "Great badminton coaching. Rahul's drills are very structured and have helped my footwork a lot. Recommended!" },
    // Coach 2 (Meera) — missing reviewers: arjun, vikram, sneha
    { author: arjun,  trainer: coach2, rating: 5, review: "Meera's football sessions are top-notch. Her tactical understanding is excellent and she explains things clearly." },
    { author: vikram, trainer: coach2, rating: 4, review: "Very energetic and motivating sessions. Would appreciate more one-on-one drill time but overall great coaching." },
    { author: sneha,  trainer: coach2, rating: 3, review: "Good coach but the group size feels too large sometimes. Individual attention could be improved. Nice atmosphere though." },
  ];

  for (const r of extraReviewDefs) {
    const trainerProfileRow = await prisma.trainerProfile.findUnique({ where: { userId: r.trainer.id } });
    const exists = await prisma.trainerReview.findUnique({
      where: { trainerId_userId: { trainerId: r.trainer.id, userId: r.author.id } },
    });
    if (!exists) {
      await prisma.trainerReview.create({
        data: {
          userId:           r.author.id,
          trainerId:        r.trainer.id,
          trainerProfileId: trainerProfileRow?.id,
          rating:           r.rating,
          review:           r.review,
        },
      });
    }
  }
  console.log("  ✓ Extra trainer reviews (full star-rating distribution)");

  // ── 13f. More batch announcements ────────────────────────────────────────
  const extraAnnouncementDefs: Array<{ batch: typeof batchTennis; trainer: typeof coach; msg: string }> = [
    { batch: batchIntermBad,    trainer: coach,  msg: "Court maintenance at Sunrise next Tuesday — session shifted to Elite Sports Arena, Court B. Same time." },
    { batch: batchIntermBad,    trainer: coach,  msg: "Reminder: monthly fee for April is due by the 5th. Please pay via the app to avoid late charge." },
    { batch: batchAdvBad,       trainer: coach,  msg: "Congratulations to Vikram for qualifying for the district-level tournament! Full squad support this weekend." },
    { batch: batchBeginnerBad,  trainer: coach,  msg: "Great improvement in last week's footwork drills! Keep practising the split-step between every shot." },
    { batch: batchFootball,     trainer: coach2, msg: "Rain contingency: if pitch is waterlogged, we'll move to the indoor court at City Hub. Check WhatsApp by 6 AM." },
    { batch: batchFootball,     trainer: coach2, msg: "Sessions this month will include a friendly match against the Advanced batch on the last Saturday. Get ready!" },
    { batch: batchBasketball,   trainer: coach2, msg: "We're introducing video review sessions every second Thursday. Bring earphones to watch your own clips." },
    // New batch announcements
    { batch: batchTennis,       trainer: coach,  msg: "Welcome to the Intermediate Tennis Batch! First session: warm-up, baseline rally and serve mechanics. Bring two rackets if possible." },
    { batch: batchTennis,       trainer: coach,  msg: "We'll hold a mini-tournament on the last Friday of the month — singles round-robin. Sign up on the app." },
    { batch: batchAdvFootball,  trainer: coach2, msg: "Advanced batch — starting this week we'll drill the 4-3-3 high press structure. Watch the reference clip shared on WhatsApp." },
    { batch: batchAdvFootball,  trainer: coach2, msg: "Fitness test next session: shuttle runs and vertical jump. Results tracked for progress over the quarter." },
    { batch: batchCricket,      trainer: coach2, msg: "Welcome to the Cricket Batting Clinic! Bring your own bat and helmet. First session focuses on grip, stance and defensive play." },
    { batch: batchCricket,      trainer: coach2, msg: "We'll use the bowling machine from session 3 onwards. Pace from 80 to 120 km/h — builds reaction timing significantly." },
  ];

  for (const a of extraAnnouncementDefs) {
    const exists = await prisma.batchAnnouncement.findFirst({
      where: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
    });
    if (!exists) {
      await prisma.batchAnnouncement.create({
        data: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
      });
    }
  }

  // Link new coaches to new venue associations
  for (const [coachUser, venueRow] of [
    [coach,  venueElite],   // already exists, idempotent
    [coach2, venuePhoenix], // already exists, idempotent
  ] as Array<[typeof coach, typeof venueElite]>) {
    const tvExists = await prisma.trainerVenue.findUnique({
      where: { userId_venueId: { userId: coachUser.id, venueId: venueRow.id } },
    });
    if (!tvExists) {
      await prisma.trainerVenue.create({ data: { userId: coachUser.id, venueId: venueRow.id } });
    }
  }
  console.log("  ✓ Extra announcements + venue links for new batches");

  // ─────────────────────────────────────────────────────────────────────────
  // 13g. NEW TRAINER PROFILES + BATCHES
  //      3 new trainer users (Kiran, Amit, Divya) — each with:
  //        TrainerProfile · TrainerVenue · 2 Batches · Sessions · Memberships
  //        BatchPayments · BatchAnnouncements · TrainerReviews
  // ─────────────────────────────────────────────────────────────────────────

  // ── Trainer profiles ────────────────────────────────────────────────────
  const newTrainerProfiles: Array<{
    user: typeof trainer3;
    bio: string; years: number; sports: string[];
    certs: string[]; achievements: string[];
    rating: number; reviewCount: number;
  }> = [
    {
      user: trainer3,
      bio: "Certified badminton and basketball coach with 5+ years developing junior athletes. Known for high-energy drills and building fundamentals fast.",
      years: 5,
      sports: ["badminton", "basketball"],
      certs: ["BWF Level 1 Coach", "FIBA Youth Coaching Certificate"],
      achievements: ["Junior State Badminton Champion 2019", "Best Youth Coach — Pune Sports Club 2023"],
      rating: 4.5, reviewCount: 22,
    },
    {
      user: trainer4,
      bio: "Ex-Ranji Trophy cricketer and certified tennis instructor. 8 years coaching competitive players at club and district levels across Pune.",
      years: 8,
      sports: ["cricket", "tennis"],
      certs: ["BCCI Level 2 Coach", "ITF Play Tennis Instructor"],
      achievements: ["Ranji Trophy Player (Maharashtra) 2014–18", "PDCA Coach of the Year 2022"],
      rating: 4.7, reviewCount: 41,
    },
    {
      user: trainer5,
      bio: "Women's football specialist and youth basketball coach based in Mumbai. Passionate about growing women's sport participation in India.",
      years: 4,
      sports: ["football", "basketball"],
      certs: ["AIFF C Licence", "Sports Authority of India Coaching Diploma"],
      achievements: ["Women's City Football League — Coach 2022", "50+ youth athletes trained"],
      rating: 4.3, reviewCount: 14,
    },
  ];

  for (const t of newTrainerProfiles) {
    const exists = await prisma.trainerProfile.findUnique({ where: { userId: t.user.id } });
    if (!exists) {
      await prisma.trainerProfile.create({
        data: {
          userId:          t.user.id,
          bio:             t.bio,
          yearsExperience: t.years,
          sports:          t.sports,
          certifications:  t.certs,
          achievements:    t.achievements,
          rating:          t.rating,
          reviewCount:     t.reviewCount,
        },
      });
    }
  }

  // ── Venue links for new trainers ─────────────────────────────────────────
  const newTrainerVenueLinks: Array<[typeof trainer3, typeof venueElite]> = [
    [trainer3, venueSunrise],
    [trainer3, venueCity],
    [trainer4, venueElite],
    [trainer4, venuePhoenix],
    [trainer5, venueMumbai],
    [trainer5, venueCity],
  ];
  for (const [t, v] of newTrainerVenueLinks) {
    const exists = await prisma.trainerVenue.findUnique({
      where: { userId_venueId: { userId: t.id, venueId: v.id } },
    });
    if (!exists) {
      await prisma.trainerVenue.create({ data: { userId: t.id, venueId: v.id } });
    }
  }
  console.log("  ✓ New trainer profiles + venue links");

  // ── Batches for new trainers ──────────────────────────────────────────────
  const batchKiranBad = await ensureBatch(
    trainer3, venueSunrise, "Junior Badminton Programme", "badminton", "beginner",
    { days: ["Mon", "Wed", "Sat"], startTime: "07:00", endTime: "08:00" }, 12, 2000,
    "Fun, structured sessions for kids and teens (8–16 yrs). Focus on grip, footwork, rally consistency and rules."
  );
  const batchKiranBasket = await ensureBatch(
    trainer3, venueCity, "Youth Basketball Training", "basketball", "beginner",
    { days: ["Tue", "Thu"], startTime: "16:00", endTime: "17:30" }, 15, 2500,
    "Build core skills — dribbling, passing, shooting and team play — in a fun, competitive environment."
  );

  const batchAmitCricket = await ensureBatch(
    trainer4, venuePhoenix, "Cricket Pace Bowling Clinic", "cricket", "advanced",
    { days: ["Sat", "Sun"], startTime: "06:00", endTime: "08:00" }, 10, 4000,
    "Specialist pace bowling sessions: run-up biomechanics, seam position, yorkers, bouncers and match simulation."
  );
  const batchAmitTennis = await ensureBatch(
    trainer4, venueElite, "Tennis Drills & Match Practice", "tennis", "intermediate",
    { days: ["Mon", "Fri"], startTime: "17:30", endTime: "19:00" }, 8, 3800,
    "Rally consistency, net approaches, serve tactics and competitive match-play. Ideal for club-level players."
  );

  const batchDivyaFootball = await ensureBatch(
    trainer5, venueMumbai, "Women's Football Batch", "football", "beginner",
    { days: ["Sat", "Sun"], startTime: "08:00", endTime: "10:00" }, 16, 2800,
    "An inclusive beginner batch for women of all ages. Skills, confidence and fitness — no prior experience needed."
  );
  const batchDivyaBasket = await ensureBatch(
    trainer5, venueMumbai, "Basketball Fundamentals — Mumbai", "basketball", "beginner",
    { days: ["Tue", "Thu"], startTime: "17:00", endTime: "18:30" }, 12, 2500,
    "Court fundamentals: ball handling, lay-ups, defence and transition drills in a friendly competitive atmosphere."
  );
  console.log("  ✓ 6 new trainer batches (Kiran × 2, Amit × 2, Divya × 2)");

  // ── Memberships for new batches ───────────────────────────────────────────
  const newBatchMemberDefs: Array<{
    batch: typeof batchKiranBad; player: typeof arjun; status: string; paymentStatus: string;
  }> = [
    // Kiran — Junior Badminton
    { batch: batchKiranBad,    player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBad,    player: priya,  status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBad,    player: sneha,  status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBad,    player: vikram, status: "pending", paymentStatus: "pending" },
    // Kiran — Youth Basketball
    { batch: batchKiranBasket, player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBasket, player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBasket, player: rohit,  status: "active",  paymentStatus: "paid"    },
    { batch: batchKiranBasket, player: sneha,  status: "pending", paymentStatus: "pending" },
    // Amit — Cricket Pace Bowling
    { batch: batchAmitCricket, player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAmitCricket, player: vikram, status: "active",  paymentStatus: "paid"    },
    { batch: batchAmitCricket, player: rohit,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAmitCricket, player: sneha,  status: "left",    paymentStatus: "paid"    },
    // Amit — Tennis Drills
    { batch: batchAmitTennis,  player: arjun,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAmitTennis,  player: sneha,  status: "active",  paymentStatus: "paid"    },
    { batch: batchAmitTennis,  player: priya,  status: "pending", paymentStatus: "pending" },
    // Divya — Women's Football
    { batch: batchDivyaFootball, player: priya,  status: "active",  paymentStatus: "paid"  },
    { batch: batchDivyaFootball, player: sneha,  status: "active",  paymentStatus: "paid"  },
    { batch: batchDivyaFootball, player: rohit,  status: "active",  paymentStatus: "paid"  },
    // Divya — Basketball Mumbai
    { batch: batchDivyaBasket,   player: rohit,  status: "active",  paymentStatus: "paid"  },
    { batch: batchDivyaBasket,   player: priya,  status: "active",  paymentStatus: "paid"  },
    { batch: batchDivyaBasket,   player: vikram, status: "pending", paymentStatus: "pending"},
  ];

  for (const m of newBatchMemberDefs) {
    const exists = await prisma.batchMembership.findUnique({
      where: { batchId_playerId: { batchId: m.batch.id, playerId: m.player.id } },
    });
    if (!exists) {
      await prisma.batchMembership.create({
        data: { batchId: m.batch.id, playerId: m.player.id, status: m.status, paymentStatus: m.paymentStatus },
      });
    }
  }

  // ── Sessions + attendance for new batches ────────────────────────────────
  const sessKiranBad    = await ensureSessions(batchKiranBad);
  const sessKiranBasket = await ensureSessions(batchKiranBasket);
  const sessAmitCricket = await ensureSessions(batchAmitCricket);
  const sessAmitTennis  = await ensureSessions(batchAmitTennis);
  const sessDivyaFoot   = await ensureSessions(batchDivyaFootball);
  const sessDivyaBasket = await ensureSessions(batchDivyaBasket);

  await markAttendance(sessKiranBad    as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessKiranBad    as unknown as SessionRow[], priya,  [0,1,3,4]);
  await markAttendance(sessKiranBad    as unknown as SessionRow[], sneha,  [0,2,3,4]);
  await markAttendance(sessKiranBasket as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessKiranBasket as unknown as SessionRow[], vikram, [0,1,2,4]);
  await markAttendance(sessKiranBasket as unknown as SessionRow[], rohit,  [0,2,3,4]);
  await markAttendance(sessAmitCricket as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessAmitCricket as unknown as SessionRow[], vikram, [0,1,3,4]);
  await markAttendance(sessAmitCricket as unknown as SessionRow[], rohit,  [0,1,2,3]);
  await markAttendance(sessAmitTennis  as unknown as SessionRow[], arjun,  [0,1,2,3,4]);
  await markAttendance(sessAmitTennis  as unknown as SessionRow[], sneha,  [0,2,3,4]);
  await markAttendance(sessDivyaFoot   as unknown as SessionRow[], priya,  [0,1,2,3,4]);
  await markAttendance(sessDivyaFoot   as unknown as SessionRow[], sneha,  [0,1,3,4]);
  await markAttendance(sessDivyaFoot   as unknown as SessionRow[], rohit,  [0,2,3,4]);
  await markAttendance(sessDivyaBasket as unknown as SessionRow[], rohit,  [0,1,2,3,4]);
  await markAttendance(sessDivyaBasket as unknown as SessionRow[], priya,  [0,1,2,4]);
  console.log("  ✓ Sessions + attendance for 6 new trainer batches");

  // ── Batch payments for new trainers (current + 2 prior months) ───────────
  const newTrainerPaymentDefs: Array<{
    batch: typeof batchKiranBad; player: typeof arjun;
    monthsAgo: number; amount: number; status: string;
  }> = [
    // Kiran — Junior Badminton
    { batch: batchKiranBad,    player: arjun,  monthsAgo: 0, amount: 2000, status: "completed" },
    { batch: batchKiranBad,    player: priya,  monthsAgo: 0, amount: 2000, status: "completed" },
    { batch: batchKiranBad,    player: sneha,  monthsAgo: 0, amount: 2000, status: "completed" },
    { batch: batchKiranBad,    player: vikram, monthsAgo: 0, amount: 2000, status: "pending"   },
    { batch: batchKiranBad,    player: arjun,  monthsAgo: 1, amount: 2000, status: "completed" },
    { batch: batchKiranBad,    player: priya,  monthsAgo: 1, amount: 2000, status: "completed" },
    { batch: batchKiranBad,    player: sneha,  monthsAgo: 1, amount: 2000, status: "completed" },
    // Kiran — Youth Basketball
    { batch: batchKiranBasket, player: arjun,  monthsAgo: 0, amount: 2500, status: "completed" },
    { batch: batchKiranBasket, player: vikram, monthsAgo: 0, amount: 2500, status: "completed" },
    { batch: batchKiranBasket, player: rohit,  monthsAgo: 0, amount: 2500, status: "completed" },
    { batch: batchKiranBasket, player: sneha,  monthsAgo: 0, amount: 2500, status: "pending"   },
    { batch: batchKiranBasket, player: arjun,  monthsAgo: 1, amount: 2500, status: "completed" },
    { batch: batchKiranBasket, player: vikram, monthsAgo: 1, amount: 2500, status: "completed" },
    // Amit — Cricket Pace Bowling
    { batch: batchAmitCricket, player: arjun,  monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAmitCricket, player: vikram, monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAmitCricket, player: rohit,  monthsAgo: 0, amount: 4000, status: "completed" },
    { batch: batchAmitCricket, player: arjun,  monthsAgo: 1, amount: 4000, status: "completed" },
    { batch: batchAmitCricket, player: vikram, monthsAgo: 1, amount: 4000, status: "completed" },
    { batch: batchAmitCricket, player: rohit,  monthsAgo: 1, amount: 4000, status: "completed" },
    // Amit — Tennis Drills
    { batch: batchAmitTennis,  player: arjun,  monthsAgo: 0, amount: 3800, status: "completed" },
    { batch: batchAmitTennis,  player: sneha,  monthsAgo: 0, amount: 3800, status: "completed" },
    { batch: batchAmitTennis,  player: priya,  monthsAgo: 0, amount: 3800, status: "pending"   },
    { batch: batchAmitTennis,  player: arjun,  monthsAgo: 1, amount: 3800, status: "completed" },
    { batch: batchAmitTennis,  player: sneha,  monthsAgo: 1, amount: 3800, status: "completed" },
    // Divya — Women's Football
    { batch: batchDivyaFootball, player: priya,  monthsAgo: 0, amount: 2800, status: "completed" },
    { batch: batchDivyaFootball, player: sneha,  monthsAgo: 0, amount: 2800, status: "completed" },
    { batch: batchDivyaFootball, player: rohit,  monthsAgo: 0, amount: 2800, status: "completed" },
    { batch: batchDivyaFootball, player: priya,  monthsAgo: 1, amount: 2800, status: "completed" },
    { batch: batchDivyaFootball, player: sneha,  monthsAgo: 1, amount: 2800, status: "completed" },
    // Divya — Basketball Mumbai
    { batch: batchDivyaBasket,   player: rohit,  monthsAgo: 0, amount: 2500, status: "completed" },
    { batch: batchDivyaBasket,   player: priya,  monthsAgo: 0, amount: 2500, status: "completed" },
    { batch: batchDivyaBasket,   player: vikram, monthsAgo: 0, amount: 2500, status: "pending"   },
    { batch: batchDivyaBasket,   player: rohit,  monthsAgo: 1, amount: 2500, status: "completed" },
    { batch: batchDivyaBasket,   player: priya,  monthsAgo: 1, amount: 2500, status: "completed" },
  ];

  for (const p of newTrainerPaymentDefs) {
    const { month, year } = monthOffset(p.monthsAgo);
    const exists = await prisma.batchPayment.findFirst({
      where: { batchId: p.batch.id, playerId: p.player.id, cycleMonth: month, cycleYear: year },
    });
    if (!exists) {
      await prisma.batchPayment.create({
        data: {
          batchId:                   p.batch.id,
          playerId:                  p.player.id,
          payerId:                   p.player.id,
          cycleMonth:                month,
          cycleYear:                 year,
          amount:                    p.amount,
          trainerNetAmount:          +(p.amount * 0.9).toFixed(2),
          platformCommissionPercent: 10,
          platformCommissionAmount:  +(p.amount * 0.1).toFixed(2),
          status:                    p.status,
          paymentMode:               "online",
        },
      });
    }
  }

  // ── Batch announcements for new trainers ──────────────────────────────────
  const newTrainerAnnounceDefs: Array<{ batch: typeof batchKiranBad; trainer: typeof trainer3; msg: string }> = [
    { batch: batchKiranBad,    trainer: trainer3, msg: "Welcome to the Junior Badminton Programme! Please bring your own racket and non-marking shoes for court sessions." },
    { batch: batchKiranBad,    trainer: trainer3, msg: "This week we focus on the backhand clear. Watch the video I shared to preview the motion before Saturday's session." },
    { batch: batchKiranBasket, trainer: trainer3, msg: "Reminder: shin guards are not required but bring sports shoes with proper ankle support. First session this Thursday!" },
    { batch: batchKiranBasket, trainer: trainer3, msg: "Great defensive work last session! Thursday we're doing 3-on-3 scrimmages — perfect chance to apply what we've drilled." },
    { batch: batchAmitCricket, trainer: trainer4, msg: "Pace clinic starts this Saturday at 6 AM sharp. Bring your own whites and bowling spikes — we'll use the bowling machine from session 2." },
    { batch: batchAmitCricket, trainer: trainer4, msg: "Video analysis reel from last week posted on WhatsApp. Study your run-up and we'll correct it live on Sunday." },
    { batch: batchAmitTennis,  trainer: trainer4, msg: "We'll introduce serve-and-volley tactics this Friday. Stay an extra 15 minutes for one-on-one corrections if needed." },
    { batch: batchAmitTennis,  trainer: trainer4, msg: "Friendly doubles match arranged for next Monday between the Intermediate and Advanced batches. Great motivation!" },
    { batch: batchDivyaFootball, trainer: trainer5, msg: "Welcome to the Women's Football Batch! No experience needed — just bring your energy. First session this Saturday at 8 AM." },
    { batch: batchDivyaFootball, trainer: trainer5, msg: "We've been selected to participate in the Mumbai Women's 5-a-side League in June. All active members are eligible to play!" },
    { batch: batchDivyaBasket,   trainer: trainer5, msg: "Basketball batch: please arrive 10 minutes early to warm up. We'll start every session with skipping rope and stretching." },
    { batch: batchDivyaBasket,   trainer: trainer5, msg: "Free shooting practice open every Saturday morning 7–8 AM for batch members. No formal session — just open court." },
  ];

  for (const a of newTrainerAnnounceDefs) {
    const exists = await prisma.batchAnnouncement.findFirst({
      where: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
    });
    if (!exists) {
      await prisma.batchAnnouncement.create({
        data: { batchId: a.batch.id, trainerId: a.trainer.id, message: a.msg },
      });
    }
  }

  // ── Reviews for new trainers ──────────────────────────────────────────────
  const newTrainerReviewDefs: Array<{
    author: typeof arjun; trainer: typeof trainer3; rating: number; review: string;
  }> = [
    // Kiran (trainer3)
    { author: arjun,  trainer: trainer3, rating: 5, review: "Kiran is fantastic with young players. My son went from knowing nothing about badminton to winning his school tournament in 3 months." },
    { author: priya,  trainer: trainer3, rating: 4, review: "Really positive and encouraging coach. Sessions are well-structured and the drills are fun. Would love more advanced content soon." },
    { author: sneha,  trainer: trainer3, rating: 5, review: "Best junior coach in Pune. Patient, technical, and knows exactly how to keep kids motivated. Highly recommend!" },
    { author: vikram, trainer: trainer3, rating: 4, review: "Good batch format and solid fundamentals training. Kiran is knowledgeable and approachable. Timing suits working professionals too." },
    // Amit (trainer4)
    { author: arjun,  trainer: trainer4, rating: 5, review: "Amit's cricket coaching is on another level. His bowling analysis using video has genuinely improved my pace and line." },
    { author: vikram, trainer: trainer4, rating: 5, review: "Former professional who really knows the game inside out. Amit's tennis drills are intense but you improve fast. Absolutely worth it." },
    { author: rohit,  trainer: trainer4, rating: 5, review: "The cricket clinic is structured like a professional camp. Video review + live correction is something you don't find elsewhere." },
    { author: sneha,  trainer: trainer4, rating: 4, review: "Great tennis coaching. Amit is very technical and patient. I've improved my serve significantly in just 6 weeks." },
    // Divya (trainer5)
    { author: priya,  trainer: trainer5, rating: 5, review: "Divya's football sessions are the best thing I've done for my fitness. The batch vibe is incredible — supportive and competitive at the same time." },
    { author: sneha,  trainer: trainer5, rating: 4, review: "Really welcoming environment for women who are new to football. Divya explains every drill clearly and keeps the pace inclusive." },
    { author: rohit,  trainer: trainer5, rating: 4, review: "Joined the basketball batch and I'm hooked. Divya makes fundamentals fun without making you feel like a beginner." },
  ];

  for (const r of newTrainerReviewDefs) {
    const trainerProfileRow = await prisma.trainerProfile.findUnique({ where: { userId: r.trainer.id } });
    const exists = await prisma.trainerReview.findUnique({
      where: { trainerId_userId: { trainerId: r.trainer.id, userId: r.author.id } },
    });
    if (!exists) {
      await prisma.trainerReview.create({
        data: {
          userId:           r.author.id,
          trainerId:        r.trainer.id,
          trainerProfileId: trainerProfileRow?.id,
          rating:           r.rating,
          review:           r.review,
        },
      });
    }
  }
  console.log("  ✓ New trainer memberships, sessions, payments, announcements, reviews");

  // ─────────────────────────────────────────────────────────────────────────
  // 14. VENUE DISPLAYS (TV scoreboard screens per court)
  //     Gives the venue owner something to see on /venue-owner/displays
  // ─────────────────────────────────────────────────────────────────────────
  const displayDefs: Array<{ venueRow: typeof venueElite; courtName: string }> = [
    { venueRow: venueElite,   courtName: "Badminton Court A" },
    { venueRow: venueElite,   courtName: "Badminton Court B" },
    { venueRow: venueElite,   courtName: "Tennis Court" },
    { venueRow: venuePhoenix, courtName: "Main Ground" },
    { venueRow: venuePhoenix, courtName: "Football Turf" },
    { venueRow: venueCity,    courtName: "Badminton Hall" },
    { venueRow: venueCity,    courtName: "Basketball Court" },
    { venueRow: venueSunrise,     courtName: "Court 1" },
    { venueRow: venueSunrise,     courtName: "Court 2" },
    { venueRow: venuePickleball,  courtName: "Pickleball Court 1" },
    { venueRow: venuePickleball,  courtName: "Pickleball Court 2" },
    { venueRow: venuePadel,       courtName: "Padel Court 1" },
    { venueRow: venuePadel,       courtName: "Padel Court 2" },
  ];

  const createdDisplays: Array<{ id: number; venueRow: typeof venueElite }> = [];
  for (const d of displayDefs) {
    let disp = await prisma.venueDisplay.findFirst({
      where: { venueId: d.venueRow.id, courtName: d.courtName },
    });
    if (!disp) {
      disp = await prisma.venueDisplay.create({
        data: { venueId: d.venueRow.id, courtName: d.courtName, status: "idle" },
      });
    }
    createdDisplays.push({ id: disp.id, venueRow: d.venueRow });
  }

  // Mark the first Elite display as "live" and link it to the ongoing live match
  const eliteDisplay = createdDisplays.find((d) => d.venueRow.id === venueElite.id);
  if (eliteDisplay) {
    await prisma.venueDisplay.update({
      where: { id: eliteDisplay.id },
      data: { currentMatchId: mLive.id, status: "live" },
    });
  }

  // Mark the first Phoenix display as "awaiting" (pairing in progress)
  const phoenixDisplay = createdDisplays.find((d) => d.venueRow.id === venuePhoenix.id);
  if (phoenixDisplay) {
    await prisma.venueDisplay.update({
      where: { id: phoenixDisplay.id },
      data: { status: "awaiting" },
    });
  }
  console.log("  ✓ Venue displays (court scoreboards)");

  // ─────────────────────────────────────────────────────────────────────────
  // 14. HISTORICAL BOOKINGS — 30 days of daily bookings for revenue charts
  //     The VenueDashboard and VenuePayments pages show revenue over
  //     the last 7/14/30 days, so we need bookings spread across those days.
  // ─────────────────────────────────────────────────────────────────────────
  type HistoricalBookingSpec = {
    user: typeof arjun;
    venue: typeof venueElite;
    fac: { id: number; name: string };
    sport: string;
    dayAgo: number;
    startHr: number;
    hours: number;
    ratePerHour: number;
  };

  const historicalDefs: HistoricalBookingSpec[] = [
    { user: arjun,  venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 1,  startHr: 7,  hours: 1,   ratePerHour: 400  },
    { user: priya,  venue: venueCity,    fac: cityFacFoot,                    sport: "football",   dayAgo: 2,  startHr: 18, hours: 1,   ratePerHour: 2025 },
    { user: vikram, venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 3,  startHr: 10, hours: 1,   ratePerHour: 500  },
    { user: sneha,  venue: venueElite,   fac: eliteFacTen,                    sport: "tennis",     dayAgo: 4,  startHr: 9,  hours: 1,   ratePerHour: 700  },
    { user: rohit,  venue: venueMumbai,  fac: venueMumbai.facilities[0],      sport: "cricket",    dayAgo: 5,  startHr: 16, hours: 2,   ratePerHour: 2000 },
    { user: arjun,  venue: venuePhoenix, fac: phoenixFacCri,                  sport: "cricket",    dayAgo: 6,  startHr: 8,  hours: 2,   ratePerHour: 2000 },
    { user: priya,  venue: venueSunrise, fac: venueSunrise.facilities[0],     sport: "badminton",  dayAgo: 8,  startHr: 6,  hours: 1,   ratePerHour: 400  },
    { user: vikram, venue: venueCity,    fac: cityFacFoot,                    sport: "football",   dayAgo: 9,  startHr: 17, hours: 1.5, ratePerHour: 1500 },
    { user: sneha,  venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 10, startHr: 8,  hours: 1,   ratePerHour: 400  },
    { user: arjun,  venue: venueCity,    fac: cityFacBad,                     sport: "badminton",  dayAgo: 11, startHr: 7,  hours: 1,   ratePerHour: 400  },
    { user: rohit,  venue: venuePhoenix, fac: phoenixFacFoot,                 sport: "football",   dayAgo: 12, startHr: 18, hours: 1,   ratePerHour: 2025 },
    { user: priya,  venue: venueElite,   fac: eliteFacTen,                    sport: "tennis",     dayAgo: 13, startHr: 9,  hours: 1,   ratePerHour: 700  },
    { user: vikram, venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 14, startHr: 10, hours: 2,   ratePerHour: 500  },
    { user: arjun,  venue: venuePhoenix, fac: phoenixFacCri,                  sport: "cricket",    dayAgo: 15, startHr: 8,  hours: 2,   ratePerHour: 2000 },
    { user: sneha,  venue: venueCity,    fac: cityFacFoot,                    sport: "football",   dayAgo: 16, startHr: 17, hours: 1,   ratePerHour: 1500 },
    { user: rohit,  venue: venueSunrise, fac: venueSunrise.facilities[0],     sport: "badminton",  dayAgo: 17, startHr: 6,  hours: 1,   ratePerHour: 400  },
    { user: priya,  venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 18, startHr: 8,  hours: 1,   ratePerHour: 400  },
    { user: arjun,  venue: venueElite,   fac: eliteFacTen,                    sport: "tennis",     dayAgo: 19, startHr: 17, hours: 1,   ratePerHour: 900  },
    { user: vikram, venue: venuePhoenix, fac: phoenixFacCri,                  sport: "cricket",    dayAgo: 20, startHr: 10, hours: 2,   ratePerHour: 2000 },
    { user: sneha,  venue: venueCity,    fac: cityFacBad,                     sport: "badminton",  dayAgo: 21, startHr: 7,  hours: 1,   ratePerHour: 400  },
    { user: arjun,  venue: venuePhoenix, fac: phoenixFacFoot,                 sport: "football",   dayAgo: 22, startHr: 17, hours: 2,   ratePerHour: 1500 },
    { user: rohit,  venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 23, startHr: 9,  hours: 1,   ratePerHour: 500  },
    { user: priya,  venue: venueSunrise, fac: venueSunrise.facilities[1] ?? venueSunrise.facilities[0], sport: "badminton", dayAgo: 24, startHr: 7, hours: 1, ratePerHour: 400 },
    { user: vikram, venue: venueCity,    fac: cityFacFoot,                    sport: "football",   dayAgo: 25, startHr: 18, hours: 1,   ratePerHour: 2025 },
    { user: arjun,  venue: venueElite,   fac: eliteFacBad,                    sport: "badminton",  dayAgo: 26, startHr: 6,  hours: 1,   ratePerHour: 400  },
    { user: sneha,  venue: venuePhoenix, fac: phoenixFacCri,                  sport: "cricket",    dayAgo: 27, startHr: 16, hours: 2,   ratePerHour: 2000 },
    { user: rohit,  venue: venueElite,   fac: eliteFacTen,                    sport: "tennis",     dayAgo: 28, startHr: 9,  hours: 1,   ratePerHour: 700  },
    { user: priya,  venue: venueCity,    fac: cityFacBad,                     sport: "badminton",  dayAgo: 29, startHr: 8,  hours: 1,   ratePerHour: 400  },
    { user: vikram, venue: venuePhoenix,  fac: phoenixFacFoot,                    sport: "football",   dayAgo: 30, startHr: 17, hours: 1.5, ratePerHour: 1500 },
    { user: arjun,  venue: venuePickleball, fac: venuePickleball.facilities[0],   sport: "pickleball", dayAgo: 2,  startHr: 7,  hours: 1.5, ratePerHour: 500  },
    { user: priya,  venue: venuePickleball, fac: venuePickleball.facilities[0],   sport: "pickleball", dayAgo: 7,  startHr: 9,  hours: 1,   ratePerHour: 600  },
    { user: vikram, venue: venuePickleball, fac: venuePickleball.facilities[1],   sport: "pickleball", dayAgo: 14, startHr: 8,  hours: 1,   ratePerHour: 500  },
    { user: rohit,  venue: venuePickleball, fac: venuePickleball.facilities[0],   sport: "pickleball", dayAgo: 21, startHr: 17, hours: 1,   ratePerHour: 750  },
    { user: arjun,  venue: venuePadel, fac: padelFacCourt1, sport: "padel", dayAgo: 3,  startHr: 8,  hours: 1,   ratePerHour: 770  },
    { user: priya,  venue: venuePadel, fac: padelFacCourt1, sport: "padel", dayAgo: 9,  startHr: 9,  hours: 1,   ratePerHour: 770  },
    { user: sneha,  venue: venuePadel, fac: padelFacCourt2, sport: "padel", dayAgo: 16, startHr: 17, hours: 1,   ratePerHour: 945  },
    { user: vikram, venue: venuePadel, fac: padelFacCourt1, sport: "padel", dayAgo: 23, startHr: 8,  hours: 1,   ratePerHour: 700  },
  ];

  for (const spec of historicalDefs) {
    const bookingDate = daysAgo(spec.dayAgo);
    bookingDate.setHours(0, 0, 0, 0);
    const startHr = spec.startHr;
    const endHrFloat = startHr + spec.hours;
    const endHr = Math.floor(endHrFloat);
    const endMin = Math.round((endHrFloat - endHr) * 60);
    const startTime = `${String(startHr).padStart(2, "0")}:00`;
    const endTime   = `${String(endHr).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

    const existing = await prisma.booking.findFirst({
      where: { userId: spec.user.id, venueId: spec.venue.id, sport: spec.sport, bookingDate, startTime },
    });
    if (!existing) {
      const subtotal    = +(spec.ratePerHour * spec.hours).toFixed(2);
      const gstAmount   = +(subtotal * 0.18).toFixed(2);
      const totalAmount = +(subtotal + gstAmount).toFixed(2);
      const bk = await prisma.booking.create({
        data: {
          userId:        spec.user.id,
          venueId:       spec.venue.id,
          sport:         spec.sport,
          sportId:       sports[spec.sport].id,
          facilityId:    spec.fac.id,
          facilityName:  spec.fac.name,
          bookingDate,
          startTime,
          endTime,
          totalHours:    spec.hours,
          subtotal,
          gstRate:       18,
          gstAmount,
          totalAmount,
          paymentStatus: "paid",
          paidAmount:    totalAmount,
          status:        "completed",
        },
      });
      await prisma.bookingPayment.create({
        data: { bookingId: bk.id, userId: spec.user.id, amount: totalAmount, paymentMethod: "online", status: "paid" },
      });
    }
  }
  console.log("  ✓ Historical bookings (30-day revenue data for venue owner dashboard)");

  // ─────────────────────────────────────────────────────────────────────────
  // 15. HISTORICAL BATCH PAYMENTS — prior-month earnings for coaches
  //     The TrainerDashboard shows totalEarnings and recentPayments from
  //     BatchPayment records. Seeding 3 prior months gives both coaches
  //     a non-trivial earnings total and a populated payment history.
  // ─────────────────────────────────────────────────────────────────────────
  const historicalPaymentDefs: Array<{
    batch: typeof batchBeginnerBad; player: typeof arjun;
    monthsAgo: number; amount: number;
  }> = [
    // Coach 1 (Rahul) — Intermediate Badminton Batch
    { batch: batchIntermBad, player: arjun,  monthsAgo: 1, amount: 3500 },
    { batch: batchIntermBad, player: priya,  monthsAgo: 1, amount: 3500 },
    { batch: batchIntermBad, player: arjun,  monthsAgo: 2, amount: 3500 },
    { batch: batchIntermBad, player: priya,  monthsAgo: 2, amount: 3500 },
    { batch: batchIntermBad, player: arjun,  monthsAgo: 3, amount: 3500 },
    { batch: batchIntermBad, player: priya,  monthsAgo: 3, amount: 3500 },
    // Coach 1 (Rahul) — Advanced Badminton Batch
    { batch: batchAdvBad,    player: vikram, monthsAgo: 1, amount: 5000 },
    { batch: batchAdvBad,    player: vikram, monthsAgo: 2, amount: 5000 },
    { batch: batchAdvBad,    player: vikram, monthsAgo: 3, amount: 5000 },
    // Coach 1 (Rahul) — Beginner Badminton Batch
    { batch: batchBeginnerBad, player: sneha, monthsAgo: 1, amount: 2500 },
    { batch: batchBeginnerBad, player: rohit, monthsAgo: 1, amount: 2500 },
    { batch: batchBeginnerBad, player: sneha, monthsAgo: 2, amount: 2500 },
    { batch: batchBeginnerBad, player: rohit, monthsAgo: 2, amount: 2500 },
    // Coach 2 (Meera) — Football Academy
    { batch: batchFootball,    player: priya, monthsAgo: 1, amount: 3000 },
    { batch: batchFootball,    player: rohit, monthsAgo: 1, amount: 3000 },
    { batch: batchFootball,    player: priya, monthsAgo: 2, amount: 3000 },
    { batch: batchFootball,    player: rohit, monthsAgo: 2, amount: 3000 },
    { batch: batchFootball,    player: priya, monthsAgo: 3, amount: 3000 },
    // Coach 2 (Meera) — Basketball Fundamentals
    { batch: batchBasketball,  player: vikram, monthsAgo: 1, amount: 2800 },
    { batch: batchBasketball,  player: vikram, monthsAgo: 2, amount: 2800 },
    { batch: batchBasketball,  player: vikram, monthsAgo: 3, amount: 2800 },
    // Coach 1 (Rahul) — Pickleball Clinic
    { batch: batchPickleball,  player: arjun,  monthsAgo: 1, amount: 2200 },
    { batch: batchPickleball,  player: priya,  monthsAgo: 1, amount: 2200 },
    { batch: batchPickleball,  player: rohit,  monthsAgo: 1, amount: 2200 },
    { batch: batchPickleball,  player: arjun,  monthsAgo: 2, amount: 2200 },
    { batch: batchPickleball,  player: priya,  monthsAgo: 2, amount: 2200 },
    // Coach 1 (Rahul) — Padel Clinic
    { batch: batchPadel,       player: arjun,  monthsAgo: 1, amount: 2500 },
    { batch: batchPadel,       player: priya,  monthsAgo: 1, amount: 2500 },
    { batch: batchPadel,       player: sneha,  monthsAgo: 1, amount: 2500 },
    { batch: batchPadel,       player: arjun,  monthsAgo: 2, amount: 2500 },
    { batch: batchPadel,       player: priya,  monthsAgo: 2, amount: 2500 },
  ];

  for (const p of historicalPaymentDefs) {
    const { month, year } = monthOffset(p.monthsAgo);
    const exists = await prisma.batchPayment.findFirst({
      where: { batchId: p.batch.id, playerId: p.player.id, cycleMonth: month, cycleYear: year },
    });
    if (!exists) {
      await prisma.batchPayment.create({
        data: {
          batchId:                   p.batch.id,
          playerId:                  p.player.id,
          payerId:                   p.player.id,
          cycleMonth:                month,
          cycleYear:                 year,
          amount:                    p.amount,
          trainerNetAmount:          +(p.amount * 0.9).toFixed(2),
          platformCommissionPercent: 10,
          platformCommissionAmount:  +(p.amount * 0.1).toFixed(2),
          status:                    "completed",
          paymentMode:               "online",
        },
      });
    }
  }
  console.log("  ✓ Historical batch payments (3-month coach earnings history)");

  // ─────────────────────────────────────────────────────────────────────────
  // 16. MORE MATCHES FOR SCORING FEATURE
  //     • 2 new live matches (basketball 3x3, football 5-a-side) so the
  //       LiveMatch scoring UI has meaningful action to display immediately
  //     • Rich MatchEvent logs for both live and completed matches so
  //       the MatchAnalytics event timeline and event log are populated
  // ─────────────────────────────────────────────────────────────────────────

  // Helper: offset minutes from a base date
  const addMinsTo = (base: Date, mins: number) => new Date(base.getTime() + mins * 60_000);

  // 16a. Live Basketball 3×3 at City Hub
  const mLiveBasket = await ensureMatch(
    null, "basketball", "3x3", 3, venueCity, new Date(),
    "live",
    { A: { name: "Dunkers", players: [{ id: arjun.id, name: arjun.name }, { id: vikram.id, name: vikram.name }] },
      B: { name: "Jammers",  players: [{ id: rohit.id,  name: rohit.name  }, { id: sneha.id,  name: sneha.name  }] } },
    { A: 18, B: 15 }, null, arjun
  );

  // 16b. Live Football 5-a-side at Phoenix Ground
  const mLiveFoot = await ensureMatch(
    null, "football", "5-a-side", 5, venuePhoenix, new Date(),
    "live",
    { A: { name: "City Hawks",    players: [{ id: priya.id, name: priya.name }] },
      B: { name: "Rising Stars", players: [{ id: rohit.id, name: rohit.name  }] } },
    { A: 2, B: 1 }, null, priya
  );

  // 16c. Completed Cricket T20 with richer event log (for MatchAnalytics)
  const mCriT20 = await ensureMatch(
    null, "cricket", "T20", 11, venuePhoenix, daysAgo(12),
    "completed",
    { A: { name: "Warriors XI", players: [{ id: arjun.id,  name: arjun.name  }] },
      B: { name: "Blasters",    players: [{ id: vikram.id, name: vikram.name }] } },
    { A: 142, B: 138 }, "A", arjun
  );

  // ── Events for live basketball match ──────────────────────────────────────
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mLiveBasket.id } });
    if (!exists) {
      const base = new Date(Date.now() - 32 * 60_000);
      const defs = [
        { team: "A", playerId: arjun.id,  eventType: "2pt",        eventValue: 2 },
        { team: "B", playerId: rohit.id,  eventType: "2pt",        eventValue: 2 },
        { team: "A", playerId: vikram.id, eventType: "3pt",        eventValue: 3 },
        { team: "B", playerId: sneha.id,  eventType: "2pt",        eventValue: 2 },
        { team: "A", playerId: arjun.id,  eventType: "2pt",        eventValue: 2 },
        { team: "B", playerId: rohit.id,  eventType: "2pt",        eventValue: 2 },
        { team: "A", playerId: vikram.id, eventType: "2pt",        eventValue: 2 },
        { team: "B", playerId: sneha.id,  eventType: "3pt",        eventValue: 3 },
        { team: "A", playerId: arjun.id,  eventType: "2pt",        eventValue: 2 },
        { team: "B", playerId: rohit.id,  eventType: "free_throw", eventValue: 1 },
        { team: "B", playerId: rohit.id,  eventType: "free_throw", eventValue: 1 },
        { team: "A", playerId: vikram.id, eventType: "3pt",        eventValue: 3 },
        { team: "B", playerId: sneha.id,  eventType: "2pt",        eventValue: 2 },
        { team: "A", playerId: arjun.id,  eventType: "2pt",        eventValue: 2 },
        { team: "B", playerId: rohit.id,  eventType: "2pt",        eventValue: 2 },
        { team: "A", playerId: vikram.id, eventType: "2pt",        eventValue: 2 },
      ];
      for (let i = 0; i < defs.length; i++) {
        await prisma.matchEvent.create({
          data: { matchId: mLiveBasket.id, ...defs[i], eventTimestamp: addMinsTo(base, i * 2) },
        });
      }
    }
  }

  // ── Events for live football match ────────────────────────────────────────
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mLiveFoot.id } });
    if (!exists) {
      const base = new Date(Date.now() - 52 * 60_000);
      const defs = [
        { team: "A", playerId: priya.id, eventType: "goal",        eventValue: 1, mins: 7  },
        { team: "A", playerId: priya.id, eventType: "goal",        eventValue: 1, mins: 23 },
        { team: "B", playerId: rohit.id, eventType: "goal",        eventValue: 1, mins: 38 },
        { team: "B", playerId: rohit.id, eventType: "yellow_card", eventValue: 0, mins: 44 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mLiveFoot.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }

  // ── Events for completed cricket T20 (Warriors vs Blasters) ──────────────
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mCriT20.id } });
    if (!exists) {
      const base = daysAgo(12);
      const defs = [
        { team: "A", playerId: arjun.id,  eventType: "four",   eventValue: 4, mins: 5  },
        { team: "A", playerId: arjun.id,  eventType: "six",    eventValue: 6, mins: 9  },
        { team: "A", playerId: arjun.id,  eventType: "run",    eventValue: 1, mins: 14 },
        { team: "B", playerId: vikram.id, eventType: "wicket", eventValue: 1, mins: 20 },
        { team: "B", playerId: vikram.id, eventType: "four",   eventValue: 4, mins: 29 },
        { team: "A", playerId: arjun.id,  eventType: "wicket", eventValue: 1, mins: 37 },
        { team: "B", playerId: vikram.id, eventType: "six",    eventValue: 6, mins: 48 },
        { team: "B", playerId: vikram.id, eventType: "six",    eventValue: 6, mins: 53 },
        { team: "A", playerId: arjun.id,  eventType: "wicket", eventValue: 1, mins: 59 },
        { team: "A", playerId: arjun.id,  eventType: "four",   eventValue: 4, mins: 65 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mCriT20.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }

  // ── Backfill events for existing completed matches (analytics page) ───────
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mCriCompleted.id } });
    if (!exists) {
      const base = daysAgo(5);
      const defs = [
        { team: "A", playerId: arjun.id,  eventType: "six",    eventValue: 6, mins: 3  },
        { team: "A", playerId: arjun.id,  eventType: "four",   eventValue: 4, mins: 7  },
        { team: "B", playerId: priya.id,  eventType: "wicket", eventValue: 1, mins: 14 },
        { team: "A", playerId: vikram.id, eventType: "four",   eventValue: 4, mins: 21 },
        { team: "B", playerId: sneha.id,  eventType: "wicket", eventValue: 1, mins: 30 },
        { team: "A", playerId: arjun.id,  eventType: "run",    eventValue: 1, mins: 38 },
        { team: "A", playerId: vikram.id, eventType: "six",    eventValue: 6, mins: 44 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mCriCompleted.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mFootCompleted.id } });
    if (!exists) {
      const base = daysAgo(8);
      const defs = [
        { team: "A", playerId: priya.id, eventType: "goal", eventValue: 1, mins: 9  },
        { team: "A", playerId: priya.id, eventType: "goal", eventValue: 1, mins: 25 },
        { team: "B", playerId: rohit.id, eventType: "goal", eventValue: 1, mins: 40 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mFootCompleted.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mTenCompleted.id } });
    if (!exists) {
      const base = daysAgo(6);
      const defs = [
        { team: "A", playerId: sneha.id,  eventType: "ace",          eventValue: 1, mins: 5  },
        { team: "B", playerId: vikram.id, eventType: "fault",        eventValue: 0, mins: 9  },
        { team: "A", playerId: sneha.id,  eventType: "ace",          eventValue: 1, mins: 17 },
        { team: "B", playerId: vikram.id, eventType: "double_fault", eventValue: 0, mins: 25 },
        { team: "A", playerId: sneha.id,  eventType: "ace",          eventValue: 1, mins: 38 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mTenCompleted.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }
  {
    const exists = await prisma.matchEvent.findFirst({ where: { matchId: mPadelCompleted.id } });
    if (!exists) {
      const base = daysAgo(4);
      const defs = [
        { team: "A", playerId: arjun.id,  eventType: "ace",      eventValue: 1, mins: 4  },
        { team: "B", playerId: vikram.id, eventType: "fault",    eventValue: 0, mins: 11 },
        { team: "A", playerId: priya.id,  eventType: "winner",   eventValue: 1, mins: 18 },
        { team: "B", playerId: sneha.id,  eventType: "ace",      eventValue: 1, mins: 27 },
        { team: "A", playerId: arjun.id,  eventType: "winner",   eventValue: 1, mins: 35 },
        { team: "B", playerId: vikram.id, eventType: "winner",   eventValue: 1, mins: 44 },
        { team: "A", playerId: priya.id,  eventType: "ace",      eventValue: 1, mins: 55 },
      ];
      for (const { mins, ...rest } of defs) {
        await prisma.matchEvent.create({
          data: { matchId: mPadelCompleted.id, ...rest, eventTimestamp: addMinsTo(base, mins) },
        });
      }
    }
  }
  console.log("  ✓ Extra live/completed matches + event logs (scoring & analytics)");

  // ─────────────────────────────────────────────────────────────────────────
  // 17. PLAYER BATCH REVIEWS (trainer mode — monthly student assessments)
  //     Trainers write a structured monthly review for each student with
  //     per-skill ratings + a free-text comment. Shown in BatchDetail and
  //     the trainer's session management views.
  // ─────────────────────────────────────────────────────────────────────────
  type BatchReviewDef = {
    batch:     typeof batchAdvBad;
    player:    typeof arjun;
    trainer:   typeof coach;
    monthsAgo: number;
    ratings:   Record<string, number>;
    comment:   string;
  };

  const batchReviewDefs: BatchReviewDef[] = [
    // ── Rahul — Advanced Badminton ──────────────────────────────────────────
    { batch: batchAdvBad, player: vikram, trainer: coach, monthsAgo: 0,
      ratings: { technique: 4, consistency: 4, footwork: 3, attitude: 5 },
      comment: "Vikram's smash has improved significantly. Needs to work on backhand net play — tends to push rather than block." },
    { batch: batchAdvBad, player: arjun, trainer: coach, monthsAgo: 0,
      ratings: { technique: 5, consistency: 4, footwork: 5, attitude: 5 },
      comment: "Arjun leads the batch in footwork drills. Tournament-ready for district level. Keep up the pressure in rallies." },
    { batch: batchAdvBad, player: sneha, trainer: coach, monthsAgo: 0,
      ratings: { technique: 4, consistency: 3, footwork: 4, attitude: 5 },
      comment: "Sneha's attacking game is developing well but her defensive clears need work under pressure. Great attitude." },
    { batch: batchAdvBad, player: vikram, trainer: coach, monthsAgo: 1,
      ratings: { technique: 3, consistency: 3, footwork: 3, attitude: 5 },
      comment: "Solid month overall. Building consistency on baseline drives. Focus next month: transition play." },
    { batch: batchAdvBad, player: arjun, trainer: coach, monthsAgo: 1,
      ratings: { technique: 5, consistency: 5, footwork: 4, attitude: 5 },
      comment: "Outstanding this month — won 2 inter-club matches. Continue rotation drills to sharpen movement." },

    // ── Rahul — Tennis Intermediate ─────────────────────────────────────────
    { batch: batchTennis, player: arjun, trainer: coach, monthsAgo: 0,
      ratings: { serve: 4, forehand: 5, backhand: 3, movement: 4 },
      comment: "Arjun's forehand is a weapon. Work on the one-handed backhand slice. Serve consistency is improving." },
    { batch: batchTennis, player: sneha, trainer: coach, monthsAgo: 0,
      ratings: { serve: 3, forehand: 4, backhand: 4, movement: 5 },
      comment: "Sneha moves brilliantly on court. Double-handed backhand is the strongest in the batch. Serve needs more first-ball points." },
    { batch: batchTennis, player: rohit, trainer: coach, monthsAgo: 0,
      ratings: { serve: 4, forehand: 3, backhand: 3, movement: 3 },
      comment: "Big serve but loses control on the forehand in long rallies. Building baseline consistency is the priority." },

    // ── Meera — Football Batch ───────────────────────────────────────────────
    { batch: batchFootball, player: priya, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 5, dribbling: 4, positioning: 4, fitness: 5 },
      comment: "Priya leads by example. Her pressing game is excellent. Ready for competitive 7-a-side." },
    { batch: batchFootball, player: rohit, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 4, dribbling: 3, positioning: 4, fitness: 4 },
      comment: "Passing accuracy up from 60% to 75% in one month. Defensive positioning has improved markedly." },
    { batch: batchFootball, player: arjun, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 3, dribbling: 4, positioning: 3, fitness: 4 },
      comment: "Good close control. Needs more game-reading — often caught out of position in transition." },

    // ── Meera — Advanced Football ────────────────────────────────────────────
    { batch: batchAdvFootball, player: arjun, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 4, dribbling: 5, positioning: 4, fitness: 5 },
      comment: "Exceptional skill on the ball. Working on spatial awareness and off-ball movement in structured play." },
    { batch: batchAdvFootball, player: priya, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 5, dribbling: 4, positioning: 5, fitness: 5 },
      comment: "Standout performer. Her reading of the game is at a different level — coaching material." },
    { batch: batchAdvFootball, player: vikram, trainer: coach2, monthsAgo: 0,
      ratings: { passing: 4, dribbling: 4, positioning: 3, fitness: 4 },
      comment: "Passing accuracy significantly improved. Defensive transition positioning needs attention next month." },

    // ── Kiran — Junior Badminton ─────────────────────────────────────────────
    { batch: batchKiranBad, player: arjun, trainer: trainer3, monthsAgo: 0,
      ratings: { technique: 4, consistency: 3, footwork: 4, attitude: 5 },
      comment: "Great enthusiasm — picked up basic strokes quickly. Focus next month: racket prep and split-step timing." },
    { batch: batchKiranBad, player: priya, trainer: trainer3, monthsAgo: 0,
      ratings: { technique: 3, consistency: 4, footwork: 3, attitude: 5 },
      comment: "Consistent and coachable. Footwork drills need more repetitions — shuffle step is still a bit slow." },
    { batch: batchKiranBad, player: sneha, trainer: trainer3, monthsAgo: 0,
      ratings: { technique: 4, consistency: 4, footwork: 4, attitude: 5 },
      comment: "Most natural talent in the batch. Court coverage already above beginner level. Moving her up soon." },

    // ── Amit — Cricket Pace Bowling Clinic ───────────────────────────────────
    { batch: batchAmitCricket, player: rohit, trainer: trainer4, monthsAgo: 0,
      ratings: { pace: 4, accuracy: 3, swing: 4, fitness: 4 },
      comment: "Good pace for his height. Release point varies — work on repeating the action for consistency." },
    { batch: batchAmitCricket, player: vikram, trainer: trainer4, monthsAgo: 0,
      ratings: { pace: 3, accuracy: 4, swing: 3, fitness: 5 },
      comment: "Most accurate bowler in the batch. Outswing developing well. Keep up the gym work for more zip." },

    // ── Divya — Women's Football Batch ───────────────────────────────────────
    { batch: batchDivyaFootball, player: priya, trainer: trainer5, monthsAgo: 0,
      ratings: { passing: 5, dribbling: 4, fitness: 5, teamwork: 5 },
      comment: "Natural leader on the pitch — already helping beginners with positioning during scrimmages. Excellent." },
    { batch: batchDivyaFootball, player: sneha, trainer: trainer5, monthsAgo: 0,
      ratings: { passing: 4, dribbling: 4, fitness: 4, teamwork: 5 },
      comment: "Remarkable progress in 4 weeks — from zero experience to playing full scrimmages. Star of the batch." },
  ];

  for (const rv of batchReviewDefs) {
    const { month, year } = monthOffset(rv.monthsAgo);
    const exists = await prisma.playerBatchReview.findUnique({
      where: { batchId_playerId_year_month: { batchId: rv.batch.id, playerId: rv.player.id, year, month } },
    });
    if (!exists) {
      await prisma.playerBatchReview.create({
        data: {
          batchId:   rv.batch.id,
          playerId:  rv.player.id,
          trainerId: rv.trainer.id,
          year,
          month,
          ratings:   rv.ratings,
          comment:   rv.comment,
        },
      });
    }
  }
  console.log("  ✓ Player batch reviews (monthly trainer assessments of students)");

  // ─────────────────────────────────────────────────────────────────────────
  // 18. SPORTZA RATINGS — SportSkillRating + RatingHistory
  //     Gives every player an established Elo-style rating across their
  //     main sports. The history entries drive the sparkline charts on
  //     StatsOverview and the trend cards on Profile / PlayerProfile.
  //     Peer matching (MatchmakingSuggestions) uses ±150–500 tolerance
  //     windows, so we distribute ratings across realistic tier ranges.
  // ─────────────────────────────────────────────────────────────────────────

  type RatingSpec = {
    user:          typeof arjun;
    sport:         string;
    matchesPlayed: number;
    confidence:    "provisional" | "low" | "medium" | "high";
    history:       Array<{ daysAgo: number; rating: number }>; // oldest first
  };

  const ratingSpecs: RatingSpec[] = [
    // ── Arjun — advanced badminton, intermediate cricket / tennis / basketball
    {
      user: arjun, sport: "badminton", matchesPlayed: 24, confidence: "high",
      history: [
        { daysAgo: 90, rating: 1000 }, { daysAgo: 80, rating: 1032 },
        { daysAgo: 70, rating: 1065 }, { daysAgo: 60, rating: 1102 },
        { daysAgo: 50, rating: 1150 }, { daysAgo: 40, rating: 1215 },
        { daysAgo: 30, rating: 1285 }, { daysAgo: 20, rating: 1360 },
        { daysAgo: 10, rating: 1420 }, { daysAgo:  4, rating: 1480 },
      ],
    },
    {
      user: arjun, sport: "cricket", matchesPlayed: 9, confidence: "medium",
      history: [
        { daysAgo: 60, rating: 1000 }, { daysAgo: 48, rating: 1030 },
        { daysAgo: 36, rating: 1070 }, { daysAgo: 24, rating: 1140 },
        { daysAgo: 14, rating: 1230 }, { daysAgo:  6, rating: 1320 },
      ],
    },
    {
      user: arjun, sport: "tennis", matchesPlayed: 6, confidence: "medium",
      history: [
        { daysAgo: 45, rating: 1000 }, { daysAgo: 32, rating: 1035 },
        { daysAgo: 20, rating: 1080 }, { daysAgo: 10, rating: 1125 },
        { daysAgo:  4, rating: 1160 },
      ],
    },
    {
      user: arjun, sport: "basketball", matchesPlayed: 5, confidence: "medium",
      history: [
        { daysAgo: 30, rating: 1000 }, { daysAgo: 20, rating: 1028 },
        { daysAgo: 10, rating: 1080 }, { daysAgo:  3, rating: 1150 },
      ],
    },

    // ── Priya — football specialist, strong badminton ─────────────────────────
    {
      user: priya, sport: "badminton", matchesPlayed: 14, confidence: "medium",
      history: [
        { daysAgo: 80, rating: 1000 }, { daysAgo: 65, rating: 1040 },
        { daysAgo: 50, rating: 1090 }, { daysAgo: 35, rating: 1145 },
        { daysAgo: 20, rating: 1210 }, { daysAgo: 10, rating: 1255 },
        { daysAgo:  4, rating: 1290 },
      ],
    },
    {
      user: priya, sport: "football", matchesPlayed: 11, confidence: "medium",
      history: [
        { daysAgo: 70, rating: 1000 }, { daysAgo: 55, rating: 1048 },
        { daysAgo: 40, rating: 1112 }, { daysAgo: 28, rating: 1195 },
        { daysAgo: 16, rating: 1285 }, { daysAgo:  6, rating: 1380 },
      ],
    },

    // ── Vikram — tennis specialist, solid badminton, intermediate cricket ──────
    {
      user: vikram, sport: "badminton", matchesPlayed: 13, confidence: "medium",
      history: [
        { daysAgo: 85, rating: 1000 }, { daysAgo: 72, rating: 1028 },
        { daysAgo: 59, rating: 1050 }, { daysAgo: 45, rating: 1080 },
        { daysAgo: 32, rating: 1130 }, { daysAgo: 18, rating: 1170 },
        { daysAgo:  7, rating: 1200 },
      ],
    },
    {
      user: vikram, sport: "cricket", matchesPlayed: 7, confidence: "medium",
      history: [
        { daysAgo: 55, rating: 1000 }, { daysAgo: 42, rating: 1035 },
        { daysAgo: 30, rating: 1075 }, { daysAgo: 18, rating: 1130 },
        { daysAgo:  7, rating: 1175 },
      ],
    },
    {
      user: vikram, sport: "tennis", matchesPlayed: 12, confidence: "medium",
      history: [
        { daysAgo: 80, rating: 1000 }, { daysAgo: 65, rating: 1045 },
        { daysAgo: 52, rating: 1100 }, { daysAgo: 38, rating: 1175 },
        { daysAgo: 24, rating: 1250 }, { daysAgo: 12, rating: 1295 },
        { daysAgo:  4, rating: 1330 },
      ],
    },

    // ── Sneha — developed badminton, growing tennis, beginner football ─────────
    {
      user: sneha, sport: "badminton", matchesPlayed: 15, confidence: "medium",
      history: [
        { daysAgo: 80, rating: 1000 }, { daysAgo: 67, rating: 1038 },
        { daysAgo: 54, rating: 1085 }, { daysAgo: 40, rating: 1145 },
        { daysAgo: 26, rating: 1220 }, { daysAgo: 14, rating: 1295 },
        { daysAgo:  5, rating: 1350 },
      ],
    },
    {
      user: sneha, sport: "tennis", matchesPlayed: 8, confidence: "medium",
      history: [
        { daysAgo: 50, rating: 1000 }, { daysAgo: 38, rating: 1040 },
        { daysAgo: 26, rating: 1095 }, { daysAgo: 15, rating: 1160 },
        { daysAgo:  6, rating: 1230 },
      ],
    },
    {
      user: sneha, sport: "football", matchesPlayed: 4, confidence: "low",
      history: [
        { daysAgo: 25, rating: 1000 }, { daysAgo: 14, rating: 1035 },
        { daysAgo:  5, rating: 1090 },
      ],
    },

    // ── Rohit — Mumbai, cricket specialist, football + basketball ─────────────
    {
      user: rohit, sport: "cricket", matchesPlayed: 12, confidence: "medium",
      history: [
        { daysAgo: 75, rating: 1000 }, { daysAgo: 62, rating: 1030 },
        { daysAgo: 49, rating: 1070 }, { daysAgo: 36, rating: 1120 },
        { daysAgo: 24, rating: 1185 }, { daysAgo: 12, rating: 1235 },
        { daysAgo:  4, rating: 1275 },
      ],
    },
    {
      user: rohit, sport: "football", matchesPlayed: 7, confidence: "medium",
      history: [
        { daysAgo: 60, rating: 1000 }, { daysAgo: 45, rating: 1028 },
        { daysAgo: 30, rating: 1072 }, { daysAgo: 16, rating: 1115 },
        { daysAgo:  5, rating: 1155 },
      ],
    },
    {
      user: rohit, sport: "basketball", matchesPlayed: 8, confidence: "medium",
      history: [
        { daysAgo: 55, rating: 1000 }, { daysAgo: 42, rating: 1040 },
        { daysAgo: 30, rating: 1090 }, { daysAgo: 18, rating: 1150 },
        { daysAgo:  6, rating: 1210 },
      ],
    },

    // ── Padel ratings — all 5 players, growing from baseline ──────────────────
    {
      user: arjun, sport: "padel", matchesPlayed: 8, confidence: "medium",
      history: [
        { daysAgo: 40, rating: 1000 }, { daysAgo: 30, rating: 1028 },
        { daysAgo: 20, rating: 1065 }, { daysAgo: 10, rating: 1105 },
        { daysAgo:  3, rating: 1140 },
      ],
    },
    {
      user: priya, sport: "padel", matchesPlayed: 7, confidence: "medium",
      history: [
        { daysAgo: 38, rating: 1000 }, { daysAgo: 28, rating: 1025 },
        { daysAgo: 18, rating: 1060 }, { daysAgo:  8, rating: 1095 },
        { daysAgo:  2, rating: 1120 },
      ],
    },
    {
      user: vikram, sport: "padel", matchesPlayed: 6, confidence: "low",
      history: [
        { daysAgo: 35, rating: 1000 }, { daysAgo: 24, rating: 1022 },
        { daysAgo: 13, rating: 1050 }, { daysAgo:  4, rating: 1080 },
      ],
    },
    {
      user: sneha, sport: "padel", matchesPlayed: 5, confidence: "low",
      history: [
        { daysAgo: 30, rating: 1000 }, { daysAgo: 20, rating: 1030 },
        { daysAgo: 10, rating: 1065 }, { daysAgo:  3, rating: 1100 },
      ],
    },
  ];

  for (const spec of ratingSpecs) {
    const sport = sports[spec.sport];
    if (!sport) continue;

    const finalRating = spec.history[spec.history.length - 1].rating;

    await prisma.sportSkillRating.upsert({
      where: {
        userId_sportId_formatName: {
          userId: spec.user.id,
          sportId: sport.id,
          formatName: "overall",
        },
      },
      update:  { rating: finalRating, matchesPlayed: spec.matchesPlayed, confidence: spec.confidence },
      create:  {
        userId: spec.user.id,
        sportId: sport.id,
        formatName: "overall",
        rating: finalRating,
        matchesPlayed: spec.matchesPlayed,
        confidence: spec.confidence,
      },
    });

    const histExists = await prisma.ratingHistory.findFirst({
      where: { userId: spec.user.id, sportId: sport.id },
    });
    if (!histExists) {
      for (let i = 1; i < spec.history.length; i++) {
        const prev = spec.history[i - 1]!;
        const curr = spec.history[i]!;
        await prisma.ratingHistory.create({
          data: {
            userId:    spec.user.id,
            sportId:   sport.id,
            oldRating: prev.rating,
            newRating: curr.rating,
            delta:     curr.rating - prev.rating,
            createdAt: daysAgo(curr.daysAgo),
          },
        });
      }
    }
  }
  console.log("  ✓ Sportza ratings (SportSkillRating + RatingHistory — 5 players × 2-4 sports)");

  // ─────────────────────────────────────────────────────────────────────────
  // 19. PLAYER CONNECTIONS (peer network for /matchmaking/network)
  //     Bidirectional links for players who've shared matches, open-play
  //     sessions, or frequented the same venues. Powers "Recently Played
  //     With", "Frequent Opponents" and "Venue Connections" sections.
  // ─────────────────────────────────────────────────────────────────────────

  type ConnSpec = {
    u1:       typeof arjun;
    u2:       typeof arjun;
    type:     "match" | "open_play" | "venue";
    venueId?: number;
    playCount: number;
    lastAt:   Date;
  };

  const connSpecs: ConnSpec[] = [
    // ── Match connections ────────────────────────────────────────────────────
    { u1: arjun,  u2: vikram, type: "match",     playCount: 3, lastAt: daysAgo(4)  },
    { u1: arjun,  u2: priya,  type: "match",     playCount: 2, lastAt: daysAgo(5)  },
    { u1: arjun,  u2: rohit,  type: "match",     playCount: 2, lastAt: daysAgo(5)  },
    { u1: arjun,  u2: sneha,  type: "match",     playCount: 2, lastAt: daysAgo(2)  },
    { u1: priya,  u2: rohit,  type: "match",     playCount: 3, lastAt: daysAgo(8)  },
    { u1: priya,  u2: sneha,  type: "match",     playCount: 1, lastAt: daysAgo(6)  },
    { u1: vikram, u2: sneha,  type: "match",     playCount: 2, lastAt: daysAgo(6)  },
    { u1: vikram, u2: rohit,  type: "match",     playCount: 2, lastAt: daysAgo(12) },
    { u1: sneha,  u2: rohit,  type: "match",     playCount: 1, lastAt: daysAgo(15) },

    // ── Open-play connections ────────────────────────────────────────────────
    { u1: arjun,  u2: priya,  type: "open_play", playCount: 3, lastAt: daysAgo(3)  },
    { u1: arjun,  u2: vikram, type: "open_play", playCount: 2, lastAt: daysAgo(7)  },
    { u1: arjun,  u2: rohit,  type: "open_play", playCount: 1, lastAt: daysAgo(10) },
    { u1: priya,  u2: vikram, type: "open_play", playCount: 2, lastAt: daysAgo(5)  },
    { u1: sneha,  u2: priya,  type: "open_play", playCount: 1, lastAt: daysAgo(9)  },
    { u1: vikram, u2: rohit,  type: "open_play", playCount: 1, lastAt: daysAgo(14) },

    // ── Venue connections ────────────────────────────────────────────────────
    { u1: arjun,  u2: sneha,  type: "venue", venueId: venueElite.id,   playCount: 4, lastAt: daysAgo(2)  },
    { u1: arjun,  u2: vikram, type: "venue", venueId: venueElite.id,   playCount: 5, lastAt: daysAgo(4)  },
    { u1: arjun,  u2: priya,  type: "venue", venueId: venueElite.id,   playCount: 3, lastAt: daysAgo(4)  },
    { u1: priya,  u2: rohit,  type: "venue", venueId: venueCity.id,    playCount: 2, lastAt: daysAgo(9)  },
    { u1: vikram, u2: rohit,  type: "venue", venueId: venuePhoenix.id, playCount: 3, lastAt: daysAgo(12) },
    { u1: sneha,  u2: rohit,  type: "venue", venueId: venueCity.id,    playCount: 1, lastAt: daysAgo(17) },
  ];

  for (const spec of connSpecs) {
    const pairs: Array<[typeof arjun, typeof arjun]> = [[spec.u1, spec.u2], [spec.u2, spec.u1]];
    for (const [u, v] of pairs) {
      await prisma.playerConnection.upsert({
        where: {
          userId_connectedUserId_connectionType: {
            userId:          u.id,
            connectedUserId: v.id,
            connectionType:  spec.type,
          },
        },
        update: { playCount: spec.playCount, lastActivityAt: spec.lastAt, venueId: spec.venueId ?? null },
        create: {
          userId:          u.id,
          connectedUserId: v.id,
          connectionType:  spec.type,
          venueId:         spec.venueId ?? null,
          playCount:       spec.playCount,
          lastActivityAt:  spec.lastAt,
        },
      });
    }
  }
  console.log("  ✓ Player connections (match / open-play / venue network — peer matching)");

  // ─────────────────────────────────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`
✅  Seed complete!
   Dev users (any email works for OTP login):
     arjun@sportza.dev  — Player      (main dev account, id=${arjun.id})
     priya@sportza.dev  — Player
     vikram@sportza.dev — Player
     sneha@sportza.dev  — Player
     rohit@sportza.dev  — Player      (Mumbai)
     coach@sportza.dev  — Coach       (Rahul Sinha, Badminton/Tennis)
     coach2@sportza.dev — Coach       (Meera Iyer, Football/Basketball)
     owner@sportza.dev  — Venue Owner (Neha Kapoor, 6 venues incl. Pune Padel Club)
     admin@sportza.in    — Admin       (platform admin; password same as other dev users)

   Trainers:    coach@sportza.dev  (Rahul Sinha)  — 4 batches: Badminton ×3 + Tennis
                coach2@sportza.dev (Meera Iyer)   — 4 batches: Football ×2 + Basketball + Cricket
                trainer3@sportza.dev (Kiran Rao)  — 2 batches: Jr. Badminton + Youth Basketball
                trainer4@sportza.dev (Amit Kulkarni)— 2 batches: Cricket Pace + Tennis Drills
                trainer5@sportza.dev (Divya Nair) — 2 batches: Women's Football + Basketball (Mumbai)
                All trainers: role="trainer", TrainerProfile, venue links, sessions,
                memberships (active/pending/left), payments, announcements, reviews
   Owner data:  6 venues (incl. Pune Padel Club), 30 days of booking history, court TV displays
                (Elite: live, Phoenix: awaiting, others: idle)
   Scoring:     Live basketball 3×3 (Dunkers 18–15 Jammers) at City Hub
                Live football 5-a-side (City Hawks 2–1 Rising Stars) at Phoenix
                Live badminton doubles (Eagles 14–11 Falcons) at Elite
                Completed cricket T20 (Warriors 142–138 Blasters)
                All live/completed matches have rich MatchEvent logs for
                analytics timeline and LiveMatch event feed.
   Trainer mode: PlayerBatchReview records for all trainers and their
                 active batches — Rahul (Advanced Badminton + Tennis),
                 Meera (Football + Advanced Football), Kiran (Jr Badminton),
                 Amit (Cricket Pace), Divya (Women's Football).
                 Current month + 1 prior month for senior batches.
   Ratings:     Sportza Elo ratings seeded for all 5 players across
                 their main sports (badminton/cricket/football/tennis/basketball).
                 Arjun: 1480 Badminton (high), 1320 Cricket, 1160 Tennis, 1150 Basketball
                 Priya: 1290 Badminton, 1380 Football
                 Vikram: 1200 Badminton, 1175 Cricket, 1330 Tennis
                 Sneha: 1350 Badminton, 1230 Tennis, 1090 Football
                 Rohit: 1275 Cricket, 1155 Football, 1210 Basketball
                 Each rating has 5–10 RatingHistory entries for sparkline charts.
   Network:     PlayerConnection records (22 bidirectional links):
                 match, open_play, venue types — powers /matchmaking/network.

   DEV_FALLBACK_USER_ID=${arjun.id} — update apps/api/.env if it differs.
   To test as coach/owner, log in with their email and switch role in the app.
`);
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
