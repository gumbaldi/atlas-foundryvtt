import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasSearchResponse, AtlasSearchResult } from '../atlas-types';

vi.mock('./search-api', () => ({ searchDocuments: vi.fn() }));

const { searchDocuments } = await import('./search-api');
const { SearchController } = await import('./search-controller');
type SearchControllerState = import('./search-controller').SearchControllerState;

function hit(id: string, name: string, sessionNumber?: number): AtlasSearchResult {
  return { id, moduleType: 'session-logs', name, tags: [], sessionNumber: sessionNumber ?? null } as AtlasSearchResult;
}

function response(data: AtlasSearchResult[]): AtlasSearchResponse {
  return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
}

describe('SearchController sorting', () => {
  let controller: InstanceType<typeof SearchController>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchDocuments).mockReset();
    controller = new SearchController(vi.fn<(state: SearchControllerState) => void>());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-sorts finished results without sending a new request', async () => {
    vi.mocked(searchDocuments).mockResolvedValue(response([hit('b', 'Beta', 2), hit('a', 'Alpha', 1)]));
    controller.searchNow('zzz');
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().results.map((r) => r.id)).toEqual(['b', 'a']);

    controller.setSort('alphabetical');
    expect(controller.getState().results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(searchDocuments).toHaveBeenCalledTimes(1);

    controller.setSort('relevance');
    expect(controller.getState().results.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('applies the chosen sort to the next search', async () => {
    vi.mocked(searchDocuments).mockResolvedValue(response([hit('b', 'Beta', 2), hit('a', 'Alpha', 1)]));
    controller.setSort('alphabetical');
    controller.searchNow('zzz');
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().results.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
