import { afterAll, beforeAll, describe, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ZodType } from 'zod';
import {
  AtlasDocumentDetailSchema,
  AtlasDocumentSummarySchema,
  AtlasMessageSchema,
  AtlasQuestsResponseSchema,
  AtlasSearchResponseSchema,
  AtlasUnreadCountSchema,
  DeviceFlowPollApprovedSchema,
  DeviceFlowStartSchema,
  FoundryMeSchema,
  TokenExchangeResponseSchema,
  VisibilityCheckResponseSchema,
} from './schemas';

/**
 * Drift-protection for the addon/backend decoupling (P9 plan): every route
 * the addon consumes gets its live response validated against the same zod
 * schema `src/atlas-types.ts` derives its compile-time types from. A field
 * rename/removal on the backend that the addon's hand-aligned types haven't
 * caught up with fails here loudly instead of silently in a real Foundry
 * client.
 *
 * Two modes:
 * - Live (`ATLAS_TEST_URL` set): bootstraps a throwaway campaign + Foundry
 *   JWT against a real backend, hits every route, validates. If the
 *   bootstrap fails, every route fails with that error — a named backend is
 *   never silently replaced by old fixtures. With `--record`, also saves
 *   each response under `fixtures/` — refused unless the target host is
 *   localhost (never record against a real deployment).
 * - Fixture-only (`ATLAS_TEST_URL` unset): validates the last recorded
 *   fixtures against the current schemas — no network, works in CI without
 *   a backend. A route with no fixture yet is skipped, not failed.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

const TEST_URL = process.env.ATLAS_TEST_URL?.replace(/\/+$/, '');

// Seeded local test user, taken from the environment only — never hardcode the
// account and never read it from a file outside this repository.
const TEST_EMAIL = process.env.ATLAS_TEST_EMAIL;
const TEST_PASSWORD = process.env.ATLAS_TEST_PASSWORD;
const RECORD = process.argv.includes('--record') || process.env.ATLAS_CONTRACT_RECORD === 'true';

if (RECORD && TEST_URL && (!TEST_EMAIL || !TEST_PASSWORD)) {
  throw new Error(
    'Missing login credentials for --record: set ATLAS_TEST_EMAIL and ATLAS_TEST_PASSWORD',
  );
}

if (RECORD && TEST_URL) {
  let host = '';
  try {
    host = new URL(TEST_URL).hostname;
  } catch {
    // falls through to the refusal below — an unparsable URL is not localhost either
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `--record refused: ATLAS_TEST_URL ("${TEST_URL}") is not localhost. Recording contract fixtures must never run against a non-local (potentially production) backend.`,
    );
  }
}

interface BootstrapContext {
  campaignId: string;
  documentId: string;
  questId: string;
  foundryJwt: string;
  worldId: string;
  gmAccessToken: string;
}

// Every device token issued during the run (bootstrap's own, plus the extra
// ones the token-exchange/device-poll-approved route cases mint) — revoked
// in afterAll so a contract-test run never leaves a 90-day-valid credential
// sitting in the database (see foundry-token.service.ts's DEFAULT_EXPIRY_DAYS).
const issuedTokenIds: string[] = [];

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function postJson(path: string, body: unknown, token?: string): Promise<any> {
  const response = await fetch(`${TEST_URL}${path}`, {
    method: 'POST',
    headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${path} failed: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function bootstrap(): Promise<BootstrapContext> {
  const { accessToken } = await postJson('/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });

  const campaign = await postJson('/campaigns', { name: `Contract Test ${Date.now()}` }, accessToken);
  const campaignId = campaign.id;

  const doc = await postJson(
    `/campaigns/${campaignId}/characters`,
    { name: 'Contract Char', entry: '<p>Contract fixture</p>', readAccess: ['all'], writeAccess: ['all'] },
    accessToken,
  );
  const quest = await postJson(
    `/campaigns/${campaignId}/quests`,
    { name: 'Contract Quest', status: 'open', readAccess: ['all'], writeAccess: ['all'] },
    accessToken,
  );

  const worldId = `contract-test-${Date.now()}`;
  const start = await postJson('/foundry/device/start', { worldId, worldName: 'Contract Test', campaignId });
  await postJson('/users/me/foundry-device/confirm', { userCode: start.userCode }, accessToken);
  const polled = await postJson('/foundry/device/poll', { deviceCode: start.deviceCode });
  issuedTokenIds.push(polled.tokenId);
  const exchanged = await postJson('/foundry/token-exchange', { token: polled.token, worldId });

  return { campaignId, documentId: doc._id, questId: quest._id, foundryJwt: exchanged.accessToken, worldId, gmAccessToken: accessToken };
}

let ctx: BootstrapContext | null = null;
let bootstrapError: string | null = null;

beforeAll(async () => {
  if (!TEST_URL) return;
  try {
    ctx = await bootstrap();
  } catch (err) {
    bootstrapError = err instanceof Error ? err.message : String(err);
    console.warn(`[contract] Bootstrap against ${TEST_URL} failed, live checks will fail: ${bootstrapError}`);
  }
}, 30_000);

afterAll(async () => {
  if (!TEST_URL || !ctx) return;
  for (const tokenId of issuedTokenIds) {
    const res = await fetch(`${TEST_URL}/users/me/foundry-tokens/${tokenId}`, {
      method: 'DELETE',
      headers: authHeaders(ctx.gmAccessToken),
    }).catch((err) => {
      console.warn(`[contract] cleanup: revoking token ${tokenId} threw: ${err}`);
      return null;
    });
    if (res && !res.ok) console.warn(`[contract] cleanup: revoking token ${tokenId} failed: HTTP ${res.status}`);
  }
  const campaignRes = await fetch(`${TEST_URL}/campaigns/${ctx.campaignId}`, {
    method: 'DELETE',
    headers: authHeaders(ctx.gmAccessToken),
  }).catch((err) => {
    console.warn(`[contract] cleanup: deleting campaign ${ctx!.campaignId} threw: ${err}`);
    return null;
  });
  if (campaignRes && !campaignRes.ok) console.warn(`[contract] cleanup: deleting campaign ${ctx.campaignId} failed: HTTP ${campaignRes.status}`);
}, 30_000);

interface RouteCase {
  name: string;
  schema: ZodType;
  /** Live-mode request builder; only called when `ctx` bootstrapped successfully. */
  live: (c: BootstrapContext) => Promise<unknown>;
}

const ROUTES: RouteCase[] = [
  {
    name: 'foundry-me',
    schema: FoundryMeSchema,
    live: (c) => fetch(`${TEST_URL}/foundry/me`, { headers: authHeaders(c.foundryJwt) }).then((r) => r.json()),
  },
  {
    name: 'user-documents-list',
    schema: AtlasDocumentSummarySchema.array(),
    live: (c) =>
      fetch(`${TEST_URL}/foundry/campaigns/${c.campaignId}/user-documents?moduleType=characters`, {
        headers: authHeaders(c.foundryJwt),
      }).then((r) => r.json()),
  },
  {
    name: 'user-documents-detail',
    schema: AtlasDocumentDetailSchema,
    live: (c) =>
      fetch(`${TEST_URL}/foundry/campaigns/${c.campaignId}/user-documents/characters/${c.documentId}`, {
        headers: authHeaders(c.foundryJwt),
      }).then((r) => r.json()),
  },
  {
    name: 'search',
    schema: AtlasSearchResponseSchema,
    live: (c) =>
      fetch(`${TEST_URL}/foundry/campaigns/${c.campaignId}/search?q=Contract`, { headers: authHeaders(c.foundryJwt) }).then((r) =>
        r.json(),
      ),
  },
  {
    name: 'quests',
    schema: AtlasQuestsResponseSchema,
    live: (c) =>
      fetch(`${TEST_URL}/foundry/campaigns/${c.campaignId}/quests?status=all`, { headers: authHeaders(c.foundryJwt) }).then((r) =>
        r.json(),
      ),
  },
  {
    name: 'visibility-check',
    schema: VisibilityCheckResponseSchema,
    live: (c) =>
      postJson(
        `/foundry/campaigns/${c.campaignId}/documents/visibility-check`,
        { refs: [{ documentId: c.documentId, moduleType: 'characters' }] },
        c.foundryJwt,
      ),
  },
  {
    name: 'messages-list',
    schema: AtlasMessageSchema.array(),
    live: (c) => fetch(`${TEST_URL}/campaigns/${c.campaignId}/messages`, { headers: authHeaders(c.foundryJwt) }).then((r) => r.json()),
  },
  {
    name: 'messages-unread-count',
    schema: AtlasUnreadCountSchema,
    live: (c) =>
      fetch(`${TEST_URL}/campaigns/${c.campaignId}/messages/unread-count`, { headers: authHeaders(c.foundryJwt) }).then((r) => r.json()),
  },
  {
    name: 'device-start',
    schema: DeviceFlowStartSchema,
    live: () => postJson('/foundry/device/start', { worldId: `contract-shape-${Date.now()}`, worldName: 'Contract Test' }),
  },
  {
    name: 'token-exchange',
    schema: TokenExchangeResponseSchema,
    // Re-runs its own tiny device flow rather than reusing ctx's already-consumed one
    // (poll() single-consumes a device code — see foundry-device.service.ts).
    live: async (c) => {
      const worldId = `contract-exchange-${Date.now()}`;
      const start = await postJson('/foundry/device/start', { worldId, worldName: 'Contract Test', campaignId: c.campaignId });
      await postJson('/users/me/foundry-device/confirm', { userCode: start.userCode }, c.gmAccessToken);
      const polled = await postJson('/foundry/device/poll', { deviceCode: start.deviceCode });
      issuedTokenIds.push(polled.tokenId);
      return postJson('/foundry/token-exchange', { token: polled.token, worldId });
    },
  },
  {
    name: 'device-poll-approved',
    schema: DeviceFlowPollApprovedSchema,
    live: async (c) => {
      const worldId = `contract-poll-${Date.now()}`;
      const start = await postJson('/foundry/device/start', { worldId, worldName: 'Contract Test', campaignId: c.campaignId });
      await postJson('/users/me/foundry-device/confirm', { userCode: start.userCode }, c.gmAccessToken);
      const polled = await postJson('/foundry/device/poll', { deviceCode: start.deviceCode });
      issuedTokenIds.push(polled.tokenId);
      return polled;
    },
  },
];

// Recorded responses are committed to a public repo — never keep real secrets in them,
// not even short-lived or already revoked ones.
const SECRET_PLACEHOLDERS: Record<string, string> = {
  accessToken: 'eyJFAKE.PLACEHOLDER.JWTVALUE_NOT_A_REAL_TOKEN_0000000000000',
  token: 'atlas_foundry_PLACEHOLDER_NOT_A_REAL_TOKEN_000000000000',
  deviceCode: 'PLACEHOLDER_DEVICE_CODE_NOT_A_REAL_CODE_00000000',
};

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        typeof inner === 'string' && key in SECRET_PLACEHOLDERS ? SECRET_PLACEHOLDERS[key] : redactSecrets(inner),
      ]),
    );
  }
  return value;
}

function fixturePath(name: string): string {
  return join(FIXTURES_DIR, `${name}.json`);
}

describe('Foundry API contract', () => {
  for (const route of ROUTES) {
    it(`${route.name} matches its schema`, async ({ skip }) => {
      let payload: unknown;

      if (TEST_URL && !ctx) {
        throw new Error(`bootstrap against ${TEST_URL} failed: ${bootstrapError}`);
      }

      if (TEST_URL && ctx) {
        payload = await route.live(ctx);
        if (RECORD) {
          mkdirSync(FIXTURES_DIR, { recursive: true });
          writeFileSync(fixturePath(route.name), `${JSON.stringify(redactSecrets(payload), null, 2)}\n`);
        }
      } else if (existsSync(fixturePath(route.name))) {
        payload = JSON.parse(readFileSync(fixturePath(route.name), 'utf8'));
      } else {
        skip(true, 'ATLAS_TEST_URL not set and no recorded fixture exists yet — run once with ATLAS_TEST_URL set and --record');
        return;
      }

      route.schema.parse(payload);
    });
  }
});
