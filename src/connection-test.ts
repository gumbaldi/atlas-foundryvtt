import { normalizeBaseUrl } from './settings';
import { t } from './i18n';

const TIMEOUT_MS = 5000;

export interface ConnectionTestResult {
  ok: boolean;
  messageKey: string;
  messageData?: Record<string, unknown>;
}

/**
 * Pings the backend's public health endpoint (`GET /api/v1/health`, see
 * packages/backend/src/health/health.controller.ts — `@Public()`, no auth
 * required). The socket handshake probe mentioned in the plan is deferred:
 * P1 doesn't port any socket code (see main.ts), so there's nothing to probe yet.
 */
export async function testConnection(baseUrl: string): Promise<ConnectionTestResult> {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return { ok: false, messageKey: 'ATLASFOUNDRY.ConnectionTest.MissingBaseUrl' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${normalized}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (response.status === 404) {
      return { ok: false, messageKey: 'ATLASFOUNDRY.ConnectionTest.NotFound' };
    }
    if (!response.ok) {
      return {
        ok: false,
        messageKey: 'ATLASFOUNDRY.ConnectionTest.HttpError',
        messageData: { status: response.status },
      };
    }

    const body = (await response.json()) as { status?: string };
    if (body.status !== 'ok') {
      return { ok: false, messageKey: 'ATLASFOUNDRY.ConnectionTest.UnexpectedResponse' };
    }
    return { ok: true, messageKey: 'ATLASFOUNDRY.ConnectionTest.Success' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, messageKey: 'ATLASFOUNDRY.ConnectionTest.Timeout' };
    }
    // fetch() collapses CORS rejections into a generic network TypeError —
    // browsers don't expose a distinct CORS error, so we hint at both causes.
    return {
      ok: false,
      messageKey: 'ATLASFOUNDRY.ConnectionTest.NetworkOrCors',
      messageData: { detail: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatConnectionTestResult(result: ConnectionTestResult): string {
  return t(result.messageKey, result.messageData);
}
