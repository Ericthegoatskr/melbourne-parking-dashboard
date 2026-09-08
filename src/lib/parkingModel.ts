import type {
  Bay,
  CitySummary,
  SignRestriction,
  Snapshot,
  StreetAvailability,
  ZoneCrosswalk,
} from './types';

/**
 * Roll a snapshot up to the city.
 *
 * Only sensors that reported recently contribute to `vacant` and `occupied`.
 * Sensors that have gone quiet are counted in `notReporting` and are never
 * folded into availability: a bay we have not heard from is an unknown, not a
 * free space.
 */
export function summarise(snapshot: Snapshot): CitySummary {
  let vacant = 0;
  let occupied = 0;
  let notReporting = 0;

  for (const bay of snapshot.bays) {
    if (!bay.trusted) notReporting += 1;
    else if (bay.occupied) occupied += 1;
    else vacant += 1;
  }

  const reporting = vacant + occupied;
  const total = reporting + notReporting;

  return {
    vacant,
    occupied,
    reporting,
    notReporting,
    total,
    vacancyRate: reporting === 0 ? null : vacant / reporting,
    coverage: total === 0 ? 0 : reporting / total,
  };
}

/** Label used for bays the council datasets cannot place on a named street. */
export const UNMAPPED_STREET = 'Unmapped bays';

interface Bucket {
  street: string;
  zones: Set<number>;
  total: number;
  vacant: number;
  occupied: number;
  notReporting: number;
  latSum: number;
  lonSum: number;
  /** Every distinct signage code seen anywhere on the street. */
  codes: Map<string, string | null>;
}

/**
 * Group bays by the street their zone belongs to.
 *
 * Bays with no zone, or a zone absent from the council crosswalk, are grouped
 * under UNMAPPED_STREET rather than dropped, so the street totals always add
 * back up to the city totals.
 */
export function groupByStreet(
  bays: readonly Bay[],
  crosswalk: ZoneCrosswalk,
): StreetAvailability[] {
  const buckets = new Map<string, Bucket>();

  for (const bay of bays) {
    const reference = bay.zone === null ? undefined : crosswalk[String(bay.zone)];
    const street = reference?.street ?? UNMAPPED_STREET;

    let bucket = buckets.get(street);
    if (!bucket) {
      bucket = {
        street,
        zones: new Set(),
        total: 0,
        vacant: 0,
        occupied: 0,
        notReporting: 0,
        latSum: 0,
        lonSum: 0,
        codes: new Map(),
      };
      buckets.set(street, bucket);
    }

    for (const restriction of reference?.restrictions ?? []) {
      if (!bucket.codes.has(restriction.code)) {
        bucket.codes.set(restriction.code, restriction.days);
      }
    }

    if (bay.zone !== null) bucket.zones.add(bay.zone);
    bucket.total += 1;
    bucket.latSum += bay.lat;
    bucket.lonSum += bay.lon;
    if (!bay.trusted) bucket.notReporting += 1;
    else if (bay.occupied) bucket.occupied += 1;
    else bucket.vacant += 1;
  }

  return [...buckets.values()].map((bucket) => {
    const reporting = bucket.vacant + bucket.occupied;
    // Only state a restriction when the whole street agrees on one. Otherwise
    // say it varies: a street that is metered in one block and a loading zone
    // in the next has no single true answer to put on a row.
    const codes: SignRestriction[] = [...bucket.codes.entries()].map(([code, days]) => ({
      code,
      days,
    }));
    const restriction: SignRestriction | null = codes.length === 1 ? codes[0]! : null;
    return {
      street: bucket.street,
      zones: [...bucket.zones].sort((a, b) => a - b),
      total: bucket.total,
      vacant: bucket.vacant,
      occupied: bucket.occupied,
      notReporting: bucket.notReporting,
      vacancyRate: reporting === 0 ? null : bucket.vacant / reporting,
      lat: bucket.latSum / bucket.total,
      lon: bucket.lonSum / bucket.total,
      restriction,
      restrictionCodes: codes,
      restrictionVaries: codes.length > 1,
    };
  });
}

export type StreetSort = 'most-vacant' | 'best-odds' | 'name';

/**
 * Rank streets for "where can I actually park".
 *
 * `best-odds` sorts by vacancy rate but requires a minimum number of reporting
 * sensors, so a single free bay on a two-sensor street cannot top the list at
 * 100%. Streets with nothing reporting sort last under every mode; they are
 * shown, but never recommended.
 */
export function sortStreets(
  streets: readonly StreetAvailability[],
  mode: StreetSort,
  minReporting = 5,
): StreetAvailability[] {
  const sorted = [...streets];
  if (mode === 'name') {
    return sorted.sort((a, b) => a.street.localeCompare(b.street));
  }

  return sorted.sort((a, b) => {
    // "Unmapped bays" is a bookkeeping group, not a place you can drive to.
    // It stays visible so the totals reconcile, but it is never a suggestion.
    const aReal = a.street !== UNMAPPED_STREET;
    const bReal = b.street !== UNMAPPED_STREET;
    if (aReal !== bReal) return aReal ? -1 : 1;

    const aReporting = a.vacant + a.occupied;
    const bReporting = b.vacant + b.occupied;
    if (aReporting === 0 && bReporting === 0) return a.street.localeCompare(b.street);
    if (aReporting === 0) return 1;
    if (bReporting === 0) return -1;

    if (mode === 'most-vacant') return b.vacant - a.vacant || a.street.localeCompare(b.street);

    const aEligible = aReporting >= minReporting;
    const bEligible = bReporting >= minReporting;
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    return (b.vacancyRate ?? -1) - (a.vacancyRate ?? -1) || b.vacant - a.vacant;
  });
}

/**
 * Human-readable expansion of City of Melbourne signage codes.
 *
 * No middots inside a label: the street row already separates its own fields
 * with them, and a label carrying one turns the line into mush.
 */
const RESTRICTION_LABELS: Record<string, string> = {
  '1P': '1hr', '2P': '2hr', '3P': '3hr', '4P': '4hr', '5P': '5hr',
  MP1P: 'Metered 1hr', MP2P: 'Metered 2hr',
  MP3P: 'Metered 3hr', MP4P: 'Metered 4hr',
  FP1P: 'Ticket 1hr', FP2P: 'Ticket 2hr', FP15: 'Ticket 15min',
  LZ30: 'Loading zone 30min', PP: 'Permit only', QP: 'Bus/coach zone',
  SP: 'Special conditions', DP2P: 'Disability 2hr',
};

export function describeRestriction(code: string | null | undefined): string | null {
  if (!code) return null;
  return RESTRICTION_LABELS[code] ?? code;
}

/**
 * One line of signage guidance for a street row.
 *
 * When a street carries one restriction we name it, with its days. When it
 * carries several we name what is actually there rather than a bare "varies":
 * knowing a street is part metered and part loading zone is more use than
 * knowing only that we could not decide. Either way the row stops short of
 * telling the reader which applies to their bay — the sign does that.
 *
 * Returns null when we have nothing trustworthy to say.
 */
export function describeStreetSignage(street: StreetAvailability): string | null {
  const labels = street.restrictionCodes
    .map((restriction) => describeRestriction(restriction.code))
    .filter((label): label is string => label !== null);

  if (labels.length === 0) return null;

  if (!street.restrictionVaries) {
    const days = street.restriction?.days;
    return days ? `${labels[0]} (${days})` : labels[0]!;
  }

  const shown = labels.slice(0, 2).join(' / ');
  const rest = labels.length - 2;
  return `${shown}${rest > 0 ? ` +${rest} more` : ''} — read the sign`;
}

/** Filter streets by a free-text query on the street name. */
export function filterStreets(
  streets: readonly StreetAvailability[],
  query: string,
): StreetAvailability[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...streets];
  return streets.filter((street) => street.street.toLowerCase().includes(needle));
}
