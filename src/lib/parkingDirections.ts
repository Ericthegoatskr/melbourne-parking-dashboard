import { UNMAPPED_STREET } from './parkingModel';
import type { StreetAvailability } from './types';

export interface ParkingDirections {
  readonly google: string;
  readonly apple: string;
}

/**
 * Directions end at the nearby model's actual sensor bay, never the legacy
 * whole-street centroid. Availability/freshness explanations belong to the UI;
 * a navigation link itself does not promise that the target is still free.
 *
 * Neither provider receives an origin, searched address, or device fix here.
 * Maps chooses its own starting point after the user explicitly opens a link.
 * Official URL contracts:
 * https://developers.google.com/maps/documentation/urls/get-started
 * https://developer.apple.com/documentation/mapkit/unified-map-urls
 */
export function directionsForStreet(street: StreetAvailability): ParkingDirections | null {
  if (!street.street.trim() || street.street === UNMAPPED_STREET
    || !('nearestBayId' in street) || typeof street.nearestBayId !== 'number'
    || !Number.isSafeInteger(street.nearestBayId) || street.nearestBayId <= 0
    || !('distanceMetres' in street) || typeof street.distanceMetres !== 'number'
    || !Number.isFinite(street.distanceMetres) || street.distanceMetres < 0
    || !Number.isFinite(street.lat) || Math.abs(street.lat) > 90
    || !Number.isFinite(street.lon) || Math.abs(street.lon) > 180) return null;

  const destination = `${street.lat},${street.lon}`;
  const google = new URL('https://www.google.com/maps/dir/');
  google.search = new URLSearchParams({
    api: '1', destination, travelmode: 'driving', dir_action: 'navigate',
  }).toString();
  const apple = new URL('https://maps.apple.com/directions');
  apple.search = new URLSearchParams({ destination, mode: 'driving' }).toString();
  return { google: google.toString(), apple: apple.toString() };
}
