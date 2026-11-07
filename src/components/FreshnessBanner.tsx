import { AlertTriangle, CircleCheck, Clock, RefreshCw, WifiOff } from 'lucide-react';
import { FRESHNESS_MINUTES } from '../lib/config';
import { formatAge, formatMelbourneTime } from '../lib/format';
import { stateExplanation, stateLabel } from '../lib/freshness';
import type { FeedState } from '../lib/types';
import './panels.css';

/** Freshness and provenance remain above every parking figure. */
const ICONS: Record<FeedState, typeof Clock> = {
  live: CircleCheck,
  delayed: Clock,
  stale: AlertTriangle,
  unavailable: WifiOff,
};

interface Props {
  state: FeedState;
  sourceTime: Date | null;
  ageMinutes: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function FreshnessBanner({ state, sourceTime, ageMinutes, refreshing, onRefresh }: Props) {
  const Icon = ICONS[state];

  return (
    <section aria-live="polite" className={`card freshness-banner freshness-banner--${state}`}>
      <div className="freshness-main">
        <span className="freshness-icon"><Icon size={21} aria-hidden /></span>
        <div className="freshness-content">
          <div className="freshness-status-line">
            <span className="chip freshness-status">{stateLabel(state)}</span>
            {sourceTime && ageMinutes !== null && (
              <span className="freshness-time tnum">
                Sensors last reported {formatMelbourneTime(sourceTime)} Melbourne time
                {' · '}
                {formatAge(ageMinutes)}
              </span>
            )}
          </div>
          <p className="freshness-copy">{stateExplanation(state)}</p>
        </div>
      </div>
      <button type="button" onClick={onRefresh} disabled={refreshing} className="freshness-action">
        <RefreshCw size={16} className={refreshing ? 'parking-loading-spin' : ''} aria-hidden />
        {refreshing ? 'Checking…' : 'Refresh'}
      </button>
    </section>
  );
}

export function FreshnessLegend() {
  return (
    <p className="freshness-legend">
      Readings are called <strong>live</strong> up to{' '}
      {FRESHNESS_MINUTES.live} minutes old, <strong>delayed</strong>{' '}
      up to {FRESHNESS_MINUTES.delayed}, and{' '}
      <strong>not current</strong> beyond that. A parking bay can
      change in the time one car leaves, so these limits are deliberately short. Age is measured
      from the council&rsquo;s own timestamp, never from when this page downloaded the file.
    </p>
  );
}
