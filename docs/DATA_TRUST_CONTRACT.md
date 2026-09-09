# Data Trust Contract

**English** · [繁體中文](DATA_TRUST_CONTRACT.zh-TW.md)

This document is the shared contract between production behaviour and the tests. Its thresholds are this product's safety policy, not a City of Melbourne SLA.

Changing any number here changes what this dashboard is willing to claim. The thresholds live in one place, `src/lib/config.ts`, and are asserted by `src/__tests__/`.

## Source of truth

| Feed | Official dataset | Times that must be preserved |
| --- | --- | --- |
| On-street parking bay sensors | [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | `status_timestamp` (sensor observation) and `lastupdated` (feed publication) |

Reference data, generated at build time and carrying no timestamps at all:

| Dataset | Used for |
| --- | --- |
| `parking-zones-linked-to-street-segments` | Zone → street name |
| `sign-plates-located-in-each-parking-zone` | Zone → signage restriction |

Three times are kept distinct and may never substitute for one another:

- `observedAt` = `status_timestamp`, the moment the sensor saw this state.
- `sourceTime` = the newest `lastupdated` in the payload, the feed's own publication time.
- `fetchedAt` = the moment this product downloaded it.

`fetchedAt`, build time, commit time, browser time and cache write time **must never** stand in for a missing source time. Re-downloading the same snapshot must not make it newer.

## Verified product facts

Every item below was measured against the live feed on 2026-09-08. None of it is assumed.

1. **The feed ships dead sensors.** 963 of 6,324 records (15.2%) carry `lastupdated` values months to years old; the oldest `status_timestamp` is stuck at 2022-09-13. Taking them all at face value claims 4,370 free bays where only 3,922 are defensible — **448 phantom bays, an 11.4% overstatement**.
2. **Metadata freshness is not data freshness.** The catalog metadata for `meshed-sensor-type-2` said it was updated 6 days ago while its newest record was a year old. Any freshness judgement based on the catalog's `modified` field is wrong.
3. **34% of zones carry multiple signage codes** (212 of the 622 zones that have signage). The common pairing is `MP2P / LZ30` — a metered bay that is also a loading zone at certain hours. Picking one and displaying it gives a wrong answer during the hours the other plate applies.
4. **522 bays have no `zone_number`**, and a further 61 sit in zones absent from the council's street crosswalk. That is 583 bays (9.2%) that cannot be given a street name.
5. **The feed republishes roughly every 2 minutes.** A single `/exports/json` request returns all 6,324 records (about 1.5 MB, 174 KB gzipped). There is no pagination to handle.
6. **The API is CORS-open** (`access-control-allow-origin: *`) and needs no API key, with a quota of 10,000 requests per IP per day. The browser can read it directly; no proxy is required.

## Validation

A payload may enter the presentable model only if all of the following hold:

- The response is an array of at least 5,000 records. 6,324 is the known size; a feed that shrinks far below this is not trustworthy.
- No more than 2% of records are unparseable. Records missing `kerbsideid`, a timestamp or coordinates, or carrying a status outside `{Present, Unoccupied}`, are **dropped** — never defaulted to vacant.
- Coordinates fall inside Greater Melbourne. Anything outside is a parsing error, not a bay we have not heard of, and is kept off the map.
- `sourceTime` parses and is no more than 2 minutes ahead of the local clock.
- At least 60% of sensors are reporting (84.8% measured). Below that we cannot describe the city.
- Occupancy falls within 0–1.

HTTP 200 is not validity. `{}`, error-page JSON, empty arrays and missing fields must all be treated as invalid.

## Sensor trust window

An individual sensor counts only if its `lastupdated` falls within **30 minutes of the feed's own newest reading**.

The threshold is measured against the feed's time rather than the local clock. When the whole feed is an hour behind, its sensors are still consistent with one another — that is a stale snapshot, not a broken sensor network, and the two are handled differently.

Sensors that have gone quiet are counted in `notReporting` and are **never folded into the vacant count**. A bay we have not heard from is an unknown, not a free space.

## Freshness state machine

Classified by `now - sourceTime`:

| State | Rule | UI contract |
| --- | --- | --- |
| `live` | ≤ 5 minutes | Present tense permitted: "Bays free now" |
| `delayed` | ≤ 15 minutes | Figures still shown, with the lag stated explicitly |
| `stale` | ≤ 60 minutes | Heading becomes "Bays free at last reading"; every present-tense claim is withdrawn |
| `unavailable` | > 60 minutes, missing, invalid, or future-dated | Show "cannot confirm" with a retry and the official source. **No figures**, and no reassuring green conclusion |

These limits are deliberately shorter than a weather or electricity dashboard's. A parking bay changes state in the time it takes one car to leave: a 30-minute-old power reading is context, while a 30-minute-old parking reading is a wrong answer that sends someone driving to a bay already taken.

## Fallback, cache and regression

- On a failed fetch or failed validation, keep the last snapshot that passed validation and display it at its true age. Never generate sample data, and never read a failure as an empty result.
- A new snapshot whose `sourceTime` predates the one on screen **must be rejected** and must not overwrite it. A lagging CDN edge may not send the dashboard backwards in time.
- Freshness is recomputed from the clock **on every render**, not read from a timestamp captured on the last tick. Browsers throttle timers in hidden tabs; without this rule, a restored tab would show hour-old figures under a "Live" label.
- Besides the timer, `visibilitychange`, `focus` and `pageshow` all trigger a recompute. The recompute is never gated on visibility — only the network refresh is.

## Signage

A restriction may be named for a street only when all of that street's zones agree on one code. Where they disagree, the row lists the codes actually present and defers to the sign — for example `Metered 2hr / Loading zone 30min — read the sign`.

Naming one code would be worse than naming none: labelling a bay "metered, 2 hours" when it is a loading zone at the hour the driver arrives is how someone gets a fine. The sign on the street always outranks this site.

## Required verification

- Fixtures in the real feed's shape, plus `{}`, empty arrays, missing fields, unknown statuses, missing timestamps, future timestamps and non-Melbourne coordinates.
- The sensor trust window's boundaries (trusted at 29 minutes, excluded past 60), and the "whole feed delayed but sensors consistent" case.
- All four freshness boundaries.
- An open page ageing across those boundaries with no network refresh.
- An older snapshot failing to overwrite a newer one.
- The gap between the naive and the honest count, with the 448-bay order of magnitude locked in by regression.
- The unmapped group never topping a recommendation, while street totals still reconcile with the city totals.
- A production build checked in a real browser: desktop and 375px mobile, horizontal overflow, console, keyboard operation.
