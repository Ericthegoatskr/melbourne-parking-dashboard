import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ExternalLink, Loader2, ShieldOff } from 'lucide-react';
import { DATASET_PAGE } from '../lib/config';
export function LoadingScreen() {
    return (_jsxs("div", { className: "card flex items-center gap-3 text-slate-300", children: [_jsx(Loader2, { className: "h-5 w-5 animate-spin text-cyan-300", "aria-hidden": true }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-100", children: "Loading council sensor data\u2026" }), _jsx("p", { className: "text-sm text-slate-400", children: "Reading all on-street bays from the City of Melbourne open-data portal." })] })] }));
}
/**
 * The fail-closed screen.
 *
 * It says what we do not know. It does not fall back to sample data, a cached
 * figure with the age filed off, or a reassuring green summary.
 */
export function UnavailableScreen({ rejection, onRetry, }) {
    return (_jsx("section", { className: "card border-rose-500/30 bg-rose-500/5", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(ShieldOff, { className: "mt-0.5 h-5 w-5 shrink-0 text-rose-300", "aria-hidden": true }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "We cannot confirm parking availability right now" }), _jsx("p", { className: "mt-1 text-sm text-slate-300", children: rejection?.message ?? 'The sensor feed did not return usable data.' }), rejection?.detail && (_jsx("p", { className: "mt-1 text-xs text-slate-400", children: rejection.detail })), _jsx("p", { className: "mt-3 text-sm text-slate-400", children: "Rather than show you a number we cannot stand behind, this page shows nothing. Check street signage when you arrive, and confirm restrictions with the City of Melbourne." }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: onRetry, className: "rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30", children: "Try again" }), _jsxs("a", { href: DATASET_PAGE, target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5", children: ["Check the source dataset", _jsx(ExternalLink, { className: "h-3.5 w-3.5", "aria-hidden": true })] })] })] })] }) }));
}
/** Shown alongside good data when the *latest* attempt failed. */
export function RefreshWarning({ rejection }) {
    return (_jsxs("p", { className: "text-xs text-amber-200/80", children: ["Last refresh did not succeed: ", rejection.message, " The figures below are the last reading that passed validation, aged accordingly."] }));
}
