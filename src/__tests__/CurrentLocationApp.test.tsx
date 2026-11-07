import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { LANDMARKS } from '../lib/destinationSearch';
import { requestCurrentLocation } from '../lib/currentLocation';
import type { Destination } from '../lib/nearbyParking';
import type { ParkingMapProps } from '../components/ParkingMap';
import { BASE_TIME, minutesBefore, validPayload } from './factories';

vi.mock('../lib/currentLocation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/currentLocation')>(),
  requestCurrentLocation: vi.fn(),
}));
vi.mock('../components/ParkingMap', () => ({
  ParkingMap: ({ destination }: ParkingMapProps) => <div role="img" aria-label={destination ? `Map near ${destination.label}` : 'City parking map'} />,
}));

const locationMock = vi.mocked(requestCurrentLocation);
const landmark = LANDMARKS[0]!;
const FIX: Destination = { ...landmark, id: 'device:1', label: 'Your location', deviceLocation: { accuracyMetres: 25, capturedAt: Date.parse(BASE_TIME) } };

function setupFeed() {
  const names = ['Near Street', 'Plenty Street', 'Occupied Street', 'Silent Street'];
  const crosswalk = Object.fromEntries(names.map((street, i) => [7001 + i, { street, from: null, to: null, restrictions: [{ code: '2P', days: null }] }]));
  const payload = validPayload(6000, (i) => {
    const near = i < 10;
    return {
      zone_number: i < 3 || i >= 10 ? 7001 : i < 8 ? 7002 : i === 8 ? 7003 : 7004,
      location: near ? { lat: FIX.lat + (i < 3 ? 0.001 : i < 8 ? 0.002 : 0.0003), lon: FIX.lon } : { lat: -37.79, lon: 144.94 },
      status_description: i === 1 || i === 8 ? 'Present' : 'Unoccupied',
      lastupdated: i === 2 || i === 9 ? minutesBefore(BASE_TIME, 90) : BASE_TIME,
    };
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes('zone-crosswalk') ? crosswalk : payload,
  ))));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(BASE_TIME));
  locationMock.mockReset();
  setupFeed();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('location uses the existing nearby-parking contract', () => {
  it('ranks local trusted bays, keeps global totals and passes the same fix to the map, then returns to landmarks', async () => {
    locationMock.mockResolvedValue(FIX);
    const { container } = render(<App />);
    await screen.findByText('Bays free now');
    const citySummary = container.querySelector('.parking-summary-grid')?.textContent;
    expect(locationMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    await screen.findByRole('heading', { name: 'Parking near your location' });

    const rows = () => [...container.querySelectorAll('.street-row')];
    expect(rows().map((row) => row.querySelector('.street-row-title > span')?.textContent))
      .toEqual(['Near Street', 'Plenty Street', 'Occupied Street', 'Silent Street']);
    expect(rows().map((row) => row.querySelector('.street-free-count')?.textContent)).toEqual(['1', '5', '0', '—']);
    expect(container.querySelector('.parking-summary-grid')?.textContent).toBe(citySummary);
    await screen.findByRole('img', { name: 'Map near Your location' });
    fireEvent.click(screen.getByRole('button', { name: 'Most reported free' }));
    expect(rows()[0]?.textContent).toContain('Plenty Street');

    fireEvent.change(screen.getByRole('combobox', { name: 'Or choose a landmark' }), { target: { value: landmark.id } });
    expect(screen.getByRole('heading', { name: 'Parking near your destination' })).toBeInTheDocument();
    expect(screen.queryByText(/Captured .*Melbourne time/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('img', { name: `Map near ${landmark.label}` })).toBeInTheDocument());
    expect(locationMock).toHaveBeenCalledTimes(1);
  });

  it('explains no mapped bays for an outside-city fix and restores the original map and street tools when cleared', async () => {
    locationMock.mockResolvedValue({ ...FIX, lat: -33.86, lon: 151.21 });
    const { container } = render(<App />);
    await screen.findByText('Bays free now');
    const citySummary = container.querySelector('.parking-summary-grid')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    await screen.findByText(/No mapped sensor bays in this radius/);
    expect(screen.getByText(/Coverage is limited to the City of Melbourne/)).toBeInTheDocument();
    expect(container.querySelectorAll('.street-row')).toHaveLength(0);
    expect(container.querySelector('.parking-summary-grid')?.textContent).toBe(citySummary);
    expect(screen.getByRole('searchbox', { name: 'Address or place' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear destination' }));
    expect(screen.getByRole('searchbox', { name: 'Find a street' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Best odds' })).toBeInTheDocument();
    await screen.findByRole('img', { name: 'City parking map' });
  });
});
