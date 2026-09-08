import { MapPin, Search, SignalZero } from 'lucide-react';
import { formatCount, formatPercent } from '../lib/format';
import { describeStreetSignage } from '../lib/parkingModel';
import { mayClaimCurrent } from '../lib/freshness';
import type { FeedState, StreetAvailability } from '../lib/types';
import type { StreetSort } from '../lib/parkingModel';

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

export function StreetList({
  streets,
  state,
  sort,
  onSortChange,
  query,
  onQueryChange,
  selected,
  onSelect,
}: Props) {
  const current = mayClaimCurrent(state);

  return (
    <section className="card">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">
          {current ? 'Where there are bays now' : 'Where there were bays'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Find a street"
              aria-label="Find a street"
              className="w-full rounded-lg border border-white/10 bg-ink-950 py-1.5 pl-8 pr-2 text-sm sm:w-44 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
          <div className="flex shrink-0 rounded-lg border border-white/10 p-0.5" role="group">
            {SORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSortChange(option.value)}
                aria-pressed={sort === option.value}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  sort === option.value
                    ? 'bg-cyan-500/20 text-cyan-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sort === 'best-odds' && (
        <p className="mt-2 text-xs text-slate-400">
          Ranked by share of bays free, among streets with at least 5 sensors reporting. A street
          with two sensors cannot top this list on one lucky bay.
        </p>
      )}

      {streets.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          No street matches “{query}”. Try a shorter search.
        </p>
      ) : (
        <ul className="mt-4 max-h-[560px] min-w-0 divide-y divide-white/5 overflow-y-auto pr-1">
          {streets.map((street) => (
            <StreetRow
              key={street.street}
              street={street}
              current={current}
              selected={selected === street.street}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function StreetRow({
  street,
  current,
  selected,
  onSelect,
}: {
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
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-white/5 ${
          selected ? 'bg-cyan-500/10' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-100">{street.street}</span>
            {silent && (
              <span className="chip bg-slate-600/40 text-slate-300">
                <SignalZero className="h-3 w-3" aria-hidden />
                No signal
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {silent ? (
              <>All {formatCount(street.total)} sensors silent</>
            ) : (
              <>
                {formatCount(reporting)} reporting
                {street.notReporting > 0 && <> · {formatCount(street.notReporting)} silent</>}
              </>
            )}
            {signage && <> · {signage}</>}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`tnum text-2xl font-semibold ${
              silent ? 'text-slate-600' : current ? 'text-white' : 'text-slate-400'
            }`}
          >
            {silent ? '—' : formatCount(street.vacant)}
          </p>
          <p className="tnum text-xs text-slate-500">
            {silent ? 'unknown' : formatPercent(street.vacancyRate)}
          </p>
        </div>

        <VacancyBar rate={street.vacancyRate} />
      </button>
    </li>
  );
}

/**
 * Colour encodes how likely a bay is, not how "good" the street is.
 * A silent street gets a neutral, unfilled bar — never a green one.
 */
function VacancyBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return (
      <div
        className="hidden h-10 w-1.5 shrink-0 rounded-full bg-slate-700 sm:block"
        aria-hidden
      />
    );
  }
  const colour =
    rate >= 0.3 ? 'bg-emerald-400' : rate >= 0.12 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="hidden h-10 w-1.5 shrink-0 flex-col justify-end overflow-hidden rounded-full bg-white/10 sm:flex">
      <div
        className={`w-full rounded-full ${colour}`}
        style={{ height: `${Math.max(rate * 100, 4)}%` }}
        aria-hidden
      />
    </div>
  );
}

export function StreetListEmpty() {
  return (
    <section className="card flex items-center gap-3 text-sm text-slate-400">
      <MapPin className="h-4 w-4" aria-hidden />
      No street-level data in this snapshot.
    </section>
  );
}
