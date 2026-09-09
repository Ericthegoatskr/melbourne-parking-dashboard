import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CircleParking } from 'lucide-react';
import { FreshnessBanner, FreshnessLegend } from './components/FreshnessBanner';
import { SummaryCards } from './components/SummaryCards';
import { StreetList } from './components/StreetList';
import { ParkingMap } from './components/ParkingMap';
import { DataQualityPanel } from './components/DataQualityPanel';
import { Footer } from './components/Footer';
import { LoadingScreen, RefreshWarning, UnavailableScreen, } from './components/StatusScreens';
import { useParkingData } from './lib/useParkingData';
import { ageMinutes } from './lib/freshness';
import { UNMAPPED_STREET, filterStreets, groupByStreet, sortStreets, summarise, } from './lib/parkingModel';
/**
 * Load the static zone -> street crosswalk.
 *
 * Reference data only. If it fails, the dashboard still works: every bay falls
 * into the "unmapped" group and the city totals are unaffected. Missing street
 * names must never take availability figures down with them.
 */
function useCrosswalk() {
    const [crosswalk, setCrosswalk] = useState({});
    useEffect(() => {
        let cancelled = false;
        const url = `${import.meta.env.BASE_URL}data/zone-crosswalk.json`;
        void fetch(url)
            .then((response) => (response.ok ? response.json() : {}))
            .then((data) => {
            if (!cancelled && typeof data === 'object' && data !== null) {
                setCrosswalk(data);
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
    const [sort, setSort] = useState('most-vacant');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const summary = useMemo(() => (snapshot ? summarise(snapshot) : null), [snapshot]);
    const streets = useMemo(() => (snapshot ? groupByStreet(snapshot.bays, crosswalk) : []), [snapshot, crosswalk]);
    const visibleStreets = useMemo(() => sortStreets(filterStreets(streets, query), sort), [streets, query, sort]);
    const unmappedBays = useMemo(() => streets.find((street) => street.street === UNMAPPED_STREET)?.total ?? 0, [streets]);
    // Recomputed on every freshness tick so the age in the banner keeps moving.
    const age = snapshot ? ageMinutes(snapshot.sourceTime, new Date()) : null;
    return (_jsxs("div", { className: "mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10", children: [_jsxs("header", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center gap-2 text-cyan-300", children: [_jsx(CircleParking, { className: "h-5 w-5", "aria-hidden": true }), _jsx("span", { className: "text-xs font-semibold uppercase tracking-[0.16em]", children: "City of Melbourne open data" })] }), _jsx("h1", { className: "mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl", children: "Melbourne street parking" }), _jsx("p", { className: "mt-2 max-w-2xl text-slate-300", children: "How many on-street bays the council\u2019s sensors currently report as free, and how much of that reading you can rely on. Sensors that have gone quiet are excluded rather than counted as empty." })] }), _jsxs("main", { className: "space-y-4", children: [loading && !snapshot && _jsx(LoadingScreen, {}), !loading && (!snapshot || state === 'unavailable') && (_jsx(UnavailableScreen, { rejection: rejection, onRetry: refresh })), snapshot && summary && (_jsxs(_Fragment, { children: [_jsx(FreshnessBanner, { state: state, sourceTime: snapshot.sourceTime, ageMinutes: age, refreshing: refreshing, onRefresh: refresh }), rejection && rejection.code !== 'stale-regression' && (_jsx(RefreshWarning, { rejection: rejection })), state !== 'unavailable' && (_jsxs(_Fragment, { children: [_jsx(SummaryCards, { summary: summary, state: state }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-5", children: [_jsx("div", { className: "min-w-0 lg:col-span-3", children: _jsx(StreetList, { streets: visibleStreets, state: state, sort: sort, onSortChange: setSort, query: query, onQueryChange: setQuery, selected: selected, onSelect: setSelected }) }), _jsx("div", { className: "min-w-0 lg:col-span-2", children: _jsx(ParkingMap, { streets: visibleStreets, state: state, selected: selected, onSelect: setSelected }) })] }), _jsx(DataQualityPanel, { summary: summary, snapshot: snapshot, unmappedBays: unmappedBays })] })), _jsx(FreshnessLegend, {})] }))] }), _jsx(Footer, {})] }));
}
