/** Base class for every classified Atlas API failure — always carries the request path. */
export class AtlasApiError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'AtlasApiError';
    this.path = path;
  }
}

export class AtlasAuthError extends AtlasApiError {
  constructor(path: string, message = 'Unauthorized') {
    super(message, path);
    this.name = 'AtlasAuthError';
  }
}

export class AtlasForbiddenError extends AtlasApiError {
  constructor(path: string, message = 'Forbidden') {
    super(message, path);
    this.name = 'AtlasForbiddenError';
  }
}

export class AtlasNotFoundError extends AtlasApiError {
  constructor(path: string, message = 'Not found') {
    super(message, path);
    this.name = 'AtlasNotFoundError';
  }
}

export class AtlasServerError extends AtlasApiError {
  readonly status: number;

  constructor(path: string, status: number, message = 'Server error') {
    super(message, path);
    this.name = 'AtlasServerError';
    this.status = status;
  }
}

export class AtlasNetworkError extends AtlasApiError {
  constructor(path: string, message = 'Network error') {
    super(message, path);
    this.name = 'AtlasNetworkError';
  }
}

/** Maps a classified error (or anything else) to an i18n key for user-facing display. */
export function apiErrorMessageKey(err: unknown): string {
  if (err instanceof AtlasAuthError) return 'ATLASFOUNDRY.ApiError.Auth';
  if (err instanceof AtlasForbiddenError) return 'ATLASFOUNDRY.ApiError.Forbidden';
  if (err instanceof AtlasNotFoundError) return 'ATLASFOUNDRY.ApiError.NotFound';
  if (err instanceof AtlasServerError) return 'ATLASFOUNDRY.ApiError.Server';
  if (err instanceof AtlasNetworkError) return 'ATLASFOUNDRY.ApiError.Network';
  return 'ATLASFOUNDRY.ApiError.Unknown';
}
