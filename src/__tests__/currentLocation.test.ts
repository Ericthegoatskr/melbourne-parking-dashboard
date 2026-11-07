import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationError, requestCurrentLocation } from '../lib/currentLocation';

const NOW = new Date('2026-11-08T01:30:00+11:00').getTime();

function position(overrides: Partial<GeolocationPosition> = {}, coordinateOverrides: Partial<GeolocationCoordinates> = {}): GeolocationPosition {
  return {
    timestamp: NOW,
    coords: {
      latitude: -37.8179,
      longitude: 144.9671,
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...coordinateOverrides,
    },
    ...overrides,
  } as GeolocationPosition;
}

function deferredGeolocation() {
  let success: PositionCallback | undefined;
  let error: PositionErrorCallback | null | undefined;
  const getCurrentPosition = vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
    success = onSuccess;
    error = onError;
  });
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  return {
    getCurrentPosition,
    resolve: (value = position()) => success?.(value),
    reject: (code: number) => error?.({ code, message: 'Private browser detail must not appear' } as GeolocationPositionError),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal('isSecureContext', true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('one-shot current location', () => {
  it('does not request permission until called and returns only the validated in-memory fix', async () => {
    const geo = deferredGeolocation();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    const request = requestCurrentLocation();
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true, maximumAge: 0, timeout: 15_000,
    });
    geo.resolve();
    await expect(request).resolves.toEqual({
      id: `device:${NOW}`, label: 'Your location', lat: -37.8179, lon: 144.9671,
      deviceLocation: { accuracyMetres: 25, capturedAt: NOW },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [1, 'denied'], [2, 'unavailable'], [3, 'timeout'], [99, 'unavailable'],
  ])('maps native error %s to safe %s guidance', async (nativeCode, code) => {
    const geo = deferredGeolocation();
    const request = requestCurrentLocation();
    geo.reject(Number(nativeCode));
    await expect(request).rejects.toMatchObject({ name: 'LocationError', code });
    await expect(request).rejects.not.toThrow('Private browser detail');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects insecure or unsupported contexts without calling geolocation', async () => {
    const geo = deferredGeolocation();
    vi.stubGlobal('isSecureContext', false);
    await expect(requestCurrentLocation()).rejects.toMatchObject({ code: 'insecure' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {});
    await expect(requestCurrentLocation()).rejects.toMatchObject({ code: 'unsupported' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    position({}, { latitude: NaN }),
    position({}, { latitude: 91 }),
    position({}, { longitude: -181 }),
    position({}, { accuracy: -1 }),
    position({}, { accuracy: Infinity }),
    position({ timestamp: NaN }),
  ])('rejects malformed position values without exposing them', async (value) => {
    const geo = deferredGeolocation();
    const request = requestCurrentLocation();
    geo.resolve(value);
    await expect(request).rejects.toMatchObject({ code: 'invalid' });
  });

  it.each([NOW - 120_001, NOW + 10_001])('rejects an old or future fix timestamp', async (timestamp) => {
    const geo = deferredGeolocation();
    const request = requestCurrentLocation();
    geo.resolve(position({ timestamp }));
    await expect(request).rejects.toMatchObject({ code: 'stale' });
  });

  it('refuses a location estimate wider than the supported search area', async () => {
    const geo = deferredGeolocation();
    const request = requestCurrentLocation();
    geo.resolve(position({}, { accuracy: 1000.1 }));
    await expect(request).rejects.toMatchObject({ code: 'inaccurate' });
    const boundary = requestCurrentLocation();
    geo.resolve(position({}, { accuracy: 1000 }));
    await expect(boundary).resolves.toMatchObject({ deviceLocation: { accuracyMetres: 1000 } });
  });

  it('does not start a cancelled request or accept late callbacks after cancellation', async () => {
    const geo = deferredGeolocation();
    const alreadyCancelled = new AbortController();
    alreadyCancelled.abort();
    await expect(requestCurrentLocation(alreadyCancelled.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();

    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const request = requestCurrentLocation(controller.signal);
    controller.abort();
    geo.resolve();
    geo.reject(1);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops waiting for an unanswered prompt and ignores a late native success', async () => {
    const geo = deferredGeolocation();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const request = requestCurrentLocation(controller.signal);
    const outcome = expect(request).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(20_000);
    geo.resolve(position({ timestamp: Date.now() }));
    await outcome;
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up after success so a later abort cannot change the accepted fix', async () => {
    const geo = deferredGeolocation();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const request = requestCurrentLocation(controller.signal);
    geo.resolve();
    controller.abort();
    await expect(request).resolves.toMatchObject({ label: 'Your location' });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('turns synchronous platform errors into safe guidance and releases the watchdog', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: () => { throw new DOMException('Internal policy detail', 'SecurityError'); } } });
    await expect(requestCurrentLocation()).rejects.toEqual(new LocationError('denied'));
    expect(vi.getTimerCount()).toBe(0);
  });
});
