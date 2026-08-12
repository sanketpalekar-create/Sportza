/**
 * MySQL-compatible Prisma filters for Location fields.
 * Do not use `mode: "insensitive"` — unsupported by Prisma's MySQL provider.
 */

export function locationCityContains(city: string) {
  return { contains: city };
}

export function locationStateContains(state: string) {
  return { contains: state };
}
