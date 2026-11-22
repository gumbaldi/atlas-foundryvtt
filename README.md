# Atlas for Foundry VTT

Foundry v14 module that brings your Atlas campaign into Foundry VTT. Everything is read-only and
per user, with that user's own Atlas rights.

## Features

- **Search**: full-text search across the campaign (`Ctrl+K`) as a split view: a hit list with a
  title-image thumbnail, type colour and highlighted search words on the left, the selected document
  (title image, text, "Open in Atlas", and "Link…" for the GM) on the right. A "Types" menu narrows the
  hits and your last searches are offered as quick choices. Results match what the same account sees
  on the Atlas web UI.
- **Right-hand HUD**: everything Atlas shows on screen is stacked at the right edge, next to the sidebar,
  top to bottom: the notification bell (only while something is unread), a compact search field (typing
  lists the first hits right there with title image, module icon and title; a click on one opens it in the
  search window, Enter or the magnifier opens the window with your text), the quests and the scene's
  links. Quests and links fold away together with one button (`Ctrl+Shift+Q`); collapsed, one pill shows
  an icon and the item count for each panel that has entries. The whole HUD can be switched off with the
  "Show Atlas HUD" tool in the Atlas toolbar group.
- **Session logs**: wherever a session log title appears (search, viewer, links, notifications) it starts
  with the session number: `#12 - Title`.
- **Context links**: attach Atlas documents to scenes, actors, tokens, journal entries, items and
  tiles. The scene's links appear under a "Links" heading as a right-aligned stack of compact chips with a
  thumbnail (the rest behind `+N`). A click opens the document in Atlas in a new tab. Visibility is
  checked per player on the server.
- **Quest tracker**: the pinned open quests as compact cards under the quest module's name; the heading
  opens the quest overview in Atlas. Pinned quests need an Atlas backend that sends `isPinned` for
  quests; until then nothing is shown.
- **Notifications**: a pulsing bell at the top of the HUD column, shown only while notifications are unread, and a
  notification center. Notifications are acknowledged explicitly. The GM can send a document-linked
  notification to all players.
- **Login**: each user links their own Atlas account with a device-code flow and can revoke it in Atlas.
- **Languages**: English and German.

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
connects from their own Foundry client via the **Atlas Search** button in the Atlas group of the
scene controls (or `Ctrl+K`), which shows a **Connect to Atlas** prompt when not yet linked. Before the world is
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

### CI and releases

`.github/workflows/release.yml` runs on pull requests into `main` and on pushes to `main`, `dev` and
`test`:

- **Pull requests** into `main` must raise the version in `package.json`.
- **Every run** lints, typechecks, runs the unit and contract tests, and builds the package.
- **Pushes** make the bot commit the regenerated `module.json` back to the branch
  (`chore: update Foundry manifest`), rebasing onto the branch head first. The `version` and
  `download` fields in `module.json` can therefore lag behind `package.json`.
- **Push to `main`** creates the GitHub release `foundry-v<version>` with the Zip and `module.json`.
- **Push to `test`** refreshes the rolling `foundry-test` prerelease, version `<version>-test.<run>`.
  The build there rewrites `package.json` on the runner only; that edit is discarded and never committed.
- **Push to `dev`** runs the checks and updates the manifest, but publishes nothing.

## Foundry API Grounding

Built against the Foundry v14 `ApplicationV2` and `DialogV2` APIs, and the v13+ Record-based
`getSceneControlButtons` hook signature (`controls` and each group's `tools` are `Record`s, not `Array`s; the Atlas tools live in their own
`atlas` group at the bottom of the scene controls).

## Known limitations

- The GM's "show this to everyone" broadcast travels over Foundry's module socket, which carries no
  verifiable sender. A player's client could forge a suggestion, which only produces a toast. Opening
  the suggested document still checks the recipient's own Atlas rights, so no content leaks.
- Objectives and checklists on quests are not shown — Atlas has no such field.
- Documents open in Atlas in a new browser tab; there is no document viewer inside Foundry.
