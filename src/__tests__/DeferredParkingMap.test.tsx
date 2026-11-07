import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredParkingMap } from '../components/DeferredParkingMap';

vi.mock('../components/ParkingMap', () => ({
  ParkingMap: ({ selected }: { selected: string | null }) => <div role="application" aria-label="Parking map">{selected}</div>,
}));

let reveal: IntersectionObserverCallback;
const disconnect = vi.fn();
const props = { streets: [], state: 'live' as const, selected: null, onSelect: vi.fn() };

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { reveal = callback; }
    observe() { /* The map starts below the viewport. */ }
    disconnect = disconnect;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('deferred map loading', () => {
  it('keeps the interactive map deferred until it approaches the viewport', async () => {
    render(<DeferredParkingMap {...props} />);
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load map' })).toBeInTheDocument();
    act(() => reveal([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(await screen.findByRole('application', { name: 'Parking map' })).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });

  it('allows loading the map without scrolling', async () => {
    render(<DeferredParkingMap {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load map' }));
    expect(await screen.findByRole('application')).toBeInTheDocument();
  });

  it('honours a direct link to the map', async () => {
    window.history.replaceState({}, '', '/#parking-map');
    render(<DeferredParkingMap {...props} />);
    expect(await screen.findByRole('application')).toBeInTheDocument();
  });

  it('loads the selected street before the map enters the viewport', async () => {
    const { rerender } = render(<DeferredParkingMap {...props} />);
    rerender(<DeferredParkingMap {...props} selected="Collins Street" />);
    expect(await screen.findByRole('application')).toHaveTextContent('Collins Street');
  });

  it('keeps the map available in browsers without an intersection observer', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DeferredParkingMap {...props} />);
    expect(await screen.findByRole('application')).toBeInTheDocument();
  });
});
