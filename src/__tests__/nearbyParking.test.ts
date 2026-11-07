import { describe, expect, it } from 'vitest';
import { formatDistance, nearbyStreets, type Destination } from '../lib/nearbyParking';
import { UNMAPPED_STREET } from '../lib/parkingModel';
import type { Bay, ZoneCrosswalk } from '../lib/types';

const DESTINATION: Destination = { id: 'test', label: 'Destination', lat: -37.81, lon: 144.96 };
const CROSSWALK: ZoneCrosswalk = {
  '1': { street: 'Alpha Street', from: null, to: null, restrictions: [{ code: 'MP2P', days: null }] },
  '2': { street: 'Beta Street', from: null, to: null, restrictions: [] },
  '3': { street: 'Gamma Street', from: null, to: null, restrictions: [] },
  '4': { street: 'Delta Street', from: null, to: null, restrictions: [] },
  '5': { street: 'Alpha Street', from: null, to: null, restrictions: [{ code: 'LZ30', days: null }] },
  '6': { street: UNMAPPED_STREET, from: null, to: null, restrictions: [] },
};

function bay(id: number, northMetres: number, overrides: Partial<Bay> = {}): Bay {
  return {
    id, zone: 1, occupied: false, trusted: true,
    observedAt: new Date('2026-09-08T18:30:00Z'),
    reportedAt: new Date('2026-09-08T18:30:00Z'),
    lat: DESTINATION.lat + northMetres / 6_371_000 * 180 / Math.PI,
    lon: DESTINATION.lon,
    ...overrides,
  };
}

describe('parking near a destination', () => {
  it('counts actual bays inside the radius, not the rest of a long street', () => {
    const results = nearbyStreets([
      bay(1, 499.9), bay(2, 500.1, { zone: 5 }), bay(3, 2000, { zone: 5 }),
    ], CROSSWALK, DESTINATION, 500, 'nearest');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ total: 1, vacant: 1, zones: [1], restrictionVaries: false });
    expect(results[0]?.distanceMetres).toBeCloseTo(499.9, 4);
    expect(results[0]?.restrictionCodes).toEqual([{ code: 'MP2P', days: null }]);
  });

  it('uses the nearest trusted vacant sensor for distance and map position, never a centroid', () => {
    const closest = bay(1, 20, { trusted: false });
    const occupied = bay(2, 40, { occupied: true });
    const available = bay(3, 150);
    const results = nearbyStreets([closest, occupied, available, bay(4, 450)], CROSSWALK, DESTINATION, 500, 'nearest');
    expect(results[0]).toMatchObject({
      nearestBayId: 3, lat: available.lat, lon: available.lon,
      vacant: 2, occupied: 1, notReporting: 1, total: 4,
    });
    expect(results[0]?.distanceMetres).toBeCloseTo(150, 4);
  });

  it('keeps silent sensors unknown and below streets with reporting sensors in both sorts', () => {
    const bays = [
      ...Array.from({ length: 20 }, (_, index) => bay(index + 1, 10, { zone: 1, trusted: false })),
      bay(21, 20, { zone: 2, occupied: true }),
      bay(22, 450, { zone: 3 }),
    ];
    for (const mode of ['nearest', 'most-vacant'] as const) {
      const results = nearbyStreets(bays, CROSSWALK, DESTINATION, 500, mode);
      expect(results.map((street) => street.street)).toEqual(['Gamma Street', 'Beta Street', 'Alpha Street']);
      expect(results[2]).toMatchObject({ vacant: 0, occupied: 0, notReporting: 20, vacancyRate: null });
    }
  });

  it('switches between nearest free sensor and highest local trusted free count', () => {
    const bays = [bay(1, 100), bay(2, 250, { zone: 2 }), bay(3, 300, { zone: 2 })];
    expect(nearbyStreets(bays, CROSSWALK, DESTINATION, 500, 'nearest')[0]?.street).toBe('Alpha Street');
    expect(nearbyStreets(bays, CROSSWALK, DESTINATION, 500, 'most-vacant')[0]?.street).toBe('Beta Street');
  });

  it('chooses a reporting occupied sensor over a closer silent sensor when none are free', () => {
    const results = nearbyStreets([
      bay(1, 20, { trusted: false }), bay(2, 120, { occupied: true }), bay(3, 200, { occupied: true }),
    ], CROSSWALK, DESTINATION, 500, 'nearest');
    expect(results[0]?.nearestBayId).toBe(2);
    expect(results[0]?.distanceMetres).toBeCloseTo(120, 4);
  });

  it('does not recommend unmapped bays or accept malformed coordinates', () => {
    const results = nearbyStreets([
      bay(1, 0, { zone: null }), bay(2, 0, { zone: 999 }), bay(3, 0, { zone: 6 }),
      bay(4, 0, { lat: Number.NaN }), bay(5, 0, { lon: Number.POSITIVE_INFINITY }),
      bay(6, 0, { lat: -91 }), bay(7, 0, { lon: 181 }),
    ], CROSSWALK, DESTINATION, 500, 'nearest');
    expect(results).toEqual([]);
  });

  it('rejects invalid search geometry and handles no coverage without a fabricated result', () => {
    expect(nearbyStreets([bay(1, 1000)], CROSSWALK, DESTINATION, 500, 'nearest')).toEqual([]);
    expect(nearbyStreets([bay(1, 0)], CROSSWALK, { ...DESTINATION, lat: Number.NaN }, 500, 'nearest')).toEqual([]);
    expect(nearbyStreets([bay(1, 0)], CROSSWALK, DESTINATION, -1, 'nearest')).toEqual([]);
    expect(nearbyStreets([bay(1, 0)], CROSSWALK, DESTINATION, Number.POSITIVE_INFINITY, 'nearest')).toEqual([]);
  });

  it('resolves identical distance and counts consistently regardless of input order', () => {
    const bays = [bay(4, 100, { zone: 2 }), bay(3, 100), bay(2, 100, { zone: 2 }), bay(1, 100)];
    for (const mode of ['nearest', 'most-vacant'] as const) {
      const first = nearbyStreets(bays, CROSSWALK, DESTINATION, 500, mode);
      const reversed = nearbyStreets([...bays].reverse(), CROSSWALK, DESTINATION, 500, mode);
      expect(first.map((street) => [street.street, street.nearestBayId])).toEqual([
        ['Alpha Street', 1], ['Beta Street', 2],
      ]);
      expect(reversed).toEqual(first);
    }
  });

  it('includes a bay at the destination for a zero radius without changing its trust', () => {
    const original = bay(1, 0, { trusted: false });
    const results = nearbyStreets([original], CROSSWALK, DESTINATION, 0, 'nearest');
    expect(results[0]).toMatchObject({ distanceMetres: 0, vacant: 0, notReporting: 1 });
    expect(original.trusted).toBe(false);
  });
});

describe('approximate straight-line distance labels', () => {
  it('rounds metres and kilometres without implying exact route length', () => {
    expect(formatDistance(153)).toBe('150 m');
    expect(formatDistance(2)).toBe('10 m');
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(995)).toBe('1.0 km');
    expect(formatDistance(1249)).toBe('1.3 km');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
});
