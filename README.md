# Melbourne Street Parking

**English** · [繁體中文](README.zh-TW.md)

A public dashboard of on-street parking availability in the City of Melbourne, built on the council's own sensor open data.

**Live site:** <https://ericthegoatskr.github.io/melbourne-parking-dashboard/>

One thing separates it from every other parking map: **it subtracts the sensors that have stopped reporting, and tells you on the page how many it subtracted.** The council's feed carries 963 sensors that have not reported in months to years while still shipping their last known state. Counting them overstates free bays by roughly 11%.

Mission, research evidence and roadmap: [`PRODUCT.md`](PRODUCT.md).
Production validation, freshness and fallback rules: [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md).

Every document in this repository is written in English with a Traditional Chinese counterpart alongside it (`*.zh-TW.md`). English is the authority where the two diverge.

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
- **Park near your destination:** submit an address or place name, then select a result; or choose one of eight bundled landmarks without a directory request. Search covers the City of Melbourne municipality, not all Greater Melbourne.
- **Use my current location:** request a one-time browser location fix only after pressing the button and allowing location access. The same nearby rankings and map use that point; the captured time and estimated accuracy stay visible. Press again after moving. Address search and landmarks remain available if location access fails or is declined.
- Choose a 250 m, 500 m or 1 km radius and rank nearby streets by **Nearest first** or **Most reported free**. Individual sensor bays are filtered before street counts are calculated; the summary cards remain city-wide. Streets with reported free bays come first, followed by occupied-only streets, then silent sensors. Distances and map pins use the nearest reporting free bay where available, otherwise the nearest reporting bay, then the nearest silent sensor.
- Nearby results retain the 30-minute sensor trust window and all feed freshness rules: stale readings describe the past, and unavailable data produces no availability counts. **Clear destination** restores the original city-wide street search, sorting and map view.
- A street-level map. Streets with nothing reporting are drawn hollow and grey, never coloured as though a bay were known to be free.
- Signage restrictions named only where a street's zones agree; otherwise the actual mix is listed and the reader is sent to the sign.
- An older snapshot may never overwrite a newer one. A failed fetch keeps the last valid reading and ages it honestly.
- An open tab ages itself, without depending on a network refresh or an unthrottled timer.
- A shared layout and navigation with [Melbourne Daily](https://ericthegoatskr.github.io/melbourne-daily/), with a dedicated **Walnut & amber** parking palette: walnut `#2C241B`, warm ivory `#FFF3DF` and amber `#EDBD69`. **Colour theme** in the sidebar/mobile menu restores the original light palette; the featured/light preference is shared across all five dashboards on this browser, while each destination keeps its own colours. Availability colours and map markers retain their meaning.
- Finite card entrance and value-change animations, with motion disabled when the system requests reduced motion.
- Responsive from desktop down to 375px, with a mobile navigation drawer and no horizontal overflow.
- The same five-destination navigation as the other dashboards: Home, Parking, Weather & UV, Air quality and Transport. Desktop uses the sidebar; mobile has a bottom bar with safe-area spacing. The current dashboard is highlighted, while local map/street/source links remain under “On this page”.
- The map code, bundled Leaflet styles and tiles load near the map instead of delaying the initial parking summary. Map links, street selection and a manual load button also activate it; a failed download leaves the street data available with a retry action. Mobile controls have 44px touch targets and the street list lets scrolling continue into the page.

## Data sources

| Dataset | Used for |
| --- | --- |
| [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | Bay occupancy, sensor timestamps, coordinates |
| [`parking-zones-linked-to-street-segments`](https://data.melbourne.vic.gov.au/explore/dataset/parking-zones-linked-to-street-segments/information/) | Zone → street name |
| [`sign-plates-located-in-each-parking-zone`](https://data.melbourne.vic.gov.au/explore/dataset/sign-plates-located-in-each-parking-zone/information/) | Zone → signage restriction |
| [`street-addresses`](https://data.melbourne.vic.gov.au/explore/dataset/street-addresses/) | Submitted address lookup and reference coordinates |
| [`landmarks-and-places-of-interest-including-schools-theatres-health-services-spor`](https://data.melbourne.vic.gov.au/explore/dataset/landmarks-and-places-of-interest-including-schools-theatres-health-services-spor/) | Submitted place-name lookup and the eight bundled landmark coordinates |

Data published by the City of Melbourne under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). This is not a council service and is not endorsed by the council.

The API is CORS-open and needs no API key, so the browser reads the official endpoint directly with no proxy in between.

Destination lookup uses these two council directories only after Search is submitted. Requests time out after 10 seconds; partial results carry a retry notice, and bundled landmarks remain available if the directories fail. Address/place lookup does not change parking-feed freshness. The directories are limited reference data: their metadata reports modifications in 2021 and no update frequency, so new addresses and renamed places may be missing.

## Current location

Location access requires HTTPS (or a trusted local development origin), browser support and permission. The page never requests it automatically or watches movement. A denied request explains how to enable location access in browser/site settings; unsupported, unavailable and timed-out requests offer retry or destination search. **Cancel location**, editing the address, choosing a landmark or clearing the selection discards the pending result, so a late browser callback cannot replace a newer choice. Errors retain the previous selected destination.

This product accepts a fix at most 120 seconds old with estimated accuracy of 1 km or better, matching the largest search radius. Older, invalid or less precise fixes require retry or an address. The captured date/time is displayed in Melbourne time; it is separate from parking-feed freshness. If uncertainty exceeds the chosen radius, the page recommends a larger radius or an exact address. Coverage still means City of Melbourne sensor bays; an empty result outside that network is not evidence that no parking exists.

Coordinates are used in page memory for distance calculations, without reverse geocoding, a coordinate-bearing URL, persistent browser storage or a backend upload. The existing OpenStreetMap tile requests reveal the map area being viewed to the tile provider; this is not a promise that viewing a location is invisible to third parties.

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

For collection navigation, check all five same-tab links, the active Parking marker, mobile drawer focus/Escape and bottom-bar visibility, and map/footer access above the bottom bar. Navigation remains available even when parking data cannot be shown. The shared navigation component and stylesheet are mirrored in `melbourne-daily`; keep their destination order, labels and routes aligned.

For destination search, submit `200 Collins Street`, explicitly select the address, then try a bundled landmark. Switch all three radii and both rankings; confirm the map's destination/radius, local street counts and unchanged city-wide cards. Clear the destination to restore the original controls. On desktop and mobile, also exercise a no-match query, directory failure/partial results, editing or selecting a landmark during a pending search, keyboard focus, stale/unavailable parking data and reduced motion. Empty nearby results mean no mapped sensor bays in that radius, not proof that no parking exists.

For current location, use controlled test coordinates to cover allow, deny, unsupported/unavailable, timeout, coarse or old fixes, and a point outside the sensor network. Check that loading the page makes no location request; then verify both rankings, all radii, captured time/accuracy and map reset after success. While a request is pending, try Cancel, typing an address, choosing a landmark, clearing and leaving the page; late callbacks must not restore an abandoned location. Agent verification should use simulated coordinates rather than request the user's real position. Confirm address search and the original map still work after each failure.

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
│   ├── styles.css              # responsive series layout and shared motion rules
│   ├── styles/
│   │   └── tokens.css          # Melbourne Daily colour, typography and motion tokens
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
├── docs/
│   ├── DATA_TRUST_CONTRACT.md   # English, authoritative
│   └── DATA_TRUST_CONTRACT.zh-TW.md
├── PRODUCT.md
├── PRODUCT.zh-TW.md
├── README.md
└── README.zh-TW.md
```

## Deployment

`.github/workflows/pages.yml` runs lint, typecheck, tests, rebuilds the crosswalk and deploys to GitHub Pages on pushes to `main` and on manual dispatch.

This dashboard needs no scheduled ingestion. The browser reads the official feed directly, so the deployed artifact is static code plus reference data. **There is no data snapshot to keep fresh, and therefore no cron delay that could leave a user looking at stale figures.**

`scripts/check-source-freshness.ts` (`npm run probe:freshness`) independently verifies that the official source itself is healthy, and runs on a schedule in CI. It checks upstream, not our deployment.

## Basemap dependency

The basemap uses OpenStreetMap's own tiles, softly desaturated with a CSS filter while keeping a light background. Street availability markers remain easy to distinguish against the map and match the legend.

The CARTO dark basemap used previously now answers **HTTP 200 with an "API KEY REQUIRED" watermark tile** — a valid response carrying invalid content, which is a neat miniature of the reason this dashboard exists.

OpenStreetMap's tile usage policy does not permit heavy traffic. Before any real volume this should move to a keyed provider with an SLA, or to self-hosted tiles. This is the only third-party runtime dependency outside the official data source; if it fails, the basemap disappears and the bay counts and street rankings are unaffected.

## Known limitations

- Covers only bays with a working in-ground sensor. A street missing from this page may still have parking.
- A sensor reading is a fact about the recent past. It is not a guarantee that a bay will still be free when you arrive.
- Destination distances are straight-line estimates to sensor locations, not walking routes or travel times. Landmark points may be building reference points rather than entrances; no arrival-time availability is promised.
- Street-level restrictions are a summary. The sign on the street always wins.
- 583 bays (9.2%) cannot be matched to a street name and are grouped as "unmapped". They count toward the city totals but never appear as a recommendation.
