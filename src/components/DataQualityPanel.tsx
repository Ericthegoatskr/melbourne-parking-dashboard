import { useState } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { SENSOR_TRUST_WINDOW_MINUTES } from '../lib/config';
import { formatCount, formatMelbourneDateTime, formatPercent } from '../lib/format';
import type { CitySummary, Snapshot } from '../lib/types';

interface Props {
  summary: CitySummary;
  snapshot: Snapshot;
  unmappedBays: number;
}

/**
 * Show the reader the data we chose *not* to count, and what the number would
 * have been if we had. This is the product's actual differentiator, so it is
 * on the page rather than buried in a README.
 */
export function DataQualityPanel({ summary, snapshot, unmappedBays }: Props) {
  const [open, setOpen] = useState(false);

  const naiveVacant = summary.vacant + countSilentVacant(snapshot);
  const inflation = summary.vacant === 0 ? null : (naiveVacant - summary.vacant) / summary.vacant;

  return (
    <section className="card border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ShieldAlert className="h-4 w-4 text-amber-300" aria-hidden />
          What this dashboard excluded
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <p className="mt-2 text-sm text-slate-300">
        {formatCount(summary.notReporting)} bays ({formatPercent(1 - summary.coverage, 1)}) have
        not reported within {SENSOR_TRUST_WINDOW_MINUTES} minutes of the feed&rsquo;s newest
        reading. They are excluded from every figure above.
      </p>

      {open && (
        <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-2">
          <Row
            term="Counting every record instead"
            detail={
              inflation === null
                ? `${formatCount(naiveVacant)} free bays`
                : `${formatCount(naiveVacant)} free bays — ${formatPercent(inflation, 1)} more than we are willing to claim`
            }
          />
          <Row
            term="Records in the feed"
            detail={`${formatCount(snapshot.totalRecords)} published, ${formatCount(snapshot.unparseableCount)} unreadable and dropped`}
          />
          <Row
            term="Bays with no named street"
            detail={`${formatCount(unmappedBays)} grouped as unmapped rather than discarded`}
          />
          <Row
            term="Feed source time"
            detail={`${formatMelbourneDateTime(snapshot.sourceTime)} Melbourne time`}
          />
          <Row
            term="Downloaded"
            detail={`${formatMelbourneDateTime(snapshot.fetchedAt)} — recorded separately, never used to imply freshness`}
          />
        </dl>
      )}
    </section>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{term}</dt>
      <dd className="tnum mt-0.5 text-slate-200">{detail}</dd>
    </div>
  );
}

/** How many silent sensors last reported "vacant" — the figures we withheld. */
function countSilentVacant(snapshot: Snapshot): number {
  let count = 0;
  for (const bay of snapshot.bays) {
    if (!bay.trusted && !bay.occupied) count += 1;
  }
  return count;
}
