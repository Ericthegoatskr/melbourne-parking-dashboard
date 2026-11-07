import { useEffect, useRef, useState, type ComponentType } from 'react';
import { MapPinned } from 'lucide-react';
import type { ParkingMapProps } from './ParkingMap';
import './ParkingMap.css';

/** Keep Leaflet and tile requests off the initial mobile reading path. */
export function DeferredParkingMap(props: ParkingMapProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [MapComponent, setMapComponent] = useState<ComponentType<ParkingMapProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (requested) return;
    const followAnchor = () => {
      if (window.location.hash === '#parking-map') setRequested(true);
    };
    followAnchor();
    window.addEventListener('hashchange', followAnchor);
    // Old browsers keep the working map rather than depending on an observer.
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setRequested(true);
      },
      { rootMargin: '250px' },
    );
    if (observer && panel.current) observer.observe(panel.current);
    else setRequested(true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('hashchange', followAnchor);
    };
  }, [requested]);

  useEffect(() => {
    if (props.selected) setRequested(true);
  }, [props.selected]);

  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    setFailed(false);
    void import('./ParkingMap').then(
      ({ ParkingMap }) => { if (!cancelled) setMapComponent(() => ParkingMap); },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [requested, attempt]);

  return (
    <div ref={panel}>
      {MapComponent ? <MapComponent {...props} /> : (
        <section className="card parking-map-card" aria-labelledby="parking-map-title">
          <div className="parking-map-heading">
            <div>
              <h2 id="parking-map-title"><MapPinned size={18} aria-hidden /> Parking map</h2>
              <p>Street-level view · City of Melbourne</p>
            </div>
          </div>
          <div className="parking-map-canvas parking-map-placeholder">
            <div>
              <p role="status">{failed ? 'The map could not load. Your parking data is still available.' : requested ? 'Loading the parking map…' : 'Explore parking by street.'}</p>
              {(!requested || failed) && <button className="parking-map-reset" type="button" onClick={() => { setRequested(true); setAttempt((value) => value + 1); }}>{failed ? 'Retry map' : 'Load map'}</button>}
            </div>
          </div>
          <div className="parking-map-key">
            <p>Street readings and signs remain available in the list.</p>
            <small>The interactive map loads as you approach it, or when you select a street.</small>
          </div>
        </section>
      )}
    </div>
  );
}
