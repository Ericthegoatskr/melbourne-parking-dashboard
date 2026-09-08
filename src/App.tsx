import { useEffect, useMemo, useState } from 'react';
import { CircleParking } from 'lucide-react';
import { FreshnessBanner, FreshnessLegend } from './components/FreshnessBanner';
import { SummaryCards } from './components/SummaryCards';
import { StreetList } from './components/StreetList';
import { ParkingMap } from './components/ParkingMap';
import { DataQualityPanel } from './components/DataQualityPanel';
import { Footer } from './components/Footer';
import {
  LoadingScreen,
  RefreshWarning,
  UnavailableScreen,
} from './components/StatusScreens';
import { useParkingData } from './lib/useParkingData';
import { ageMinutes } from './lib/freshness';
import {
  UNMAPPED_STREET,
  filterStreets,
  groupByStreet,
  sortStreets,
  summarise,
} from './lib/parkingModel';
import type { StreetSort } from './lib/parkingModel';
import type { ZoneCrosswalk } from './lib/types';

/**
 * Load the static zone -> street crosswalk.
 *
 * Reference data only. If it fails, the dashboard still works: every bay falls
 * into the "unmapped" group and the city totals are unaffected. Missing street
 * names must never take availability figures down with them.
 */
function useCrosswalk(): ZoneCrosswalk {
  const [crosswalk, setCrosswalk] = useState<ZoneCrosswalk>({});

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}data/zone-crosswalk.json`;

    void fetch(url)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: unknown) => {
        if (!cancelled && typeof data === 'object' && data !== null) {
          setCrosswalk(data as ZoneCrosswalk);
        }
      })
      .catch(() => {
        /* Street names are a nicety; availability is the product. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return crosswalk;
}

export default function App() {
  const { snapshot, state, rejection, loading, refreshing, refresh } = useParkingData();
  const crosswalk = useCrosswalk();

  const [sort, setSort] = useState<StreetSort>('most-vacant');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useMemo(() => (snapshot ? summarise(snapshot) : null), [snapshot]);

  const streets = useMemo(
    () => (snapshot ? groupByStreet(snapshot.bays, crosswalk) : []),
    [snapshot, crosswalk],
  );

  const visibleStreets = useMemo(
    () => sortStreets(filterStreets(streets, query), sort),
    [streets, query, sort],
  );

  const unmappedBays = useMemo(
    () => streets.find((street) => street.street === UNMAPPED_STREET)?.total ?? 0,
    [streets],
  );

  // Recomputed on every freshness tick so the age in the banner keeps moving.
  const age = snapshot ? ageMinutes(snapshot.sourceTime, new Date()) : null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-cyan-300">
          <CircleParking className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            City of Melbourne open data
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Melbourne street parking
        </h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          How many on-street bays the council&rsquo;s sensors currently report as free, and how
          much of that reading you can rely on. Sensors that have gone quiet are excluded rather
          than counted as empty.
        </p>
      </header>

      <main className="space-y-4">
        {loading && !snapshot && <LoadingScreen />}

        {!loading && (!snapshot || state === 'unavailable') && (
          <UnavailableScreen rejection={rejection} onRetry={refresh} />
        )}

        {snapshot && summary && (
          <>
            <FreshnessBanner
              state={state}
              sourceTime={snapshot.sourceTime}
              ageMinutes={age}
              refreshing={refreshing}
              onRefresh={refresh}
            />

            {rejection && rejection.code !== 'stale-regression' && (
              <RefreshWarning rejection={rejection} />
            )}

            {state !== 'unavailable' && (
              <>
                <SummaryCards summary={summary} state={state} />

                <div className="grid gap-4 lg:grid-cols-5">
                  <div className="min-w-0 lg:col-span-3">
                    <StreetList
                      streets={visibleStreets}
                      state={state}
                      sort={sort}
                      onSortChange={setSort}
                      query={query}
                      onQueryChange={setQuery}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  </div>
                  <div className="min-w-0 lg:col-span-2">
                    <ParkingMap
                      streets={visibleStreets}
                      state={state}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  </div>
                </div>

                <DataQualityPanel
                  summary={summary}
                  snapshot={snapshot}
                  unmappedBays={unmappedBays}
                />
              </>
            )}

            <FreshnessLegend />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
