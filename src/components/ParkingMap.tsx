import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { mayClaimCurrent } from '../lib/freshness';
import { describeStreetSignage } from '../lib/parkingModel';
import type { FeedState, StreetAvailability } from '../lib/types';

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
  if (street.vacancyRate === null) return '#64748b';
  if (street.vacancyRate >= 0.3) return '#34d399';
  if (street.vacancyRate >= 0.12) return '#fbbf24';
  return '#fb7185';
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
  // Keep the latest callback without re-running the marker effect on each render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MELBOURNE_CBD,
      zoom: 14,
      scrollWheelZoom: false,
    });

    /*
     * OpenStreetMap's own tiles, darkened with a CSS filter rather than
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

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const current = mayClaimCurrent(state);
    const maxTotal = streets.reduce((max, s) => Math.max(max, s.total), 1);

    for (const street of streets) {
      const silent = street.vacancyRate === null;
      const radius = 6 + Math.sqrt(street.total / maxTotal) * 16;
      const signage = describeStreetSignage(street);

      const marker = L.circleMarker([street.lat, street.lon], {
        radius,
        color: colourFor(street),
        weight: street.street === selected ? 3 : 1.5,
        opacity: silent ? 0.55 : 0.9,
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
    }
  }, [streets, state, selected]);

  // Pan to a street chosen from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const target = streets.find((street) => street.street === selected);
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [selected, streets]);

  return (
    <section className="card h-full p-0">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-xl lg:h-full lg:min-h-[420px]"
        role="application"
        aria-label="Map of on-street parking availability by street"
      />
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
