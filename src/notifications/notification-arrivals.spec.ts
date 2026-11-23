import { describe, expect, it } from 'vitest';
import type { AtlasMessage } from '../atlas-types';
import { detectArrivals } from './notification-arrivals';

function makeMessage(over: Partial<AtlasMessage> = {}): AtlasMessage {
  return {
    id: 'm1',
    campaignId: 'camp-1',
    senderId: 's1',
    recipientId: 'u1',
    type: 'notification',
    body: '',
    channels: [],
    kind: 'gm-announcement',
    folder: 'notifications',
    isRead: false,
    createdAt: '2026-01-01T10:00:00.000Z',
    ...over,
  };
}

describe('detectArrivals', () => {
  it('treats every unread, eligible message as an arrival when nothing was seen', () => {
    const items = [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })];
    const { arrivals } = detectArrivals(items, new Set());
    expect(arrivals.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('does not report ids that were already seen', () => {
    const items = [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })];
    const { arrivals } = detectArrivals(items, new Set(['a']));
    expect(arrivals.map((m) => m.id)).toEqual(['b']);
  });

  it('never reports read messages, sender copies or trashed messages, but remembers their ids', () => {
    const items = [
      makeMessage({ id: 'read', isRead: true }),
      makeMessage({ id: 'copy', isSenderCopy: true }),
      makeMessage({ id: 'trash', trashedAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const { arrivals, seen } = detectArrivals(items, new Set());
    expect(arrivals).toEqual([]);
    expect([...seen].sort()).toEqual(['copy', 'read', 'trash']);
  });

  it('returns arrivals oldest first', () => {
    const items = [
      makeMessage({ id: 'new', createdAt: '2026-01-03T00:00:00.000Z' }),
      makeMessage({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeMessage({ id: 'mid', createdAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const { arrivals } = detectArrivals(items, new Set());
    expect(arrivals.map((m) => m.id)).toEqual(['old', 'mid', 'new']);
  });

  it('returns a seen set that is a superset of the input and of all item ids, without mutating the input', () => {
    const input = new Set(['x']);
    const { seen } = detectArrivals([makeMessage({ id: 'a' }), makeMessage({ id: 'b', isRead: true })], input);
    expect([...seen].sort()).toEqual(['a', 'b', 'x']);
    expect([...input]).toEqual(['x']);
  });

  it('returns nothing for an empty list', () => {
    const { arrivals, seen } = detectArrivals([], new Set(['x']));
    expect(arrivals).toEqual([]);
    expect([...seen]).toEqual(['x']);
  });
});
