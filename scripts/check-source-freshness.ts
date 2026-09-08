/**
 * Probe the upstream council feed and fail loudly if it stops being usable.
 *
 * This checks the *source*, not our deployment. The dashboard reads the
 * official API directly from the browser, so we ship no data snapshot that
 * could rot. What can rot is upstream, and this is how we find out first.
 *
 *   npm run probe:freshness
 */
import { FEED_URL, SENSOR_TRUST_WINDOW_MINUTES, VALIDATION } from '../src/lib/config';
import { validatePayload } from '../src/lib/odsClient';
import { classifyAge, ageMinutes } from '../src/lib/freshness';
import { SnapshotRejected } from '../src/lib/types';

const TIMEOUT_MS = 30_000;

async function main(): Promise<void> {
  const now = new Date();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      fail(`Feed returned HTTP ${response.status}.`);
      return;
    }
    payload = await response.json();
  } catch (error) {
    fail(`Could not read the feed: ${error instanceof Error ? error.message : error}`);
    return;
  } finally {
    clearTimeout(timer);
  }

  let snapshot;
  try {
    // Reuse the exact rules the browser applies. A probe that validates
    // differently to the product is a probe that lies.
    snapshot = validatePayload(payload, now);
  } catch (error) {
    if (error instanceof SnapshotRejected) {
      fail(`Feed rejected as ${error.code}: ${error.message} ${error.detail ?? ''}`);
      return;
    }
    throw error;
  }

  const age = ageMinutes(snapshot.sourceTime, now);
  const state = classifyAge(age);
  const coverage = snapshot.trustedCount / snapshot.bays.length;

  console.log(`Source time:   ${snapshot.sourceTime.toISOString()}`);
  console.log(`Age:           ${age.toFixed(1)} min  (${state})`);
  console.log(`Records:       ${snapshot.totalRecords}`);
  console.log(`Reporting:     ${snapshot.trustedCount} (${(coverage * 100).toFixed(1)}%)`);
  console.log(`Silent:        ${snapshot.untrustedCount}`);
  console.log(`Unreadable:    ${snapshot.unparseableCount}`);
  console.log(`Trust window:  ${SENSOR_TRUST_WINDOW_MINUTES} min`);

  if (state === 'unavailable') {
    fail(`Feed is ${age.toFixed(0)} minutes old; the dashboard would show nothing.`);
    return;
  }
  if (coverage < VALIDATION.minTrustedRatio) {
    fail(`Only ${(coverage * 100).toFixed(1)}% of sensors are reporting.`);
    return;
  }

  console.log('\nSource is healthy.');
}

function fail(message: string): void {
  console.error(`Source health check failed: ${message}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
