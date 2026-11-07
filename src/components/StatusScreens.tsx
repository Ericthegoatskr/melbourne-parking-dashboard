import { ExternalLink, Loader2, ShieldOff } from 'lucide-react';
import { DATASET_PAGE } from '../lib/config';
import type { SnapshotRejected } from '../lib/types';
import './panels.css';

export function LoadingScreen() {
  return (
    <div className="card parking-loading" role="status">
      <span className="parking-status-icon"><Loader2 size={24} className="parking-loading-spin" aria-hidden /></span>
      <div>
        <p className="parking-status-title">Loading council sensor data…</p>
        <p className="parking-status-copy">Reading all on-street bays from the City of Melbourne open-data portal.</p>
      </div>
    </div>
  );
}

/** Never substitute invented figures or an unlabelled old snapshot when the feed is unusable. */
export function UnavailableScreen({ rejection, onRetry }: {
  rejection: SnapshotRejected | null;
  onRetry: () => void;
}) {
  return (
    <section className="card parking-unavailable">
      <span className="parking-status-icon"><ShieldOff size={23} aria-hidden /></span>
      <div className="parking-status-content">
        <h2 className="parking-status-title">We cannot confirm parking availability right now</h2>
        <p className="parking-status-copy">{rejection?.message ?? 'The sensor feed did not return usable data.'}</p>
        {rejection?.detail && <p className="parking-status-detail">{rejection.detail}</p>}
        <p className="parking-status-explanation">
          Rather than show you a number we cannot stand behind, this page shows nothing. Check
          street signage when you arrive, and confirm restrictions with the City of Melbourne.
        </p>
        <div className="parking-status-actions">
          <button type="button" onClick={onRetry} className="parking-retry">Try again</button>
          <a href={DATASET_PAGE} target="_blank" rel="noreferrer" className="parking-source-link">
            Check the source dataset <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

export function RefreshWarning({ rejection }: { rejection: SnapshotRejected }) {
  return (
    <p className="parking-refresh-warning" role="status">
      Last refresh did not succeed: {rejection.message} The figures below are the last reading
      that passed validation, aged accordingly.
    </p>
  );
}
