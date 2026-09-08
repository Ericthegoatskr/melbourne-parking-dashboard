import { describe, expect, it } from 'vitest';
import {
  ageMinutes,
  classifyAge,
  classifySnapshot,
  mayClaimCurrent,
} from '../lib/freshness';
import { FRESHNESS_MINUTES } from '../lib/config';
import type { Snapshot } from '../lib/types';

function snapshotAt(sourceTime: Date): Snapshot {
  return {
    bays: [],
    sourceTime,
    fetchedAt: new Date(),
    totalRecords: 6324,
    trustedCount: 5361,
    untrustedCount: 963,
    unparseableCount: 0,
  };
}

describe('freshness state machine', () => {
  it('classifies each band', () => {
    expect(classifyAge(0)).toBe('live');
    expect(classifyAge(FRESHNESS_MINUTES.live)).toBe('live');
    expect(classifyAge(FRESHNESS_MINUTES.live + 0.01)).toBe('delayed');
    expect(classifyAge(FRESHNESS_MINUTES.delayed)).toBe('delayed');
    expect(classifyAge(FRESHNESS_MINUTES.delayed + 0.01)).toBe('stale');
    expect(classifyAge(FRESHNESS_MINUTES.stale)).toBe('stale');
    expect(classifyAge(FRESHNESS_MINUTES.stale + 0.01)).toBe('unavailable');
  });

  it('treats a future or unreadable age as unavailable, never as live', () => {
    expect(classifyAge(-1)).toBe('unavailable');
    expect(classifyAge(Number.NaN)).toBe('unavailable');
    expect(classifyAge(Number.POSITIVE_INFINITY)).toBe('unavailable');
  });

  it('only lets live and delayed data describe the present', () => {
    expect(mayClaimCurrent('live')).toBe(true);
    expect(mayClaimCurrent('delayed')).toBe(true);
    expect(mayClaimCurrent('stale')).toBe(false);
    expect(mayClaimCurrent('unavailable')).toBe(false);
  });

  it('derives age from source time only, so re-downloading does not refresh it', () => {
    const sourceTime = new Date('2026-09-08T18:00:00Z');
    const now = new Date('2026-09-08T18:30:00Z');
    const snapshot = snapshotAt(sourceTime);

    // A later fetch of the same source time must not change the verdict.
    const refetched: Snapshot = { ...snapshot, fetchedAt: now };

    expect(ageMinutes(sourceTime, now)).toBe(30);
    expect(classifySnapshot(snapshot, now)).toBe('stale');
    expect(classifySnapshot(refetched, now)).toBe('stale');
  });

  it('ages a snapshot in place as the clock moves', () => {
    const sourceTime = new Date('2026-09-08T18:00:00Z');
    const snapshot = snapshotAt(sourceTime);
    expect(classifySnapshot(snapshot, new Date('2026-09-08T18:03:00Z'))).toBe('live');
    expect(classifySnapshot(snapshot, new Date('2026-09-08T18:10:00Z'))).toBe('delayed');
    expect(classifySnapshot(snapshot, new Date('2026-09-08T18:40:00Z'))).toBe('stale');
    expect(classifySnapshot(snapshot, new Date('2026-09-08T19:30:00Z'))).toBe('unavailable');
  });
});
