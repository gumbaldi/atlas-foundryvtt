# Manual Smoke Test — Atlas Integration for Foundry VTT

Consolidates the manual testplans from packages P3–P8
into one run. Required before every release (see `docs/RELEASING.md` §5) — record the date
and Foundry version in `CHANGELOG.md` when done.

## Setup

1. Local stack running: `./services.sh` from the repo root (Backend `:53001`, Frontend `:3000`).
2. A Foundry v14 instance with this addon installed (packaged Zip from `npm run package`,
   installed fresh — not a dev symlink, per the release gate).
3. Two browser profiles/windows:
   - **GM**: an Atlas account that is GM/owner of the test campaign.
   - **Player**: a *different* Atlas account, member of the same campaign with role `player`.
4. A test campaign with documents covering all three visibility levels — public
   (`readAccess: ["all"]`), owner/custom (`readAccess: [<player's userId>]`), and GM-only
   (`readAccess: []`) — across at least `characters` and `locations`, plus at least one
   `quests` document of each status with a mention referencing both a visible and a
   GM-only document. `scripts/test-api.sh`'s Foundry category creates exactly this shape
   automatically if you want a scripted starting point instead of building it by hand.

## The one rule every section below serves

**A player must never reach a document they don't have read access to — through any path.**
Search, links, mentions, notifications, quest reference chips, GM-broadcast suggestions,
guessed deep-links: all of them. Any single failure here is a release blocker regardless of
how everything else scores.

---

## P3 — Login & Session

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
7. **Security**: as the player, `game.settings.get('atlas-foundry','userToken')` for the
   **GM's** token is not readable (client-scoped, different browser); world-scoped settings
   contain no token (`baseUrl`/`campaignId` only).

## P4 — Viewer & Data Layer

8. Open a document with mentions → mentions are clickable, the target viewer opens; a
   target the player can't read shows "not available", not an error or stale content.
9. "Open in Atlas" → correct deep-link, correct locale.
10. Set a document's access to owner-only in Atlas → the player's already-open viewer, after
    "Refresh" or once the cache TTL lapses, shows the 404 state (not stale content).
11. Stop the backend → viewer shows a reachability error with Retry; no uncaught promise
    rejection in the console.
12. Open two documents, then reopen one of them → focuses the existing window, no duplicate.
13. Sanitizer spot-check (paste as raw HTML into a test document's entry, or via API):
    `<img src=x onerror=alert(1)>`, `<script>`, `<a href="javascript:…">`, nested SVG — none
    execute; a mention span with all four `data-*` attributes survives intact.

## P6 — Search

14. GM finds a GM-only document via search; the player searching the identical query does
    not.
15. Module-type filter chips narrow results correctly.
16. `Ctrl+K` opens search from anywhere; `↑`/`↓`/`Enter` navigate and open a result.
17. "Open in Atlas" on a result lands on the correct document.
18. Picker mode (`await AtlasFoundry.pickDocument()` in the console) resolves with the
    chosen result object.

## P5 — Context Links

19. GM links a Scene to both a public document and a GM-only document → GM sees 2 chips on
    the scene bar; the player sees 1.
20. GM revokes the public document's sharing (readAccess → owner-only) → within ≤60s or on
    scene reload, the player's chip disappears.
21. Token HUD: an Actor-level link appears on every Token of that Actor; clicking opens the
    viewer.
22. Delete the linked Atlas document → GM sees a "broken" marker with a remove shortcut;
    player never sees that link at all.
23. "Attach…" from search results (GM only) → link lands on the chosen target (active scene
    / selected token / an open sheet).
24. Player-side console: `scene.flags['atlas-foundry']` shows the raw refs/`nameSnapshot`
    (documented, accepted privacy tradeoff) — but confirm no click path anywhere delivers
    actual document *content* without the server-side check passing.

## P7 — Quest Panel

25. GM's quest panel shows every quest including GM-only ones, visibly marked; the player's
    panel shows only what they're permitted to see.
26. Mark an objective/quest complete in Atlas → status filter chip in the panel reflects it
    after refresh/TTL.
27. Set a quest's status to "completed" in Atlas → it moves to the Completed group.
28. A reference chip (e.g. a linked location) opens the viewer; a GM-only referenced document
    does not appear as a chip for the player.
29. Close and reopen the panel → position/size persisted from before.

## P8 — Notifications

30. GM sends an in-app notification to the player (frontend channel) → player's Foundry:
    bell badge +1 and a toast within seconds; GM's own Foundry: nothing (not the recipient).
31. Player marks it read in Foundry → Atlas' own web Postfach shows it as read, and vice
    versa (same API, same state).
32. Close the player's Foundry, send another notification, reopen Foundry → badge is correct
    immediately (catch-up via the initial sync, not just live push).
33. Kill the backend socket (restart the backend process) → badge still updates via the
    polling fallback; goes live again after reconnect.
34. GM-broadcasts ("show to everyone") a GM-only document → player sees a "GM wants to show
    you…" toast; clicking it shows the viewer's "not available" state (never the content).
    GM-broadcasts a public document → viewer opens normally for the player.
35. Enable `quietMode` in the addon's client settings → no more toasts, but the bell badge
    keeps updating.

---

## Sign-off

Record in `CHANGELOG.md`'s entry for the release: `Smoke-tested: <date> on Foundry v<x.y.z>`,
and only then raise `compatibility.verified` in `module.json` (see `docs/RELEASING.md` §5).
