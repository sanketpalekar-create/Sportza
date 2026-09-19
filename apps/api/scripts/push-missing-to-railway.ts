/**
 * Push missing local MySQL rows to Railway MySQL — insert-if-missing only.
 *
 * Never UPDATE or DELETE on the target. Existing Railway rows are skipped;
 * only natural-key misses are inserted, with IDs remapped for children.
 *
 * Usage:
 *   pnpm --filter @sportza/api db:push-missing -- --target "mysql://..."
 *   pnpm --filter @sportza/api db:push-missing -- --target "mysql://..." --apply
 *
 * Or set RAILWAY_DATABASE_URL instead of --target.
 * Local source uses DATABASE_URL from apps/api/.env (or process env).
 */

import path from "path";
import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  let target = process.env.RAILWAY_DATABASE_URL ?? "";
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") apply = true;
    else if (a === "--target" && argv[i + 1]) {
      target = argv[++i];
    } else if (a.startsWith("--target=")) {
      target = a.slice("--target=".length);
    }
  }
  return { target, apply };
}

const { target: TARGET_URL, apply: APPLY } = parseArgs(process.argv.slice(2));

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL (local) is not set. Check apps/api/.env");
  process.exit(1);
}
if (!TARGET_URL) {
  console.error(
    "❌  Pass --target \"mysql://...\" or set RAILWAY_DATABASE_URL to the Railway MySQL URL."
  );
  process.exit(1);
}

const source = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const target = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

// ─── Stats / maps ────────────────────────────────────────────────────────────

type Counters = { inserted: number; skipped: number; conflicts: number };
const stats: Record<string, Counters> = {};
const conflicts: string[] = [];
const newlyInsertedUsers = new Set<number>(); // local user ids that were created on target

function bump(entity: string, kind: keyof Counters) {
  if (!stats[entity]) stats[entity] = { inserted: 0, skipped: 0, conflicts: 0 };
  stats[entity][kind]++;
}

function conflict(msg: string) {
  conflicts.push(msg);
}

/** localId → targetId */
type IdMap = Map<number, number>;
const maps = {
  location: new Map<number, number>() as IdMap,
  sport: new Map<number, number>() as IdMap,
  sportFormat: new Map<number, number>() as IdMap,
  user: new Map<number, number>() as IdMap,
  venue: new Map<number, number>() as IdMap,
  facility: new Map<number, number>() as IdMap,
  sportFacility: new Map<number, number>() as IdMap,
  tournament: new Map<number, number>() as IdMap,
  fixture: new Map<number, number>() as IdMap,
  batch: new Map<number, number>() as IdMap,
  booking: new Map<number, number>() as IdMap,
  openPlay: new Map<number, number>() as IdMap,
  match: new Map<number, number>() as IdMap,
  wallet: new Map<number, number>() as IdMap,
};

function requireMap(map: IdMap, localId: number | null | undefined, label: string): number | null {
  if (localId == null) return null;
  const t = map.get(localId);
  if (t == null) {
    conflict(`Missing remap for ${label} localId=${localId}`);
    return null;
  }
  return t;
}

/** Remap numeric userId fields inside JSON (teams/players blobs). */
function remapUserIdsInJson(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "number") {
        return maps.user.get(item) ?? item;
      }
      return remapUserIdsInJson(item);
    });
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        (k === "userId" || k === "playerId" || k === "connectedUserId" || k === "createdById") &&
        typeof v === "number"
      ) {
        out[k] = maps.user.get(v) ?? v;
      } else if (k === "players" && Array.isArray(v) && v.every((x) => typeof x === "number")) {
        out[k] = (v as number[]).map((id) => maps.user.get(id) ?? id);
      } else {
        out[k] = remapUserIdsInJson(v);
      }
    }
    return out;
  }
  return value;
}

function asJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

// ─── Phase helpers ───────────────────────────────────────────────────────────

async function syncLocations() {
  const rows = await source.location.findMany();
  for (const row of rows) {
    const existing = await target.location.findFirst({
      where: {
        country: row.country,
        state: row.state,
        city: row.city,
        pincode: row.pincode ?? null,
      },
    });
    if (existing) {
      maps.location.set(row.id, existing.id);
      bump("locations", "skipped");
      continue;
    }
    if (!APPLY) {
      maps.location.set(row.id, -row.id); // provisional for dry-run child planning
      bump("locations", "inserted");
      continue;
    }
    const created = await target.location.create({
      data: {
        country: row.country,
        state: row.state,
        city: row.city,
        pincode: row.pincode,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
      },
    });
    maps.location.set(row.id, created.id);
    bump("locations", "inserted");
  }
}

async function syncSports() {
  const rows = await source.sport.findMany({ include: { formats: true } });
  for (const row of rows) {
    const existing = await target.sport.findUnique({ where: { name: row.name } });
    let sportId: number;
    if (existing) {
      maps.sport.set(row.id, existing.id);
      sportId = existing.id;
      bump("sports", "skipped");
    } else if (!APPLY) {
      maps.sport.set(row.id, -row.id);
      sportId = -row.id;
      bump("sports", "inserted");
    } else {
      const created = await target.sport.create({
        data: {
          name: row.name,
          displayName: row.displayName,
          defaultPricePerHour: row.defaultPricePerHour,
          defaultRates: asJson(row.defaultRates),
          defaultMinBookingHrs: row.defaultMinBookingHrs,
          statFields: asJson(row.statFields),
          rulebookTitle: row.rulebookTitle,
          rulebookLines: asJson(row.rulebookLines),
          isActive: row.isActive,
        },
      });
      maps.sport.set(row.id, created.id);
      sportId = created.id;
      bump("sports", "inserted");
    }

    for (const fmt of row.formats) {
      const existingFmt = APPLY
        ? await target.sportFormat.findFirst({
            where: { sportId, name: fmt.name },
          })
        : null;
      // In dry-run, try real lookup if sport already existed
      const lookupSportId = maps.sport.get(row.id)!;
      const realExisting =
        existingFmt ??
        (lookupSportId > 0
          ? await target.sportFormat.findFirst({
              where: { sportId: lookupSportId, name: fmt.name },
            })
          : null);

      if (realExisting) {
        maps.sportFormat.set(fmt.id, realExisting.id);
        bump("sport_formats", "skipped");
        continue;
      }
      if (!APPLY) {
        maps.sportFormat.set(fmt.id, -fmt.id);
        bump("sport_formats", "inserted");
        continue;
      }
      if (sportId < 0) continue;
      const created = await target.sportFormat.create({
        data: {
          sportId,
          name: fmt.name,
          playersPerTeam: fmt.playersPerTeam,
          minTeams: fmt.minTeams,
          maxTeams: fmt.maxTeams,
          description: fmt.description,
          config: asJson(fmt.config),
        },
      });
      maps.sportFormat.set(fmt.id, created.id);
      bump("sport_formats", "inserted");
    }
  }
}

async function syncUsers() {
  const rows = await source.user.findMany();
  for (const row of rows) {
    const existing = await target.user.findUnique({ where: { email: row.email } });
    if (existing) {
      // Phone conflict: same email matched, but if local phone is on a different railway user, note it
      if (row.phone) {
        const phoneOwner = await target.user.findUnique({ where: { phone: row.phone } });
        if (phoneOwner && phoneOwner.id !== existing.id) {
          conflict(
            `User ${row.email}: phone ${row.phone} belongs to another Railway user (id=${phoneOwner.id}); keeping email match, not overwriting`
          );
          bump("users", "conflicts");
        }
      }
      maps.user.set(row.id, existing.id);
      bump("users", "skipped");
      continue;
    }

    // Email missing — check phone / google / facebook uniqueness before insert
    if (row.phone) {
      const phoneOwner = await target.user.findUnique({ where: { phone: row.phone } });
      if (phoneOwner) {
        conflict(
          `User ${row.email}: phone ${row.phone} already on Railway user ${phoneOwner.email} — skipping insert`
        );
        bump("users", "conflicts");
        continue;
      }
    }
    if (row.googleId) {
      const g = await target.user.findUnique({ where: { googleId: row.googleId } });
      if (g) {
        conflict(
          `User ${row.email}: googleId already on Railway user ${g.email} — skipping insert`
        );
        bump("users", "conflicts");
        continue;
      }
    }
    if (row.facebookId) {
      const f = await target.user.findUnique({ where: { facebookId: row.facebookId } });
      if (f) {
        conflict(
          `User ${row.email}: facebookId already on Railway user ${f.email} — skipping insert`
        );
        bump("users", "conflicts");
        continue;
      }
    }

    const locationId =
      row.locationId != null ? maps.location.get(row.locationId) ?? null : null;
    if (row.locationId != null && locationId == null) {
      conflict(`User ${row.email}: location ${row.locationId} not remapped — inserting with null location`);
    }

    if (!APPLY) {
      maps.user.set(row.id, -row.id);
      newlyInsertedUsers.add(row.id);
      bump("users", "inserted");
      continue;
    }

    const created = await target.user.create({
      data: {
        name: row.name,
        email: row.email,
        password: row.password,
        phone: row.phone,
        googleId: row.googleId,
        facebookId: row.facebookId,
        avatar: row.avatar,
        role: row.role,
        locationId: locationId != null && locationId > 0 ? locationId : null,
        sports: asJson(row.sports),
        isActive: row.isActive,
        suspendedAt: row.suspendedAt,
        suspensionReason: row.suspensionReason,
        onboardingStatus: row.onboardingStatus,
        onboardingNote: row.onboardingNote,
        createdAt: row.createdAt,
      },
    });
    maps.user.set(row.id, created.id);
    newlyInsertedUsers.add(row.id);
    bump("users", "inserted");
  }
}

async function syncTrainerProfiles() {
  const rows = await source.trainerProfile.findMany();
  for (const row of rows) {
    const targetUserId = maps.user.get(row.userId);
    if (targetUserId == null || targetUserId < 0) {
      if (targetUserId == null) {
        bump("trainer_profiles", "conflicts");
        conflict(`TrainerProfile localUser=${row.userId}: user not remapped`);
      } else if (!APPLY) {
        bump("trainer_profiles", "inserted");
      }
      continue;
    }
    const existing = await target.trainerProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (existing) {
      bump("trainer_profiles", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("trainer_profiles", "inserted");
      continue;
    }
    await target.trainerProfile.create({
      data: {
        userId: targetUserId,
        bio: row.bio,
        yearsExperience: row.yearsExperience,
        sports: asJson(row.sports),
        certifications: asJson(row.certifications),
        achievements: asJson(row.achievements),
        rating: row.rating,
        reviewCount: row.reviewCount,
      },
    });
    bump("trainer_profiles", "inserted");
  }
}

async function syncVenues() {
  const rows = await source.venue.findMany({
    include: {
      owner: { select: { email: true } },
      sportFacilities: true,
      sportRates: true,
      addOns: true,
      dbFacilities: { include: { schedules: true } },
    },
  });

  for (const row of rows) {
    const ownerTargetId = maps.user.get(row.ownerId);
    if (ownerTargetId == null) {
      conflict(`Venue "${row.name}": owner localId=${row.ownerId} not remapped — skip`);
      bump("venues", "conflicts");
      continue;
    }

    // Match by name + owner email on target
    const existing = await target.venue.findFirst({
      where: {
        name: row.name,
        owner: { email: row.owner.email },
      },
    });

    let venueId: number;
    if (existing) {
      maps.venue.set(row.id, existing.id);
      venueId = existing.id;
      bump("venues", "skipped");
    } else if (!APPLY) {
      maps.venue.set(row.id, -row.id);
      venueId = -row.id;
      bump("venues", "inserted");
    } else {
      if (ownerTargetId < 0) continue;
      const locationId =
        row.locationId != null ? maps.location.get(row.locationId) ?? null : null;
      const created = await target.venue.create({
        data: {
          name: row.name,
          ownerId: ownerTargetId,
          sports: asJson(row.sports),
          gstRate: row.gstRate,
          commissionPercent: row.commissionPercent,
          locationId: locationId != null && locationId > 0 ? locationId : null,
          facilities: asJson(row.facilities),
          capacity: row.capacity,
          pricePerHour: row.pricePerHour,
          images: asJson(row.images),
          availability: asJson(row.availability),
          isActive: row.isActive,
          createdAt: row.createdAt,
        },
      });
      maps.venue.set(row.id, created.id);
      venueId = created.id;
      bump("venues", "inserted");
    }

    // Sport facilities
    for (const sf of row.sportFacilities) {
      const realVenueId = maps.venue.get(row.id)!;
      const existingSf =
        realVenueId > 0
          ? await target.sportFacility.findFirst({
              where: { venueId: realVenueId, name: sf.name },
            })
          : null;
      if (existingSf) {
        maps.sportFacility.set(sf.id, existingSf.id);
        bump("sport_facilities", "skipped");
        continue;
      }
      if (!APPLY || venueId < 0) {
        if (!APPLY) bump("sport_facilities", "inserted");
        maps.sportFacility.set(sf.id, -sf.id);
        continue;
      }
      const created = await target.sportFacility.create({
        data: {
          venueId,
          name: sf.name,
          surfaceType: sf.surfaceType,
          count: sf.count,
          sports: asJson(sf.sports),
        },
      });
      maps.sportFacility.set(sf.id, created.id);
      bump("sport_facilities", "inserted");
    }

    // Sport rates — match venue + sport name
    for (const sr of row.sportRates) {
      const realVenueId = maps.venue.get(row.id)!;
      const existingSr =
        realVenueId > 0
          ? await target.sportRate.findFirst({
              where: { venueId: realVenueId, sport: sr.sport },
            })
          : null;
      if (existingSr) {
        bump("sport_rates", "skipped");
        continue;
      }
      if (!APPLY || venueId < 0) {
        if (!APPLY) bump("sport_rates", "inserted");
        continue;
      }
      const sportId =
        sr.sportId != null ? maps.sport.get(sr.sportId) ?? null : null;
      await target.sportRate.create({
        data: {
          venueId,
          sportId: sportId != null && sportId > 0 ? sportId : null,
          sport: sr.sport,
          minBookingHours: sr.minBookingHours,
          rates: asJson(sr.rates),
        },
      });
      bump("sport_rates", "inserted");
    }

    // Add-ons
    for (const ao of row.addOns) {
      const realVenueId = maps.venue.get(row.id)!;
      const existingAo =
        realVenueId > 0
          ? await target.venueAddOn.findFirst({
              where: { venueId: realVenueId, name: ao.name },
            })
          : null;
      if (existingAo) {
        bump("venue_add_ons", "skipped");
        continue;
      }
      if (!APPLY || venueId < 0) {
        if (!APPLY) bump("venue_add_ons", "inserted");
        continue;
      }
      await target.venueAddOn.create({
        data: {
          venueId,
          name: ao.name,
          category: ao.category,
          price: ao.price,
          unit: ao.unit,
          sport: ao.sport,
          description: ao.description,
        },
      });
      bump("venue_add_ons", "inserted");
    }

    // Facilities + schedules
    for (const fac of row.dbFacilities) {
      const realVenueId = maps.venue.get(row.id)!;
      const existingFac =
        realVenueId > 0
          ? await target.facility.findFirst({
              where: { venueId: realVenueId, name: fac.name },
            })
          : null;
      let facilityId: number;
      if (existingFac) {
        maps.facility.set(fac.id, existingFac.id);
        facilityId = existingFac.id;
        bump("facilities", "skipped");
      } else if (!APPLY || venueId < 0) {
        maps.facility.set(fac.id, -fac.id);
        facilityId = -fac.id;
        if (!APPLY) bump("facilities", "inserted");
      } else {
        const created = await target.facility.create({
          data: {
            venueId,
            name: fac.name,
            surfaceType: fac.surfaceType,
            sports: asJson(fac.sports),
            count: fac.count,
            createdAt: fac.createdAt,
          },
        });
        maps.facility.set(fac.id, created.id);
        facilityId = created.id;
        bump("facilities", "inserted");
      }

      for (const sch of fac.schedules) {
        const realFacId = maps.facility.get(fac.id)!;
        const existingSch =
          realFacId > 0
            ? await target.facilitySchedule.findUnique({
                where: {
                  facilityId_dayOfWeek: {
                    facilityId: realFacId,
                    dayOfWeek: sch.dayOfWeek,
                  },
                },
              })
            : null;
        if (existingSch) {
          bump("facility_schedules", "skipped");
          continue;
        }
        if (!APPLY || facilityId < 0) {
          if (!APPLY) bump("facility_schedules", "inserted");
          continue;
        }
        await target.facilitySchedule.create({
          data: {
            facilityId,
            venueId,
            dayOfWeek: sch.dayOfWeek,
            isOpen: sch.isOpen,
            openTime: sch.openTime,
            closeTime: sch.closeTime,
            slotDuration: sch.slotDuration,
            breakTimes: asJson(sch.breakTimes),
          },
        });
        bump("facility_schedules", "inserted");
      }
    }
  }

  // Trainer venues
  const tvs = await source.trainerVenue.findMany();
  for (const tv of tvs) {
    const uid = maps.user.get(tv.userId);
    const vid = maps.venue.get(tv.venueId);
    if (uid == null || vid == null) {
      bump("trainer_venues", "conflicts");
      continue;
    }
    if (uid < 0 || vid < 0) {
      if (!APPLY) bump("trainer_venues", "inserted");
      continue;
    }
    const existing = await target.trainerVenue.findUnique({
      where: { userId_venueId: { userId: uid, venueId: vid } },
    });
    if (existing) {
      bump("trainer_venues", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("trainer_venues", "inserted");
      continue;
    }
    await target.trainerVenue.create({ data: { userId: uid, venueId: vid } });
    bump("trainer_venues", "inserted");
  }
}

async function syncTournaments() {
  const rows = await source.tournament.findMany({
    include: {
      fixtures: true,
      coOrganizers: true,
      announcements: true,
    },
  });

  for (const row of rows) {
    const existing = await target.tournament.findFirst({ where: { name: row.name } });
    let tournamentId: number;

    if (existing) {
      maps.tournament.set(row.id, existing.id);
      tournamentId = existing.id;
      bump("tournaments", "skipped");
    } else {
      const createdById = maps.user.get(row.createdById);
      if (createdById == null) {
        conflict(`Tournament "${row.name}": createdBy not remapped — skip`);
        bump("tournaments", "conflicts");
        continue;
      }
      if (!APPLY) {
        maps.tournament.set(row.id, -row.id);
        tournamentId = -row.id;
        bump("tournaments", "inserted");
      } else {
        if (createdById < 0) continue;
        const venueId =
          row.venueId != null ? maps.venue.get(row.venueId) ?? null : null;
        const locationId =
          row.locationId != null ? maps.location.get(row.locationId) ?? null : null;
        const sportId =
          row.sportId != null ? maps.sport.get(row.sportId) ?? null : null;
        const created = await target.tournament.create({
          data: {
            name: row.name,
            description: row.description,
            sportId: sportId != null && sportId > 0 ? sportId : null,
            sport: row.sport,
            format: row.format,
            stages: asJson(remapUserIdsInJson(row.stages)),
            matchFormatName: row.matchFormatName,
            venueId: venueId != null && venueId > 0 ? venueId : null,
            locationId: locationId != null && locationId > 0 ? locationId : null,
            createdById,
            maxTeams: row.maxTeams,
            teams: asJson(remapUserIdsInJson(row.teams)),
            registrations: asJson(remapUserIdsInJson(row.registrations)),
            players: asJson(remapUserIdsInJson(row.players)),
            sponsors: asJson(row.sponsors),
            status: row.status,
            winner: asJson(remapUserIdsInJson(row.winner)),
            runnerUp: asJson(remapUserIdsInJson(row.runnerUp)),
            startDate: row.startDate,
            endDate: row.endDate,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        });
        maps.tournament.set(row.id, created.id);
        tournamentId = created.id;
        bump("tournaments", "inserted");
      }
    }

    // Fixtures — insert missing slots only (never rewrite existing)
    for (const fx of row.fixtures) {
      const realTid = maps.tournament.get(row.id)!;
      const existingFx =
        realTid > 0
          ? await target.tournamentFixture.findFirst({
              where: {
                tournamentId: realTid,
                stage: fx.stage,
                round: fx.round,
                matchOrder: fx.matchOrder,
                groupIndex: fx.groupIndex,
              },
            })
          : null;
      if (existingFx) {
        maps.fixture.set(fx.id, existingFx.id);
        bump("tournament_fixtures", "skipped");
        continue;
      }
      if (!APPLY || tournamentId < 0) {
        if (!APPLY) bump("tournament_fixtures", "inserted");
        maps.fixture.set(fx.id, -fx.id);
        continue;
      }
      const created = await target.tournamentFixture.create({
        data: {
          tournamentId,
          stage: fx.stage,
          round: fx.round,
          groupIndex: fx.groupIndex,
          matchOrder: fx.matchOrder,
          team1Type: fx.team1Type,
          team1Ref: asJson(remapUserIdsInJson(fx.team1Ref))!,
          team2Type: fx.team2Type,
          team2Ref: asJson(remapUserIdsInJson(fx.team2Ref))!,
          matchId: null, // link later if match synced
          status: fx.status,
          createdAt: fx.createdAt,
          updatedAt: fx.updatedAt,
        },
      });
      maps.fixture.set(fx.id, created.id);
      bump("tournament_fixtures", "inserted");
    }

    // Co-organizers
    for (const co of row.coOrganizers) {
      const realTid = maps.tournament.get(row.id)!;
      const uid = maps.user.get(co.userId);
      if (uid == null || realTid < 0 || uid < 0) {
        if (!APPLY && uid != null) bump("tournament_co_organizers", "inserted");
        else if (uid == null) bump("tournament_co_organizers", "conflicts");
        continue;
      }
      const existingCo = await target.tournamentCoOrganizer.findUnique({
        where: { tournamentId_userId: { tournamentId: realTid, userId: uid } },
      });
      if (existingCo) {
        bump("tournament_co_organizers", "skipped");
        continue;
      }
      if (!APPLY) {
        bump("tournament_co_organizers", "inserted");
        continue;
      }
      await target.tournamentCoOrganizer.create({
        data: {
          tournamentId: realTid,
          userId: uid,
          role: co.role,
          addedAt: co.addedAt,
        },
      });
      bump("tournament_co_organizers", "inserted");
    }

    // Announcements — match by tournament + title + createdAt day (insert if no same title)
    for (const ann of row.announcements) {
      const realTid = maps.tournament.get(row.id)!;
      if (realTid < 0) {
        if (!APPLY) bump("tournament_announcements", "inserted");
        continue;
      }
      const existingAnn = await target.tournamentAnnouncement.findFirst({
        where: { tournamentId: realTid, title: ann.title },
      });
      if (existingAnn) {
        bump("tournament_announcements", "skipped");
        continue;
      }
      if (!APPLY) {
        bump("tournament_announcements", "inserted");
        continue;
      }
      await target.tournamentAnnouncement.create({
        data: {
          tournamentId: realTid,
          title: ann.title,
          body: ann.body,
          createdAt: ann.createdAt,
        },
      });
      bump("tournament_announcements", "inserted");
    }
  }
}

async function syncBatches() {
  const rows = await source.batch.findMany({
    include: {
      trainer: { select: { email: true } },
      memberships: true,
      sessions: true,
    },
  });

  for (const row of rows) {
    const existing = await target.batch.findFirst({
      where: {
        name: row.name,
        trainer: { email: row.trainer.email },
      },
    });

    let batchId: number;
    if (existing) {
      maps.batch.set(row.id, existing.id);
      batchId = existing.id;
      bump("batches", "skipped");
    } else {
      const trainerId = maps.user.get(row.trainerId);
      if (trainerId == null) {
        conflict(`Batch "${row.name}": trainer not remapped — skip`);
        bump("batches", "conflicts");
        continue;
      }
      if (!APPLY) {
        maps.batch.set(row.id, -row.id);
        batchId = -row.id;
        bump("batches", "inserted");
      } else {
        if (trainerId < 0) continue;
        const venueId =
          row.venueId != null ? maps.venue.get(row.venueId) ?? null : null;
        const locationId =
          row.locationId != null ? maps.location.get(row.locationId) ?? null : null;
        const sportId =
          row.sportId != null ? maps.sport.get(row.sportId) ?? null : null;
        const created = await target.batch.create({
          data: {
            trainerId,
            name: row.name,
            description: row.description,
            locationId: locationId != null && locationId > 0 ? locationId : null,
            venueId: venueId != null && venueId > 0 ? venueId : null,
            venueDiscountPct: row.venueDiscountPct,
            commissionPercent: row.commissionPercent,
            sportId: sportId != null && sportId > 0 ? sportId : null,
            sport: row.sport,
            sportFees: asJson(row.sportFees),
            feeSchedules: asJson(row.feeSchedules),
            capacity: row.capacity,
            skillRatingMin: row.skillRatingMin,
            skillRatingMax: row.skillRatingMax,
            joinType: row.joinType,
            reservationPercent: row.reservationPercent,
            schedule: asJson(row.schedule),
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        });
        maps.batch.set(row.id, created.id);
        batchId = created.id;
        bump("batches", "inserted");
      }
    }

    for (const m of row.memberships) {
      const realBid = maps.batch.get(row.id)!;
      const pid = maps.user.get(m.playerId);
      if (pid == null || realBid < 0 || pid < 0) {
        if (!APPLY && pid != null) bump("batch_memberships", "inserted");
        else if (pid == null) bump("batch_memberships", "conflicts");
        continue;
      }
      const existingM = await target.batchMembership.findUnique({
        where: { batchId_playerId: { batchId: realBid, playerId: pid } },
      });
      if (existingM) {
        bump("batch_memberships", "skipped");
        continue;
      }
      if (!APPLY) {
        bump("batch_memberships", "inserted");
        continue;
      }
      await target.batchMembership.create({
        data: {
          batchId: realBid,
          playerId: pid,
          joinDate: m.joinDate,
          status: m.status,
          reservationStatus: m.reservationStatus,
          paymentStatus: m.paymentStatus,
          createdAt: m.createdAt,
        },
      });
      bump("batch_memberships", "inserted");
    }

    for (const s of row.sessions) {
      const realBid = maps.batch.get(row.id)!;
      if (realBid < 0) {
        if (!APPLY) bump("batch_sessions", "inserted");
        continue;
      }
      const existingS = await target.batchSession.findFirst({
        where: {
          batchId: realBid,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
        },
      });
      if (existingS) {
        bump("batch_sessions", "skipped");
        continue;
      }
      if (!APPLY) {
        bump("batch_sessions", "inserted");
        continue;
      }
      await target.batchSession.create({
        data: {
          batchId: realBid,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        },
      });
      bump("batch_sessions", "inserted");
    }
  }
}

async function syncBookings() {
  const rows = await source.booking.findMany({
    include: {
      user: { select: { email: true } },
      venue: { select: { name: true } },
      payments: true,
    },
  });

  for (const row of rows) {
    const userId = maps.user.get(row.userId);
    const venueId = maps.venue.get(row.venueId);
    if (userId == null || venueId == null) {
      bump("bookings", "conflicts");
      conflict(
        `Booking localId=${row.id}: user/venue not remapped (user=${row.userId}, venue=${row.venueId})`
      );
      continue;
    }

    const existing =
      userId > 0 && venueId > 0
        ? await target.booking.findFirst({
            where: {
              userId,
              venueId,
              bookingDate: row.bookingDate,
              startTime: row.startTime,
              facilityName: row.facilityName,
            },
          })
        : null;

    if (existing) {
      maps.booking.set(row.id, existing.id);
      bump("bookings", "skipped");
      continue;
    }

    if (!APPLY || userId < 0 || venueId < 0) {
      if (!APPLY) bump("bookings", "inserted");
      maps.booking.set(row.id, -row.id);
      continue;
    }

    const facilityId = maps.facility.get(row.facilityId);
    if (facilityId == null || facilityId < 0) {
      conflict(`Booking localId=${row.id}: facility ${row.facilityId} not remapped — skip`);
      bump("bookings", "conflicts");
      continue;
    }

    const sportId =
      row.sportId != null ? maps.sport.get(row.sportId) ?? null : null;
    const batchId =
      row.batchId != null ? maps.batch.get(row.batchId) ?? null : null;
    const createdById =
      row.createdById != null ? maps.user.get(row.createdById) ?? null : null;

    const created = await target.booking.create({
      data: {
        userId,
        createdById: createdById != null && createdById > 0 ? createdById : null,
        bookingType: row.bookingType,
        venueId,
        sportId: sportId != null && sportId > 0 ? sportId : null,
        sport: row.sport,
        facilityId,
        facilityName: row.facilityName,
        facilitySurfaceType: row.facilitySurfaceType,
        bookingDate: row.bookingDate,
        startTime: row.startTime,
        endTime: row.endTime,
        totalHours: row.totalHours,
        subtotal: row.subtotal,
        gstRate: row.gstRate,
        gstAmount: row.gstAmount,
        totalAmount: row.totalAmount,
        platformCommissionPercent: row.platformCommissionPercent,
        platformCommissionAmount: row.platformCommissionAmount,
        venueNetAmount: row.venueNetAmount,
        paymentType: row.paymentType,
        paidAmount: row.paidAmount,
        paymentStatus: row.paymentStatus,
        paymentId: row.paymentId,
        razorpayOrderId: row.razorpayOrderId,
        razorpayPaymentId: row.razorpayPaymentId,
        status: row.status,
        slotId: null,
        batchId: batchId != null && batchId > 0 ? batchId : null,
        discountPercent: row.discountPercent,
        groupId: row.groupId,
        splitCount: row.splitCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
    maps.booking.set(row.id, created.id);
    bump("bookings", "inserted");

    for (const pay of row.payments) {
      if (pay.razorpayOrderId || pay.paymentGatewayId) {
        const dup = await target.bookingPayment.findFirst({
          where: {
            OR: [
              ...(pay.razorpayOrderId
                ? [{ razorpayOrderId: pay.razorpayOrderId }]
                : []),
              ...(pay.paymentGatewayId
                ? [{ paymentGatewayId: pay.paymentGatewayId }]
                : []),
            ],
          },
        });
        if (dup) {
          bump("booking_payments", "skipped");
          continue;
        }
      }
      const payUserId = maps.user.get(pay.userId);
      if (payUserId == null || payUserId < 0) {
        bump("booking_payments", "conflicts");
        continue;
      }
      await target.bookingPayment.create({
        data: {
          bookingId: created.id,
          userId: payUserId,
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          paymentGatewayId: pay.paymentGatewayId,
          razorpayOrderId: pay.razorpayOrderId,
          status: pay.status,
          splitIndex: pay.splitIndex,
          createdAt: pay.createdAt,
        },
      });
      bump("booking_payments", "inserted");
    }
  }
}

async function syncOpenPlays() {
  const rows = await source.openPlay.findMany({ include: { players: true } });
  for (const row of rows) {
    const bookingId = maps.booking.get(row.bookingId);
    if (bookingId == null) {
      bump("open_plays", "conflicts");
      continue;
    }
    if (bookingId > 0) {
      const existing = await target.openPlay.findUnique({ where: { bookingId } });
      if (existing) {
        maps.openPlay.set(row.id, existing.id);
        bump("open_plays", "skipped");
        // still try players
        for (const p of row.players) {
          const uid = maps.user.get(p.userId);
          if (uid == null || uid < 0) continue;
          const ep = await target.openPlayPlayer.findUnique({
            where: { openPlayId_userId: { openPlayId: existing.id, userId: uid } },
          });
          if (ep) {
            bump("open_play_players", "skipped");
            continue;
          }
          if (!APPLY) {
            bump("open_play_players", "inserted");
            continue;
          }
          await target.openPlayPlayer.create({
            data: { openPlayId: existing.id, userId: uid },
          });
          bump("open_play_players", "inserted");
        }
        continue;
      }
    }

    if (!APPLY || bookingId < 0) {
      if (!APPLY) bump("open_plays", "inserted");
      maps.openPlay.set(row.id, -row.id);
      continue;
    }

    const venueId = maps.venue.get(row.venueId);
    const createdById = maps.user.get(row.createdById);
    if (venueId == null || venueId < 0 || createdById == null || createdById < 0) {
      bump("open_plays", "conflicts");
      continue;
    }
    const sportId =
      row.sportId != null ? maps.sport.get(row.sportId) ?? null : null;
    const facilityId =
      row.facilityId != null ? maps.facility.get(row.facilityId) ?? null : null;

    const created = await target.openPlay.create({
      data: {
        bookingId,
        venueId,
        sportId: sportId != null && sportId > 0 ? sportId : null,
        sport: row.sport,
        formatName: row.formatName,
        playersPerTeam: row.playersPerTeam,
        maxPlayers: row.maxPlayers,
        minimumPlayers: row.minimumPlayers,
        createdById,
        facilityId: facilityId != null && facilityId > 0 ? facilityId : null,
        facilityName: row.facilityName,
        title: row.title,
        status: row.status,
        bookingDate: row.bookingDate,
        startTime: row.startTime,
        endTime: row.endTime,
        pricePerPlayer: row.pricePerPlayer,
        skillLevel: row.skillLevel,
        skillRatingMin: row.skillRatingMin,
        skillRatingMax: row.skillRatingMax,
        notes: row.notes,
        joinDeadlineAt: row.joinDeadlineAt,
        hostProtectionAmount: row.hostProtectionAmount,
        hostProtectionStatus: row.hostProtectionStatus,
        pricingLockedAt: row.pricingLockedAt,
        finalPlayerCount: row.finalPlayerCount,
        finalPricePerPlayer: row.finalPricePerPlayer,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
    maps.openPlay.set(row.id, created.id);
    bump("open_plays", "inserted");

    for (const p of row.players) {
      const uid = maps.user.get(p.userId);
      if (uid == null || uid < 0) continue;
      await target.openPlayPlayer.create({
        data: { openPlayId: created.id, userId: uid },
      });
      bump("open_play_players", "inserted");
    }
  }
}

async function syncMatches() {
  const rows = await source.match.findMany({ include: { events: true } });
  for (const row of rows) {
    const sportId = maps.sport.get(row.sportId);
    if (sportId == null) {
      bump("matches", "conflicts");
      continue;
    }

    // Natural key: tournament+date+format or venue+date+sport+status
    const tournamentId =
      row.tournamentId != null ? maps.tournament.get(row.tournamentId) ?? null : null;
    const venueId =
      row.venueId != null ? maps.venue.get(row.venueId) ?? null : null;

    const existing =
      sportId > 0
        ? await target.match.findFirst({
            where: {
              sportId: sportId > 0 ? sportId : undefined,
              matchDate: row.matchDate,
              formatName: row.formatName,
              ...(tournamentId != null && tournamentId > 0
                ? { tournamentId }
                : {}),
              ...(venueId != null && venueId > 0 ? { venueId } : {}),
              status: row.status,
            },
          })
        : null;

    if (existing) {
      maps.match.set(row.id, existing.id);
      bump("matches", "skipped");
      continue;
    }

    if (!APPLY || sportId < 0) {
      if (!APPLY) bump("matches", "inserted");
      maps.match.set(row.id, -row.id);
      continue;
    }

    const locationId =
      row.locationId != null ? maps.location.get(row.locationId) ?? null : null;
    const bookingId =
      row.bookingId != null ? maps.booking.get(row.bookingId) ?? null : null;
    const createdById =
      row.createdById != null ? maps.user.get(row.createdById) ?? null : null;

    const created = await target.match.create({
      data: {
        activityId: null,
        bookingId: bookingId != null && bookingId > 0 ? bookingId : null,
        tournamentId: tournamentId != null && tournamentId > 0 ? tournamentId : null,
        sportId,
        sportName: row.sportName,
        formatName: row.formatName,
        playersPerTeam: row.playersPerTeam,
        venueId: venueId != null && venueId > 0 ? venueId : null,
        locationId: locationId != null && locationId > 0 ? locationId : null,
        matchType: row.matchType,
        loggingMode: row.loggingMode,
        teams: asJson(remapUserIdsInJson(row.teams)),
        winnerTeam: row.winnerTeam,
        matchDate: row.matchDate,
        scores: asJson(row.scores),
        scoreType: row.scoreType,
        status: row.status,
        playerStats: asJson(remapUserIdsInJson(row.playerStats)),
        createdById: createdById != null && createdById > 0 ? createdById : null,
        statsProcessed: row.statsProcessed,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
    maps.match.set(row.id, created.id);
    bump("matches", "inserted");

    for (const ev of row.events) {
      await target.matchEvent.create({
        data: {
          matchId: created.id,
          eventType: ev.eventType,
          team: ev.team,
          playerId: ev.playerId != null ? maps.user.get(ev.playerId) ?? null : null,
          eventValue: ev.eventValue,
          eventTimestamp: ev.eventTimestamp,
          metadata: asJson(ev.metadata),
          createdAt: ev.createdAt,
        },
      });
      bump("match_events", "inserted");
    }
  }
  // Intentionally do not UPDATE fixture.matchId on Railway (no-overwrite rule).
}

async function syncRatingsAndConnections() {
  // Sport skill ratings
  const ratings = await source.sportSkillRating.findMany();
  for (const r of ratings) {
    const userId = maps.user.get(r.userId);
    const sportId = maps.sport.get(r.sportId);
    if (userId == null || sportId == null || userId < 0 || sportId < 0) {
      if (!APPLY && userId != null && sportId != null) bump("sport_skill_ratings", "inserted");
      else if (userId == null || sportId == null) bump("sport_skill_ratings", "conflicts");
      continue;
    }
    const existing = await target.sportSkillRating.findUnique({
      where: {
        userId_sportId_formatName: {
          userId,
          sportId,
          formatName: r.formatName,
        },
      },
    });
    if (existing) {
      bump("sport_skill_ratings", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("sport_skill_ratings", "inserted");
      continue;
    }
    await target.sportSkillRating.create({
      data: {
        userId,
        sportId,
        formatName: r.formatName,
        rating: r.rating,
        matchesPlayed: r.matchesPlayed,
        winsCount: r.winsCount,
        totalMOVSum: r.totalMOVSum,
        confidence: r.confidence,
        lastUpdated: r.lastUpdated,
      },
    });
    bump("sport_skill_ratings", "inserted");
  }

  // Player connections
  const conns = await source.playerConnection.findMany();
  for (const c of conns) {
    const userId = maps.user.get(c.userId);
    const connectedUserId = maps.user.get(c.connectedUserId);
    if (
      userId == null ||
      connectedUserId == null ||
      userId < 0 ||
      connectedUserId < 0
    ) {
      if (!APPLY && userId != null && connectedUserId != null) {
        bump("player_connections", "inserted");
      } else if (userId == null || connectedUserId == null) {
        bump("player_connections", "conflicts");
      }
      continue;
    }
    const existing = await target.playerConnection.findUnique({
      where: {
        userId_connectedUserId_connectionType: {
          userId,
          connectedUserId,
          connectionType: c.connectionType,
        },
      },
    });
    if (existing) {
      bump("player_connections", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("player_connections", "inserted");
      continue;
    }
    const venueId =
      c.venueId != null ? maps.venue.get(c.venueId) ?? null : null;
    await target.playerConnection.create({
      data: {
        userId,
        connectedUserId,
        connectionType: c.connectionType,
        venueId: venueId != null && venueId > 0 ? venueId : null,
        playCount: c.playCount,
        lastActivityAt: c.lastActivityAt,
      },
    });
    bump("player_connections", "inserted");
  }

  // Venue reviews
  const vReviews = await source.venueReview.findMany();
  for (const r of vReviews) {
    const userId = maps.user.get(r.userId);
    const venueId = maps.venue.get(r.venueId);
    if (userId == null || venueId == null || userId < 0 || venueId < 0) {
      if (!APPLY && userId != null && venueId != null) bump("venue_reviews", "inserted");
      else if (userId == null || venueId == null) bump("venue_reviews", "conflicts");
      continue;
    }
    const existing = await target.venueReview.findUnique({
      where: { venueId_userId: { venueId, userId } },
    });
    if (existing) {
      bump("venue_reviews", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("venue_reviews", "inserted");
      continue;
    }
    await target.venueReview.create({
      data: {
        venueId,
        userId,
        rating: r.rating,
        review: r.review,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    bump("venue_reviews", "inserted");
  }

  // Trainer reviews
  const tReviews = await source.trainerReview.findMany();
  for (const r of tReviews) {
    const userId = maps.user.get(r.userId);
    const trainerId = maps.user.get(r.trainerId);
    if (userId == null || trainerId == null || userId < 0 || trainerId < 0) {
      if (!APPLY && userId != null && trainerId != null) bump("trainer_reviews", "inserted");
      else if (userId == null || trainerId == null) bump("trainer_reviews", "conflicts");
      continue;
    }
    const existing = await target.trainerReview.findUnique({
      where: { trainerId_userId: { trainerId, userId } },
    });
    if (existing) {
      bump("trainer_reviews", "skipped");
      continue;
    }
    if (!APPLY) {
      bump("trainer_reviews", "inserted");
      continue;
    }
    await target.trainerReview.create({
      data: {
        trainerId,
        userId,
        rating: r.rating,
        review: r.review,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    bump("trainer_reviews", "inserted");
  }
}

async function syncWalletsForNewUsers() {
  // Only create wallets for users we inserted in this run — never touch existing
  for (const localUserId of newlyInsertedUsers) {
    const targetUserId = maps.user.get(localUserId);
    if (targetUserId == null || targetUserId < 0) {
      if (!APPLY) bump("wallet_accounts", "inserted");
      continue;
    }
    const existing = await target.walletAccount.findUnique({
      where: { userId: targetUserId },
    });
    if (existing) {
      bump("wallet_accounts", "skipped");
      continue;
    }

    const localWallet = await source.walletAccount.findUnique({
      where: { userId: localUserId },
      include: { transactions: true },
    });

    if (!APPLY) {
      bump("wallet_accounts", "inserted");
      if (localWallet) bump("wallet_transactions", "inserted");
      continue;
    }

    const created = await target.walletAccount.create({
      data: {
        userId: targetUserId,
        balance: localWallet?.balance ?? 0,
        createdAt: localWallet?.createdAt,
      },
    });
    maps.wallet.set(localWallet?.id ?? localUserId, created.id);
    bump("wallet_accounts", "inserted");

    if (localWallet) {
      for (const tx of localWallet.transactions) {
        await target.walletTransaction.create({
          data: {
            walletId: created.id,
            userId: targetUserId,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            referenceType: tx.referenceType,
            referenceId: null, // don't cross-wire refs to wrong DB ids
            balanceAfter: tx.balanceAfter,
            createdAt: tx.createdAt,
          },
        });
        bump("wallet_transactions", "inserted");
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀  Push missing local → Railway (${APPLY ? "APPLY" : "DRY-RUN"})\n`);

  // Mask host for logs
  try {
    const u = new URL(TARGET_URL.replace(/^mysql:\/\//, "http://"));
    console.log(`   Target host: ${u.host}`);
  } catch {
    console.log("   Target: (url set)");
  }

  await syncLocations();
  console.log("  ✓ locations");
  await syncSports();
  console.log("  ✓ sports + formats");
  await syncUsers();
  console.log("  ✓ users");
  await syncTrainerProfiles();
  console.log("  ✓ trainer_profiles");
  await syncVenues();
  console.log("  ✓ venues + facilities + rates");
  await syncTournaments();
  console.log("  ✓ tournaments + fixtures");
  await syncBatches();
  console.log("  ✓ batches");
  await syncBookings();
  console.log("  ✓ bookings");
  await syncOpenPlays();
  console.log("  ✓ open_plays");
  await syncMatches();
  console.log("  ✓ matches");
  await syncRatingsAndConnections();
  console.log("  ✓ ratings / connections / reviews");
  await syncWalletsForNewUsers();
  console.log("  ✓ wallets (new users only)");

  console.log("\n──────── Summary ────────");
  const entities = Object.keys(stats).sort();
  let totalIns = 0;
  let totalSkip = 0;
  let totalConf = 0;
  for (const e of entities) {
    const s = stats[e];
    totalIns += s.inserted;
    totalSkip += s.skipped;
    totalConf += s.conflicts;
    console.log(
      `  ${e.padEnd(28)} insert=${s.inserted}  skip=${s.skipped}  conflict=${s.conflicts}`
    );
  }
  console.log("  ────────────────────────────");
  console.log(
    `  TOTAL                        insert=${totalIns}  skip=${totalSkip}  conflict=${totalConf}`
  );

  if (conflicts.length) {
    console.log("\n──────── Conflicts (sample) ────────");
    for (const c of conflicts.slice(0, 40)) console.log(`  • ${c}`);
    if (conflicts.length > 40) console.log(`  … and ${conflicts.length - 40} more`);
  }

  if (!APPLY) {
    console.log(
      "\nℹ️  Dry-run only. Re-run with --apply to insert missing rows on Railway.\n"
    );
  } else {
    console.log("\n✅  Apply complete. Existing Railway rows were not updated.\n");
  }
}

main()
  .catch((err) => {
    console.error("\n❌  Fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
