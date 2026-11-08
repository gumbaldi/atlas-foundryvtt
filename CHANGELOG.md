# Changelog

All notable changes to the Atlas Integration for Foundry VTT are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
SemVer, independent of the Atlas monorepo version.

Each release requires a completed manual run of [docs/SMOKE-TEST.md](docs/SMOKE-TEST.md)
before `compatibility.verified` in `module.json` is raised — see
[docs/RELEASING.md](docs/RELEASING.md).

## [Unreleased]

### Added
- Foundry category in the root `scripts/test-api.sh` suite: device-flow token issuance,
  a default-deny regression matrix, and per-user visibility checks across documents,
  search, quests, `visibility-check`, and messages.
- Contract tests (`npm run test:contract`, `integrations/foundryvtt/contract/`) validating
  every consumed backend response against zod schemas derived from `src/atlas-types.ts`,
  with a fixture-replay fallback for CI without a live backend and a `--record` mode
  (`npm run test:contract:record`) gated to localhost.
- `npm run package` (`scripts/package.mjs`): builds, patches `dist/module.json`'s version
  and (if configured) manifest/download URLs, and produces a deterministic, Foundry-
  installable Zip plus a standalone manifest under `release/`.
- `docs/SMOKE-TEST.md`, `docs/RELEASING.md`.

### Changed
- `src/atlas-types.ts` now defines zod schemas (`z.infer`-derived types keep their
  original names) instead of plain interfaces — no behavior change, but every consumer
  of a Foundry/messages response can now be validated against the same definition at
  runtime, not just at compile time.

## [0.2.0] — cumulative, no dated release yet

Everything built through packages P1–P8 of the FoundryVTT integration plan, documented here retroactively since
this is the first version to carry a changelog:

### Added
- TS/Vite scaffold, `module.json`, DE/EN i18n, scene-controls fix (P1).
- Backend: `ScopesGuard` default-deny for Foundry JWTs, device-code login flow, per-user
  Foundry API, Foundry-token lifecycle (P2).
- Addon login flow, token handling, managed Socket.IO session with auth-on-reconnect (P3).
- Live per-user data layer (API client, short-TTL cache, classified error handling),
  document viewer with sanitized/enriched entry HTML and clickable mentions (P4).
- Full-text Atlas search (debounced, filterable, keyboard-navigable), reusable as a picker (P6).
- Context links between Foundry objects (Scene/Actor/Token/JournalEntry/Item/Tile) and
  Atlas documents, with server-side per-player visibility checks (P5).
- Quest panel: status-grouped, visibility-filtered, with a same-status `parentId` tree and
  mention-derived character/location reference chips (P7).
- Notification Center: unread-badge bell, read/dismiss synced with the Atlas web Postfach,
  socket wake-up + polling fallback, GM "show to everyone" broadcast (P8).

### Known limitations
- Objectives/checklists on quests are not implemented — Atlas has no such field today.
- Appointment/DM-conversation notification kinds and their deep-links are not implemented —
  the `messages` schema has no reference fields for them yet; those notifications fall back
  to the campaign dashboard link.
- The shared Foundry `notify:user` websocket room currently receives the same full-content
  `notification:new`/`conversation:message:new` events the web app does (not just wake-up
  signals) — not a cross-user leak (always the correct recipient), but broader than this
  addon's own "socket is wake-up only" principle. A true fix needs a dedicated Foundry-only
  socket room on the backend; out of scope for the addon itself. See P8's implementation notes.
