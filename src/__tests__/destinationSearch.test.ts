import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANDMARKS, searchDestinations } from '../lib/destinationSearch';

function response(results: unknown[], total_count = results.length): Response {
  return new Response(JSON.stringify({ total_count, results }), { status: 200 });
}

const address = {
  gisid: '19605',
  address_pnt: '200 Collins Street  Melbourne',
  geo_point_2d: { lat: -37.815184162476, lon: 144.967095411213 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('destination search', () => {
  it('loads official address coordinates and searches on submit with no credential', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([address])).mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetcher);
    const result = await searchDestinations('  200 Collins  ');
    expect(result).toEqual({
      destinations: [{ id: 'address:19605', label: '200 Collins Street Melbourne', ...address.geo_point_2d }],
      partial: false,
    });
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://data.melbourne.vic.gov.au');
    expect(url.searchParams.get('where')).toBe('suggest(address_pnt, "200 Collins")');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(fetcher.mock.calls[0]![1]).toEqual({ signal: expect.any(AbortSignal) });
  });

  it('keeps typed quotes and backslashes inside the ODSQL literal', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response([]));
    vi.stubGlobal('fetch', fetcher);
    await searchDestinations('x\\") OR true OR ("');
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    const where = url.searchParams.get('where')!;
    // JSON decoding is equivalent for these escaped quote/backslash characters.
    expect(JSON.parse(where.slice('suggest(address_pnt, '.length, -1))).toBe('x\\") OR true OR ("');
    expect(url.searchParams.size).toBe(3);
  });

  it('finds landmarks beyond the bundled choices and rejects invalid coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([
        { feature_name: 'Carlton Gardens North', co_ordinates: { lat: -37.8017690847403, lon: 144.971997551189 } },
        { feature_name: 'Reversed', co_ordinates: { lat: 144.96, lon: -37.8 } },
        { feature_name: 'Elsewhere', co_ordinates: { lat: 51.5, lon: -0.1 } },
        { feature_name: 'Missing', co_ordinates: null },
        { feature_name: 'NaN', co_ordinates: { lat: null, lon: 144.96 } },
      ])));
    const result = await searchDestinations('Carlton Gardens');
    expect(result.destinations.map((place) => place.label)).toEqual(['Carlton Gardens North']);
    expect(result.partial).toBe(true);
  });

  it('deduplicates source IDs and bundled landmark reference points', async () => {
    const place = LANDMARKS[1]!;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response([address, address]))
      .mockResolvedValueOnce(response([
        { feature_name: place.label, co_ordinates: { lat: place.lat, lon: place.lon } },
        { feature_name: place.label, co_ordinates: { lat: place.lat, lon: place.lon } },
      ])));
    const result = await searchDestinations('qUeEn ViCtOrIa');
    expect(result.destinations).toHaveLength(2);
    expect(result.destinations[0]).toEqual(place);
    expect(result.partial).toBe(false);
  });

  it('distinguishes successful empty results from a failed source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response([])));
    await expect(searchDestinations('No such destination')).resolves.toEqual({ destinations: [], partial: false });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(response([])));
    await expect(searchDestinations('200 Collins')).rejects.toThrow('temporarily unavailable');
  });

  it('keeps usable results while explicitly reporting a partial failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response([address]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: 'invalid' }), { status: 200 })));
    const result = await searchDestinations('200 Collins');
    expect(result.destinations).toHaveLength(1);
    expect(result.partial).toBe(true);
  });

  it('offers bundled landmarks during an outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));
    const result = await searchDestinations('FEDERATION');
    expect(result.destinations).toEqual([LANDMARKS[4]]);
    expect(result.partial).toBe(true);
  });

  it('does not convert malformed locations into an empty successful search', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response([{ ...address, geo_point_2d: { lat: '-37.8', lon: 144.96 } }]))
      .mockResolvedValueOnce(response([])));
    await expect(searchDestinations('200 Collins')).rejects.toThrow('temporarily unavailable');
  });

  it('rejects short and overlong queries before any network request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const query of ['', ' a ', 'x'.repeat(101)]) {
      await expect(searchDestinations(query)).rejects.toThrow('between 2 and 100');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('respects an already cancelled search without returning local matches', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(searchDestinations('Federation', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('cancels in-flight requests and never returns cancelled local results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const controller = new AbortController();
    const promise = searchDestinations('Federation', controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('times out stalled searches and retains a labelled local fallback', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const promise = searchDestinations('Federation');
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ destinations: [LANDMARKS[4]], partial: true });
  });
});
