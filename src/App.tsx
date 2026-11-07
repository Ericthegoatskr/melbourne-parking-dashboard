import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Database, LayoutGrid, ListFilter, Map, Menu, ShieldCheck, X } from 'lucide-react';
import { FreshnessBanner, FreshnessLegend } from './components/FreshnessBanner';
import { SummaryCards } from './components/SummaryCards';
import { StreetList } from './components/StreetList';
import { DestinationFinder } from './components/DestinationFinder';
import { DeferredParkingMap } from './components/DeferredParkingMap';
import { DataQualityPanel } from './components/DataQualityPanel';
import { Footer } from './components/Footer';
import CollectionNav from './components/CollectionNav';
import {
  LoadingScreen,
  RefreshWarning,
  UnavailableScreen,
} from './components/StatusScreens';
import { useParkingData } from './lib/useParkingData';
import { ageMinutes } from './lib/freshness';
import { formatMelbourneTime } from './lib/format';
import {
  UNMAPPED_STREET,
  filterStreets,
  groupByStreet,
  sortStreets,
  summarise,
} from './lib/parkingModel';
import type { StreetSort } from './lib/parkingModel';
import type { ZoneCrosswalk } from './lib/types';
import { nearbyStreets, type Destination, type NearbySort } from './lib/nearbyParking';

const DAILY_URL = 'https://ericthegoatskr.github.io/melbourne-daily/';
const navigation = [
  { id: 'overview', label: 'Overview', Icon: LayoutGrid },
  { id: 'destination', label: 'Park near a destination', Icon: Map },
  { id: 'streets', label: 'Find a street', Icon: ListFilter },
  { id: 'parking-map', label: 'Parking map', Icon: Map },
  { id: 'quality', label: 'Data quality', Icon: ShieldCheck },
  { id: 'sources', label: 'Sources & licence', Icon: Database },
];
function sectionFromHash() {
  const id = window.location.hash.slice(1);
  return navigation.some((item) => item.id === id) ? id : 'overview';
}

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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [radiusMetres, setRadiusMetres] = useState(500);
  const [nearbySort, setNearbySort] = useState<NearbySort>('nearest');
  const [active, setActive] = useState(sectionFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  useEffect(() => {
    const syncNavigation = () => setActive(sectionFromHash());
    window.addEventListener('hashchange', syncNavigation);
    return () => window.removeEventListener('hashchange', syncNavigation);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnDesktop = () => {
      if (window.innerWidth > 760) setMenuOpen(false);
    };
    window.addEventListener('resize', closeOnDesktop);
    const focusable = () => Array.from(
      sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    // Wait until the drawer is visible and the opening click has completed.
    const focusFrame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const focusAfterReveal = window.setTimeout(() => {
      if (!sidebar.current?.contains(document.activeElement)) focusable()[0]?.focus();
    }, 260);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (!sidebar.current?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', closeOnDesktop);
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusAfterReveal);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };
  const navigate = (id: string) => {
    setActive(id);
    setMenuOpen(false);
    if (menuOpen) menuButton.current?.focus();
  };

  const summary = useMemo(() => (snapshot ? summarise(snapshot) : null), [snapshot]);

  const streets = useMemo(
    () => (snapshot ? groupByStreet(snapshot.bays, crosswalk) : []),
    [snapshot, crosswalk],
  );

  const visibleStreets = useMemo(
    () => destination && snapshot
      ? nearbyStreets(snapshot.bays, crosswalk, destination, radiusMetres, nearbySort)
      : sortStreets(filterStreets(streets, query), sort),
    [streets, query, sort, destination, snapshot, crosswalk, radiusMetres, nearbySort],
  );

  const changeDestination = (place: Destination | null) => {
    setDestination(place);
    setSelected(null);
    setQuery('');
  };

  const unmappedBays = useMemo(
    () => streets.find((street) => street.street === UNMAPPED_STREET)?.total ?? 0,
    [streets],
  );

  // Recomputed on every freshness tick so the age in the banner keeps moving.
  const age = snapshot ? ageMinutes(snapshot.sourceTime, new Date()) : null;
  const canExplore = snapshot !== null && state !== 'unavailable';

  return (
    <div className="parking-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      {menuOpen && <div className="parking-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <aside
        ref={sidebar}
        id="main-navigation"
        className={`parking-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Main navigation"
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? true : undefined}
      >
        {menuOpen && <button className="drawer-close" aria-label="Close navigation" onClick={closeMenu}><X size={20} /></button>}
        <a className="brand" href="#overview" onClick={() => navigate('overview')}>
          <span className="brand-mark">m<span>.</span></span>
          <span>melbourne<span>parking<span className="brand-period">.</span></span></span>
        </a>
        <CollectionNav current="parking" placement="sidebar" onNavigate={closeMenu} />
        <span className="sidebar-label">ON THIS PAGE</span>
        <nav className="parking-nav page-section-nav" aria-label="On this page">
          {navigation.filter(({ id }) => canExplore || id === 'overview' || id === 'sources').map(({ id, label, Icon }) => (
            <a key={id} href={`#${id}`} className={active === id ? 'active' : ''}
              aria-current={active === id ? 'location' : undefined} onClick={() => navigate(id)}>
              <Icon className="nav-icon" size={18} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="https://github.com/Ericthegoatskr/melbourne-parking-dashboard" target="_blank" rel="noopener noreferrer">View on GitHub<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
          <span>THE MELBOURNE COLLECTION</span>
        </div>
      </aside>

      <div className="parking-main-shell">
      <header className="parking-topbar">
        <div className="topbar-start">
          <button ref={menuButton} className="menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <span className="parking-breadcrumb">Your city, at a glance<span>/</span><strong>Parking explorer</strong></span>
        </div>
        <div className="topbar-end">
          <span className="local-clock">MEL {formatMelbourneTime(new Date())}</span>
          <a className="series-link" href={DAILY_URL}>Melbourne Daily<ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <main id="main" className="parking-main">
        <section id="overview" className="parking-intro">
          <div className="intro-copy">
            <h1>Melbourne street parking<span>.</span></h1>
            <p>Find your next spot, with a clearer picture of what is reporting.</p>
            <p className="parking-source-note">City of Melbourne open data</p>
          </div>
          {canExplore
            ? <a className="intro-actions" href="#destination" onClick={() => navigate('destination')}><Map size={17} aria-hidden="true" />Find nearby parking<ArrowUpRight size={16} aria-hidden="true" /></a>
            : <a className="intro-actions" href="#sources" onClick={() => navigate('sources')}><Database size={17} aria-hidden="true" />Data sources<ArrowUpRight size={16} aria-hidden="true" /></a>}
        </section>

        <div className="parking-content">
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

            {state !== 'unavailable' && rejection && rejection.code !== 'stale-regression' && (
              <RefreshWarning rejection={rejection} />
            )}

            {state !== 'unavailable' && (
              <>
                <DestinationFinder destination={destination} onDestinationChange={changeDestination}
                  radiusMetres={radiusMetres} onRadiusChange={(radius) => { setRadiusMetres(radius); setSelected(null); }} />
                {!destination && <SummaryCards summary={summary} state={state} />}

                <div className="parking-section-heading">
                  <div><h2>{destination ? 'Parking near your destination' : 'Streets worth a look'}</h2></div>
                  <p>{destination ? 'Only sensor bays inside your search radius.' : 'Choose a street to find it on the map.'}</p>
                </div>
                <div className="parking-workspace">
                  <div className="street-column" id="streets">
                    <StreetList
                      streets={visibleStreets}
                      state={state}
                      sort={sort}
                      onSortChange={setSort}
                      query={query}
                      onQueryChange={setQuery}
                      selected={selected}
                      onSelect={setSelected}
                      nearby={destination ? { radiusMetres, sort: nearbySort, onSortChange: setNearbySort } : undefined}
                    />
                  </div>
                  <div className="map-column" id="parking-map">
                    <DeferredParkingMap
                      streets={visibleStreets}
                      state={state}
                      selected={selected}
                      onSelect={setSelected}
                      destination={destination}
                      radiusMetres={radiusMetres}
                    />
                  </div>
                </div>

                {destination && <>
                  <p className="parking-summary-scope">City-wide overview · all sensor bays, beyond this destination</p>
                  <SummaryCards summary={summary} state={state} />
                </>}
                <div id="quality"><DataQualityPanel
                  summary={summary}
                  snapshot={snapshot}
                  unmappedBays={unmappedBays}
                /></div>
              </>
            )}

            <FreshnessLegend />
          </>
        )}
        </div>
        <div id="sources"><Footer /></div>
      </main>
      </div>
      <CollectionNav current="parking" placement="mobile" hidden={menuOpen} />
    </div>
  );
}
