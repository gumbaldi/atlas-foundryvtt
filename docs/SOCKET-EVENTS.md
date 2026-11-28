# Socket events for the Foundry module

The module keeps one Socket.IO connection per client (`/ws`, token in the handshake `auth`).
Socket events are **wake-up signals only**: they carry ids and kinds, never content. The client
reacts by refetching through the REST API, which applies the recipient's permissions. This document
is the contract the Atlas backend has to meet; the client side is in `src/socket/`.

## Events

### `notification:new` (existing)

Sent to a user when a notification message is created for them. The client calls the messages
list and unread-count endpoints; the payload is not used as a data source.

Target: a thin payload (`messageId`, `campaignId`), so that no notification content travels over
the socket. Today the shared Foundry room also carries the full content (see CHANGELOG, Known
limitations); moving to a dedicated Foundry-only room is part of the same backend work.

### `document:changed` (new)

Sent when a document is created, updated or deleted.

```json
{
  "campaignId": "camp-1",
  "moduleType": "quests",
  "documentId": "q-1",
  "customModuleId": "mod-1",
  "change": "updated",
  "updatedAt": "2026-11-26T10:00:00.000Z"
}
```

- `moduleType`: one of the module types, or `custom` (then `customModuleId` is set).
- `change`: `created` | `updated` | `deleted`.
- No title, no body, no image URL, no field values.

The client validates the payload with `DocumentChangeSchema` (`src/atlas-types.ts`) and drops
malformed events. It re-emits valid ones as the Foundry hook `atlas-foundry.documentChanged`.

## Permission rule

`document:changed` is sent **only to users who may read the document** (the same check as
`GET` on that document). A campaign-wide broadcast would reveal the existence and type of
GM-only documents, so it is not allowed. If the check per recipient is too expensive for large
campaigns, the backend may instead send to a campaign room only for document types that are
readable by every campaign member, and say so in its own docs.

A user who loses access gets no event. Their next refetch fails with 403 or 404, which the client
already handles.

## Bursts

The backend may coalesce events (for example one event per document per second). The client also
debounces: it refreshes once, one second after the last relevant event (`src/socket/debounce.ts`).

## How the client reacts

| Event | Client reaction |
| --- | --- |
| `document:changed` with `moduleType: 'quests'` | Quest tracker reloads (debounced, bypassing its cache). |
| `document:changed` with `moduleType: 'characters'` or `'deadlines'`, or any change to a GM-picked deadline document | Deadline section reloads (debounced). |
| `document:changed` (any) | Cached detail and list entries for that `documentId` are dropped (`src/api/cache.ts`). |
| `notification:new` | Notification store resyncs immediately. |

Both panels keep their 5-minute poll while expanded, as a fallback when the socket is down.

## Open points for the backend

1. Emit `document:changed` on create, update and delete of every document type.
2. Apply the permission rule above to each recipient.
3. Confirm the event names against the backend. The client uses `notification:new` and
   `document:changed`. Older comments in this repo mentioned `foundry:notification`; the module no
   longer refers to it, but this repo cannot show whether the backend sends it.
