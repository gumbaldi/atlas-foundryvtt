import { searchDocuments, type SearchDocumentsParams } from './search-api';
import { apiErrorMessageKey } from '../api/errors';
import type { AtlasSearchResult } from '../atlas-types';
import type { ModuleType } from '../constants';

export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

export interface SearchFilters {
  types?: ModuleType[];
  nameOnly?: boolean;
}

export interface SearchControllerState {
  status: SearchStatus;
  query: string;
  results: AtlasSearchResult[];
  errorKey: string | null;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function initialState(): SearchControllerState {
  return { status: 'idle', query: '', results: [], errorKey: null };
}

/**
 * UI-free search state machine (P6 plan) — debounces input, aborts a
 * superseded in-flight request, and discards a response that arrives after
 * a newer query has already taken over (belt-and-suspenders alongside the
 * abort, in case a caller ignores the signal).
 */
export class SearchController {
  private state: SearchControllerState = initialState();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  /** Bumped on every update(); a response only counts while its version is still the latest. */
  private requestVersion = 0;

  constructor(private readonly onStateChange: (state: SearchControllerState) => void) {}

  getState(): SearchControllerState {
    return this.state;
  }

  /** Called on every text-input keystroke or filter change (module-type chips, "names only" toggle). */
  update(q: string, filters: SearchFilters = {}): void {
    this.cancelPendingDebounce();
    // A filter change keeps the text the same, so the running request must be
    // superseded here, not only once the debounce for the new one fires.
    const version = ++this.requestVersion;
    this.abortController?.abort();
    this.abortController = null;

    if (q.trim().length < MIN_QUERY_LENGTH) {
      this.setState({ status: 'idle', query: q, results: [], errorKey: null });
      return;
    }

    this.setState({ ...this.state, query: q, status: 'loading' });
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.runSearch(q, filters, version);
    }, DEBOUNCE_MS);
  }

  dispose(): void {
    this.cancelPendingDebounce();
    this.abortController?.abort();
  }

  private async runSearch(q: string, filters: SearchFilters, version: number): Promise<void> {
    const controller = new AbortController();
    this.abortController = controller;

    const params: SearchDocumentsParams = { q, ...filters };
    try {
      const response = await searchDocuments(params, { signal: controller.signal });
      if (controller.signal.aborted || version !== this.requestVersion) return;
      this.setState({ status: 'done', query: q, results: response.data, errorKey: null });
    } catch (err) {
      if (controller.signal.aborted || version !== this.requestVersion) return;
      this.setState({ status: 'error', query: q, results: [], errorKey: apiErrorMessageKey(err) });
    }
  }

  private cancelPendingDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private setState(state: SearchControllerState): void {
    this.state = state;
    this.onStateChange(state);
  }
}
