import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DestinationFinder } from '../components/DestinationFinder';
import { LANDMARKS, searchDestinations, type DestinationSearchResult } from '../lib/destinationSearch';
import { LocationError, requestCurrentLocation } from '../lib/currentLocation';
import type { Destination } from '../lib/nearbyParking';

vi.mock('../lib/currentLocation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/currentLocation')>(),
  requestCurrentLocation: vi.fn(),
}));
vi.mock('../lib/destinationSearch', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/destinationSearch')>(),
  searchDestinations: vi.fn(),
}));

const locationMock = vi.mocked(requestCurrentLocation);
const searchMock = vi.mocked(searchDestinations);
const ADDRESS: Destination = { id: 'address:1', label: '200 Collins Street Melbourne', lat: -37.815, lon: 144.967 };
const FIX: Destination = {
  id: 'device:1', label: 'Your location', lat: -37.818, lon: 144.967,
  deviceLocation: { accuracyMetres: 650, capturedAt: Date.parse('2026-11-08T02:30:00Z') },
};

function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((fulfil) => { resolve = fulfil; });
  return { promise, resolve };
}

function renderFinder(initial: Destination | null = null) {
  const onChange = vi.fn();
  function Harness() {
    const [destination, setDestination] = useState(initial);
    const [radius, setRadius] = useState(500);
    return <DestinationFinder destination={destination} onDestinationChange={(place) => {
      onChange(place);
      setDestination(place);
    }} radiusMetres={radius} onRadiusChange={setRadius} />;
  }
  return { ...render(<Harness />), onChange };
}

function locate() {
  fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
}

function enterAddress() {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Address or place' }), { target: { value: '200 Collins' } });
  fireEvent.submit(screen.getByRole('search', { name: 'Find a destination' }));
}

beforeEach(() => {
  vi.useRealTimers();
  locationMock.mockReset();
  searchMock.mockReset();
});
afterEach(cleanup);

describe('current location is an explicit, cancellable alternative to destination search', () => {
  it('does not request location or search on mount, then shows the fix time and precision after consent succeeds', async () => {
    locationMock.mockResolvedValue(FIX);
    const { onChange } = renderFinder();
    expect(locationMock).not.toHaveBeenCalled();
    expect(searchMock).not.toHaveBeenCalled();
    locate();

    await screen.findByText('Your location');
    expect(locationMock).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(FIX);
    expect(screen.getByText(/Captured .*Melbourne time · accuracy about 650 m/)).toBeInTheDocument();
    expect(screen.getByText(/Location uncertainty is larger than your search radius/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search radius' }), { target: { value: '1000' } });
    expect(screen.queryByText(/Location uncertainty is larger than your search radius/)).not.toBeInTheDocument();
    expect(screen.getByText(/Use the location button again after moving/)).toBeInTheDocument();
    expect(locationMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing destination on denial and allows a successful retry', async () => {
    locationMock.mockRejectedValueOnce(new LocationError('denied')).mockResolvedValueOnce(FIX);
    const { onChange } = renderFinder(ADDRESS);
    locate();
    await screen.findByText(/Location access was not allowed/);
    expect(screen.getByText(ADDRESS.label)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Or choose a landmark' })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
    locate();
    await screen.findByText('Your location');
    expect(screen.queryByText(/Location access was not allowed/)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('editing and submitting an address cancels location, so a late fix cannot replace the selected address', async () => {
    const pending = deferred<Destination>();
    locationMock.mockReturnValue(pending.promise);
    searchMock.mockResolvedValue({ destinations: [ADDRESS], partial: false });
    const { onChange } = renderFinder();
    locate();
    const signal = locationMock.mock.calls[0]![0]!;
    enterAddress();
    expect(signal.aborted).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: `${ADDRESS.label} Select` }));
    await act(async () => { pending.resolve(FIX); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(ADDRESS);
    expect(screen.getByText(ADDRESS.label)).toBeInTheDocument();
    expect(screen.queryByText('Your location')).not.toBeInTheDocument();
  });

  it('starting location abandons an address request and ignores its late search results', async () => {
    const lookup = deferred<DestinationSearchResult>();
    const pending = deferred<Destination>();
    searchMock.mockReturnValue(lookup.promise);
    locationMock.mockReturnValue(pending.promise);
    const { onChange } = renderFinder();
    enterAddress();
    const signal = searchMock.mock.calls[0]![1]!;
    locate();
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Locating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    await act(async () => { lookup.resolve({ destinations: [ADDRESS], partial: false }); });
    expect(screen.queryByRole('list', { name: 'Destination search results' })).not.toBeInTheDocument();
    await act(async () => { pending.resolve(FIX); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(FIX);
  });

  it('choosing a landmark during acquisition remains the final choice', async () => {
    const pending = deferred<Destination>();
    locationMock.mockReturnValue(pending.promise);
    const { onChange } = renderFinder();
    locate();
    const signal = locationMock.mock.calls[0]![0]!;
    const landmark = LANDMARKS[1]!;
    fireEvent.change(screen.getByRole('combobox', { name: 'Or choose a landmark' }), { target: { value: landmark.id } });
    await act(async () => { pending.resolve(FIX); });
    expect(signal.aborted).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(landmark);
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeEnabled();
  });

  it.each(['Cancel location', 'Clear destination'])('%s abandons an in-flight fix and restores input focus', async (action) => {
    const pending = deferred<Destination>();
    locationMock.mockReturnValue(pending.promise);
    const { onChange } = renderFinder(ADDRESS);
    locate();
    const signal = locationMock.mock.calls[0]![0]!;
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('searchbox', { name: 'Address or place' })).toHaveFocus();
    await act(async () => { pending.resolve(FIX); });
    expect(screen.queryByText('Your location')).not.toBeInTheDocument();
    expect(onChange.mock.calls).toEqual(action === 'Clear destination' ? [[null]] : []);
    if (action === 'Cancel location') expect(screen.getByText(ADDRESS.label)).toBeInTheDocument();
  });

  it('unmounting cancels location and prevents a late callback updating the selection', async () => {
    const pending = deferred<Destination>();
    locationMock.mockReturnValue(pending.promise);
    const { onChange, unmount } = renderFinder();
    locate();
    const signal = locationMock.mock.calls[0]![0]!;
    unmount();
    await act(async () => { pending.resolve(FIX); });
    expect(signal.aborted).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
