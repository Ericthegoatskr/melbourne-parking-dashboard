import { describe, expect, it } from 'vitest';
import { validatePayload } from '../lib/odsClient';
import { SnapshotRejected } from '../lib/types';
import { VALIDATION } from '../lib/config';
import {
  BASE_TIME,
  WELL_OUTSIDE_TRUST_WINDOW,
  minutesBefore,
  rawBay,
  validPayload,
} from './factories';

const NOW = new Date('2026-09-08T18:31:00+00:00');

function expectRejection(payload: unknown, code: string): void {
  try {
    validatePayload(payload, NOW);
    throw new Error(`Expected rejection ${code}, but the payload was accepted.`);
  } catch (error) {
    expect(error).toBeInstanceOf(SnapshotRejected);
    expect((error as SnapshotRejected).code).toBe(code);
  }
}

describe('payload validation fails closed', () => {
  it('accepts a well-formed payload', () => {
    const snapshot = validatePayload(validPayload(), NOW);
    expect(snapshot.totalRecords).toBe(6000);
    expect(snapshot.trustedCount).toBe(6000);
    expect(snapshot.sourceTime.toISOString()).toBe(new Date(BASE_TIME).toISOString());
  });

  it('rejects things that are not a list of bays', () => {
    expectRejection({}, 'malformed');
    expectRejection(null, 'malformed');
    expectRejection('{"error":"nope"}', 'malformed');
  });

  it('rejects an empty or shrunken feed rather than reporting zero bays', () => {
    expectRejection([], 'too-few-records');
    expectRejection(validPayload(10), 'too-few-records');
    expectRejection(validPayload(VALIDATION.minRecords - 1), 'too-few-records');
  });

  it('rejects a payload whose records are mostly unreadable', () => {
    // Every record missing its status: HTTP 200 with junk inside.
    const broken = validPayload(6000, () => ({ status_description: undefined }));
    expectRejection(broken, 'unparseable-records');
  });

  it('never coerces an unknown status into "vacant"', () => {
    const payload = validPayload(6000, (i) =>
      i === 0 ? { status_description: 'Maintenance' } : {},
    );
    const snapshot = validatePayload(payload, NOW);
    // The odd record is dropped, not counted as a free bay.
    expect(snapshot.bays).toHaveLength(5999);
    expect(snapshot.unparseableCount).toBe(1);
  });

  it('drops records with no source time instead of substituting fetch time', () => {
    const payload = validPayload(6000, (i) => (i < 50 ? { lastupdated: undefined } : {}));
    const snapshot = validatePayload(payload, NOW);
    expect(snapshot.bays).toHaveLength(5950);
    expect(snapshot.unparseableCount).toBe(50);
  });

  it('rejects a feed that claims a time in the future', () => {
    const future = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    expectRejection(validPayload(6000, () => ({ lastupdated: future })), 'future-source-time');
  });

  it('tolerates small clock skew without rejecting', () => {
    const slightlyAhead = new Date(NOW.getTime() + 60_000).toISOString();
    const snapshot = validatePayload(
      validPayload(6000, () => ({ lastupdated: slightlyAhead })),
      NOW,
    );
    expect(snapshot.trustedCount).toBe(6000);
  });

  it('rejects coordinates outside Melbourne rather than mapping them', () => {
    const payload = validPayload(6000, (i) =>
      i < 30 ? { location: { lat: 25.03, lon: 121.56 } } : {},
    );
    const snapshot = validatePayload(payload, NOW);
    expect(snapshot.bays).toHaveLength(5970);
  });

  it('refuses to summarise the city when too few sensors are reporting', () => {
    const dead = minutesBefore(BASE_TIME, WELL_OUTSIDE_TRUST_WINDOW);
    // 70% of sensors silent, below the 60% reporting floor.
    const payload = validPayload(6000, (i) => (i < 4200 ? { lastupdated: dead } : {}));
    expectRejection(payload, 'too-few-trusted-sensors');
  });
});

describe('stale sensors are excluded, not counted as free', () => {
  it('marks sensors that have gone quiet as untrusted', () => {
    const dead = minutesBefore(BASE_TIME, WELL_OUTSIDE_TRUST_WINDOW);
    const payload = validPayload(6000, (i) => (i < 900 ? { lastupdated: dead } : {}));
    const snapshot = validatePayload(payload, NOW);

    expect(snapshot.untrustedCount).toBe(900);
    expect(snapshot.trustedCount).toBe(5100);
    // Every record is retained so the totals still reconcile.
    expect(snapshot.bays).toHaveLength(6000);
  });

  it('keeps a sensor that reported just inside the trust window', () => {
    const borderline = minutesBefore(BASE_TIME, 29);
    const payload = validPayload(6000, (i) => (i < 100 ? { lastupdated: borderline } : {}));
    expect(validatePayload(payload, NOW).untrustedCount).toBe(0);
  });

  it('measures the trust window against the feed, not the local clock', () => {
    // Whole feed is an hour old. Sensors are still consistent with each other,
    // so they stay trusted; it is the snapshot that is stale, not the sensors.
    const hourOld = minutesBefore(BASE_TIME, 60);
    const snapshot = validatePayload(
      validPayload(6000, () => ({ lastupdated: hourOld })),
      NOW,
    );
    expect(snapshot.untrustedCount).toBe(0);
    expect(snapshot.sourceTime.toISOString()).toBe(new Date(hourOld).toISOString());
  });
});

describe('regression against the real feed shape', () => {
  it('reads a record in the exact shape the council publishes', () => {
    const real = rawBay({
      kerbsideid: 62644,
      zone_number: 7512,
      status_description: 'Unoccupied',
      status_timestamp: '2026-09-08T18:28:54+00:00',
      lastupdated: '2026-09-08T18:30:49+00:00',
      location: { lon: 144.97289678223075, lat: -37.81252513205844 },
    });
    const payload = [real, ...validPayload(5999, (i) => ({ kerbsideid: i + 100 }))];
    const snapshot = validatePayload(payload, NOW);
    const bay = snapshot.bays.find((b) => b.id === 62644);

    expect(bay).toBeDefined();
    expect(bay?.occupied).toBe(false);
    expect(bay?.zone).toBe(7512);
    // observedAt and reportedAt are distinct facts and must not be conflated.
    expect(bay?.observedAt.toISOString()).not.toBe(bay?.reportedAt.toISOString());
  });

  it('handles a bay with no zone rather than discarding it', () => {
    const payload = validPayload(6000, (i) => (i < 500 ? { zone_number: null } : {}));
    const snapshot = validatePayload(payload, NOW);
    expect(snapshot.bays).toHaveLength(6000);
    expect(snapshot.bays.filter((b) => b.zone === null)).toHaveLength(500);
  });
});
