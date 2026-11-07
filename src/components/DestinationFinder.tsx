import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { LANDMARKS, searchDestinations } from '../lib/destinationSearch';
import { LocationError, requestCurrentLocation } from '../lib/currentLocation';
import { formatDistance, type Destination } from '../lib/nearbyParking';
import { formatMelbourneDateTime } from '../lib/format';
import './DestinationFinder.css';

interface Props {
  destination: Destination | null;
  onDestinationChange: (destination: Destination | null) => void;
  radiusMetres: number;
  onRadiusChange: (radius: number) => void;
}

export function DestinationFinder({ destination, onDestinationChange, radiusMetres, onRadiusChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const radiusInput = useRef<HTMLSelectElement>(null);
  const focusSelection = useRef(false);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);
  useEffect(() => {
    if (focusSelection.current && radiusInput.current) {
      radiusInput.current.focus();
      focusSelection.current = false;
    }
  }, [destination, results]);

  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setLocating(false);
    setResults([]);
    setStatus('');
  };
  const choose = (place: Destination) => {
    cancel();
    setQuery('');
    onDestinationChange(place);
  };
  const locate = async () => {
    cancel();
    const controller = new AbortController();
    request.current = controller;
    setLocating(true);
    setStatus('Finding your location… Allow location access in your browser, or cancel to search by destination.');
    try {
      const place = await requestCurrentLocation(controller.signal);
      if (request.current !== controller) return;
      choose(place);
    } catch (error) {
      if (request.current !== controller) return;
      setStatus(error instanceof LocationError ? error.message : 'Your location could not be found. Try again or search for a destination.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLocating(false);
      }
    }
  };
  const search = async (event: FormEvent) => {
    event.preventDefault();
    cancel();
    if (query.trim().length < 2) {
      setStatus('Enter at least two characters, or choose a landmark.');
      input.current?.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStatus('Searching City of Melbourne destinations…');
    try {
      const result = await searchDestinations(query, controller.signal);
      if (request.current !== controller) return;
      setResults(result.destinations);
      setStatus(result.destinations.length
        ? `${result.destinations.length} ${result.destinations.length === 1 ? 'destination' : 'destinations'} found. Choose the correct location.${result.partial ? ' Some address or landmark results are unavailable; retry to check more.' : ''}`
        : 'No matching destination in the council directory. Try a street number and name, or choose a landmark. Coverage is City of Melbourne only.');
    } catch {
      if (request.current !== controller) return;
      setStatus('Destination search could not load. Try Search again, or use a landmark below. Your parking readings are still available.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <section id="destination" className="card destination-finder" aria-labelledby="destination-title">
      <div className="destination-heading">
        <h2 id="destination-title"><MapPin size={19} aria-hidden /> Find nearby parking</h2>
        <p>Use your location or choose a destination in the City of Melbourne.</p>
      </div>
      <div className="destination-location">
        <button type="button" className="destination-locate" disabled={locating} aria-describedby="location-privacy"
          onClick={() => { void locate(); }}><LocateFixed size={17} aria-hidden />{locating ? 'Locating…' : 'Use my current location'}</button>
        {locating && <button type="button" className="destination-clear" onClick={() => {
          cancel();
          setStatus('Location request cancelled. Dismiss any open location prompt, or search for a destination.');
          input.current?.focus();
        }}>Cancel location</button>}
        <p id="location-privacy">With your permission. One-time fix; no saved location or movement tracking.</p>
      </div>
      <div className="destination-inputs">
        <form onSubmit={(event) => { void search(event); }} className="destination-form" role="search" aria-label="Find a destination">
          <label htmlFor="destination-query">Address or place</label>
          <div className="destination-search-row">
            <input ref={input} id="destination-query" type="search" value={query} maxLength={100}
              placeholder="e.g. 200 Collins Street" autoComplete="off"
              onChange={(event) => { cancel(); setQuery(event.target.value); }} />
            <button type="submit" className="destination-search-button" disabled={busy}>
              <Search size={16} aria-hidden />{busy ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>
        <div className="destination-landmarks">
          <label htmlFor="destination-landmark">Or choose a landmark</label>
          <select id="destination-landmark" value={LANDMARKS.some((place) => place.id === destination?.id) ? destination!.id : ''}
            onChange={(event) => { const place = LANDMARKS.find((item) => item.id === event.target.value); if (place) choose(place); }}>
            <option value="" disabled>Choose a landmark</option>
            {LANDMARKS.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}
          </select>
        </div>
      </div>
      <p className="destination-search-status" role="status" aria-live="polite">{status}</p>
      {results.length > 0 && <ul className="destination-results" aria-label="Destination search results">
        {results.map((place) => <li key={place.id}><button type="button" onClick={() => { focusSelection.current = true; choose(place); }}>
          <MapPin size={16} aria-hidden /><span>{place.label}</span><span className="destination-result-action">Select</span>
        </button></li>)}
      </ul>}
      {destination && <div className="destination-selection">
        <div className="destination-selected-copy" role="status"><span>Parking near</span><strong>{destination.label}</strong>
          {destination.deviceLocation && <p className="destination-location-detail">
            Captured {formatMelbourneDateTime(new Date(destination.deviceLocation.capturedAt))} Melbourne time · accuracy about {formatDistance(destination.deviceLocation.accuracyMetres)}.
            {' '}Use the location button again after moving.
            {destination.deviceLocation.accuracyMetres > radiusMetres && ' Location uncertainty is larger than your search radius; try a larger radius or an exact address.'}
          </p>}
        </div>
        <label className="destination-radius">Search radius
          <select ref={radiusInput} value={radiusMetres} onChange={(event) => onRadiusChange(Number(event.target.value))}>
            <option value={250}>250 m</option><option value={500}>500 m</option><option value={1000}>1 km</option>
          </select>
        </label>
        <button type="button" className="destination-clear" onClick={() => { cancel(); setQuery(''); onDestinationChange(null); input.current?.focus(); }}>
          <X size={16} aria-hidden />Clear destination
        </button>
        <p>Distances are straight-line estimates to sensor bays, not walking routes. Check the street signs when you arrive.</p>
      </div>}
    </section>
  );
}
