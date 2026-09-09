/**
 * Data-trust policy constants.
 *
 * These are *this product's* safety thresholds, not a City of Melbourne SLA.
 * Every value is traceable to a measurement recorded in docs/DATA_TRUST_CONTRACT.md.
 * Changing one changes what the dashboard is willing to claim, so they live in
 * one place and are asserted by tests.
 */
export const DATASET_ID = 'on-street-parking-bay-sensors';
export const ODS_BASE = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets';
/** Full-feed export. One request returns every bay; there is no pagination. */
export const FEED_URL = `${ODS_BASE}/${DATASET_ID}/exports/json` +
    '?select=kerbsideid,zone_number,status_description,status_timestamp,lastupdated,location';
export const DATASET_PAGE = `https://data.melbourne.vic.gov.au/explore/dataset/${DATASET_ID}/information/`;
/**
 * Feed freshness thresholds, in minutes.
 *
 * Deliberately tighter than a weather or electricity dashboard: a parking bay
 * changes state in the time it takes one car to leave. A 30-minute-old power
 * reading is context; a 30-minute-old parking reading is a wrong answer that
 * sends someone driving to a bay that is already taken.
 */
export const FRESHNESS_MINUTES = {
    live: 5,
    delayed: 15,
    stale: 60,
};
/**
 * A single sensor is only counted if it reported within this many minutes of
 * the feed's own newest reading.
 *
 * Measured 2026-09-08: 963 of 6,324 bays (15.2%) carry `lastupdated` values
 * months to years old — decommissioned sensors that the feed still ships.
 * Counting them inflates apparent availability by ~11%.
 */
export const SENSOR_TRUST_WINDOW_MINUTES = 30;
/** Fail-closed validation limits. */
export const VALIDATION = {
    /** Observed 6,324 bays. A feed that shrinks far below this is not trustworthy. */
    minRecords: 5000,
    /** Observed 84.8% of sensors reporting. Below 60% we cannot summarise the city. */
    minTrustedRatio: 0.6,
    /** Records that fail to parse at all, as a share of the payload. */
    maxUnparseableRatio: 0.02,
    /** Clock skew we tolerate before treating a source time as impossible. */
    maxFutureSkewMinutes: 2,
    /** Occupancy outside this band means we misread the feed, not that the city changed. */
    occupancyBounds: { min: 0, max: 1 },
};
/** The only bay states the City of Melbourne feed publishes. */
export const OCCUPIED_STATUS = 'Present';
export const VACANT_STATUS = 'Unoccupied';
export const KNOWN_STATUSES = [OCCUPIED_STATUS, VACANT_STATUS];
/** Network refresh cadence. The feed itself republishes roughly every 2 minutes. */
export const REFRESH_INTERVAL_MS = 120_000;
/**
 * How often the page re-derives freshness from the clock alone.
 * A tab left open must age into delayed/stale by itself, without waiting for
 * a network refresh that a throttled background timer may never fire.
 */
export const FRESHNESS_TICK_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 20_000;
export const ATTRIBUTION = {
    publisher: 'City of Melbourne',
    licence: 'Creative Commons Attribution 4.0 International',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    portal: 'https://data.melbourne.vic.gov.au/',
};
