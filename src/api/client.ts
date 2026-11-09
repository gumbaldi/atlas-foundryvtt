import { getBaseUrl } from '../settings';
import { authManager } from '../auth/auth-manager';
import { AtlasApiError, AtlasAuthError, AtlasForbiddenError, AtlasNetworkError, AtlasNotFoundError, AtlasServerError } from './errors';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

// GET-Deduping: identical in-flight GETs share one Promise, per plan step 1.
const inFlightGets = new Map<string, Promise<unknown>>();

interface ErrorBody {
  message?: string;
}

async function readErrorBody(response: Response): Promise<ErrorBody | null> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return null;
  }
}

async function toApiError(response: Response, path: string): Promise<AtlasApiError> {
  const body = await readErrorBody(response);
  const message = body?.message;
  if (response.status === 401) return new AtlasAuthError(path, message);
  if (response.status === 403) return new AtlasForbiddenError(path, message);
  if (response.status === 404) return new AtlasNotFoundError(path, message);
  return new AtlasServerError(path, response.status, message);
}

/**
 * A single classified request. Combines the caller's signal with a timeout
 * manually rather than relying on `AbortSignal.any`/`.timeout` (not
 * guaranteed available in every Foundry/Electron runtime — see plan risk
 * note), so this works everywhere the rest of the addon does.
 */
async function performRequest<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new AtlasNetworkError(path, 'Atlas Foundry: base URL not configured');

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestController = new AbortController();
  const onCallerAbort = () => requestController.abort();
  const timer = setTimeout(() => requestController.abort(), timeoutMs);
  options.signal?.addEventListener('abort', onCallerAbort);

  try {
    let accessToken: string;
    try {
      accessToken = await authManager.ensureAccessToken();
    } catch {
      throw new AtlasAuthError(path, 'Not logged in');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: requestController.signal,
      });
    } catch (err) {
      if (requestController.signal.aborted) throw new AtlasNetworkError(path, 'Request timed out');
      throw new AtlasNetworkError(path, err instanceof Error ? err.message : String(err));
    }

    // One forced re-exchange + retry on 401 (JWT rejected mid-flight, e.g.
    // revoked seconds ago) before treating it as an auth failure — see plan's
    // AtlasAuthError note.
    if (response.status === 401 && !isRetry) {
      authManager.invalidateCache();
      return performRequest<T>(path, options, true);
    }
    if (!response.ok) {
      throw await toApiError(response, path);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isGet = (options.method ?? 'GET') === 'GET';
  if (!isGet) return performRequest<T>(path, options);

  const existing = inFlightGets.get(path);
  if (existing) return existing as Promise<T>;

  const promise = performRequest<T>(path, options).finally(() => {
    if (inFlightGets.get(path) === promise) inFlightGets.delete(path);
  });
  inFlightGets.set(path, promise);
  return promise;
}

/** Session reset: later GETs must not join a request that started under the previous sign-in. */
export function clearInFlightGets(): void {
  inFlightGets.clear();
}
