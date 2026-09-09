import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { MapPin, Search, SignalZero } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { describeStreetSignage } from '../lib/parkingModel';
import { mayClaimCurrent } from '../lib/freshness';
const SORTS = [
    { value: 'most-vacant', label: 'Most free bays' },
    { value: 'best-odds', label: 'Best odds' },
    { value: 'name', label: 'A–Z' },
];
export function StreetList({ streets, state, sort, onSortChange, query, onQueryChange, selected, onSelect, }) {
    const current = mayClaimCurrent(state);
    return (_jsxs("section", { className: "card", children: [_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: current ? 'Where there are bays now' : 'Where there were bays' }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "relative min-w-0 flex-1 sm:flex-none", children: [_jsx(Search, { className: "pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500", "aria-hidden": true }), _jsx("input", { type: "search", value: query, onChange: (event) => onQueryChange(event.target.value), placeholder: "Find a street", "aria-label": "Find a street", className: "w-full rounded-lg border border-white/10 bg-ink-950 py-1.5 pl-8 pr-2 text-sm sm:w-44 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none" })] }), _jsx("div", { className: "flex shrink-0 rounded-lg border border-white/10 p-0.5", role: "group", children: SORTS.map((option) => (_jsx("button", { type: "button", onClick: () => onSortChange(option.value), "aria-pressed": sort === option.value, className: `rounded-md px-2.5 py-1 text-xs font-medium transition ${sort === option.value
                                        ? 'bg-cyan-500/20 text-cyan-100'
                                        : 'text-slate-400 hover:text-slate-200'}`, children: option.label }, option.value))) })] })] }), sort === 'best-odds' && (_jsx("p", { className: "mt-2 text-xs text-slate-400", children: "Ranked by share of bays free, among streets with at least 5 sensors reporting. A street with two sensors cannot top this list on one lucky bay." })), streets.length === 0 ? (_jsxs("p", { className: "mt-6 text-sm text-slate-400", children: ["No street matches \u201C", query, "\u201D. Try a shorter search."] })) : (_jsx("ul", { className: "mt-4 max-h-[560px] min-w-0 divide-y divide-white/5 overflow-y-auto pr-1", children: streets.map((street) => (_jsx(StreetRow, { street: street, current: current, selected: selected === street.street, onSelect: onSelect }, street.street))) }))] }));
}
function StreetRow({ street, current, selected, onSelect, }) {
    const reporting = street.vacant + street.occupied;
    const silent = reporting === 0;
    const signage = describeStreetSignage(street);
    return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onSelect(selected ? null : street.street), "aria-pressed": selected, className: `flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-white/5 ${selected ? 'bg-cyan-500/10' : ''}`, children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-slate-100", children: street.street }), silent && (_jsxs("span", { className: "chip bg-slate-600/40 text-slate-300", children: [_jsx(SignalZero, { className: "h-3 w-3", "aria-hidden": true }), "No signal"] }))] }), _jsxs("p", { className: "mt-0.5 truncate text-xs text-slate-400", children: [silent ? (_jsxs(_Fragment, { children: ["All ", formatCount(street.total), " sensors silent"] })) : (_jsxs(_Fragment, { children: [formatCount(reporting), " reporting", street.notReporting > 0 && _jsxs(_Fragment, { children: [" \u00B7 ", formatCount(street.notReporting), " silent"] })] })), signage && _jsxs(_Fragment, { children: [" \u00B7 ", signage] })] })] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("p", { className: `tnum text-2xl font-semibold ${silent ? 'text-slate-600' : current ? 'text-white' : 'text-slate-400'}`, children: silent ? '—' : formatCount(street.vacant) }), _jsx("p", { className: "tnum text-xs text-slate-500", children: silent ? 'unknown' : formatPercent(street.vacancyRate) })] }), _jsx(VacancyBar, { rate: street.vacancyRate })] }) }));
}
/**
 * Colour encodes how likely a bay is, not how "good" the street is.
 * A silent street gets a neutral, unfilled bar — never a green one.
 */
function VacancyBar({ rate }) {
    if (rate === null) {
        return (_jsx("div", { className: "hidden h-10 w-1.5 shrink-0 rounded-full bg-slate-700 sm:block", "aria-hidden": true }));
    }
    const colour = rate >= 0.3 ? 'bg-emerald-400' : rate >= 0.12 ? 'bg-amber-400' : 'bg-rose-400';
    return (_jsx("div", { className: "hidden h-10 w-1.5 shrink-0 flex-col justify-end overflow-hidden rounded-full bg-white/10 sm:flex", children: _jsx("div", { className: `w-full rounded-full ${colour}`, style: { height: `${Math.max(rate * 100, 4)}%` }, "aria-hidden": true }) }));
}
export function StreetListEmpty() {
    return (_jsxs("section", { className: "card flex items-center gap-3 text-sm text-slate-400", children: [_jsx(MapPin, { className: "h-4 w-4", "aria-hidden": true }), "No street-level data in this snapshot."] }));
}
