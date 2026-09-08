/** Feed-level trust state. The UI must never contradict this value. */
export type FeedState = 'live' | 'delayed' | 'stale' | 'unavailable';

/** Why a snapshot was rejected. Surfaced to the user, not swallowed. */
export type RejectionCode =
  | 'network'
  | 'timeout'
  | 'http'
  | 'malformed'
  | 'too-few-records'
  | 'unparseable-records'
  | 'no-source-time'
  | 'future-source-time'
  | 'too-few-trusted-sensors'
  | 'impossible-occupancy'
  | 'stale-regression';

export class SnapshotRejected extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'SnapshotRejected';
  }
}

/** One parking bay, after validation. */
export interface Bay {
  readonly id: number;
  readonly zone: number | null;
  readonly occupied: boolean;
  /** When the sensor observed this state. */
  readonly observedAt: Date;
  /** When the feed last republished this record. */
  readonly reportedAt: Date;
  readonly lat: number;
  readonly lon: number;
  /**
   * Whether this sensor reported recently enough to count.
   * Untrusted bays are shown as "not reporting", never as available.
   */
  readonly trusted: boolean;
}

/** A validated, self-consistent view of the whole feed at one instant. */
export interface Snapshot {
  readonly bays: readonly Bay[];
  /** Newest `lastupdated` in the payload — the feed's own source time. */
  readonly sourceTime: Date;
  /** When *we* downloaded it. Never used to imply freshness. */
  readonly fetchedAt: Date;
  readonly totalRecords: number;
  readonly trustedCount: number;
  readonly untrustedCount: number;
  readonly unparseableCount: number;
}

/** Aggregated availability for one named street. */
export interface StreetAvailability {
  readonly street: string;
  readonly zones: readonly number[];
  readonly total: number;
  readonly vacant: number;
  readonly occupied: number;
  readonly notReporting: number;
  /** vacant / (vacant + occupied). Undefined when no sensor is reporting. */
  readonly vacancyRate: number | null;
  readonly lat: number;
  readonly lon: number;
  /** Null when the street's zones do not agree on one restriction. */
  readonly restriction: SignRestriction | null;
  /** Every distinct restriction found along the street, in first-seen order. */
  readonly restrictionCodes: readonly SignRestriction[];
  /** True when signage differs across the street; the UI must say so. */
  readonly restrictionVaries: boolean;
}

/** City-wide roll-up. */
export interface CitySummary {
  readonly vacant: number;
  readonly occupied: number;
  readonly reporting: number;
  readonly notReporting: number;
  readonly total: number;
  readonly vacancyRate: number | null;
  readonly coverage: number;
}

/** One sign plate: what the signage permits, and on which days. */
export interface SignRestriction {
  readonly code: string;
  readonly days: string | null;
}

/** Static reference data, generated at build time from council datasets. */
export interface ZoneReference {
  readonly street: string;
  readonly from: string | null;
  readonly to: string | null;
  /**
   * Every distinct sign plate on the zone, not just one.
   * 34% of zones carry more than one code (a metered bay that becomes a
   * loading zone, for example). Collapsing those to a single label would state
   * a restriction that is wrong at the times the other plate applies.
   */
  readonly restrictions: readonly SignRestriction[];
}

export type ZoneCrosswalk = Readonly<Record<string, ZoneReference>>;
