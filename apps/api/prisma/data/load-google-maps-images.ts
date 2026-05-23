/**
 * Load Google Maps venue photo URLs from exported CSV files.
 */
import * as fs from "fs";
import * as path from "path";

export interface GoogleMapsImageRow {
  placeId: string;
  name: string;
  images: string[];
}

const DATA_DIR = path.join(__dirname, "google-maps");

const CSV_FILES = [
  path.join(DATA_DIR, "pickleball-nashik.csv"),
  path.join(DATA_DIR, "turfs-nashik.csv"),
];

/** Parse a single CSV line respecting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function readCsvRecords(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    records.push(row);
  }
  return records;
}

function buildImagesFromRow(row: Record<string, string>): string[] {
  const streetView = row.street_view?.trim() ?? "";
  const photo = row.photo?.trim() ?? "";
  const logo = row.logo?.trim() ?? "";

  const images: string[] = [];
  const primary = streetView || photo;
  if (primary) images.push(primary);
  if (photo && photo !== primary) images.push(photo);
  if (logo && !images.includes(logo)) images.push(logo);
  return images;
}

/** Normalize venue names for fuzzy matching. */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\bnashik\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function loadGoogleMapsImageRows(): GoogleMapsImageRow[] {
  const rows: GoogleMapsImageRow[] = [];
  const seenPlaceIds = new Set<string>();

  for (const file of CSV_FILES) {
    if (!fs.existsSync(file)) {
      console.warn(`[load-google-maps-images] Missing file: ${file}`);
      continue;
    }
    for (const record of readCsvRecords(file)) {
      const placeId = record.place_id?.trim();
      const name = record.name?.trim();
      const images = buildImagesFromRow(record);
      if (!placeId || !name || images.length === 0) continue;
      if (seenPlaceIds.has(placeId)) continue;
      seenPlaceIds.add(placeId);
      rows.push({ placeId, name, images });
    }
  }
  return rows;
}

export function imageMapByPlaceId(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of loadGoogleMapsImageRows()) {
    map.set(row.placeId, row.images);
  }
  return map;
}

export function imageMapByNormalizedName(): Map<string, GoogleMapsImageRow> {
  const map = new Map<string, GoogleMapsImageRow>();
  for (const row of loadGoogleMapsImageRows()) {
    map.set(normalizeVenueName(row.name), row);
  }
  return map;
}

/** Primary hero image URL for a place_id (first in array). */
export function primaryImageForPlaceId(placeId: string): string | undefined {
  return imageMapByPlaceId().get(placeId)?.[0];
}
