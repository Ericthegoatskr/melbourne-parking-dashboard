import { memo } from 'react';
import { MapPin, Search, SignalZero } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { describeStreetSignage } from '../lib/parkingModel';
import { mayClaimCurrent } from '../lib/freshness';
import type { FeedState, StreetAvailability } from '../lib/types';
import type { StreetSort } from '../lib/parkingModel';
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
}

const SORTS: { value: StreetSort; label: string }[] = [
  { value: 'most-vacant', label: 'Most free bays' },
  { value: 'best-odds', label: 'Best odds' },
  { value: 'name', label: 'A–Z' },
];

export const StreetList = memo(function StreetList({ streets, state, sort, onSortChange, query, onQueryChange, selected, onSelect }: Props) {
  const current = mayClaimCurrent(state);

  return (
    <section className="card street-panel">
      <div className="street-panel-heading">
        <span className="street-panel-icon"><MapPin size={19} aria-hidden /></span>
        <div>
          <h2>{current ? 'Where there are bays now' : 'Where there were bays'}</h2>
          <p>Select a street to focus the map.</p>
        </div>
      </div>
      <div className="street-controls">
        <div className="street-search">
          <Search size={17} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find a street"
            aria-label="Find a street"
          />
        </div>
        <div className="street-sorts" role="group" aria-label="Street ranking">
          {SORTS.map((option) => (
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

      {sort === 'best-odds' && (
        <p className="street-ranking-note">
          Ranked by share of bays free, among streets with at least 5 sensors reporting. A street
          with two sensors cannot top this list on one lucky bay.
        </p>
      )}

      {streets.length === 0 ? (
        <p className="street-empty">No street matches “{query}”. Try a shorter search.</p>
      ) : (
        <ul className="street-list">
          {streets.map((street) => (
            <StreetRow key={street.street} street={street} current={current} selected={selected === street.street} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
});

function StreetRow({ street, current, selected, onSelect }: {
  street: StreetAvailability;
  current: boolean;
  selected: boolean;
  onSelect: (street: string | null) => void;
}) {
  const reporting = street.vacant + street.occupied;
  const silent = reporting === 0;
  const signage = describeStreetSignage(street);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(selected ? null : street.street)}
        aria-pressed={selected}
        className={`street-row ${selected ? 'street-row--selected' : ''} ${silent ? 'street-row--silent' : ''}`}
      >
        <div className="street-row-copy">
          <div className="street-row-title">
            <span>{street.street}</span>
            {silent && <span className="chip street-no-signal"><SignalZero size={12} aria-hidden />No signal</span>}
          </div>
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
          <p className="street-free-rate tnum">{silent ? 'unknown' : formatPercent(street.vacancyRate)}</p>
        </div>
        <VacancyBar rate={street.vacancyRate} />
      </button>
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
