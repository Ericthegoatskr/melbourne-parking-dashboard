import { memo } from 'react';
import { MapPin, Search, SignalZero } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { describeStreetSignage } from '../lib/parkingModel';
import { mayClaimCurrent } from '../lib/freshness';
import type { FeedState, StreetAvailability } from '../lib/types';
import type { StreetSort } from '../lib/parkingModel';
import { formatDistance, type NearbySort, type NearbyStreet } from '../lib/nearbyParking';
import { ParkingDirections } from './ParkingDirections';
import './panels.css';

interface Props {
  streets: readonly StreetAvailability[];
  state: FeedState;
  sort: StreetSort;
  onSortChange: (sort: StreetSort) => void;
  query: string;
  onQueryChange: (query: string) => void;
  selected: string | null;
  onSelect: (street: string | null) => void;
  nearby?: { radiusMetres: number; sort: NearbySort; onSortChange: (sort: NearbySort) => void } | undefined;
}

const SORTS: { value: StreetSort; label: string }[] = [
  { value: 'most-vacant', label: 'Most free bays' },
  { value: 'best-odds', label: 'Best odds' },
  { value: 'name', label: 'A–Z' },
];

export const StreetList = memo(function StreetList({ streets, state, sort, onSortChange, query, onQueryChange, selected, onSelect, nearby }: Props) {
  const current = mayClaimCurrent(state);

  return (
    <section className="card street-panel">
      <div className="street-panel-heading">
        <span className="street-panel-icon"><MapPin size={19} aria-hidden /></span>
        <div>
          <h2>{nearby ? (current ? 'Nearby streets' : 'Nearby streets at last reading') : (current ? 'Where there are bays now' : 'Where there were bays')}</h2>
          <p>{nearby ? `Within ${formatDistance(nearby.radiusMetres)} · select a street for directions and its map location.` : 'Select a street to focus the map.'}</p>
        </div>
      </div>
      <div className="street-controls">
        {!nearby && <div className="street-search">
          <Search size={17} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find a street"
            aria-label="Find a street"
          />
        </div>}
        <div className="street-sorts" role="group" aria-label="Street ranking">
          {nearby ? ([{ value: 'nearest', label: 'Nearest first' }, { value: 'most-vacant', label: 'Most reported free' }] as const).map((option) => (
            <button key={option.value} type="button" aria-pressed={nearby.sort === option.value}
              onClick={() => nearby.onSortChange(option.value)}>{option.label}</button>
          )) : SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSortChange(option.value)}
              aria-pressed={sort === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {nearby && <p className="street-ranking-note">
        {current ? 'Streets with reported free bays come first.' : 'Historical readings only — these bays may no longer be free.'}{' '}
        Only recently reporting sensors count as free. Distance is to the nearest reported free bay, or nearest reporting bay when none are free. Silent sensors sort last.
      </p>}
      {!nearby && sort === 'best-odds' && (
        <p className="street-ranking-note">
          Ranked by share of bays free, among streets with at least 5 sensors reporting. A street
          with two sensors cannot top this list on one lucky bay.
        </p>
      )}

      {streets.length === 0 ? (
        <p className="street-empty">{nearby ? 'No mapped sensor bays in this radius. Coverage is limited to the City of Melbourne. Try a larger radius or a destination in the city. This does not mean there is no parking nearby.' : `No street matches “${query}”. Try a shorter search.`}</p>
      ) : (
        <ul className="street-list">
          {streets.map((street) => (
            <StreetRow key={street.street} street={street} state={state} selected={selected === street.street} onSelect={onSelect} nearby={Boolean(nearby)} />
          ))}
        </ul>
      )}
    </section>
  );
});

function StreetRow({ street, state, selected, onSelect, nearby }: {
  street: StreetAvailability;
  state: FeedState;
  selected: boolean;
  onSelect: (street: string | null) => void;
  nearby: boolean;
}) {
  const reporting = street.vacant + street.occupied;
  const current = mayClaimCurrent(state);
  const silent = reporting === 0;
  const signage = describeStreetSignage(street);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(selected ? null : street.street)}
        aria-pressed={selected}
        aria-expanded={nearby ? selected : undefined}
        className={`street-row ${selected ? 'street-row--selected' : ''} ${silent ? 'street-row--silent' : ''}`}
      >
        <div className="street-row-copy">
          <div className="street-row-title">
            <span>{street.street}</span>
            {silent && <span className="chip street-no-signal"><SignalZero size={12} aria-hidden />No signal</span>}
          </div>
          {nearby && 'distanceMetres' in street && <span className="nearby-distance tnum">≈ {formatDistance((street as NearbyStreet).distanceMetres)} away</span>}
          <p className="street-row-detail">
            {silent ? <>All {formatCount(street.total)} sensors silent</> : <>
              {formatCount(reporting)} reporting
              {street.notReporting > 0 && <> · {formatCount(street.notReporting)} silent</>}
            </>}
            {signage && <> · {signage}</>}
          </p>
        </div>
        <div className={`street-row-figures ${!current ? 'street-row-figures--historical' : ''}`}>
          <p className="street-free-count tnum">{silent ? '—' : formatCount(street.vacant)}</p>
          {nearby && !silent && <p className="street-free-label">{current ? 'free' : 'last free'}</p>}
          <p className="street-free-rate tnum">{silent ? 'unknown' : formatPercent(street.vacancyRate)}</p>
        </div>
        <VacancyBar rate={street.vacancyRate} />
      </button>
      {nearby && selected && <ParkingDirections street={street} state={state} />}
    </li>
  );
}

/** Unknown vacancy stays neutral and unfilled. */
function VacancyBar({ rate }: { rate: number | null }) {
  if (rate === null) return <div className="street-vacancy-bar street-vacancy-bar--unknown" aria-hidden />;
  const colour = rate >= 0.3 ? 'high' : rate >= 0.12 ? 'medium' : 'low';
  return (
    <div className={`street-vacancy-bar street-vacancy-bar--${colour}`} aria-hidden>
      <div style={{ transform: `scaleY(${Math.max(rate, 0.04)})` }} />
    </div>
  );
}

export function StreetListEmpty() {
  return <section className="card street-empty-panel"><MapPin size={17} aria-hidden />No street-level data in this snapshot.</section>;
}
