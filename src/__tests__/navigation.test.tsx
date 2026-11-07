import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import CollectionNav from '../components/CollectionNav';
import { BASE_TIME, validPayload } from './factories';

vi.mock('../components/ParkingMap', () => ({
  ParkingMap: () => <div data-testid="map-stub" />,
}));

const destinations = [
  ['Home', '/melbourne-daily/'],
  ['Parking', '/melbourne-parking-dashboard/'],
  ['Weather & UV', '/melbourne-daily/weather.html'],
  ['Air quality', '/melbourne-daily/air.html'],
  ['Transport', '/melbourne-daily/transport.html'],
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(BASE_TIME));
  window.history.replaceState({}, '', '/melbourne-parking-dashboard/');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dashboard series navigation', () => {
  it.each(['sidebar', 'mobile'] as const)('offers the same five destinations in the %s navigation', (placement) => {
    render(<CollectionNav current="parking" placement={placement} />);
    const nav = within(screen.getByRole('navigation', { name: placement === 'sidebar' ? 'Dashboard series' : 'Dashboard series mobile' }));
    const links = nav.getAllByRole('link');
    expect(links).toHaveLength(destinations.length);
    destinations.forEach(([name, href], index) => {
      const link = links[index]!;
      expect(link).toHaveAccessibleName(name);
      expect(link).toHaveAttribute('href', href);
      expect(link).not.toHaveAttribute('target');
      expect(link.getAttribute('aria-current')).toBe(name === 'Parking' ? 'page' : null);
    });
  });

  it('keeps series switching available when parking data is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/cannot confirm parking availability right now/i)).toBeInTheDocument());
    expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
    const sidebar = within(screen.getByRole('navigation', { name: 'Dashboard series' }));
    expect(sidebar.getAllByRole('link')).toHaveLength(5);
    expect(sidebar.getByRole('link', { name: 'Air quality' })).toHaveAttribute('href', '/melbourne-daily/air.html');
  });

  it('preserves map access and restores focus when the mobile drawer closes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes('zone-crosswalk') ? {} : validPayload()))));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('map-stub')).toBeInTheDocument());
    const sections = within(screen.getByRole('navigation', { name: 'On this page' }));
    expect(sections.getByRole('link', { name: 'Parking map' })).toHaveAttribute('href', '#parking-map');
    const menuButton = screen.getByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-controls', 'main-navigation');
    fireEvent.click(menuButton);
    expect(screen.getByRole('dialog', { name: 'Main navigation' })).toHaveAttribute('id', 'main-navigation');
    expect(screen.queryByRole('navigation', { name: 'Dashboard series mobile' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: 'Main navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Dashboard series mobile' })).toBeInTheDocument();
    expect(menuButton).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});
