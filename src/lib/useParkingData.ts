import { useCallback, useEffect, useRef, useState } from 'react';
import { FRESHNESS_TICK_MS, REFRESH_INTERVAL_MS } from './config';
import { fetchSnapshot } from './odsClient';
import { classifySnapshot } from './freshness';
import { SnapshotRejected } from './types';
import type { FeedState, Snapshot } from './types';

export interface ParkingData {
  /** Last snapshot that passed validation. May be old; check `state`. */
  snapshot: Snapshot | null;
  /** Derived from the snapshot's source time and the current clock. */
  state: FeedState;
  /** Why the most recent attempt failed, if it did. */
  rejection: SnapshotRejected | null;
  loading: boolean;
  /** True while refreshing on top of an existing snapshot. */
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Own the feed lifecycle: fetch, validate, guard against regression, and age
 * the result in place.
 *
 * Two properties this hook is responsible for:
 *
 * 1. Monotonic source time. A refresh that returns an *older* snapshot than
 *    the one on screen is rejected. Without this, a lagging CDN edge could
 *    silently roll the dashboard backwards.
 * 2. Self-ageing. Freshness is recomputed on a short timer and whenever the
 *    tab becomes visible, so a page left open crosses the delayed/stale
 *    boundaries by itself instead of waiting for a network refresh that a
 *    throttled background timer may never fire.
 */
export function useParkingData(): ParkingData {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [rejection, setRejection] = useState<SnapshotRejected | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Bumped purely to schedule a re-render. The freshness verdict is never read
   * from this value — see the note on `state` below.
   */
  const [, bumpClock] = useState(0);
  const tick = useCallback(() => bumpClock((n) => n + 1), []);

  // Read inside the async callback without making it a dependency.
  const latest = useRef<Snapshot | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (latest.current) setRefreshing(true);

    try {
      const fresh = await fetchSnapshot(new Date());

      const previous = latest.current;
      if (previous && fresh.sourceTime < previous.sourceTime) {
        // Keep the newer snapshot on screen and say why we ignored this one.
        setRejection(
          new SnapshotRejected(
            'stale-regression',
            'Ignored a feed response older than the data already shown.',
            `Received ${fresh.sourceTime.toISOString()}, holding ${previous.sourceTime.toISOString()}.`,
          ),
        );
        return;
      }

      latest.current = fresh;
      setSnapshot(fresh);
      setRejection(null);
    } catch (error) {
      setRejection(
        error instanceof SnapshotRejected
          ? error
          : new SnapshotRejected('network', 'Could not load parking data.'),
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      tick();
    }
  }, [tick]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Age the snapshot in place, independent of the network.
  useEffect(() => {
    const timer = setInterval(tick, FRESHNESS_TICK_MS);
    return () => clearInterval(timer);
  }, [tick]);

  /*
   * Browsers throttle timers in a hidden tab, so the interval above can stop
   * firing for minutes at a time. Re-render the moment the tab comes back.
   *
   * `tick` is called unconditionally rather than only when the page reports
   * itself visible: the cost of an extra render is nothing, and gating it on
   * `visibilityState` is how a restored tab ends up showing an hour-old figure
   * under a "Live" label. Only the network refresh is gated, to avoid fetching
   * for a tab nobody is looking at.
   */
  useEffect(() => {
    const onWake = () => {
      tick();
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [load, tick]);

  /*
   * Derived from the clock at render time, not from a stored timestamp.
   *
   * Reading a `now` held in state would leave a window — as long as the gap
   * between ticks — where the component re-renders for some other reason and
   * paints a fresh-looking label over data that has already expired. Computing
   * it here means every render that reaches the screen is self-consistent.
   */
  const state: FeedState = snapshot ? classifySnapshot(snapshot, new Date()) : 'unavailable';

  return {
    snapshot,
    state,
    rejection,
    loading,
    refreshing,
    refresh: () => void load(),
  };
}
