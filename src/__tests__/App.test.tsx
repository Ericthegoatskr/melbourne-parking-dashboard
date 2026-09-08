import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
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
