import { ExternalLink, Loader2, ShieldOff } from 'lucide-react';
import { DATASET_PAGE } from '../lib/config';
import type { SnapshotRejected } from '../lib/types';

export function LoadingScreen() {
  return (
    <div className="card flex items-center gap-3 text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin text-cyan-300" aria-hidden />
      <div>
        <p className="font-medium text-slate-100">Loading council sensor data…</p>
        <p className="text-sm text-slate-400">
          Reading all on-street bays from the City of Melbourne open-data portal.
        </p>
      </div>
    </div>
  );
}

/**
 * The fail-closed screen.
 *
 * It says what we do not know. It does not fall back to sample data, a cached
 * figure with the age filed off, or a reassuring green summary.
 */
export function UnavailableScreen({
  rejection,
  onRetry,
}: {
  rejection: SnapshotRejected | null;
  onRetry: () => void;
}) {
  return (
    <section className="card border-rose-500/30 bg-rose-500/5">
      <div className="flex items-start gap-3">
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">
            We cannot confirm parking availability right now
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {rejection?.message ?? 'The sensor feed did not return usable data.'}
          </p>
          {rejection?.detail && (
            <p className="mt-1 text-xs text-slate-400">{rejection.detail}</p>
          )}
          <p className="mt-3 text-sm text-slate-400">
            Rather than show you a number we cannot stand behind, this page shows nothing. Check
            street signage when you arrive, and confirm restrictions with the City of Melbourne.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
            >
              Try again
            </button>
            <a
              href={DATASET_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              Check the source dataset
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Shown alongside good data when the *latest* attempt failed. */
export function RefreshWarning({ rejection }: { rejection: SnapshotRejected }) {
  return (
    <p className="text-xs text-amber-200/80">
      Last refresh did not succeed: {rejection.message} The figures below are the last reading
      that passed validation, aged accordingly.
    </p>
  );
}
