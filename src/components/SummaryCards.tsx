import { CarFront, CircleParking, SignalHigh } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { mayClaimCurrent } from '../lib/freshness';
import type { CitySummary, FeedState } from '../lib/types';
import './panels.css';

interface Props {
  summary: CitySummary;
  state: FeedState;
}

/** The same reading loses every present-tense claim when it is no longer current. */
export function SummaryCards({ summary, state }: Props) {
  const current = mayClaimCurrent(state);

  return (
    <div className={`parking-summary-grid ${current ? '' : 'parking-summary--historical'}`}>
      <section className="card parking-summary-tile parking-summary-tile--free">
        <div className="parking-summary-label">
          <span className="parking-summary-icon"><CircleParking size={21} aria-hidden /></span>
          {current ? 'Bays free now' : 'Bays free at last reading'}
        </div>
        <p className="parking-summary-value tnum">
          <span key={summary.vacant} className="parking-value-change">{formatCount(summary.vacant)}</span>
        </p>
        <p className="parking-summary-detail">
          of {formatCount(summary.reporting)} sensors reporting
          {summary.vacancyRate !== null && (
            <> · {formatPercent(summary.vacancyRate)} free</>
          )}
        </p>
        {!current && (
          <p className="parking-summary-warning">Not a description of the street right now.</p>
        )}
      </section>

      <section className="card parking-summary-tile parking-summary-tile--occupied">
        <div className="parking-summary-label">
          <span className="parking-summary-icon"><CarFront size={21} aria-hidden /></span>
          Occupied
        </div>
        <p className="parking-summary-value tnum">
          <span key={summary.occupied} className="parking-value-change">{formatCount(summary.occupied)}</span>
        </p>
        <p className="parking-summary-detail">
          {formatPercent(summary.reporting === 0 ? null : summary.occupied / summary.reporting)}{' '}
          of reporting bays
        </p>
      </section>

      <section className="card parking-summary-tile parking-summary-tile--coverage">
        <div className="parking-summary-label">
          <span className="parking-summary-icon"><SignalHigh size={21} aria-hidden /></span>
          Sensor coverage
        </div>
        <p className="parking-summary-value tnum">
          <span key={summary.coverage} className="parking-value-change">{formatPercent(summary.coverage, 1)}</span>
        </p>
        <p className="parking-summary-detail">
          {formatCount(summary.notReporting)} of {formatCount(summary.total)} bays not reporting
        </p>
      </section>
    </div>
  );
}
