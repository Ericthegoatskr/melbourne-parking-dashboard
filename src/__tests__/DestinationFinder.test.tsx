import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DestinationFinder } from '../components/DestinationFinder';
import { LANDMARKS, searchDestinations, type DestinationSearchResult } from '../lib/destinationSearch';

vi.mock('../lib/destinationSearch', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/destinationSearch')>(),
  searchDestinations: vi.fn(),
}));

const searchMock = vi.mocked(searchDestinations);
const ADDRESS = { id: 'address:19605', label: '200 Collins Street Melbourne', lat: -37.815184162476, lon: 144.967095411213 };
const OTHER_ADDRESS = { id: 'address:2', label: '10 Bourke Street Melbourne', lat: -37.811, lon: 144.972 };

function deferred() {
  let resolve!: (result: DestinationSearchResult) => void;
  const promise = new Promise<DestinationSearchResult>((fulfil) => { resolve = fulfil; });
  return { promise, resolve };
}

function renderFinder(destination = null as typeof ADDRESS | null) {
  const onDestinationChange = vi.fn();
  const onRadiusChange = vi.fn();
  const view = render(<DestinationFinder
    destination={destination}
    onDestinationChange={onDestinationChange}
    radiusMetres={500}
    onRadiusChange={onRadiusChange}
  />);
  return { ...view, onDestinationChange, onRadiusChange };
}

function enterQuery(query: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Address or place' }), { target: { value: query } });
}

function submit() {
  fireEvent.submit(screen.getByRole('search', { name: 'Find a destination' }));
}

beforeEach(() => {
  vi.useRealTimers();
  searchMock.mockReset();
});

afterEach(cleanup);

describe('destination finder interaction', () => {
  it('searches only on submit and does not let an edited query resurrect old results', async () => {
    const older = deferred();
    const newer = deferred();
    searchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    renderFinder();

    enterQuery('200 Collins');
    expect(searchMock).not.toHaveBeenCalled();
    submit();
    const oldSignal = searchMock.mock.calls[0]![1]!;
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled();

    enterQuery('10 Bourke');
    expect(oldSignal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    submit();
    await act(async () => { newer.resolve({ destinations: [OTHER_ADDRESS], partial: false }); });
    expect(screen.getByRole('button', { name: `${OTHER_ADDRESS.label} Select` })).toBeInTheDocument();

    // A network implementation may still finish after cancellation. The UI must
    // ignore that older resolution instead of relying on fetch to suppress it.
    await act(async () => { older.resolve({ destinations: [ADDRESS], partial: false }); });
    expect(screen.queryByRole('button', { name: `${ADDRESS.label} Select` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${OTHER_ADDRESS.label} Select` })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('10 Bourke');
  });

  it('choosing a landmark cancels pending search and keeps late results hidden', async () => {
    const pending = deferred();
    searchMock.mockReturnValueOnce(pending.promise);
    const { onDestinationChange } = renderFinder();
    enterQuery('200 Collins');
    submit();
    const signal = searchMock.mock.calls[0]![1]!;

    const landmark = LANDMARKS[1]!;
    fireEvent.change(screen.getByRole('combobox', { name: 'Or choose a landmark' }), { target: { value: landmark.id } });
    expect(signal.aborted).toBe(true);
    expect(onDestinationChange).toHaveBeenCalledTimes(1);
    expect(onDestinationChange).toHaveBeenCalledWith(landmark);
    expect(screen.getByRole('searchbox')).toHaveValue('');

    await act(async () => { pending.resolve({ destinations: [ADDRESS], partial: false }); });
    expect(screen.queryByRole('list', { name: 'Destination search results' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
  });

  it('shows partial-source warning alongside selectable successful results', async () => {
    searchMock.mockResolvedValueOnce({ destinations: [ADDRESS], partial: true });
    const { onDestinationChange } = renderFinder();
    enterQuery('200 Collins');
    submit();

    const result = await screen.findByRole('button', { name: `${ADDRESS.label} Select` });
    expect(screen.getByRole('status')).toHaveTextContent('Some address or landmark results are unavailable; retry to check more.');
    expect(onDestinationChange).not.toHaveBeenCalled();
    fireEvent.click(result);
    expect(onDestinationChange).toHaveBeenCalledTimes(1);
    expect(onDestinationChange).toHaveBeenCalledWith(ADDRESS);
    expect(screen.queryByRole('list', { name: 'Destination search results' })).not.toBeInTheDocument();
  });

  it('keeps landmarks and current selection available after a search error, then permits retry', async () => {
    searchMock.mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ destinations: [OTHER_ADDRESS], partial: false });
    const { onDestinationChange } = renderFinder(ADDRESS);
    enterQuery('10 Bourke');
    submit();

    await screen.findByText(/Destination search could not load/);
    expect(screen.getByRole('combobox', { name: 'Or choose a landmark' })).toBeEnabled();
    expect(screen.getByText(ADDRESS.label)).toBeInTheDocument();
    expect(onDestinationChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();

    submit();
    await screen.findByRole('button', { name: `${OTHER_ADDRESS.label} Select` });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Destination search could not load/)).not.toBeInTheDocument();
  });

  it('distinguishes a successful empty directory search from a network error', async () => {
    searchMock.mockResolvedValueOnce({ destinations: [], partial: false });
    renderFinder();
    enterQuery('No such destination');
    submit();

    await screen.findByText(/No matching destination in the council directory/);
    expect(screen.getByRole('status')).toHaveTextContent('Coverage is City of Melbourne only.');
    expect(screen.queryByText(/could not load/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Destination search results' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Or choose a landmark' })).toBeEnabled();
  });

  it('clears the selected destination, restores input focus and cancels a pending lookup', async () => {
    const pending = deferred();
    searchMock.mockReturnValueOnce(pending.promise);
    const { onDestinationChange } = renderFinder(ADDRESS);
    enterQuery('10 Bourke');
    submit();
    const signal = searchMock.mock.calls[0]![1]!;
    fireEvent.click(screen.getByRole('button', { name: 'Clear destination' }));

    expect(onDestinationChange).toHaveBeenCalledTimes(1);
    expect(onDestinationChange).toHaveBeenCalledWith(null);
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await act(async () => { pending.resolve({ destinations: [OTHER_ADDRESS], partial: false }); });
    expect(screen.queryByRole('list', { name: 'Destination search results' })).not.toBeInTheDocument();
  });

  it('cancels an in-flight lookup when unmounted', async () => {
    const pending = deferred();
    searchMock.mockReturnValueOnce(pending.promise);
    const { unmount } = renderFinder();
    enterQuery('200 Collins');
    submit();
    const signal = searchMock.mock.calls[0]![1]!;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ destinations: [ADDRESS], partial: false }); });
  });
});
