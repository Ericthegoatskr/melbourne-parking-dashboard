import { groupByStreet, UNMAPPED_STREET } from './parkingModel';
import type { Bay, StreetAvailability, ZoneCrosswalk } from './types';

export interface Destination {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
}

export interface NearbyStreet extends StreetAvailability {
  /** Straight-line distance to the representative sensor, not a walking route. */
  readonly distanceMetres: number;
  readonly nearestBayId: number;
}

export type NearbySort = 'nearest' | 'most-vacant';

const EARTH_RADIUS_METRES = 6_371_000;
const TO_RADIANS = Math.PI / 180;

function validCoordinates(point: { lat: number; lon: number }): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

function distanceBetween(a: Destination, b: Bay): number {
  const latDelta = (b.lat - a.lat) * TO_RADIANS;
  const lonDelta = (b.lon - a.lon) * TO_RADIANS;
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(a.lat * TO_RADIANS) * Math.cos(b.lat * TO_RADIANS)
      * Math.sin(lonDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

/** A vacant, reporting sensor takes precedence over occupied and unknown bays. */
function bayTier(bay: Bay): number {
  return !bay.trusted ? 2 : bay.occupied ? 1 : 0;
}

function streetTier(street: StreetAvailability): number {
  return street.vacant > 0 ? 0 : street.occupied > 0 ? 1 : 2;
}

/**
 * Count and rank only named sensor bays inside the destination radius.
 *
 * A long street may extend far outside the search area. Filtering individual
 * bays before aggregating prevents its remote empty bays from inflating the
 * nearby result. The map pin is an actual sensor location: nearest trusted
 * vacant bay where possible, then occupied, then unknown. Bay.trusted remains
 * owned by the feed's freshness model; this function never upgrades a reading.
 */
export function nearbyStreets(
  bays: readonly Bay[],
  crosswalk: ZoneCrosswalk,
  destination: Destination,
  radiusMetres: number,
  sort: NearbySort,
): NearbyStreet[] {
  if (!validCoordinates(destination) || !Number.isFinite(radiusMetres) || radiusMetres < 0) return [];

  const nearbyBays: Bay[] = [];
  const representatives = new Map<string, { bay: Bay; distance: number }>();

  for (const bay of bays) {
    if (!validCoordinates(bay) || bay.zone === null) continue;
    const street = crosswalk[String(bay.zone)]?.street;
    if (!street?.trim() || street === UNMAPPED_STREET) continue;
    const distance = distanceBetween(destination, bay);
    if (distance > radiusMetres) continue;
    nearbyBays.push(bay);

    const previous = representatives.get(street);
    if (!previous || bayTier(bay) < bayTier(previous.bay)
      || (bayTier(bay) === bayTier(previous.bay)
        && (distance < previous.distance || (distance === previous.distance && bay.id < previous.bay.id)))) {
      representatives.set(street, { bay, distance });
    }
  }

  return groupByStreet(nearbyBays, crosswalk).map((street): NearbyStreet => {
    const representative = representatives.get(street.street)!;
    return {
      ...street,
      lat: representative.bay.lat,
      lon: representative.bay.lon,
      distanceMetres: representative.distance,
      nearestBayId: representative.bay.id,
    };
  }).sort((a, b) => {
    const tier = streetTier(a) - streetTier(b);
    if (tier !== 0) return tier;
    const distance = a.distanceMetres - b.distanceMetres;
    const vacancy = b.vacant - a.vacant;
    return (sort === 'nearest' ? distance || vacancy : vacancy || distance)
      || a.street.localeCompare(b.street);
  });
}

/** Approximate distances so the UI does not imply survey or route precision. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  const rounded = metres === 0 ? 0 : Math.max(10, Math.round(metres / 10) * 10);
  return rounded < 1000 ? `${rounded} m` : `${(rounded / 1000).toFixed(1)} km`;
}
