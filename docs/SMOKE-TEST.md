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
S2. The Atlas tools (search, the quests-deadlines-and-documents switch, notifications; scene links and the deadline documents for the GM) are visible after clicking the Atlas group at the bottom of the left toolbar; scene links
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
24. Under a "Documents" ("Dokumente") heading in the right-hand HUD column (below the quests and the
    deadlines), link chips are stacked one
    per row, right-aligned, and show a thumbnail of the document's title image; with more than ten
    links only ten are shown and `+N` opens the rest in a popover.
25. The toggle at the bottom of the column (chevron) folds quests, deadlines and documents away together →
    only a small pill stays, with an icon and the item count for each panel that has entries (nothing for
    an empty one); click the pill to expand. With nothing to show in any panel, no toggle is drawn.
    `Ctrl+Shift+Q` and the "Show quests, deadlines and documents" switch in the Atlas toolbar group do the
    same and the choice survives a reload (per player).
26. GM revokes the public document's sharing (readAccess → owner-only) → within ≤60s or on
    scene reload, the player's chip disappears.
27. Token HUD: open the HUD of a token whose Actor has a link → it shows no Atlas buttons (no view, no
    edit); the links stay reachable through the Documents section, the scene bar and the sheet header.
28. Delete the linked Atlas document → GM sees a "broken" marker with a remove shortcut;
    player never sees that link at all.
29. Player-side console: `scene.flags['atlas-foundry']` shows the raw refs/`nameSnapshot`
    (documented, accepted privacy tradeoff) — but confirm no click path anywhere delivers
    actual document *content* without the server-side check passing.

## Quest tracker

30. The HUD column sits at the visible right edge of the sidebar (left of the open panel, or of the tab
    strip when collapsed). Top to bottom: bell (only while unread), search field, quests, deadlines, documents,
    toggle.
    The quests start with a heading showing the quest module's name as the campaign set it (shared default
    "Quests" without a campaign name), then the pinned open quests (at most three) as compact cards with
    the quest name and the start of the description; the GM sees GM-only quests visibly marked, the player
    only what the backend permits.
31. Pins only: exactly the pinned open quests are shown. With a backend that sends no `isPinned`, no
    quest section appears (no arbitrary quests).
32. Set a quest to "completed" in Atlas → after refresh/TTL it disappears from the tracker. With more
    open pinned quests than shown, the "+N more" line opens the quest list in Atlas.
33. A card opens the quest in Atlas in a new tab; the heading opens the quests overview of the campaign
    in a new tab.
34. Collapsing (toggle button, `Ctrl+Shift+Q` or the toolbar switch) hides quests, deadlines and documents together and
    leaves a pill with the combined count; the choice survives a reload (per player).

## Deadlines

D1. As a player with at least one account character that has running deadlines: a "Deadlines" section sits
    between the quests and the documents. Your own characters' documents come first (alphabetical), then
    the documents the GM picked (alphabetical).
D2. Each document shows a header with its thumbnail and title; below it the running deadlines (state
    `upcoming` or `due`) with thumbnail, title and remaining days. Overdue deadlines are highlighted and
    listed first; kept and archived deadlines are absent.
D3. A click on a deadline opens its entry in Atlas in a new tab; a click on the document header opens the
    document's deadlines tab (Atlas may ignore the tab until it supports it).
D4. With many deadlines the section scrolls instead of growing past about 40% of the viewport height.
D5. The GM sees at least what the players see. The pencil button in the Deadlines heading and the Atlas
    scene-controls tool both open the deadline documents window (players see neither); add a document via
    search and remove one again.
D6. After the GM adds or removes a document, every connected player's Deadlines section updates without a
    reload and shows (or no longer shows) that document.
D7. Against a backend without the deadlines route (or with nothing to show), the Deadlines section is
    absent and nothing is logged as an error.
D8. Security: a player never sees a deadline whose document they cannot read in Atlas, even when the GM
    picked that document.

## HUD switch and session log titles

34b. The "Show Atlas HUD" tool in the Atlas toolbar group hides and shows the whole HUD column (bell,
    search, quests, deadlines, documents, toggle); the choice survives a reload (per player).
34c. Session logs show as `#<number> - Title` in the search hit list, the HUD hits, the viewer heading,
    link chips/popover/manager and notifications. A session log without a `sessionNumber` whose name is
    "Session 19 - ..." shows as `#19 - ...`; other document types keep their name.

## Search field in the HUD

34a. The field is at most half as wide as the quest cards. Typing at least two characters lists up to five
    hits under it, each with the title image as a thumbnail (a tile in the type colour without an image),
    the module icon and the title; "+N more" and a click on the magnifier or Enter open the search window with the text already
    searched; a click on a hit opens the window with that hit selected. Escape clears the field. The
    field is absent while signed out.
34d. The column's top edge lines up with the top of the first sidebar tab (Chat), so the search field sits
    level with that icon, with the sidebar collapsed and expanded.
34e. The Atlas icon before the search field opens the campaign dashboard in Atlas in a new tab.

## Notifications

35. The bell is not visible when nothing is unread. GM sends an in-app notification to the player
    (frontend channel) → a notification window opens in the player's Foundry within seconds and the bell appears
    next to the sidebar (at the top of the HUD column) as a pulsing bell with a red count; GM's own
    Foundry: nothing (not the recipient).
36. Click the bell → the notification center opens (the click works, even over the sidebar); opening the
    list or a notification marks nothing as read.
37. "Acknowledge" on one notification → it is read in Atlas' own web Postfach too (same API, same state)
    and the count drops by one; "Acknowledge all" brings the bell to 0 and it disappears. With more than 30
    unread notifications, "Acknowledge all" still reaches 0.
38. Close the player's Foundry, send another notification, reopen Foundry → bell and count are correct
    immediately (catch-up via the initial sync, not just live push).
39. Kill the backend socket (restart the backend process) → the count still updates via the
    polling fallback, and a newly sent notification opens its window within about 30 seconds; goes live
    again after reconnect.
40. GM-broadcasts ("show to everyone") a GM-only document → player sees a "GM wants to show
    you…" toast (the one remaining toast); clicking it opens Atlas, which shows its own "no access" page (never the content in
    Foundry). GM-broadcasts a public document → Atlas opens it normally for the player.
41. Enable `quietMode` in the addon's client settings → no more notification windows (and no suggestion
    toasts), but the bell keeps updating.
    Turning the "Show the notification bell when there are unread notifications" setting off hides the bell entirely; the center stays reachable via the scene controls.
42. Send three or four notifications in quick succession → at most three windows are open at once, cascaded
    so each stays reachable; further ones open no window but stay in the bell. Notifications that were already unread when you entered the world open no window.
43. A notification that consists only of an image (a `document-media` notification) shows the picture
    large in its window.
44. "Acknowledge" in a window marks that notification as read (count drops, window closes); closing the
    window with X leaves it unread and the bell count unchanged.
45. "Open in Atlas" in a window opens the notification's document in Atlas in a new tab, or the campaign
    dashboard when the notification has no document.

### Diary invitation

46. As a player who has no diary entry for the latest session log, enter the world → the invitation window
    opens with the log's picture, number, title and real and in-world date, inviting you to read it and
    write an entry; "Read the log and write a diary entry" opens the log in Atlas. It is not listed in the bell.
47. "Don't remind me again for this log" (offered in the window shown when entering the world) → leave and
    re-enter the world: no window for that log; a player without the opt-out gets it again on every
    entering while no diary entry exists. Writing the diary entry in Atlas also stops it.
48. Publish a new session log while the player is in the world → the player gets exactly one window (the
    invitation, not a second notification window for the same log); the opt-out is not offered there but
    is again when entering the world.
49. Against a backend without the diary route nothing opens and nothing is logged as an error.

---

## Sign-off

Record in `CHANGELOG.md`'s entry for the release: `Smoke-tested: <date> on Foundry v<x.y.z>`,
and only then raise `compatibility.verified` in `module.json` (see `docs/RELEASING.md` §5).
