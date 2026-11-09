# Atlas for Foundry VTT

Foundry v14 module ("Atlas") that shows your Atlas campaign inside Foundry: search and read
documents, a quest panel, Atlas notifications, and links from Foundry scenes, actors and items to
Atlas documents. Everything is read per user with that user's own Atlas rights.

This repository is standalone: it is built and released on its own and never imports from the Atlas
repository or any of its packages.

## Installation

**Via manifest URL**: in Foundry's *Install Module* dialog, paste the manifest URL from
`module.json` (`manifest` field).

**Manually**: build the module (see Development below) and copy or symlink the `dist/` output to:

```text
{Foundry userData}/Data/modules/atlas-foundry
```

Then enable `Atlas Integration` in the world's module settings.

## GM Setup

1. In Foundry, open *Configure Settings → Atlas* and click **Atlas connection** (GM only).
2. Enter your Atlas frontend URL as the **Atlas base URL** (e.g. `https://atlas.example.com`).
3. Click **Test connection** to confirm Foundry can reach the Atlas backend.
4. Click **Connect to Atlas**. Atlas opens in a new tab on the confirmation page — confirm there and
   the Foundry dialog closes by itself. Closing the dialog instead cancels the connection. Your
   first successful GM login links this world to your Atlas campaign automatically (no manual
   campaign ID needed).
5. Save.

Every Foundry user connects separately, even in the same browser. A link is per user and revocable
in Atlas under *Profile → Foundry links* or with the addon's **Disconnect** button. If a user's
Atlas account belongs to a different campaign than the one the world is linked to, the link is
refused and revoked.

## Player Setup

`Atlas Settings` is GM-only. Once the GM has linked the world to an Atlas campaign, each player
connects from their own Foundry client via the scene controls' **Atlas Search** button (or
`Ctrl+K`), which shows a **Connect to Atlas** prompt when not yet linked. Before the world is
linked, no connect prompt is shown — players see a hint that their GM needs to sign in first.

## Deployment Requirements

For the connection test, login, and live data/notifications to work, the Foundry server must be
able to reach the Atlas backend over HTTPS:

- `/api/v1` must be reachable at the configured base URL (reverse-proxied to the Atlas backend).
- `/socket.io` must also be reachable from there for the managed realtime connection (P3).
- The Atlas backend's `ALLOWED_ORIGINS` must include this Foundry server's origin, or requests
  from the module will fail with a CORS error.
- Every player's **browser** (not just the Foundry server) must be able to reach the
  `MINIO_ENDPOINT` host directly and without CORS issues — document hero/portrait images and
  inline entry images are loaded as plain `<img>` tags, not proxied through the addon.

## Development

```bash
npm install
npm run build      # builds dist/ (module.json, scripts/, lang/, styles/)
npm run dev         # watch mode
npm run lint
npm run test
npm run test:contract       # fixture-mode by default; see docs/RELEASING.md for live mode
npm run package              # builds + zips a Foundry-installable release/ (see docs/RELEASING.md)
```

To test locally, symlink `dist/` into your Foundry data directory:

```bash
ln -s "$(pwd)/dist" "{Foundry userData}/Data/modules/atlas-foundry"
```

See `docs/RELEASING.md` for the full release process and `docs/SMOKE-TEST.md` for the
manual pre-release checklist. The end-to-end permission checks against a live backend
(`scripts/test-api.sh`) belong to the Atlas repository.

## Foundry API Grounding

Built against the Foundry v14 `ApplicationV2` and `DialogV2` APIs, and the v13+ Record-based
`getSceneControlButtons` hook signature (`controls.tokens.tools` is a `Record`, not an `Array`).

## Known limitations

- The GM's "show this to everyone" broadcast travels over Foundry's module socket, which carries no
  verifiable sender. A player's client could forge a suggestion, which only produces a toast. Opening
  the suggested document still checks the recipient's own Atlas rights, so no content leaks.
- Objectives and checklists on quests are not shown — Atlas has no such field.

## Scope (current state)

- Scene-control button (**Atlas Search**, also bound to `Ctrl+K`) and the GM settings menu exist and
  are fully localized (DE/EN).
- Per-user device-code login (GM and players), JWT lifecycle (cached with lazy renewal, no
  background timer), a managed Socket.IO connection with auth-on-reconnect, and logout are all
  implemented.
- Only the revocable, 90-day, scope-limited Foundry user token is persisted, and only in a
  client-scoped (per-browser) setting — never in world-scoped settings, never the Atlas password
  or refresh cookie, never the short-lived exchange JWT (memory only). Any legacy world-scoped
  integration token is detected and cleared automatically.
- Full-text Atlas search (debounced, abortable, module-type filter chips, "names only" toggle)
  wraps the same backend `SearchService` the Atlas web UI uses via a thin per-user Foundry
  endpoint — results are identical to what the same account sees on the web, keyboard-navigable
  (↑/↓/Enter/Esc), and reusable as a picker (`SearchApp.pick()`) for P5's link-attachment flow.
- A document viewer with sanitized/enriched entry HTML, clickable mentions (in-Foundry or
  shift-click/right-click for an Atlas deep link), a hero image with a broken-image fallback, and
  a classified, localized error state (auth/forbidden/not-found/server/network) that never shows
  stale content after a permission change.
- A short-TTL in-memory cache (30s lists/search, 60s details, never persisted) backs all of this
  and self-invalidates on incoming Atlas socket events; a 403/404 always evicts its cache entry
  immediately rather than waiting out the TTL.
- Context links (P5): GMs can attach Atlas documents to Scenes, Actors, Tokens, JournalEntries,
  Items, and Tiles (Foundry flags, `"Verknüpfen…"` from search or the link-manager dialog on a
  sheet/scene/token). Visibility is decided server-side per player via a batched, debounced,
  60s-cached `/foundry/campaigns/:id/documents/visibility-check` call — never a client-side
  permission guess. Entry points: a sheet header button (edit for GMs, a read-only popover of
  visible links for everyone else), a scene navigation context-menu item and scene-controls tool
  for the active scene's links, a scene-top overlay bar of link chips, and Token HUD buttons
  (view + GM-only edit, unioning the token's own links with its actor's). Broken links (deleted
  Atlas document) are marked and removable by the GM; a failed check shows "?" instead of being
  mistaken for "deleted".
- Quest panel (P7): a dockable, resizable window (scene-controls tool, `Ctrl+Shift+Q`, or
  `AtlasFoundry.openQuests()`) listing Atlas quests grouped by status (open/completed/failed),
  server-side visibility-filtered per player, with a campaign/role header, a same-status
  `parentId` tree (2 levels, cycle-safe), and character/location reference chips resolved from
  the quest's own mentions (Atlas quests currently have no dedicated `objectives`/`locationIds`/
  `characterIds` fields, so there's no checklist — this reads the real schema, not the original
  plan's assumption). Updates via the 30s list cache + a manual refresh button; live socket
  invalidation is wired and now active (see P8 below).
- Notifications (P8): a bell with an unread badge (next to the player list, or via the
  scene-controls tool/`AtlasFoundry.openNotifications()` if hidden) and a Notification Center
  panel — no more auto-popups. The per-user Atlas Postfach (`messages` module, now scoped to
  Foundry tokens via `notify:user`) is the single source of truth; the existing `notification:new`
  socket event (already emitted by `notification-delivery.service.ts`, reused rather than adding a
  new one) is only ever treated as a wake-up signal that triggers a resync — its `subject` backs
  an optional, dismissable toast (off via the `quietMode` setting), never the list itself. Falls
  back to unread-count polling (3 min while the socket is down, 10 min drift-check while
  connected) when the socket is unavailable. Read/dismiss round-trip through the same API the web
  Postfach uses, so both stay consistent, with optimistic UI and rollback on failure. A GM can
  broadcast "show this to everyone" for a document-linked notification over Foundry's own
  `game.socket` (ids only, never content); recipients get a manual confirm-to-open toast unless
  they've opted into `autoOpenGmSuggestions`. Note: `messages/schemas/message.schema.ts` has no
  appointment/conversation/DM reference fields yet, so those notification kinds and their
  deep-links aren't buildable today — items without a `documentId` fall back to the campaign
  dashboard link, exactly as the plan's own documented fallback describes.
- Testing, contracts, and release process: `npm run test:contract` validates zod schemas
  (`src/atlas-types.ts`) against a live backend or replayed fixtures (`contract/fixtures/`),
  catching addon/backend response drift; CI runs it on every build. `npm run package`
  (`scripts/package.mjs`) produces a deterministic, installable Zip + manifest under `release/`.
  See `CHANGELOG.md`, `docs/RELEASING.md`, `docs/SMOKE-TEST.md`.
