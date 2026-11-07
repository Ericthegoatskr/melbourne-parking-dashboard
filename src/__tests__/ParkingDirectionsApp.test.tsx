import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { LANDMARKS } from '../lib/destinationSearch';
import { requestCurrentLocation } from '../lib/currentLocation';
import type { Destination } from '../lib/nearbyParking';
import { BASE_TIME, minutesBefore, validPayload } from './factories';

vi.mock('../lib/currentLocation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/currentLocation')>(),
  requestCurrentLocation: vi.fn(),
}));
vi.mock('../components/ParkingMap', () => ({ ParkingMap: () => <div data-testid="map-stub" /> }));

const landmark = LANDMARKS[0]!;
const FIX: Destination = { ...landmark, id: 'device:directions', label: 'Your location', deviceLocation: { accuracyMetres: 25, capturedAt: Date.parse(BASE_TIME) } };
const locationMock = vi.mocked(requestCurrentLocation);
let newer = false;

function installFeed() {
  const crosswalk = {
    7001: { street: 'Alpha Street', from: null, to: null, restrictions: [{ code: '2P', days: null }] },
    7002: { street: 'Beta Street', from: null, to: null, restrictions: [{ code: '1P', days: null }] },
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('zone-crosswalk')) return new Response(JSON.stringify(crosswalk));
    const source = newer ? new Date(Date.parse(BASE_TIME) + 1000).toISOString() : BASE_TIME;
    return new Response(JSON.stringify(validPayload(6000, (i) => ({
      zone_number: i === 3 ? 7002 : 7001,
      location: i < 5 ? {
        lat: FIX.lat + [0.001, 0.003, 0.0001, 0.002, 0.00005][i]!, lon: FIX.lon,
      } : { lat: -37.79, lon: 144.94 },
      status_description: i === 2 || (newer && i === 0) ? 'Present' : 'Unoccupied',
      lastupdated: i === 4 ? minutesBefore(source, 90) : source,
    }))));
  }));
}

function assertTarget(street: string, lat: number, lon: number) {
  const panel = screen.getByRole('region', { name: `Directions to ${street}` });
  for (const provider of ['Google Maps', 'Apple Maps']) {
    const link = within(panel).getByRole('link', { name: new RegExp(provider) });
    const url = new URL(link.getAttribute('href')!);
    expect(url.searchParams.get('destination') ?? url.searchParams.get('daddr')).toBe(`${lat},${lon}`);
    for (const key of ['origin', 'source', 'saddr']) expect(url.searchParams.has(key)).toBe(false);
    expect(link.closest('button')).toBeNull();
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(BASE_TIME));
  newer = false;
  locationMock.mockReset();
  installFeed();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('directions follow the chosen nearby sensor', () => {
  it('requires a nearby street selection, retargets a new street, and clears when radius or destination changes', async () => {
    render(<App />);
    await screen.findByText('Bays free now');
    fireEvent.click(await screen.findByRole('button', { name: /^Alpha Street/ }));
    expect(screen.queryByRole('region', { name: /^Directions to / })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Or choose a landmark' }), { target: { value: landmark.id } });
    expect(screen.queryByRole('region', { name: /^Directions to / })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Alpha Street/ }));
    assertTarget('Alpha Street', FIX.lat + 0.001, FIX.lon);
    fireEvent.click(screen.getByRole('button', { name: /^Beta Street/ }));
    assertTarget('Beta Street', FIX.lat + 0.002, FIX.lon);
    expect(screen.queryByRole('region', { name: 'Directions to Alpha Street' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search radius' }), { target: { value: '250' } });
    expect(screen.queryByRole('region', { name: /^Directions to / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Alpha Street/ }));
    assertTarget('Alpha Street', FIX.lat + 0.001, FIX.lon);
    fireEvent.change(screen.getByRole('combobox', { name: 'Or choose a landmark' }), { target: { value: LANDMARKS[4]!.id } });
    expect(screen.queryByRole('region', { name: /^Directions to / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear destination' }));
    expect(screen.getByRole('searchbox', { name: 'Find a street' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Directions to / })).not.toBeInTheDocument();
  });

  it('uses the real free bay instead of the location fix or centroid and updates the endpoint after a sensor changes', async () => {
    locationMock.mockResolvedValue(FIX);
    const { container } = render(<App />);
    await screen.findByText('Bays free now');
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    await screen.findByRole('heading', { name: 'Parking near your location' });
    fireEvent.click(screen.getByRole('button', { name: /^Alpha Street/ }));
    assertTarget('Alpha Street', FIX.lat + 0.001, FIX.lon);
    const url = new URL(screen.getByRole('link', { name: /Google Maps/ }).getAttribute('href')!);
    expect(url.searchParams.get('destination')).not.toBe(`${FIX.lat},${FIX.lon}`);
    expect(container.querySelector('.street-row--selected .street-free-count')).toHaveTextContent('2');

    newer = true;
    vi.setSystemTime(new Date(Date.parse(BASE_TIME) + 1000));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => assertTarget('Alpha Street', FIX.lat + 0.003, FIX.lon));
    expect(container.querySelector('.street-row--selected .street-free-count')).toHaveTextContent('1');
    expect(locationMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Directions to Alpha Street' })).toBeInTheDocument();
  });
});
