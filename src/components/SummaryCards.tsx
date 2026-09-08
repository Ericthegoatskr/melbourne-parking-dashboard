import { CarFront, CircleParking, SignalHigh } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { mayClaimCurrent } from '../lib/freshness';
import type { CitySummary, FeedState } from '../lib/types';

interface Props {
  summary: CitySummary;
  state: FeedState;
}

/**
 * The headline answer.
 *
 * When the feed is not current the hero number keeps its value but loses every
 * present-tense word: it becomes "last reading", not "free now". The figure is
 * still true as a historical fact; the claim about *now* is what we withdraw.
 */
export function SummaryCards({ summary, state }: Props) {
  const current = mayClaimCurrent(state);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <section className="card border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-transparent sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
          <CircleParking className="h-4 w-4" aria-hidden />
          {current ? 'Bays free now' : 'Bays free at last reading'}
        </div>
        <p className="tnum mt-2 text-5xl font-bold tracking-tight text-white">
          {formatCount(summary.vacant)}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          of {formatCount(summary.reporting)} sensors reporting
          {summary.vacancyRate !== null && (
            <> · {formatPercent(summary.vacancyRate)} free</>
          )}
        </p>
        {!current && (
          <p className="mt-2 text-xs font-medium text-orange-200">
            Not a description of the street right now.
          </p>
        )}
      </section>

      <section className="card">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <CarFront className="h-4 w-4" aria-hidden />
          Occupied
        </div>
        <p className="tnum mt-2 text-3xl font-semibold text-white">
          {formatCount(summary.occupied)}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {formatPercent(summary.reporting === 0 ? null : summary.occupied / summary.reporting)}{' '}
          of reporting bays
        </p>
      </section>

      <section className="card">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <SignalHigh className="h-4 w-4" aria-hidden />
          Sensor coverage
        </div>
        <p className="tnum mt-2 text-3xl font-semibold text-white">
          {formatPercent(summary.coverage, 1)}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {formatCount(summary.notReporting)} of {formatCount(summary.total)} bays not reporting
        </p>
      </section>
    </div>
  );
}
