import type { Destination } from './nearbyParking';

export type LocationErrorCode =
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'invalid'
  | 'stale'
  | 'inaccurate';

const MESSAGES: Record<LocationErrorCode, string> = {
  insecure: 'Location needs a secure connection. Open the HTTPS site, or enter an address instead.',
  unsupported: 'This browser cannot share your location. Enter an address or choose a landmark instead.',
  denied: 'Location access was not allowed. You can enable it in your browser or device settings, or enter an address instead.',
  unavailable: 'Your browser could not find your location. Check your device location settings and try again, or enter an address.',
  timeout: 'Location took too long. Check the browser permission prompt, then try again or enter an address.',
  invalid: 'Your browser returned an unusable location. Try again, or enter an address instead.',
  stale: 'Your browser returned an old or incorrectly timed location. Try again, or enter an address instead.',
  inaccurate: 'Your location estimate is wider than 1 km. Try again with a better signal, or enter an address for nearby parking.',
};

export class LocationError extends Error {
  constructor(readonly code: LocationErrorCode) {
    super(MESSAGES[code]);
    this.name = 'LocationError';
  }
}

const POSITION_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_POSITION_AGE_MS = 120_000;
const MAX_CLOCK_SKEW_MS = 10_000;
const MAX_ACCURACY_METRES = 1000;

function asDestination(position: GeolocationPosition): Destination {
  const coords = position?.coords;
  if (!coords || !Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90
    || !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180
    || !Number.isFinite(coords.accuracy) || coords.accuracy < 0
    || !Number.isFinite(position.timestamp)) {
    throw new LocationError('invalid');
  }
  const age = Date.now() - position.timestamp;
  if (age > MAX_POSITION_AGE_MS || age < -MAX_CLOCK_SKEW_MS) {
    throw new LocationError('stale');
  }
  // Product policy: our largest nearby search is 1 km. A broader location
  // estimate cannot support a useful street-level recommendation.
  if (coords.accuracy > MAX_ACCURACY_METRES) throw new LocationError('inaccurate');
  return {
    id: `device:${position.timestamp}`,
    label: 'Your location',
    lat: coords.latitude,
    lon: coords.longitude,
    deviceLocation: { accuracyMetres: coords.accuracy, capturedAt: position.timestamp },
  };
}

/**
 * A single location fix, requested only by an explicit caller action.
 *
 * Native getCurrentPosition has no cancellation method. Aborting this wrapper
 * abandons the result and releases our timer/listener; it cannot dismiss the
 * browser's permission prompt. Coordinates stay in the returned in-memory
 * object; this module performs no network request, persistence or logging.
 */
export async function requestCurrentLocation(signal?: AbortSignal): Promise<Destination> {
  if (signal?.aborted) throw new DOMException('Location request cancelled.', 'AbortError');
  if (typeof window === 'undefined' || !window.isSecureContext) throw new LocationError('insecure');
  let geolocation: Geolocation;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.geolocation?.getCurrentPosition !== 'function') {
      throw new LocationError('unsupported');
    }
    geolocation = navigator.geolocation;
  } catch (error) {
    throw error instanceof LocationError ? error : new LocationError('unavailable');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = () => fail(new DOMException('Location request cancelled.', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    // The native acquisition timeout excludes waiting for permission. This
    // separate deadline also restores the UI when a prompt remains unanswered.
    const timer = setTimeout(() => fail(new LocationError('timeout')), REQUEST_TIMEOUT_MS);
    try {
      geolocation.getCurrentPosition(
        (position) => {
          if (settled) return;
          try {
            const destination = asDestination(position);
            settled = true;
            cleanup();
            resolve(destination);
          } catch (error) {
            fail(error instanceof LocationError ? error : new LocationError('invalid'));
          }
        },
        (error) => {
          fail(new LocationError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: POSITION_TIMEOUT_MS },
      );
    } catch (error) {
      fail(new LocationError(error instanceof DOMException && error.name === 'SecurityError' ? 'denied' : 'unavailable'));
    }
  });
}
