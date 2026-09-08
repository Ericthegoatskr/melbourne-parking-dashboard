import { AlertTriangle, CircleCheck, Clock, RefreshCw, WifiOff } from 'lucide-react';
import { FRESHNESS_MINUTES } from '../lib/config';
import { formatAge, formatMelbourneTime } from '../lib/format';
import { stateExplanation, stateLabel } from '../lib/freshness';
import type { FeedState } from '../lib/types';

/**
 * The first thing on the page, above every number.
 *
 * The series rule this enforces: freshness and provenance come before the
 * conclusion. A user must never read a bay count without having already read
 * how old it is.
 */

const STYLES: Record<FeedState, { wrap: string; chip: string; Icon: typeof Clock }> = {
  live: {
    wrap: 'border-emerald-400/30 bg-emerald-500/10',
    chip: 'bg-emerald-400/20 text-emerald-200',
    Icon: CircleCheck,
  },
  delayed: {
    wrap: 'border-amber-400/30 bg-amber-500/10',
    chip: 'bg-amber-400/20 text-amber-100',
    Icon: Clock,
  },
  stale: {
    wrap: 'border-orange-500/40 bg-orange-500/10',
    chip: 'bg-orange-400/25 text-orange-100',
    Icon: AlertTriangle,
  },
  unavailable: {
    wrap: 'border-rose-500/40 bg-rose-500/10',
    chip: 'bg-rose-400/25 text-rose-100',
    Icon: WifiOff,
  },
};

interface Props {
  state: FeedState;
  sourceTime: Date | null;
  ageMinutes: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function FreshnessBanner({
  state,
  sourceTime,
  ageMinutes,
  refreshing,
  onRefresh,
}: Props) {
  const { wrap, chip, Icon } = STYLES[state];

  return (
    <section
      aria-live="polite"
      className={`card flex flex-col gap-3 border ${wrap} sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${chip}`}>{stateLabel(state)}</span>
            {sourceTime && ageMinutes !== null && (
              <span className="tnum text-sm text-slate-300">
                Sensors last reported {formatMelbourneTime(sourceTime)} Melbourne time
                {' · '}
                {formatAge(ageMinutes)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-300">{stateExplanation(state)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:opacity-50 sm:self-auto"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
        {refreshing ? 'Checking…' : 'Refresh'}
      </button>
    </section>
  );
}

/** Plain-language note explaining what the thresholds mean, shown once. */
export function FreshnessLegend() {
  return (
    <p className="text-xs leading-relaxed text-slate-400">
      Readings are called <strong className="text-slate-300">live</strong> up to{' '}
      {FRESHNESS_MINUTES.live} minutes old, <strong className="text-slate-300">delayed</strong>{' '}
      up to {FRESHNESS_MINUTES.delayed}, and{' '}
      <strong className="text-slate-300">not current</strong> beyond that. A parking bay can
      change in the time one car leaves, so these limits are deliberately short. Age is measured
      from the council&rsquo;s own timestamp, never from when this page downloaded the file.
    </p>
  );
}
