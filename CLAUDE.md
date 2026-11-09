# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Überblick

Foundry VTT **v14** module (`atlas-foundry`) that gives read-only access to Atlas campaign documents (search, viewer, context links, quest panel, notifications) inside Foundry. TypeScript + Vite, bundled as a single ES module (`dist/scripts/main.js`). The only runtime dependency is `socket.io-client`. This repo was split out of the Atlas monorepo and never imports from `@atlas/shared` or other workspace packages. The Atlas backend and `scripts/test-api.sh` live in the Atlas repository.

## Commands

```bash
npm run build              # vite build -> dist/ (module.json, scripts/, lang/, styles/)
npm run dev                # vite build --watch --mode development
npm run lint               # eslint src (the rtk hook may widen this; use `rtk proxy node_modules/.bin/eslint src contract` for exact exit codes)
npm run typecheck          # tsc --noEmit
npm test                   # vitest run (src/**/*.spec.ts, node environment)
npx vitest run src/api/cache.spec.ts            # single test file
npx vitest run -t "name of test"                # single test by name
npm run test:contract      # replays contract/fixtures against zod schemas (no network)
npm run test:contract:record   # live mode: ATLAS_TEST_URL + ATLAS_TEST_EMAIL/ATLAS_TEST_PASSWORD (env only, localhost only); re-records fixtures with secrets replaced by placeholders
npm run typecheck:contract
npm run package            # build + deterministic zip + manifest in release/ (needs `zip` CLI)
./update_module.sh         # npm ci, lint, typecheck, test, patch-bump version, commit, push
```

To try the module in Foundry, symlink `dist/` to `{Foundry userData}/Data/modules/atlas-foundry`.

CI (`.github/workflows/release.yml`) runs lint, typecheck, test, the contract typecheck, the contract tests (recorded fixtures) and `npm run package` on PRs and on pushes to `main`/`dev`/`test`. On PRs it enforces that `package.json`'s version increased versus the base branch. Pushes to `main` publish a GitHub release `foundry-v<version>`; pushes to `test` publish a rolling `foundry-test` prerelease with version `<version>-test.<run>`.

## Versionierung / Manifest

- `package.json` `version` is the single source of truth. The build (`vite.config.ts`) and `scripts/package.mjs` patch `module.json`'s version from it, and `__MODULE_VERSION__` is injected as a compile-time define. Don't hand-edit `module.json`'s version. CI commits the packaged `module.json` back to the branch, which is why its `version`/`download` fields can lag behind `package.json`.
- Manifest/download URLs come from `ATLAS_FOUNDRY_MANIFEST_URL` and `ATLAS_FOUNDRY_DOWNLOAD_URL_TEMPLATE` (`{version}` is substituted).
- Don't raise `compatibility.verified` in `module.json` without a completed `docs/SMOKE-TEST.md` run (see `docs/RELEASING.md`).

## Architektur

Entry point is `src/main.ts`. Everything that only calls `Hooks.on`/keybindings/`registerMenu` happens in `init` (Foundry 14 builds the scene controls before `ready`, and **no setting may be read while the ES module is evaluated** — `src/main.spec.ts` guards this); auth, DOM, `game.socket` and network work happen in `ready`. The GM settings are an `ApplicationV2` opened via `game.settings.registerMenu`. It also exposes `globalThis.AtlasFoundry` as a console/debug API. Foundry globals (`game`, `Hooks`, `ui`, …) are typed by the small hand-written `src/foundry-shim.d.ts`, not by `foundry-vtt-types`. Extend the shim when you use a new Foundry API.

**Layers**
- `auth/`: `AuthManager` is a state machine (`loggedOut | linking | active | revoked`). It runs a device-code login (`device-flow.ts`, one click opens a pre-opened tab on the Atlas confirmation page), keeps the long-lived Foundry token in the **client-scoped** setting `userTokens`, keyed by Foundry user id (never world-scoped), and holds the short-lived JWT in memory with lazy renewal and no timer. A token whose campaign differs from the world's is revoked (`campaign-mismatch`). It emits `atlas-foundry.authChanged`, and bumps a session epoch with `atlas-foundry.sessionReset` on login/logout/revoke/base-URL change; `session-reset.ts` then clears caches and closes content windows, and async consumers drop results from an older epoch.
- `api/`: `client.ts` is the single HTTP entry point (`/api/v1` on the configured base URL). It does auth injection, one retry on 401, a manual timeout/abort combination, GET de-duplication, and maps responses to the typed errors in `errors.ts` (`AtlasAuthError`, `AtlasForbiddenError`, `AtlasNotFoundError`, …). `cache.ts` is a short-TTL in-memory `TtlCache` (never persisted). A 403/404 evicts the entry immediately. `documents.ts` is the document-level API on top.
- `socket/atlas-socket.ts`: managed Socket.IO connection, started and stopped by `main.ts` in reaction to `authChanged`. Socket events are only wake-up signals that invalidate caches or trigger resyncs, never a data source.
- Feature modules (`search/`, `links/`, `quests/`, `notifications/`, `apps/`, `render/`): each has an API/store layer (unit-tested) plus ApplicationV2/DialogV2 UI classes (`*-app.ts`, not unit-tested). Entry points are registered through Foundry hooks (scene controls, token HUD, sheet header buttons, `renderSettings`, …).

**Conventions that matter**
- **Event bus = Foundry `Hooks`** with the `atlas-foundry.*` prefix. Modules such as `AuthManager` and `AtlasSocket` don't import each other. `main.ts` is the only place they're wired together.
- **Server-side permissions only.** The client never guesses what a player may see. Link visibility goes through the batched, debounced, cached `documents/visibility-check` endpoint, and search, quests and notifications are filtered by the backend per user. Never leak content a player can't read (see "the one rule" in `docs/SMOKE-TEST.md`). Links stored in Foundry flags (`links/link-store.ts`) hold only id/name/label, never Atlas content, because anyone who can see the Foundry object can read its flags.
- **Entry HTML is untrusted.** It goes through `render/sanitize.ts` and `render/entry-renderer.ts` before display.
- **No secrets in world-scoped settings.** `settings.ts` migrates and clears the legacy `integrationToken`.
- **i18n:** UI strings go through `t()` (`src/i18n.ts`) with keys under `ATLASFOUNDRY.*`, and both `lang/en.json` and `lang/de.json` must be updated together.
- Response types in `src/atlas-types.ts` are **zod schemas** with `z.infer`-derived types. The contract tests (`contract/schemas.ts`, `contract/fixtures/*.json`) validate recorded or live backend responses against them to catch backend drift. When you change a schema, update the fixtures too (or re-record against a local backend).
- TS is strict with `noUncheckedIndexedAccess`. Spec files sit next to their source (`foo.ts` / `foo.spec.ts`) and run in plain Node, so keep logic that needs testing free of Foundry globals, as `settings.ts`'s `normalizeBaseUrl` does.
