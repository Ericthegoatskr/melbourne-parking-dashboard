# Product Mission and Roadmap

**English** · [繁體中文](PRODUCT.zh-TW.md)

Research last updated: 2026-09-08 (Australia/Melbourne)

## Mission

Someone driving into central Melbourne should be able to answer three things within ten seconds, and trust the answers:

1. Is this data current, and how old is it?
2. Which street actually has space right now?
3. How much of that number can I rely on?

Where the data cannot answer, the product must say plainly that it cannot confirm — never manufacture a sense of currency out of sample data, fetch time or cache time.

## Why this exists

The City of Melbourne is the source of truth and already publishes its sensor data in full. Existing parking apps have long been able to draw dots on a map. So the differentiator is not another map:

**It subtracts what should not be counted, and tells you how much it subtracted.**

The council's feed contains 963 sensors that have not reported in months to years, yet still carry their last known state. Any dashboard that counts records directly will claim 4,370 free bays. Only 3,922 are defensible. **448 phantom bays — an 11.4% overstatement.**

This is not a theoretical flaw. Its concrete consequence is a driver heading for a street they were told had space, finding none, and going around the block again.

## Verified product facts

All measured against the live feed on 2026-09-08. Evidence in [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md):

- Of 6,324 bay sensors, 963 (15.2%) have not reported in months to years; the oldest is stuck at 2022-09-13.
- Of the 622 zones carrying signage, 212 (34.1%) have multiple restriction codes. `MP2P / LZ30` is the most common pairing. Displaying either one alone gives an answer that can earn a fine during the hours the other applies.
- 583 bays (9.2%) cannot be matched to a street name.
- Catalog metadata bears no relation to actual data freshness: another dataset's metadata claimed an update 6 days ago while its newest record was a year old.
- The feed republishes roughly every 2 minutes, is CORS-open, needs no API key, and allows 10,000 requests per IP per day. The browser can read it directly.

## Outcome measures

Success in the first round is not "the page is built". It is:

- The `live`, `delayed`, `stale` and `unavailable` states never impersonate one another.
- No figure on screen at any moment includes a contribution from a sensor that is not reporting.
- The quantity excluded, and what the number would have been without the exclusion, are visible on the page rather than buried in a README.
- Past 60 minutes, the page shows no bay count at all.
- A tab left open ages itself without waiting for a network refresh.
- Street-level restrictions are named only where unambiguous; otherwise the reader is pointed at the sign.
- On both desktop and 375px mobile, the first screen shows the data state before it shows a number.

The next stage should run comprehension testing with 5–8 people unfamiliar with Melbourne parking rules: at least 4 in 5 should answer the data state, the data age, and "which street is worth trying first" within ten seconds. That research is still outstanding, and team opinion is not a substitute for it.

## Roadmap

### P0 — the data trust contract (current)

- Keep `observedAt` / `sourceTime` / `fetchedAt` distinct.
- A 30-minute sensor trust window; sensors that have gone quiet never count toward free bays.
- Validate schema, record count, coordinate range, source time and reporting coverage — all fail closed.
- The `live / delayed / stale / unavailable` state machine, with present-tense claims withdrawn on schedule.
- Reject an older snapshot overwriting a newer one.
- Recompute freshness from the clock on every render, so a restored hidden tab never shows an expired label.
- Where signage disagrees, list what is actually present instead of picking one plate.
- Keep unmapped bays in the totals while excluding them from recommendations.

### P1 — make the answer actionable

- Filter signage by the current day and time, answering "how long can I park here right now" rather than only "this is a metered zone".
- Rank streets near the user's location or destination instead of city-wide.
- Use the council's historical data to show how empty a street usually is at this hour, kept clearly separate from the live reading.
- Add a post-deploy freshness smoke check, and state it on the page when the source has been down for a sustained period.

### P2 — sharing, SEO and a real domain

- Canonical URL, share image, structured data, sitemap, robots and a 404 page.
- Configure a custom domain, CNAME and HTTPS only after domain, DNS authority and ownership are confirmed.
- Let real user research decide on notifications or personalisation. Feature count is not the goal.

## Explicitly out of scope

- Predicting whether a given bay will still be free when you arrive. A sensor reading is a fact about the recent past, not a reservation.
- Replacing the signs on the street. Restrictions, closures, permit zones and events are settled by signage.
- Claiming complete coverage. Only bays with a working sensor appear here; a street missing from this site may still have parking.
