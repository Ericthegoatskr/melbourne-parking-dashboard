import { describe, expect, it } from 'vitest';
import { UNMAPPED_STREET, describeRestriction, describeStreetSignage, filterStreets, groupByStreet, sortStreets, summarise, } from '../lib/parkingModel';
const CROSSWALK = {
    '7001': {
        street: 'Argyle Place North',
        from: null,
        to: null,
        restrictions: [{ code: 'MP2P', days: 'Mon-Fri' }],
    },
    '7002': {
        street: 'Barry Street',
        from: null,
        to: null,
        restrictions: [{ code: 'MP3P', days: 'Sat-Sun' }],
    },
    '7009': { street: 'Berkeley Street', from: null, to: null, restrictions: [] },
    // A zone that is metered most of the time and a loading zone at others.
    '7502': {
        street: 'Rankin Street',
        from: null,
        to: null,
        restrictions: [
            { code: 'MP2P', days: 'Mon-Fri' },
            { code: 'LZ30', days: 'Mon-Fri' },
        ],
    },
};
let nextId = 1;
function bay(overrides = {}) {
    return {
        id: nextId++,
        zone: 7001,
        occupied: false,
        observedAt: new Date('2026-09-08T18:30:00Z'),
        reportedAt: new Date('2026-09-08T18:30:00Z'),
        lat: -37.8,
        lon: 144.96,
        trusted: true,
        ...overrides,
    };
}
function snapshotOf(bays) {
    return {
        bays,
        sourceTime: new Date('2026-09-08T18:30:00Z'),
        fetchedAt: new Date('2026-09-08T18:31:00Z'),
        totalRecords: bays.length,
        trustedCount: bays.filter((b) => b.trusted).length,
        untrustedCount: bays.filter((b) => !b.trusted).length,
        unparseableCount: 0,
    };
}
describe('city summary', () => {
    it('excludes silent sensors from availability', () => {
        const summary = summarise(snapshotOf([
            bay({ occupied: false }),
            bay({ occupied: false }),
            bay({ occupied: true }),
            // Silent sensor that happens to have last reported "Unoccupied".
            bay({ occupied: false, trusted: false }),
        ]));
        expect(summary.vacant).toBe(2);
        expect(summary.occupied).toBe(1);
        expect(summary.notReporting).toBe(1);
        expect(summary.reporting).toBe(3);
        expect(summary.total).toBe(4);
        expect(summary.vacancyRate).toBeCloseTo(2 / 3);
        expect(summary.coverage).toBeCloseTo(0.75);
    });
    it('reproduces the inflation a naive count would produce', () => {
        // Mirrors the measurement in docs/DATA_TRUST_CONTRACT.md:
        // 6,324 bays, 963 silent, and the silent ones skew free.
        const bays = [
            ...Array.from({ length: 3922 }, () => bay({ occupied: false })),
            ...Array.from({ length: 1439 }, () => bay({ occupied: true })),
            ...Array.from({ length: 448 }, () => bay({ occupied: false, trusted: false })),
            ...Array.from({ length: 515 }, () => bay({ occupied: true, trusted: false })),
        ];
        const summary = summarise(snapshotOf(bays));
        const naiveVacant = bays.filter((b) => !b.occupied).length;
        expect(summary.vacant).toBe(3922);
        expect(naiveVacant).toBe(4370);
        expect(naiveVacant - summary.vacant).toBe(448);
    });
    it('returns a null rate rather than 0% when nothing reports', () => {
        const summary = summarise(snapshotOf([bay({ trusted: false }), bay({ trusted: false })]));
        expect(summary.vacancyRate).toBeNull();
        expect(summary.coverage).toBe(0);
    });
});
describe('street grouping', () => {
    it('names streets and keeps totals reconciling with the city', () => {
        const bays = [
            bay({ zone: 7001, occupied: false }),
            bay({ zone: 7001, occupied: true }),
            bay({ zone: 7002, occupied: false }),
            bay({ zone: null, occupied: false }),
            // A zone the council crosswalk does not cover.
            bay({ zone: 9999, occupied: false }),
        ];
        const streets = groupByStreet(bays, CROSSWALK);
        const city = summarise(snapshotOf(bays));
        expect(streets.map((s) => s.street).sort()).toEqual([
            'Argyle Place North',
            'Barry Street',
            UNMAPPED_STREET,
        ]);
        // Nothing is silently dropped.
        expect(streets.reduce((n, s) => n + s.total, 0)).toBe(city.total);
        expect(streets.find((s) => s.street === UNMAPPED_STREET)?.total).toBe(2);
    });
    it('carries a single unambiguous restriction through', () => {
        const streets = groupByStreet([bay({ zone: 7001 })], CROSSWALK);
        expect(streets[0]?.restriction).toEqual({ code: 'MP2P', days: 'Mon-Fri' });
        expect(streets[0]?.restrictionVaries).toBe(false);
        expect(describeStreetSignage(streets[0])).toBe('Metered 2hr (Mon-Fri)');
    });
    it('refuses to name one restriction when the signage disagrees', () => {
        // Stating "metered, 2 hours" on a bay that is a loading zone at the time
        // the driver arrives is how someone gets a fine.
        const streets = groupByStreet([bay({ zone: 7502 })], CROSSWALK);
        expect(streets[0]?.restriction).toBeNull();
        expect(streets[0]?.restrictionVaries).toBe(true);
        // Name what is actually on the street, then defer to the sign.
        expect(describeStreetSignage(streets[0])).toBe('Metered 2hr / Loading zone 30min — read the sign');
    });
    it('says nothing rather than guessing when a zone has no signage data', () => {
        const streets = groupByStreet([bay({ zone: 7009 })], CROSSWALK);
        expect(describeStreetSignage(streets[0])).toBeNull();
    });
    it('reports a null vacancy rate for a street with no reporting sensor', () => {
        const streets = groupByStreet([bay({ zone: 7009, trusted: false })], CROSSWALK);
        expect(streets[0]?.vacancyRate).toBeNull();
        expect(streets[0]?.notReporting).toBe(1);
    });
});
describe('street ranking', () => {
    const streets = groupByStreet([
        // Argyle: 1 of 2 free, tiny sample.
        bay({ zone: 7001, occupied: false }),
        bay({ zone: 7001, occupied: true }),
        // Barry: 4 of 10 free, meaningful sample.
        ...Array.from({ length: 4 }, () => bay({ zone: 7002, occupied: false })),
        ...Array.from({ length: 6 }, () => bay({ zone: 7002, occupied: true })),
        // Berkeley: nothing reporting.
        ...Array.from({ length: 8 }, () => bay({ zone: 7009, trusted: false })),
    ], CROSSWALK);
    it('ranks by absolute free bays', () => {
        expect(sortStreets(streets, 'most-vacant')[0]?.street).toBe('Barry Street');
    });
    it('does not let a two-sensor street win on rate alone', () => {
        // Argyle is 50% free but has only 2 reporting sensors.
        expect(sortStreets(streets, 'best-odds', 5)[0]?.street).toBe('Barry Street');
    });
    it('never puts the unmapped bookkeeping group at the top of a recommendation', () => {
        // It holds hundreds of free bays but is not a place anyone can drive to.
        const withUnmapped = groupByStreet([
            ...Array.from({ length: 300 }, () => bay({ zone: null, occupied: false })),
            ...Array.from({ length: 4 }, () => bay({ zone: 7002, occupied: false })),
            ...Array.from({ length: 6 }, () => bay({ zone: 7002, occupied: true })),
        ], CROSSWALK);
        for (const mode of ['most-vacant', 'best-odds']) {
            const ranked = sortStreets(withUnmapped, mode);
            expect(ranked[0]?.street).toBe('Barry Street');
            expect(ranked[ranked.length - 1]?.street).toBe(UNMAPPED_STREET);
        }
        // Still present, so street totals continue to reconcile with the city.
        expect(withUnmapped.find((s) => s.street === UNMAPPED_STREET)?.vacant).toBe(300);
    });
    it('never recommends a street with nothing reporting', () => {
        for (const mode of ['most-vacant', 'best-odds']) {
            const ranked = sortStreets(streets, mode);
            expect(ranked[ranked.length - 1]?.street).toBe('Berkeley Street');
        }
    });
});
describe('presentation helpers', () => {
    it('expands signage codes and passes unknown ones through', () => {
        expect(describeRestriction('MP2P')).toBe('Metered 2hr');
        expect(describeRestriction('LZ30')).toBe('Loading zone 30min');
        expect(describeRestriction('ZZZ')).toBe('ZZZ');
        expect(describeRestriction(null)).toBeNull();
    });
    it('filters streets case-insensitively', () => {
        const streets = groupByStreet([bay({ zone: 7001 }), bay({ zone: 7002 })], CROSSWALK);
        expect(filterStreets(streets, 'barry')).toHaveLength(1);
        expect(filterStreets(streets, '  ')).toHaveLength(2);
    });
});
