import { describe, expect, it } from 'vitest';
import { directionsForStreet } from '../lib/parkingDirections';
import { nearbyStreets, type NearbyStreet } from '../lib/nearbyParking';
import { UNMAPPED_STREET } from '../lib/parkingModel';
import type { Bay, StreetAvailability } from '../lib/types';

const STREET: NearbyStreet = {
  street: 'Collins Street', zones: [1], total: 3, vacant: 1, occupied: 1,
  notReporting: 1, vacancyRate: .5, lat: -37.815184162476, lon: 144.967095411213,
  restriction: null, restrictionCodes: [], restrictionVaries: false,
  distanceMetres: 100, nearestBayId: 123,
};

describe('parking directions links', () => {
  it('targets the actual trusted vacant bay selected by the nearby model', () => {
    const point = { id: 'destination', label: 'A place', lat: -37.815, lon: 144.967 };
    const base = { zone: 1, observedAt: new Date(), reportedAt: new Date(), lon: point.lon };
    const bays: Bay[] = [
      { ...base, id: 1, lat: point.lat, occupied: false, trusted: false },
      { ...base, id: 2, lat: point.lat + .0001, occupied: true, trusted: true },
      { ...base, id: 3, lat: point.lat + .001, occupied: false, trusted: true },
    ];
    const [street] = nearbyStreets(bays, {
      '1': { street: 'Collins Street', from: null, to: null, restrictions: [] },
    }, point, 500, 'nearest');
    const links = directionsForStreet(street!);
    const destination = `${bays[2]!.lat},${bays[2]!.lon}`;
    expect(new URL(links!.google).searchParams.get('destination')).toBe(destination);
    expect(new URL(links!.apple).searchParams.get('destination')).toBe(destination);
    expect(street!.nearestBayId).toBe(3);
  });

  it('uses HTTPS driving links with provider-selected origins and no key', () => {
    const links = directionsForStreet(STREET)!;
    const google = new URL(links.google);
    const apple = new URL(links.apple);
    expect(`${google.origin}${google.pathname}`).toBe('https://www.google.com/maps/dir/');
    expect(Object.fromEntries(google.searchParams)).toEqual({
      api: '1', destination: `${STREET.lat},${STREET.lon}`, travelmode: 'driving', dir_action: 'navigate',
    });
    expect(`${apple.origin}${apple.pathname}`).toBe('https://maps.apple.com/directions');
    expect(Object.fromEntries(apple.searchParams)).toEqual({
      destination: `${STREET.lat},${STREET.lon}`, mode: 'driving',
    });
  });

  it('rejects whole-street centroids even when their coordinates are valid', () => {
    const centroid: StreetAvailability & { nearestBayId?: number; distanceMetres?: number } = { ...STREET };
    delete centroid.nearestBayId;
    delete centroid.distanceMetres;
    expect(directionsForStreet(centroid)).toBeNull();
    expect(directionsForStreet({ ...centroid, nearestBayId: 123 } as StreetAvailability)).toBeNull();
  });

  it('rejects unmapped, unnamed, malformed and invalid-coordinate targets', () => {
    const invalid = [
      { street: UNMAPPED_STREET }, { street: '  ' },
      { nearestBayId: 0 }, { nearestBayId: NaN }, { nearestBayId: -1 },
      { distanceMetres: Infinity }, { distanceMetres: -1 },
      { lat: NaN }, { lat: -91 }, { lon: Infinity }, { lon: 181 },
    ];
    for (const overrides of invalid) {
      expect(directionsForStreet({ ...STREET, ...overrides })).toBeNull();
    }
  });

  it('does not serialize labels, extra private fields or query-like text', () => {
    const supplied = {
      ...STREET,
      street: 'A & origin=private-address <street>',
      origin: 'private-origin',
      deviceLocation: { lat: -33.8, lon: 151.2 },
    };
    const links = directionsForStreet(supplied)!;
    expect(links).toEqual(directionsForStreet(STREET));
    expect(links.google).not.toContain('origin');
    expect(links.apple).not.toContain('source');
    expect(links.google).not.toContain('private');
    expect(links.apple).not.toContain('private');
  });

  it('keeps coordinate navigation separate from availability claims', () => {
    const occupied = { ...STREET, vacant: 0, occupied: 2, vacancyRate: 0 };
    const unknown = { ...STREET, vacant: 0, occupied: 0, notReporting: 3, vacancyRate: null };
    expect(directionsForStreet(occupied)).toEqual(directionsForStreet(STREET));
    expect(directionsForStreet(unknown)).toEqual(directionsForStreet(STREET));
  });
});
