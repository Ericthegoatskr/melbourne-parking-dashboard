import { SENSOR_TRUST_WINDOW_MINUTES } from '../lib/config';

export const BASE_TIME = '2026-09-08T18:30:00+00:00';

/**
 * Overrides accept an explicit `undefined` so a test can model a field the
 * council feed omitted entirely, which is a case validation must handle.
 */
interface BayOverrides {
  kerbsideid?: number | undefined;
  zone_number?: number | null | undefined;
  status_description?: string | undefined;
  status_timestamp?: string | undefined;
  lastupdated?: string | undefined;
  location?: unknown;
}

export function rawBay(overrides: BayOverrides = {}): Record<string, unknown> {
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
export function validPayload(
  count = 6000,
  mutate?: (index: number) => BayOverrides,
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) =>
    rawBay({ kerbsideid: index + 1, ...(mutate?.(index) ?? {}) }),
  );
}

export function minutesBefore(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

export const WELL_OUTSIDE_TRUST_WINDOW = SENSOR_TRUST_WINDOW_MINUTES + 60;
