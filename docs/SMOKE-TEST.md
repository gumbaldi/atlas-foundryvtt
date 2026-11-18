# Manual Smoke Test — Atlas Integration for Foundry VTT

Consolidates the manual testplans from packages P3–P8
into one run. Required before every release (see `docs/RELEASING.md` §5) — record the date
and Foundry version in `CHANGELOG.md` when done.

## Setup

1. A running Atlas backend and frontend, started from the Atlas repository (the examples assume
   the dev ports `:53001` and `:3000`).
2. A Foundry v14 instance with this addon installed (packaged Zip from `npm run package`,
   installed fresh — not a dev symlink, per the release gate).
3. Two browser profiles/windows:
   - **GM**: an Atlas account that is GM/owner of the test campaign.
   - **Player**: a *different* Atlas account, member of the same campaign with role `player`.
4. A test campaign with documents covering all three visibility levels — public
   (`readAccess: ["all"]`), owner/custom (`readAccess: [<player's userId>]`), and GM-only
   (`readAccess: []`) — across at least `characters` and `locations`, plus at least one
   `quests` document of each status with a mention referencing both a visible and a
   GM-only document. The Foundry category of the Atlas repository's `scripts/test-api.sh` creates exactly this shape
   automatically if you want a scripted starting point instead of building it by hand.

## The one rule every section below serves

**A player must never reach a document they don't have read access to — through any path.**
Search, links, mentions, notifications, quest reference chips, GM-broadcast suggestions,
guessed deep-links: all of them. Any single failure here is a release blocker regardless of
how everything else scores.

---

## Start-up and entry points (Foundry 14)

Do this section first, in a fresh world with only this module active.

S1. Open the browser console. No Atlas error is logged while the world loads, and
   `({ scriptLoaded: typeof globalThis.AtlasFoundry !== 'undefined', settingsRegistered: game.settings.settings.has('atlas-foundry.showBell') })`
   returns `true` / `true`.
S2. The Atlas tools (search, quest tracker switch, notifications; scene links for the GM, the "Show scene links"
   switch) are visible after clicking the Atlas group at the bottom of the left toolbar; scene links
   only for the GM, token controls contain none of them. The Atlas group shows the Atlas logo (globe
   over book), recoloured on hover and when active like the other toolbar icons, not a Font Awesome book.
S3. Click the Atlas group button itself: it opens nothing by itself (no search window, no dialog). Click the
   magnifier tool: the search window opens; click it again while the window is open or minimized: the
   existing window comes to the front (no second window). Note which tool Foundry marks as selected after
   a click on the group button; if Foundry selects another tool and fires it, report it.
S4. As GM, right-click a scene in the navigation bar and in the Scenes directory: "Atlas links…" is
   present in both. This confirms the `getSceneContextOptions` hook name — if it is missing, report
   which context menu lacks it. As a player the entry is absent.
S5. *Configure Settings* shows an "Atlas" section with the **Atlas connection** button for the GM only.
S6. Connect: one click opens Atlas on the confirmation page; after confirming there, the Foundry
   dialog closes by itself. Start again, close the dialog with X, then confirm in Atlas: Foundry
   stays disconnected.
S7. Open a second browser tab as another Foundry user: that user is not connected until they connect
   themselves.
S8. As GM, change the world's campaign to a different one: a connected player turns red ("different
   campaign") and sees no Atlas data.

---

## Login and session

1. GM: world unlinked → connect via the device-code flow → `campaignId` gets set on the
   world setting, status dot turns green, `foundry_tokens` (Atlas profile) shows an entry
   with scopes `read:user notify:user`.
2. Player: confirm the code with the player account → status green; the addon's `/foundry/me`
   equivalent (status line) shows role `player`.
3. A non-member account confirms the code → Atlas shows a 403 error page; the addon stays
   "pending" until the code expires (not a silent hang).
4. Revoke the token from Atlas' own settings (Profile → Foundry) → next addon action shows
   "link revoked", state turns `revoked` — no silent failure.
5. Force a short JWT lifetime (`FOUNDRY_ACCESS_EXPIRES_IN=1m` on the backend), wait 2 minutes,
   trigger any addon action → transparent re-exchange; the socket reconnects with a fresh
   token (Network tab: new handshake after a disconnect).
6. Stop the backend → status turns yellow/degraded, no repeated error popups; restart it →
   automatic recovery.
7. **Security**: the long-lived token lives only in the client-scoped setting
   `game.settings.get('atlas-foundry','userTokens')`, keyed by Foundry user id — as the player, the
   **GM's** entry is not readable (different browser); world-scoped settings contain no token
   (`baseUrl`/`campaignId` only).
8. Connection status with a working WebSocket: the status text goes from "Connecting…" to "Connected"
   without ever showing "Reconnecting" while the module works.
9. Connection status without a working WebSocket (block `/socket.io` WebSocket upgrades in the proxy or
   devtools): the status reads "Connected, live updates unavailable", search, links and quests still
   work, and the bell/quests refresh through polling.

## Documents opened in Atlas (no viewer)

10. Click a link chip, a quest card or a notification → the document opens in Atlas in a new browser tab
    with the correct deep link and locale; no Atlas window opens inside Foundry. A document of a custom
    module opens its own target.
11. As the player, open a document from a link or notification that was set to owner-only in Atlas
    meanwhile → Atlas itself shows its "no access" page; Foundry never shows the content.
12. Stop the backend → clicking a link or search hit that needs a lookup shows a reachability message,
    no uncaught promise rejection in the console.
13. Sanitizer spot-check (paste as raw HTML into a test document's entry, then view it in the search
    focus pane): `<img src=x onerror=alert(1)>`, `<script>`, `<a href="javascript:…">`, nested SVG — none
    execute; a mention span with all four `data-*` attributes survives intact.

## Search

14. GM finds a GM-only document via search; the player searching the identical query does
    not.
15. Open the "Types" menu: one checkbox per document kind plus "All" and "None"; selecting a kind
    narrows the hits correctly, "All"/"None" show every kind.
16. Split view: type text and press Enter → results appear at once and nothing is preselected; the
    right pane shows a hint. Enter never opens a hit. Click a hit → the focus pane shows its title
    image, text and "Open in Atlas".
17. Each hit shows a thumbnail of the title image (the type icon in a coloured tile when there is none), a
    type colour accent and the search words highlighted in a three-line excerpt.
18. `↑`/`↓` move through the hits; `Ctrl+Enter` opens the selected hit in Atlas in a new tab; `Ctrl+K`
    opens search from anywhere.
19. Click the title image in the focus pane → a large view opens (Foundry's `ImagePopout`; on Foundry
    v14 no `window.open` fallback tab appears, and no console error). An image URL that is not
    `http(s)` is never shown.
20. Empty search box → up to 8 recent searches appear as quick choices; clicking one runs that search.
    After a reload they are still there; after signing out of Atlas they are gone.
21. Pick mode (`await AtlasFoundry.pickDocument()` in the console, or "Attach…" from a link dialog): the
    focus pane shows a "Use as target" button; only that button confirms (it resolves with the chosen
    result object), a plain click or Enter does not.
22. As GM, "Link…" in the focus pane attaches the hit to the chosen target (active scene / selected
    token / an open sheet); the player does not see the button.

## Context links

23. GM links a Scene to both a public document and a GM-only document → GM sees 2 chips on
    the scene bar; the player sees 1.
24. Link chips are narrow, sit side by side in at most two rows and show a thumbnail of the document's
    title image; with more than ten links only ten are shown and `+N` opens the rest in a popover.
25. Collapse the bar with its button → only a small pill with the link count stays; click the pill to
    expand. The "Show scene links" switch in the Atlas toolbar group does the same and the choice
    survives a reload (per player).
26. GM revokes the public document's sharing (readAccess → owner-only) → within ≤60s or on
    scene reload, the player's chip disappears.
27. Token HUD: an Actor-level link appears on every Token of that Actor; clicking opens the
    document in Atlas.
28. Delete the linked Atlas document → GM sees a "broken" marker with a remove shortcut;
    player never sees that link at all.
29. Player-side console: `scene.flags['atlas-foundry']` shows the raw refs/`nameSnapshot`
    (documented, accepted privacy tradeoff) — but confirm no click path anywhere delivers
    actual document *content* without the server-side check passing.

## Quest tracker

30. The tracker sits next to the sidebar below the bell position and shows the pinned open quests (at
    most three) as compact cards with the quest name and the start of the description; the GM sees
    GM-only quests visibly marked, the player only what the backend permits.
31. Pin fallback: with a backend that sends no `isPinned`, the first three open top-level quests are
    shown; with a backend that sends it, exactly the pinned open quests are shown.
32. Set a quest to "completed" in Atlas → after refresh/TTL it disappears from the tracker. With more
    open pinned quests than shown, the "+N more" line opens the quest list in Atlas.
33. A card opens the quest in Atlas in a new tab.
34. Collapse with the button, `Ctrl+Shift+Q` or the "Show quest tracker" switch in the Atlas toolbar
    group → only a small pill with the quest count stays; the choice survives a reload (per player).

## Notifications

35. The bell is not visible when nothing is unread. GM sends an in-app notification to the player
    (frontend channel) → the player's bell appears next to the sidebar (above the quest tracker) as a
    pulsing bell with a red count, plus a toast within seconds; GM's own Foundry: nothing (not the
    recipient).
36. Click the bell → the notification center opens (the click works, even over the sidebar); opening the
    list or a notification marks nothing as read.
37. "Acknowledge" on one notification → it is read in Atlas' own web Postfach too (same API, same state)
    and the count drops by one; "Acknowledge all" brings the bell to 0 and it disappears. With more than 30
    unread notifications, "Acknowledge all" still reaches 0.
38. Close the player's Foundry, send another notification, reopen Foundry → bell and count are correct
    immediately (catch-up via the initial sync, not just live push).
39. Kill the backend socket (restart the backend process) → the count still updates via the
    polling fallback; goes live again after reconnect.
40. GM-broadcasts ("show to everyone") a GM-only document → player sees a "GM wants to show
    you…" toast; clicking it opens Atlas, which shows its own "no access" page (never the content in
    Foundry). GM-broadcasts a public document → Atlas opens it normally for the player.
41. Enable `quietMode` in the addon's client settings → no more toasts, but the bell keeps updating.
    Turning the "Show the notification bell when there are unread notifications" setting off hides the bell entirely; the center stays reachable via the scene controls.

---

## Sign-off

Record in `CHANGELOG.md`'s entry for the release: `Smoke-tested: <date> on Foundry v<x.y.z>`,
and only then raise `compatibility.verified` in `module.json` (see `docs/RELEASING.md` §5).
