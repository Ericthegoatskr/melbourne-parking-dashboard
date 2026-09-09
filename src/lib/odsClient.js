import { FEED_URL, KNOWN_STATUSES, OCCUPIED_STATUS, REQUEST_TIMEOUT_MS, SENSOR_TRUST_WINDOW_MINUTES, VALIDATION, } from './config';
import { SnapshotRejected } from './types';
function parseTime(value) {
    if (typeof value !== 'string' || value.length === 0)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function parseCoord(location) {
    if (typeof location !== 'object' || location === null)
        return null;
    const { lat, lon } = location;
    if (typeof lat !== 'number' || typeof lon !== 'number')
        return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return null;
    // Greater Melbourne. A coordinate outside this box is a parsing error,
    // not a bay we have not heard of.
    if (lat > -37.5 || lat < -38.2)
        return null;
    if (lon < 144.5 || lon > 145.4)
        return null;
    return { lat, lon };
}
/**
 * Turn one raw record into a Bay, or null if it cannot be trusted at all.
 *
 * A record is dropped — not defaulted — when a required field is missing.
 * `status_description` outside the known set is never coerced to "vacant".
 */
function parseBay(raw) {
    const id = typeof raw.kerbsideid === 'number' ? raw.kerbsideid : null;
    if (id === null)
        return null;
    const status = raw.status_description;
    if (typeof status !== 'string' || !KNOWN_STATUSES.includes(status))
        return null;
    const observedAt = parseTime(raw.status_timestamp);
    const reportedAt = parseTime(raw.lastupdated);
    if (!observedAt || !reportedAt)
        return null;
    const coord = parseCoord(raw.location);
    if (!coord)
        return null;
    const zone = typeof raw.zone_number === 'number' ? raw.zone_number : null;
    return {
        id,
        zone,
        occupied: status === OCCUPIED_STATUS,
        observedAt,
        reportedAt,
        lat: coord.lat,
        lon: coord.lon,
    };
}
/**
 * Validate a raw payload into a Snapshot, or throw SnapshotRejected.
 *
 * Exported separately from the fetch so every rule is testable against
 * fixtures without a network.
 */
export function validatePayload(payload, now) {
    if (!Array.isArray(payload)) {
        throw new SnapshotRejected('malformed', 'Feed did not return a list of bays.');
    }
    if (payload.length < VALIDATION.minRecords) {
        throw new SnapshotRejected('too-few-records', 'The feed returned far fewer bays than the sensor network contains.', `${payload.length} records, expected at least ${VALIDATION.minRecords}.`);
    }
    const parsed = [];
    let unparseable = 0;
    for (const raw of payload) {
        const bay = parseBay(raw);
        if (bay)
            parsed.push(bay);
        else
            unparseable += 1;
    }
    const unparseableRatio = unparseable / payload.length;
    if (unparseableRatio > VALIDATION.maxUnparseableRatio) {
        throw new SnapshotRejected('unparseable-records', 'Too much of the feed could not be read.', `${(unparseableRatio * 100).toFixed(1)}% of records were unreadable.`);
    }
    if (parsed.length === 0) {
        throw new SnapshotRejected('no-source-time', 'No readable bay records.');
    }
    // The feed's own source time is the newest republish stamp in the payload.
    let sourceTime = parsed[0].reportedAt;
    for (const bay of parsed) {
        if (bay.reportedAt > sourceTime)
            sourceTime = bay.reportedAt;
    }
    const skewMinutes = (sourceTime.getTime() - now.getTime()) / 60_000;
    if (skewMinutes > VALIDATION.maxFutureSkewMinutes) {
        throw new SnapshotRejected('future-source-time', 'The feed reports a time in the future.', `Source time is ${skewMinutes.toFixed(1)} minutes ahead of this device.`);
    }
    // A sensor counts only if it reported close to the feed's own newest reading.
    const trustCutoff = sourceTime.getTime() - SENSOR_TRUST_WINDOW_MINUTES * 60_000;
    const bays = parsed.map((bay) => ({
        ...bay,
        trusted: bay.reportedAt.getTime() >= trustCutoff,
    }));
    const trustedCount = bays.reduce((n, bay) => n + (bay.trusted ? 1 : 0), 0);
    const trustedRatio = trustedCount / bays.length;
    if (trustedRatio < VALIDATION.minTrustedRatio) {
        throw new SnapshotRejected('too-few-trusted-sensors', 'Too few sensors are currently reporting to describe the city.', `${(trustedRatio * 100).toFixed(1)}% reporting, need ${(VALIDATION.minTrustedRatio * 100).toFixed(0)}%.`);
    }
    const occupied = bays.reduce((n, b) => n + (b.trusted && b.occupied ? 1 : 0), 0);
    const occupancy = trustedCount === 0 ? 0 : occupied / trustedCount;
    if (occupancy < VALIDATION.occupancyBounds.min ||
        occupancy > VALIDATION.occupancyBounds.max) {
        throw new SnapshotRejected('impossible-occupancy', 'Occupancy figures are not internally consistent.', `Computed occupancy ${occupancy}.`);
    }
    return {
        bays,
        sourceTime,
        fetchedAt: now,
        totalRecords: payload.length,
        trustedCount,
        untrustedCount: bays.length - trustedCount,
        unparseableCount: unparseable,
    };
}
export async function fetchSnapshot(now = new Date(), fetchImpl = fetch) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetchImpl(FEED_URL, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
    }
    catch (error) {
        clearTimeout(timer);
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new SnapshotRejected('timeout', 'The open-data feed did not respond in time.');
        }
        throw new SnapshotRejected('network', 'Could not reach the open-data feed.');
    }
    finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        throw new SnapshotRejected('http', 'The open-data feed returned an error.', `HTTP ${response.status}.`);
    }
    // HTTP 200 is not validity: an error page that parses as JSON still fails below.
    let payload;
    try {
        payload = await response.json();
    }
    catch {
        throw new SnapshotRejected('malformed', 'The feed response was not valid JSON.');
    }
    return validatePayload(payload, now);
}
