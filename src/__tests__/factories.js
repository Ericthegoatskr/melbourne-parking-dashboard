import { SENSOR_TRUST_WINDOW_MINUTES } from '../lib/config';
export const BASE_TIME = '2026-09-08T18:30:00+00:00';
export function rawBay(overrides = {}) {
    return {
        kerbsideid: 1,
        zone_number: 7001,
        status_description: 'Unoccupied',
        status_timestamp: BASE_TIME,
        lastupdated: BASE_TIME,
        location: { lat: -37.8, lon: 144.96 },
        ...overrides,
    };
}
/** A payload large enough to clear the minimum-record floor. */
export function validPayload(count = 6000, mutate) {
    return Array.from({ length: count }, (_, index) => rawBay({ kerbsideid: index + 1, ...(mutate?.(index) ?? {}) }));
}
export function minutesBefore(iso, minutes) {
    return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}
export const WELL_OUTSIDE_TRUST_WINDOW = SENSOR_TRUST_WINDOW_MINUTES + 60;
