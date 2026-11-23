import { describe, expect, it } from 'vitest';
import { KIND_ICONS, POPUP_MAX_OPEN, canOpenAnother, cascadeOffset, popupBody, popupLayout, popupTitle } from './notification-popup-model';
import type { AtlasMessage } from '../atlas-types';

function msg(overrides: Partial<AtlasMessage> = {}): AtlasMessage {
  return {
    id: 'm1',
    campaignId: 'c1',
    senderId: 's1',
    recipientId: 'r1',
    type: 'notification',
    body: '<p>Body</p>',
    channels: [],
    kind: 'document-new',
    folder: 'inbox',
    isRead: false,
    createdAt: '2026-11-22T10:00:00.000Z',
    ...overrides,
  } as AtlasMessage;
}

describe('popupLayout', () => {
  it('uses the image layout for document-media with a usable image', () => {
    expect(popupLayout(msg({ kind: 'document-media' }), 'https://atlas.example/a.png')).toBe('image');
  });

  it('falls back to text for document-media without a usable image', () => {
    expect(popupLayout(msg({ kind: 'document-media' }), '')).toBe('text');
  });

  it('uses text for every other kind, with or without an image', () => {
    for (const kind of ['gm-announcement', 'document-new', 'document-updated', 'support-ticket', 'diary-invite', 'diary-entry', 'agent-content'] as const) {
      expect(popupLayout(msg({ kind }), 'https://atlas.example/a.png')).toBe('text');
      expect(popupLayout(msg({ kind }), '')).toBe('text');
    }
  });
});

describe('popupTitle', () => {
  it('prefers the subject', () => {
    expect(popupTitle(msg({ subject: 'Hello', documentName: 'Doc', documentModuleType: 'characters' }), 'Notification')).toBe('Hello');
  });

  it('falls back to the formatted document title', () => {
    expect(popupTitle(msg({ documentName: 'Session 3 - Fire', documentModuleType: 'session-logs' }), 'Notification')).toBe('#3 - Fire');
    expect(popupTitle(msg({ documentName: 'Doc', documentModuleType: 'characters' }), 'Notification')).toBe('Doc');
  });

  it('falls back to the given text', () => {
    expect(popupTitle(msg(), 'Notification')).toBe('Notification');
  });
});

describe('popupBody', () => {
  it('returns the plain text, never the HTML body', () => {
    expect(popupBody(msg({ bodyPlainText: 'Plain' }))).toBe('Plain');
  });

  it('is empty when no plain text exists', () => {
    expect(popupBody(msg({ body: '<b>raw</b>' }))).toBe('');
  });
});

describe('canOpenAnother / cascadeOffset', () => {
  it('allows up to three open windows', () => {
    expect(POPUP_MAX_OPEN).toBe(3);
    expect(canOpenAnother(2)).toBe(true);
    expect(canOpenAnother(3)).toBe(false);
    expect(canOpenAnother(1, 1)).toBe(false);
  });

  it('shifts each window by 30 px', () => {
    expect(cascadeOffset(0)).toBe(0);
    expect(cascadeOffset(1)).toBe(30);
    expect(cascadeOffset(2)).toBe(60);
  });
});

describe('KIND_ICONS', () => {
  it('has an icon for every kind', () => {
    expect(KIND_ICONS['document-media']).toBe('fa-solid fa-photo-film');
  });
});
