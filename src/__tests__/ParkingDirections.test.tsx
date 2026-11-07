import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ParkingDirections } from '../components/ParkingDirections';
import type { NearbyStreet } from '../lib/nearbyParking';
import type { FeedState, StreetAvailability } from '../lib/types';

const STREET: NearbyStreet = {
  street: 'Collins Street', zones: [7001], total: 10, vacant: 4, occupied: 5,
  notReporting: 1, vacancyRate: 4 / 9, lat: -37.8155, lon: 144.9673,
  restriction: null, restrictionCodes: [], restrictionVaries: false,
  nearestBayId: 123, distanceMetres: 120,
};

afterEach(cleanup);

describe('selected street directions', () => {
  it('offers explicit, safe external links to the sensor point and explains that the space is not reserved', () => {
    render(<ParkingDirections street={STREET} state="live" />);
    expect(screen.getByRole('region', { name: 'Directions to Collins Street' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(/opens in a new tab/);
      expect(link.closest('button')).toBeNull();
      const url = new URL(link.getAttribute('href')!);
      expect(url.searchParams.get('destination') ?? url.searchParams.get('daddr')).toBe(`${STREET.lat},${STREET.lon}`);
      for (const origin of ['origin', 'source', 'saddr']) expect(url.searchParams.has(origin)).toBe(false);
    }
    expect(screen.getByRole('status')).toHaveTextContent('nearest bay reported free');
    expect(screen.getByText(/space is not reserved/)).toBeInTheDocument();
  });

  it.each([
    ['delayed', STREET, /Readings are delayed/],
    ['stale', STREET, /out of date.*not a confirmed free bay/],
    ['live', { ...STREET, vacant: 0, occupied: 9, vacancyRate: 0 }, /No free bays are reported/],
    ['live', { ...STREET, vacant: 0, occupied: 0, notReporting: 10, vacancyRate: null }, /Availability is unknown/],
  ] as const)('keeps directions honest for %s readings and non-free streets', (state, street, warning) => {
    render(<ParkingDirections street={street} state={state as FeedState} />);
    expect(screen.getByRole('status')).toHaveTextContent(warning);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText(/Check signs; space is not reserved/)).toBeInTheDocument();
  });

  it('does not turn the city-wide street centroid into a navigation target', () => {
    const centroid: StreetAvailability = {
      street: STREET.street, zones: STREET.zones, total: STREET.total,
      vacant: STREET.vacant, occupied: STREET.occupied, notReporting: STREET.notReporting,
      vacancyRate: STREET.vacancyRate, lat: STREET.lat, lon: STREET.lon,
      restriction: STREET.restriction, restrictionCodes: STREET.restrictionCodes,
      restrictionVaries: STREET.restrictionVaries,
    };
    const { container } = render(<ParkingDirections street={centroid} state="live" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('withdraws the directions panel when parking data is unavailable', () => {
    const { rerender, container } = render(<ParkingDirections street={STREET} state="live" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    rerender(<ParkingDirections street={STREET} state="unavailable" />);
    expect(container).toBeEmptyDOMElement();
  });
});
