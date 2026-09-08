/**
 * Generate the zone -> street / restriction crosswalk.
 *
 * Streets and signage change on a council timescale, not a sensor timescale,
 * so this is reference data baked in at build time rather than fetched on every
 * page load. It carries no availability figures and no timestamps: nothing in
 * here can make stale live data look fresh.
 *
 *   npm run build:crosswalk   ->  public/data/zone-crosswalk.json
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ODS = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets';
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data/zone-crosswalk.json',
);

interface Segment {
  parkingzone: number | null;
  onstreet: string | null;
  streetfrom: string | null;
  streetto: string | null;
}
interface SignPlate {
  parkingzone: number | null;
  restriction_display: string | null;
  restriction_days: string | null;
}

async function exportAll<T>(dataset: string, select: string): Promise<T[]> {
  const url = `${ODS}/${dataset}/exports/json?select=${encodeURIComponent(select)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${dataset}: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error(`${dataset}: expected an array`);
  return data as T[];
}

async function main(): Promise<void> {
  const [segments, plates] = await Promise.all([
    exportAll<Segment>(
      'parking-zones-linked-to-street-segments',
      'parkingzone,onstreet,streetfrom,streetto',
    ),
    exportAll<SignPlate>(
      'sign-plates-located-in-each-parking-zone',
      'parkingzone,restriction_display,restriction_days',
    ),
  ]);

  // Keep every distinct plate per zone. Picking one would be a guess, and a
  // wrong guess here is the difference between a legal park and a fine.
  const restrictions = new Map<number, Map<string, string | null>>();
  for (const plate of plates) {
    if (typeof plate.parkingzone !== 'number') continue;
    if (!plate.restriction_display) continue;
    let byCode = restrictions.get(plate.parkingzone);
    if (!byCode) {
      byCode = new Map();
      restrictions.set(plate.parkingzone, byCode);
    }
    if (!byCode.has(plate.restriction_display)) {
      byCode.set(plate.restriction_display, plate.restriction_days ?? null);
    }
  }

  const crosswalk: Record<string, unknown> = {};
  for (const segment of segments) {
    const zone = segment.parkingzone;
    if (typeof zone !== 'number') continue;
    if (!segment.onstreet) continue;
    if (crosswalk[String(zone)]) continue;
    const byCode = restrictions.get(zone);
    crosswalk[String(zone)] = {
      street: segment.onstreet,
      from: segment.streetfrom ?? null,
      to: segment.streetto ?? null,
      restrictions: [...(byCode?.entries() ?? [])].map(([code, days]) => ({ code, days })),
    };
  }

  const zoneCount = Object.keys(crosswalk).length;
  if (zoneCount < 500) {
    throw new Error(`Refusing to write a crosswalk with only ${zoneCount} zones.`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(crosswalk, null, 0)}\n`, 'utf8');

  const values = Object.values(crosswalk) as { restrictions: unknown[] }[];
  const withRestriction = values.filter((z) => z.restrictions.length > 0).length;
  const multiPlate = values.filter((z) => z.restrictions.length > 1).length;
  console.log(`Wrote ${zoneCount} zones to ${OUT}`);
  console.log(`  street names:      ${zoneCount}`);
  console.log(`  with signage:      ${withRestriction}`);
  console.log(`  multiple plates:   ${multiPlate} (shown as "varies")`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
