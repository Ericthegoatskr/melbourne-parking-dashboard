import { FRESHNESS_MINUTES } from './config';
import type { FeedState, Snapshot } from './types';

/**
 * Classify a snapshot by the age of its *source* time.
 *
 * The only input is `now - sourceTime`. Fetch time, build time, deploy time,
 * cache write time and browser clock drift are all deliberately excluded:
 * re-downloading the same snapshot must never make it look newer.
 */
export function classifyAge(ageMinutes: number): FeedState {
  if (!Number.isFinite(ageMinutes) || ageMinutes < 0) return 'unavailable';
  if (ageMinutes <= FRESHNESS_MINUTES.live) return 'live';
  if (ageMinutes <= FRESHNESS_MINUTES.delayed) return 'delayed';
  if (ageMinutes <= FRESHNESS_MINUTES.stale) return 'stale';
  return 'unavailable';
}

export function ageMinutes(sourceTime: Date, now: Date): number {
  return (now.getTime() - sourceTime.getTime()) / 60_000;
}

export function classifySnapshot(snapshot: Snapshot, now: Date): FeedState {
  return classifyAge(ageMinutes(snapshot.sourceTime, now));
}

/**
 * Whether the dashboard may state a bay count as the current situation.
 * `stale` data stays visible for context but must never be presented as now.
 */
export function mayClaimCurrent(state: FeedState): boolean {
  return state === 'live' || state === 'delayed';
}

const LABELS: Record<FeedState, string> = {
  live: 'Live',
  delayed: 'Delayed',
  stale: 'Not current',
  unavailable: 'Unavailable',
};

const EXPLANATIONS: Record<FeedState, string> = {
  live: 'Sensor readings are current.',
  delayed: 'Readings are behind. Bays may already have changed.',
  stale: 'Too old to describe the street right now. Shown as the last reading only.',
  unavailable: 'We cannot confirm current parking availability.',
};

export function stateLabel(state: FeedState): string {
  return LABELS[state];
}

export function stateExplanation(state: FeedState): string {
  return EXPLANATIONS[state];
}
