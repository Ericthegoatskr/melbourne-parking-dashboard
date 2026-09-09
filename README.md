# Melbourne Street Parking

**English** · [繁體中文](README.zh-TW.md)

A public dashboard of on-street parking availability in the City of Melbourne, built on the council's own sensor open data.

**Live site:** <https://ericthegoatskr.github.io/melbourne-parking-dashboard/>

One thing separates it from every other parking map: **it subtracts the sensors that have stopped reporting, and tells you on the page how many it subtracted.** The council's feed carries 963 sensors that have not reported in months to years while still shipping their last known state. Counting them overstates free bays by roughly 11%.

Mission, research evidence and roadmap: [`PRODUCT.md`](PRODUCT.md).
Production validation, freshness and fallback rules: [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md).

> Both of those documents are currently written in Traditional Chinese.

## Why this exists

The City of Melbourne is the source of truth and already publishes its sensor data in full. Other parking apps have long been able to draw dots on a map. So the differentiator here is not another map — it is what the dashboard refuses to count.

Measured against the live feed on 2026-09-08:

| | Bays reported free |
| --- | --- |
| Counting every record in the feed | 4,370 |
| Counting only sensors that are actually reporting | **3,922** |
| Difference | **448 phantom bays — an 11.4% overstatement** |

That is not a theoretical flaw. Its concrete consequence is a driver heading for a street they were told had space, finding none, and going around the block again.

## Features

- Explicit `live`, `delayed`, `stale` and `unavailable` states derived from the council's own timestamps. The data state always appears above the numbers.
- Present-tense claims are withdrawn past 15 minutes; past 60 minutes no bay count is shown at all.
- A 30-minute sensor trust window. Bays that have not reported are counted as *not reporting* and never as free.
- An expandable "what this dashboard excluded" panel showing the exclusions alongside what a naive count would have claimed.
- Street rankings by most free bays or best odds. The odds ranking requires at least 5 reporting sensors, so a two-sensor street cannot top the list at 100%.
- A street-level map. Streets with nothing reporting are drawn hollow and grey, never coloured as though a bay were known to be free.
- Signage restrictions named only where a street's zones agree; otherwise the actual mix is listed and the reader is sent to the sign.
- An older snapshot may never overwrite a newer one. A failed fetch keeps the last valid reading and ages it honestly.
- An open tab ages itself, without depending on a network refresh or an unthrottled timer.
- Responsive from desktop down to 375px, with no horizontal overflow.

## Data sources

| Dataset | Used for |
| --- | --- |
| [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | Bay occupancy, sensor timestamps, coordinates |
| [`parking-zones-linked-to-street-segments`](https://data.melbourne.vic.gov.au/explore/dataset/parking-zones-linked-to-street-segments/information/) | Zone → street name |
| [`sign-plates-located-in-each-parking-zone`](https://data.melbourne.vic.gov.au/explore/dataset/sign-plates-located-in-each-parking-zone/information/) | Zone → signage restriction |

Data published by the City of Melbourne under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). This is not a council service and is not endorsed by the council.

The API is CORS-open and needs no API key, so the browser reads the official endpoint directly with no proxy in between.

## Run locally

Requires Node.js 20, 22, or 24 and above.

```bash
npm install
npm run dev
```

Vite prints the local preview URL.

## Verification

```bash
npm run verify
```

This runs the same four steps as CI, in the same order: `lint` → `typecheck` → `test` → `build`.

**Use this command rather than invoking the underlying tools with `npx`.** Checking locally with `npx tsc -b` while CI ran `npm run typecheck` is exactly how a broken script passed local checks and then failed CI.

For any change a user can see, also exercise a production build in a real browser: desktop and 375px mobile, all four data states, interaction, overflow, and the browser console. **A successful build is not acceptance.**

## Reference data

```bash
npm run build:crosswalk
```

Writes `public/data/zone-crosswalk.json` — 839 zones, 177 streets, about 106 KB.

The crosswalk holds street names and signage codes and **no timestamps whatsoever**, so reference data can never make stale live data look fresh.

If street names fail to load the dashboard still works: every bay falls into the "unmapped" group and the city-wide figures are unaffected.

## Project structure

```text
melbourne-parking-dashboard/
├── src/
│   ├── App.tsx
│   ├── lib/
│   │   ├── config.ts            # every threshold, each traceable to a measurement
│   │   ├── odsClient.ts         # fetching and fail-closed validation
│   │   ├── freshness.ts         # the four-state machine
│   │   ├── parkingModel.ts      # aggregation, ranking, signage
│   │   └── useParkingData.ts    # lifecycle, regression guard, self-ageing
│   ├── components/
│   └── __tests__/
├── scripts/
│   ├── build-street-crosswalk.ts
│   └── check-source-freshness.ts
├── docs/DATA_TRUST_CONTRACT.md
└── PRODUCT.md
```

## Deployment

`.github/workflows/pages.yml` runs lint, typecheck, tests, rebuilds the crosswalk and deploys to GitHub Pages on pushes to `main` and on manual dispatch.

This dashboard needs no scheduled ingestion. The browser reads the official feed directly, so the deployed artifact is static code plus reference data. **There is no data snapshot to keep fresh, and therefore no cron delay that could leave a user looking at stale figures.**

`scripts/check-source-freshness.ts` (`npm run probe:freshness`) independently verifies that the official source itself is healthy, and runs on a schedule in CI. It checks upstream, not our deployment.

## Basemap dependency

The basemap uses OpenStreetMap's own tiles, darkened in the browser with a CSS filter to near-greyscale so that colour belongs only to the data.

The CARTO dark basemap used previously now answers **HTTP 200 with an "API KEY REQUIRED" watermark tile** — a valid response carrying invalid content, which is a neat miniature of the reason this dashboard exists.

OpenStreetMap's tile usage policy does not permit heavy traffic. Before any real volume this should move to a keyed provider with an SLA, or to self-hosted tiles. This is the only third-party runtime dependency outside the official data source; if it fails, the basemap disappears and the bay counts and street rankings are unaffected.

## Known limitations

- Covers only bays with a working in-ground sensor. A street missing from this page may still have parking.
- A sensor reading is a fact about the recent past. It is not a guarantee that a bay will still be free when you arrive.
- Street-level restrictions are a summary. The sign on the street always wins.
- 583 bays (9.2%) cannot be matched to a street name and are grouped as "unmapped". They count toward the city totals but never appear as a recommendation.
