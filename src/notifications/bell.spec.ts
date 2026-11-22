import { describe, expect, it } from 'vitest';
import { shouldShowBell } from './bell-visibility';

describe('shouldShowBell', () => {
  it('hides the bell when nothing is unread', () => {
    expect(shouldShowBell({ unreadCount: 0 }, true)).toBe(false);
  });

  it('shows the bell for unread notifications', () => {
    expect(shouldShowBell({ unreadCount: 3 }, true)).toBe(true);
  });

  it('hides the bell when the setting is off', () => {
    expect(shouldShowBell({ unreadCount: 3 }, false)).toBe(false);
  });

  it('keeps showing a stale count while the store is in error', () => {
    const state = { status: 'error', unreadCount: 2 };
    expect(shouldShowBell(state, true)).toBe(true);
  });
});
