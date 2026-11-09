import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasSearchResponse } from '../atlas-types';

vi.mock('./search-api', () => ({ searchDocuments: vi.fn() }));

const { searchDocuments } = await import('./search-api');
const { SearchController } = await import('./search-controller');
const { AtlasForbiddenError } = await import('../api/errors');
type SearchControllerState = import('./search-controller').SearchControllerState;

function emptyResponse(): AtlasSearchResponse {
  return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
}

describe('SearchController', () => {
  let onStateChange: (state: SearchControllerState) => void;
  let controller: InstanceType<typeof SearchController>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchDocuments).mockReset();
    onStateChange = vi.fn<(state: SearchControllerState) => void>();
    controller = new SearchController(onStateChange);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not search below the minimum query length', () => {
    controller.update('d');
    expect(controller.getState()).toMatchObject({ status: 'idle', query: 'd', results: [] });
    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('debounces: does not call searchDocuments before 300ms have elapsed', async () => {
    vi.mocked(searchDocuments).mockResolvedValue(emptyResponse());
    controller.update('dragon');
    expect(controller.getState().status).toBe('loading');
    expect(searchDocuments).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    expect(searchDocuments).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(searchDocuments).toHaveBeenCalledTimes(1);
  });

  it('only fires once for a rapid burst of keystrokes (debounce reset)', async () => {
    vi.mocked(searchDocuments).mockResolvedValue(emptyResponse());
    controller.update('d');
    controller.update('dr');
    controller.update('dra');
    controller.update('drag');
    controller.update('dragon');

    await vi.advanceTimersByTimeAsync(300);
    expect(searchDocuments).toHaveBeenCalledTimes(1);
    expect(searchDocuments).toHaveBeenCalledWith({ q: 'dragon' }, expect.anything());
  });

  it('aborts the in-flight request when a new query supersedes it', async () => {
    const signals: Array<AbortSignal | undefined> = [];
    vi.mocked(searchDocuments).mockImplementation((_params: unknown, options?: { signal?: AbortSignal }) => {
      signals.push(options?.signal);
      return new Promise(() => undefined);
    });

    controller.update('dragon');
    await vi.advanceTimersByTimeAsync(300);
    expect(searchDocuments).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    controller.update('dragons');
    await vi.advanceTimersByTimeAsync(300);
    expect(searchDocuments).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('discards a late response for a query that is no longer current', async () => {
    let resolveFirst!: (value: AtlasSearchResponse) => void;
    vi.mocked(searchDocuments).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    controller.update('dragon');
    await vi.advanceTimersByTimeAsync(300);
    expect(controller.getState().status).toBe('loading');

    vi.mocked(searchDocuments).mockResolvedValueOnce({
      data: [{ id: 'b', name: 'Bear', moduleType: 'creatures', tags: [] }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    controller.update('bear');
    await vi.advanceTimersByTimeAsync(300);
    expect(controller.getState()).toMatchObject({ status: 'done', query: 'bear' });

    // The stale first response arrives late — must not overwrite the newer state.
    resolveFirst({
      data: [{ id: 'a', name: 'Dragon', moduleType: 'creatures', tags: [] }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getState()).toMatchObject({ status: 'done', query: 'bear' });
  });

  it('aborts the running request at once on a filter change and never shows its results', async () => {
    const signals: AbortSignal[] = [];
    let resolveA!: (value: AtlasSearchResponse) => void;
    vi.mocked(searchDocuments)
      .mockImplementationOnce((_params, options) => {
        signals.push(options!.signal!);
        return new Promise((resolve) => (resolveA = resolve));
      })
      .mockImplementationOnce(async (_params, options) => {
        signals.push(options!.signal!);
        return { data: [{ id: 'b', name: 'Orc B', moduleType: 'creatures', tags: [] }], total: 1, page: 1, limit: 20, totalPages: 1 };
      });

    controller.update('orc', { types: ['creatures'] });
    await vi.advanceTimersByTimeAsync(300);
    expect(signals[0]?.aborted).toBe(false);

    // Same text, different filter — before the debounce for the new request even fires.
    controller.update('orc', { types: ['items'] });
    expect(signals[0]?.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    resolveA({ data: [{ id: 'a', name: 'Orc A', moduleType: 'creatures', tags: [] }], total: 1, page: 1, limit: 20, totalPages: 1 });
    await vi.advanceTimersByTimeAsync(0);

    expect(controller.getState().results.map((r) => r.id)).toEqual(['b']);
  });

  it('surfaces a classified, localized error message on failure', async () => {
    vi.mocked(searchDocuments).mockRejectedValue(new AtlasForbiddenError('/x'));

    controller.update('dragon');
    await vi.advanceTimersByTimeAsync(300);
    await vi.waitFor(() => expect(controller.getState().status).toBe('error'));
    expect(controller.getState().errorKey).toBe('ATLASFOUNDRY.ApiError.Forbidden');
  });

  it('dispose() cancels a pending debounce so no request ever fires', async () => {
    vi.mocked(searchDocuments).mockResolvedValue(emptyResponse());
    controller.update('dragon');
    controller.dispose();
    await vi.advanceTimersByTimeAsync(300);
    expect(searchDocuments).not.toHaveBeenCalled();
  });

  it('clearing the query below the minimum length aborts any in-flight request', async () => {
    vi.mocked(searchDocuments).mockImplementation(() => new Promise(() => undefined));
    controller.update('dragon');
    await vi.advanceTimersByTimeAsync(300);
    expect(controller.getState().status).toBe('loading');

    controller.update('d');
    expect(controller.getState()).toMatchObject({ status: 'idle', query: 'd', results: [] });
  });
});
