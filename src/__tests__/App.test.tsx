import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { LANDMARKS } from '../lib/destinationSearch';
import { validPayload, minutesBefore, BASE_TIME } from './factories';

// Leaflet needs a real SVG renderer, which jsdom does not provide. These tests
// assert what the page is allowed to claim, not how the map draws, so the map
// is stubbed. Map rendering is verified in a browser against a production build.
vi.mock('../components/ParkingMap', () => ({
  ParkingMap: () => <div data-testid="map-stub" />,
}));

/**
 * These assert the UI contract, not the layout: which claims the page is
 * allowed to make in each data state.
 */

function mockFeed(payload: unknown, ok = true) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('zone-crosswalk')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify(payload), { status: ok ? 200 : 500 });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('data state governs what the page claims', () => {
  it('says "free now" only when the feed is live', async () => {
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed(validPayload()));

    render(<App />);

    await waitFor(() => expect(screen.getByText(/Bays free now/i)).toBeInTheDocument());
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('withdraws the present-tense claim once the data is not current', async () => {
    const old = minutesBefore(BASE_TIME, 40);
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed(validPayload(6000, () => ({ lastupdated: old }))));

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/Bays free at last reading/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Bays free now/i)).not.toBeInTheDocument();
    expect(screen.getByText('Not current')).toBeInTheDocument();
  });

  it('shows no figures at all when the feed is unusable', async () => {
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed({ error: 'nope' }));

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText(/cannot confirm parking availability right now/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Bays free/i)).not.toBeInTheDocument();
  });

  it('ages an open page out of "live" without waiting for a network refresh', async () => {
    // The tab-left-open case. Browsers throttle timers in a background tab, so
    // the verdict must be recomputed from the clock on any render that reaches
    // the screen — never read from a timestamp captured on the last tick.
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed(validPayload()));

    render(<App />);
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());

    // The clock moves on while the feed goes away entirely.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    vi.setSystemTime(new Date(new Date(BASE_TIME).getTime() + 70 * 60_000));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(
        screen.getByText(/cannot confirm parking availability right now/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText(/Bays free now/i)).not.toBeInTheDocument();
  });

  it('holds the newer reading when a refresh returns older data', async () => {
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed(validPayload()));

    render(<App />);
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
    const shownTime = screen.getByText(/Sensors last reported/).textContent;

    // A lagging edge serves a snapshot from eight hours ago.
    const older = minutesBefore(BASE_TIME, 8 * 60);
    vi.stubGlobal('fetch', mockFeed(validPayload(6000, () => ({ lastupdated: older }))));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // The page must not roll backwards.
    expect(screen.getByText(/Sensors last reported/).textContent).toBe(shownTime);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('refuses to render a summary when the data is older than the stale limit', async () => {
    const ancient = minutesBefore(BASE_TIME, 180);
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', mockFeed(validPayload(6000, () => ({ lastupdated: ancient }))));

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText(/cannot confirm parking availability right now/i),
      ).toBeInTheDocument(),
    );
  });
});

describe('destination parking preserves the data contract', () => {
  const place = LANDMARKS[0]!;
  function nearbyFeed(oldMinutes = 0) {
    const source = minutesBefore(BASE_TIME, oldMinutes);
    const payload = validPayload(6000, (index) => ({
      zone_number: 7001,
      location: index < 3 ? { lat: place.lat + 0.0004, lon: place.lon } : { lat: -37.79, lon: 144.95 },
      status_description: index === 1 ? 'Present' : 'Unoccupied',
      lastupdated: index === 2 ? minutesBefore(source, 90) : source,
    }));
    return vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input).includes('zone-crosswalk')
        ? { 7001: { street: 'Test Street', from: null, to: null, restrictions: [{ code: '2P', days: null }] } }
        : payload,
    )));
  }

  it('uses only nearby reporting bays, keeps city totals, and restores the original street tools when cleared', async () => {
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', nearbyFeed());
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByText('Bays free now')).toBeInTheDocument());
    const citySummary = container.querySelector('.parking-summary-grid')?.textContent;

    fireEvent.change(screen.getByLabelText('Or choose a landmark'), { target: { value: place.id } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nearby streets' })).toBeInTheDocument());
    const row = screen.getByRole('button', { name: /Test Street.*2 reporting.*1 silent/ });
    expect(within(row).getByText('1', { selector: '.street-free-count' })).toBeInTheDocument();
    expect(row.textContent).toContain('≈ 40 m away');
    expect(container.querySelector('.parking-summary-grid')?.textContent).toBe(citySummary);
    expect(screen.queryByRole('searchbox', { name: 'Find a street' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Most reported free' }));
    expect(screen.getByRole('button', { name: 'Most reported free' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Clear destination' }));
    expect(screen.getByRole('searchbox', { name: 'Find a street' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Best odds' })).toBeInTheDocument();
    expect(screen.getByLabelText('Address or place')).toHaveFocus();
  });

  it('labels stale destination readings as historical, then removes counts when they expire', async () => {
    vi.setSystemTime(new Date(BASE_TIME));
    vi.stubGlobal('fetch', nearbyFeed(40));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Not current')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Or choose a landmark'), { target: { value: place.id } });
    expect(screen.getByRole('heading', { name: 'Nearby streets at last reading' })).toBeInTheDocument();
    expect(screen.getByText(/Historical readings only/)).toBeInTheDocument();
    expect(screen.getByText('last free')).toBeInTheDocument();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    vi.setSystemTime(new Date(new Date(BASE_TIME).getTime() + 30 * 60_000));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(screen.getByText(/cannot confirm parking availability right now/i)).toBeInTheDocument());
    expect(screen.queryByText('last free')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nearby streets at last reading' })).not.toBeInTheDocument();
  });
});
