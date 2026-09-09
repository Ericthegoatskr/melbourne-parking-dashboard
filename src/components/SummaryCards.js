import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CarFront, CircleParking, SignalHigh } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { mayClaimCurrent } from '../lib/freshness';
/**
 * The headline answer.
 *
 * When the feed is not current the hero number keeps its value but loses every
 * present-tense word: it becomes "last reading", not "free now". The figure is
 * still true as a historical fact; the claim about *now* is what we withdraw.
 */
export function SummaryCards({ summary, state }) {
    const current = mayClaimCurrent(state);
    return (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: [_jsxs("section", { className: "card border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-transparent sm:col-span-2 lg:col-span-1", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-medium text-cyan-200", children: [_jsx(CircleParking, { className: "h-4 w-4", "aria-hidden": true }), current ? 'Bays free now' : 'Bays free at last reading'] }), _jsx("p", { className: "tnum mt-2 text-5xl font-bold tracking-tight text-white", children: formatCount(summary.vacant) }), _jsxs("p", { className: "mt-2 text-sm text-slate-300", children: ["of ", formatCount(summary.reporting), " sensors reporting", summary.vacancyRate !== null && (_jsxs(_Fragment, { children: [" \u00B7 ", formatPercent(summary.vacancyRate), " free"] }))] }), !current && (_jsx("p", { className: "mt-2 text-xs font-medium text-orange-200", children: "Not a description of the street right now." }))] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-medium text-slate-300", children: [_jsx(CarFront, { className: "h-4 w-4", "aria-hidden": true }), "Occupied"] }), _jsx("p", { className: "tnum mt-2 text-3xl font-semibold text-white", children: formatCount(summary.occupied) }), _jsxs("p", { className: "mt-2 text-sm text-slate-400", children: [formatPercent(summary.reporting === 0 ? null : summary.occupied / summary.reporting), ' ', "of reporting bays"] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-medium text-slate-300", children: [_jsx(SignalHigh, { className: "h-4 w-4", "aria-hidden": true }), "Sensor coverage"] }), _jsx("p", { className: "tnum mt-2 text-3xl font-semibold text-white", children: formatPercent(summary.coverage, 1) }), _jsxs("p", { className: "mt-2 text-sm text-slate-400", children: [formatCount(summary.notReporting), " of ", formatCount(summary.total), " bays not reporting"] })] })] }));
}
