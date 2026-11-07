import { ArrowUpRight, Navigation } from 'lucide-react';
import { directionsForStreet } from '../lib/parkingDirections';
import { directionsNote } from '../lib/directionsNote';
import type { FeedState, StreetAvailability } from '../lib/types';
import './ParkingDirections.css';

export function ParkingDirections({ street, state }: { street: StreetAvailability; state: FeedState }) {
  const links = directionsForStreet(street);
  if (!links || state === 'unavailable') return null;
  return (
    <section className="parking-directions" aria-label={`Directions to ${street.street}`}>
      <h3><Navigation size={16} aria-hidden />Directions to {street.street}</h3>
      <p role="status">{directionsNote(street, state)}</p>
      <div className="parking-directions-actions">
        <a href={links.google} target="_blank" rel="noopener noreferrer">
          Google Maps<ArrowUpRight size={15} aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={links.apple} target="_blank" rel="noopener noreferrer">
          Apple Maps<ArrowUpRight size={15} aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="parking-directions-hint">Driving directions to the marked sensor location. Check signs; space is not reserved. Your maps app chooses the starting point.</p>
    </section>
  );
}
