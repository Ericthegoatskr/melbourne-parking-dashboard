import { ODS_BASE } from './config';
import type { Destination } from './nearbyParking';

const LANDMARK_DATASET =
  'landmarks-and-places-of-interest-including-schools-theatres-health-services-spor';
const SEARCH_TIMEOUT_MS = 10_000;
const SOURCE_LIMIT = 8;

/** City of Melbourne CC BY 4.0 reference points, verified 2026-11-08. */
export const LANDMARKS: readonly Destination[] = [
  { id: 'landmark:flinders-street', label: 'Flinders Street Railway Station', lat: -37.8179063007545, lon: 144.967064817875 },
  { id: 'landmark:queen-victoria-market', label: 'Queen Victoria Market', lat: -37.8075002018073, lon: 144.957158515056 },
  { id: 'landmark:melbourne-central', label: 'Melbourne Central', lat: -37.8105371797142, lon: 144.962749729496 },
  { id: 'landmark:state-library', label: 'State Library Victoria', lat: -37.8099852201226, lon: 144.964330322397 },
  { id: 'landmark:federation-square', label: 'Federation Square', lat: -37.8178516571684, lon: 144.968963600783 },
  { id: 'landmark:southern-cross', label: 'Southern Cross Railway Station', lat: -37.8181633057171, lon: 144.952944748845 },
  { id: 'landmark:royal-melbourne-hospital', label: 'Royal Melbourne Hospital', lat: -37.7993071664096, lon: 144.956389746765 },
  { id: 'landmark:university-of-melbourne', label: 'University of Melbourne', lat: -37.7982892284927, lon: 144.96099520158 },
];

export interface DestinationSearchResult {
  destinations: Destination[];
  /** Some official results could not be loaded or validated. Show a retry hint. */
  partial: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPoint(value: unknown): { lat: number; lon: number } | null {
  if (!isObject(value)) return null;
  const { lat, lon } = value;
  // A generous Melbourne envelope catches reversed coordinates and corrupt data.
  if (typeof lat !== 'number' || typeof lon !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -38.1 || lat > -37.5 || lon < 144.5 || lon > 145.3) return null;
  return { lat, lon };
}

function readDestination(value: unknown, landmark: boolean): Destination | null {
  if (!isObject(value)) return null;
  const name = landmark ? value.feature_name : value.address_pnt;
  const point = readPoint(landmark ? value.co_ordinates : value.geo_point_2d);
  if (typeof name !== 'string' || !name.trim() || name.length > 500 || !point) return null;
  const label = name.trim().replace(/\s+/g, ' ');
  if (landmark) {
    const bundled = LANDMARKS.find((place) =>
      place.label.toLowerCase() === label.toLowerCase() &&
      Math.abs(place.lat - point.lat) < 0.000001 &&
      Math.abs(place.lon - point.lon) < 0.000001,
    );
    return bundled ?? {
      id: `landmark:${label.toLowerCase()}:${point.lat.toFixed(6)},${point.lon.toFixed(6)}`,
      label,
      ...point,
    };
  }
  if (typeof value.gisid !== 'string' || !value.gisid.trim() || value.gisid.length > 100) return null;
  return { id: `address:${value.gisid.trim()}`, label, ...point };
}

function searchUrl(query: string, landmark: boolean): string {
  // ODSQL string literals escape both quotes and backslashes; URL encoding alone
  // does not prevent a typed query from changing the filter expression.
  const literal = `"${query.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const params = new URLSearchParams({
    select: landmark ? 'feature_name,co_ordinates' : 'gisid,address_pnt,geo_point_2d',
    where: `suggest(${landmark ? 'feature_name' : 'address_pnt'}, ${literal})`,
    limit: String(SOURCE_LIMIT),
  });
  return `${ODS_BASE}/${landmark ? LANDMARK_DATASET : 'street-addresses'}/records?${params}`;
}

async function searchSource(query: string, landmark: boolean, signal: AbortSignal): Promise<DestinationSearchResult> {
  const response = await fetch(searchUrl(query, landmark), { signal });
  if (!response.ok) throw new Error(`Destination search returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isObject(payload) || !Array.isArray(payload.results) ||
      typeof payload.total_count !== 'number' || !Number.isFinite(payload.total_count) ||
      payload.total_count < 0) {
    throw new Error('The destination service returned an unreadable response.');
  }
  let partial = false;
  const destinations: Destination[] = [];
  for (const row of payload.results.slice(0, SOURCE_LIMIT)) {
    const destination = readDestination(row, landmark);
    if (destination) destinations.push(destination);
    else partial = true;
  }
  if (payload.total_count > 0 && payload.results.length === 0) partial = true;
  if (partial && !destinations.length) {
    throw new Error('The destination service returned unusable locations.');
  }
  return { destinations, partial };
}

/** Submitted searches only. Every result needs an explicit user selection. */
export async function searchDestinations(query: string, signal?: AbortSignal): Promise<DestinationSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new Error('Enter a destination between 2 and 100 characters.');
  }
  if (signal?.aborted) throw new DOMException('Destination search cancelled.', 'AbortError');

  const terms = trimmed.toLowerCase().split(/\s+/);
  const local = LANDMARKS.filter((place) => terms.every((term) => place.label.toLowerCase().includes(term)));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, SEARCH_TIMEOUT_MS);
  try {
    const responses = await Promise.allSettled([
      searchSource(trimmed, false, controller.signal),
      searchSource(trimmed, true, controller.signal),
    ]);
    // Caller cancellation must never return an older result, even a local one.
    if (signal?.aborted) throw new DOMException('Destination search cancelled.', 'AbortError');
    let partial = false;
    const unique = new Map(local.map((destination) => [destination.id, destination]));
    for (const result of responses) {
      if (result.status === 'rejected') {
        partial = true;
      } else {
        partial ||= result.value.partial;
        for (const destination of result.value.destinations) {
          if (!unique.has(destination.id)) unique.set(destination.id, destination);
        }
      }
    }
    if (partial && !unique.size) {
      throw new Error('Destination search is temporarily unavailable. Try again or choose a landmark.');
    }
    return { destinations: [...unique.values()], partial };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
