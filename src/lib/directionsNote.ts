import type { FeedState, StreetAvailability } from './types';

/** Directions locate a sensor; they never reserve or predict a parking space. */
export function directionsNote(street: StreetAvailability, state: FeedState): string {
  if (state === 'stale' || state === 'unavailable') {
    return 'Parking readings are out of date. This is a sensor location, not a confirmed free bay.';
  }
  if (street.vacant + street.occupied === 0) {
    return 'No sensors are reporting on this street. Availability is unknown; directions lead to a mapped sensor location.';
  }
  if (street.vacant === 0) {
    return 'No free bays are reported on this street. Directions lead to its nearest reporting sensor location.';
  }
  if (state === 'delayed') {
    return 'Readings are delayed. Directions lead to a bay reported free, but its status may have changed.';
  }
  return 'Directions lead to the nearest bay reported free on this street, relative to your search point.';
}
