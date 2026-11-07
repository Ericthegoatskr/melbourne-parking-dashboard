import { useEffect, useRef } from 'react';
import { LocateFixed, MapPinned } from 'lucide-react';
import L from 'leaflet';
import { mayClaimCurrent } from '../lib/freshness';
import { describeStreetSignage } from '../lib/parkingModel';
import type { FeedState, StreetAvailability } from '../lib/types';
import './ParkingMap.css';

const MELBOURNE_CBD: L.LatLngTuple = [-37.8136, 144.9631];

/**
 * Street-level circles rather than 6,324 bay pins.
 *
 * Radius encodes how many bays a street has, colour encodes vacancy. Streets
 * with no reporting sensor are drawn hollow and grey: visible, so the reader
 * knows the sensor network reaches there, but never coloured as if we knew
 * whether a bay was free.
 */
function colourFor(street: StreetAvailability): string {
  if (street.vacancyRate === null) return '#817b89';
  if (street.vacancyRate >= 0.3) return '#38805b';
  if (street.vacancyRate >= 0.12) return '#b77a22';
  return '#bf5b70';
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  streets: readonly StreetAvailability[];
  state: FeedState;
  selected: string | null;
  onSelect: (street: string | null) => void;
}

export function ParkingMap({ streets, state, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());
  // Keep the latest callback without re-running the marker effect on each render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reducedMotion = prefersReducedMotion();
    const map = L.map(containerRef.current, {
      center: MELBOURNE_CBD,
      zoom: 14,
      scrollWheelZoom: false,
      zoomAnimation: !reducedMotion,
      fadeAnimation: !reducedMotion,
      markerZoomAnimation: !reducedMotion,
    });

    /*
     * OpenStreetMap's own tiles, softly desaturated with a CSS filter rather than
     * fetched from a themed tile service.
     *
     * The previous CARTO dark basemap now answers HTTP 200 with an
     * "API KEY REQUIRED" watermark tile — a valid response carrying invalid
     * content, which is the same failure this dashboard exists to catch.
     * OSM needs no key. See the tile-provider note in README.md before
     * putting this in front of real traffic.
     */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'basemap-tiles',
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    const markers = markersRef.current;

    // A responsive grid can resize this panel without a window resize event.
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer?.observe(containerRef.current);

    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const openStreet = [...markersRef.current].find(([, marker]) => marker.isPopupOpen())?.[0];
    layer.clearLayers();
    markersRef.current.clear();

    const current = mayClaimCurrent(state);
    const maxTotal = streets.reduce((max, s) => Math.max(max, s.total), 1);

    for (const street of streets) {
      const silent = street.vacancyRate === null;
      const radius = 6 + Math.sqrt(street.total / maxTotal) * 16;
      const signage = describeStreetSignage(street);

      const marker = L.circleMarker([street.lat, street.lon], {
        radius,
        color: colourFor(street),
        weight: 1.5,
        opacity: silent ? 0.65 : 0.95,
        fillColor: colourFor(street),
        fillOpacity: silent ? 0 : current ? 0.45 : 0.2,
      });

      marker.bindPopup(
        `<strong>${escapeHtml(street.street)}</strong><br/>` +
          (silent
            ? `<span>No sensor reporting — availability unknown</span>`
            : `<span>${street.vacant} of ${street.vacant + street.occupied} bays free` +
              `${current ? '' : ' at last reading'}</span>`) +
          (street.notReporting > 0 ? `<br/><span>${street.notReporting} sensors silent</span>` : '') +
          (signage ? `<br/><span>${escapeHtml(signage)}</span>` : ''),
      );

      marker.on('click', () => onSelectRef.current(street.street));
      marker.addTo(layer);
      markersRef.current.set(street.street, marker);
      if (street.street === openStreet) marker.openPopup();
    }
  }, [streets, state]);

  // Selecting a circle must not recreate it and close its newly opened popup.
  useEffect(() => {
    for (const [street, marker] of markersRef.current) {
      marker.setStyle({ weight: street === selected ? 3.5 : 1.5 });
      if (street === selected) marker.bringToFront();
    }
  }, [selected, streets, state]);

  // Pan to a street chosen from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const target = streets.find((street) => street.street === selected);
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), {
      duration: 0.6,
      animate: !prefersReducedMotion(),
    });
  }, [selected, streets]);

  return (
    <section className="card parking-map-card" aria-labelledby="parking-map-title">
      <div className="parking-map-heading">
        <div>
          <h2 id="parking-map-title"><MapPinned size={18} aria-hidden /> Parking map</h2>
          <p>Street-level view · City of Melbourne</p>
        </div>
        <button
          type="button"
          className="parking-map-reset"
          onClick={() => {
            onSelectRef.current(null);
            mapRef.current?.closePopup().setView(MELBOURNE_CBD, 14, { animate: !prefersReducedMotion() });
          }}
        >
          <LocateFixed size={15} aria-hidden /> Reset view
        </button>
      </div>
      <div
        ref={containerRef}
        className="parking-map-canvas"
        role="application"
        aria-label="Map of on-street parking availability by street"
      />
      <div className="parking-map-key">
        <p>{mayClaimCurrent(state) ? 'Share of reporting bays free' : 'Share free at last reading'}</p>
        <ul aria-label="Map availability legend">
          <li><i className="map-key-more" aria-hidden />30%+ free</li>
          <li><i className="map-key-some" aria-hidden />12–&lt;30% free</li>
          <li><i className="map-key-few" aria-hidden />&lt;12% free</li>
          <li><i className="map-key-silent" aria-hidden />No signal</li>
        </ul>
        <small>Larger circles represent more sensor bays. Select a street for its reading and signs.</small>
      </div>
    </section>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}
