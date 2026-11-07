import { ExternalLink } from 'lucide-react';
import { ATTRIBUTION, DATASET_PAGE, SENSOR_TRUST_WINDOW_MINUTES } from '../lib/config';
import './panels.css';

export function Footer() {
  return (
    <footer className="parking-footer">
      <div>
        <h2 className="parking-footer-heading">
          Source and licence
        </h2>
        <p className="parking-footer-copy">
          Bay status from the{' '}
          <a
            className="parking-footer-link"
            href={DATASET_PAGE}
            target="_blank"
            rel="noreferrer"
          >
            On-street Parking Bay Sensors
            <ExternalLink className="parking-footer-external" aria-hidden />
          </a>{' '}
          dataset. Street names and signage from the council&rsquo;s parking zone and sign plate
          datasets. Published by {ATTRIBUTION.publisher} on the{' '}
          <a
            className="parking-footer-link"
            href={ATTRIBUTION.portal}
            target="_blank"
            rel="noreferrer"
          >
            Melbourne Open Data portal
          </a>{' '}
          under{' '}
          <a
            className="parking-footer-link"
            href={ATTRIBUTION.licenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {ATTRIBUTION.licence}
          </a>
          .
        </p>
      </div>

      <div>
        <h2 className="parking-footer-heading">
          What this is not
        </h2>
        <ul className="parking-footer-limitations">
          <li>
            Not a City of Melbourne service, and not endorsed by the council. It is an
            independent reading of their published data.
          </li>
          <li>
            Not a guarantee that a bay will be free when you arrive. A sensor reading is a fact
            about the recent past, not a reservation.
          </li>
          <li>
            Not a substitute for the signs on the street. Restrictions, closures, permit zones
            and events are decided by signage, which always wins.
          </li>
          <li>
            Not complete. Only bays with a working in-ground sensor appear here; a street missing
            from this page may still have parking.
          </li>
        </ul>
      </div>

      <p className="parking-footer-note">
        Bays are counted only when their sensor reported within{' '}
        {SENSOR_TRUST_WINDOW_MINUTES} minutes of the feed&rsquo;s newest reading. Freshness is
        derived from the council&rsquo;s timestamps in Australia/Melbourne time.
      </p>
    </footer>
  );
}
