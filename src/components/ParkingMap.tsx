import { useEffect, useRef } from 'react';
import { LocateFixed, MapPinned } from 'lucide-react';
import L from 'leaflet';
import { mayClaimCurrent } from '../lib/freshness';
import { describeStreetSignage } from '../lib/parkingModel';
import { formatDistance, type Destination } from '../lib/nearbyParking';
import { formatMelbourneDateTime } from '../lib/format';
import type { FeedState, StreetAvailability } from '../lib/types';
import 'leaflet/dist/leaflet.css';
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

export interface ParkingMapProps {
  streets: readonly StreetAvailability[];
  state: FeedState;
  selected: string | null;
  onSelect: (street: string | null) => void;
  destination?: Destination | null;
  radiusMetres?: number;
}

export function ParkingMap({ streets, state, selected, onSelect, destination = null, radiusMetres = 500 }: ParkingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const destinationLayerRef = useRef<L.LayerGroup | null>(null);
  const destinationCircleRef = useRef<L.Circle | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());
  const streetsRef = useRef(streets);
  streetsRef.current = streets;
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
    destinationLayerRef.current = L.layerGroup().addTo(map);
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
      destinationLayerRef.current = null;
      destinationCircleRef.current = null;
      markers.clear();
    };
  }, []);

  const destinationId = destination?.id;
  const destinationLabel = destination?.label;
  const destinationLat = destination?.lat;
  const destinationLon = destination?.lon;
  const locationAccuracy = destination?.deviceLocation?.accuracyMetres;
  const locationCapturedAt = destination?.deviceLocation?.capturedAt;

  // Reframe only when the chosen destination or search radius changes. Fresh
  // sensor readings must not pull the map away from where someone is looking.
  useEffect(() => {
    const map = mapRef.current;
    const layer = destinationLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    destinationCircleRef.current = null;
    if (destinationLat === undefined || destinationLon === undefined) {
      map.setView(MELBOURNE_CBD, 14, { animate: !prefersReducedMotion() });
      return;
    }

    const point: L.LatLngTuple = [destinationLat, destinationLon];
    const circle = L.circle(point, {
      radius: radiusMetres,
      color: '#805115',
      weight: 1.5,
      dashArray: '6 6',
      fillColor: '#edbd69',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layer);
    destinationCircleRef.current = circle;
    const label = locationCapturedAt === undefined ? `Destination: ${destinationLabel ?? 'Selected place'}` : 'Your location (one-time fix)';
    const marker = L.marker(point, {
      icon: L.divIcon({
        className: 'parking-destination-marker',
        html: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        iconSize: [40, 44],
        iconAnchor: [20, 44],
        tooltipAnchor: [0, -38],
        popupAnchor: [0, -38],
      }),
      title: label,
      alt: label,
      keyboard: true,
      zIndexOffset: 1000,
    }).addTo(layer);
    marker.getElement()?.setAttribute('aria-label', label);
    marker.bindTooltip(escapeHtml(label), { direction: 'top', className: 'parking-destination-tooltip' });
    marker.bindPopup(`<strong>${escapeHtml(label)}</strong><br/><span>${formatDistance(radiusMetres)} search radius · straight-line distance</span>`
      + (locationAccuracy !== undefined && locationCapturedAt !== undefined
        ? `<br/><span>Accuracy about ${formatDistance(locationAccuracy)} · captured ${escapeHtml(formatMelbourneDateTime(new Date(locationCapturedAt)))} Melbourne time. Update your location after moving.</span>` : ''));
    map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 16, animate: !prefersReducedMotion() });
  }, [destinationId, destinationLabel, destinationLat, destinationLon, radiusMetres, locationAccuracy, locationCapturedAt]);

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
      const distanceMetres = 'distanceMetres' in street && typeof street.distanceMetres === 'number'
        ? street.distanceMetres : null;

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
          (distanceMetres !== null ? `<br/><span>${formatDistance(distanceMetres)} straight line · counts within search radius</span>` : '') +
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
    const target = streetsRef.current.find((street) => street.street === selected);
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), {
      duration: 0.6,
      animate: !prefersReducedMotion(),
    });
  }, [selected]);

  return (
    <section className="card parking-map-card" aria-labelledby="parking-map-title">
      <div className="parking-map-heading">
        <div>
          <h2 id="parking-map-title"><MapPinned size={18} aria-hidden /> Parking map</h2>
          <p>{destination ? `Near ${destination.label} · ${formatDistance(radiusMetres)} radius` : 'Street-level view · City of Melbourne'}</p>
        </div>
        <button
          type="button"
          className="parking-map-reset"
          onClick={() => {
            onSelectRef.current(null);
            const map = mapRef.current;
            if (!map) return;
            map.closePopup();
            const circle = destinationCircleRef.current;
            if (circle) map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 16, animate: !prefersReducedMotion() });
            else map.setView(MELBOURNE_CBD, 14, { animate: !prefersReducedMotion() });
          }}
        >
          <LocateFixed size={15} aria-hidden /> Reset view
        </button>
      </div>
      <div
        ref={containerRef}
        className="parking-map-canvas"
        role="application"
        aria-label={destination ? `Map of parking near ${destination.label}, within ${formatDistance(radiusMetres)}` : 'Map of on-street parking availability by street'}
      />
      <div className="parking-map-key">
        <p>{mayClaimCurrent(state) ? 'Share of reporting bays free' : 'Share free at last reading'}</p>
        <ul aria-label="Map availability legend">
          <li><i className="map-key-more" aria-hidden />30%+ free</li>
          <li><i className="map-key-some" aria-hidden />12–&lt;30% free</li>
          <li><i className="map-key-few" aria-hidden />&lt;12% free</li>
          <li><i className="map-key-silent" aria-hidden />No signal</li>
          {destination && <li><i className="map-key-destination" aria-hidden />{destination.deviceLocation ? 'Your location' : 'Destination'}</li>}
        </ul>
        <small>{destination
          ? `Only bays inside the dashed search radius are counted${mayClaimCurrent(state) ? '' : ', using the last reading'}. Each street circle marks its nearest reporting free bay, or its nearest reporting bay if none is free. Silent streets use their nearest sensor. Distances are straight line, not walking routes.`
          : 'Larger circles represent more sensor bays. Select a street for its reading and signs.'}</small>
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
