import { describe, expect, it } from 'vitest';
import { formatDocumentTitle } from './document-title';

describe('formatDocumentTitle', () => {
  it('puts the session number in front of a session log title', () => {
    expect(formatDocumentTitle('session-logs', 'Der Hinterhalt', 12)).toBe('#12 - Der Hinterhalt');
  });

  it('leaves other document types alone, even with a number-like name', () => {
    expect(formatDocumentTitle('characters', 'Session 3 - Aria', 3)).toBe('Session 3 - Aria');
    expect(formatDocumentTitle('notes', 'Aria')).toBe('Aria');
  });

  it('reads the number from a Kanka-style name when the backend sends none', () => {
    expect(formatDocumentTitle('session-logs', 'Session 19 - Die Flucht')).toBe('#19 - Die Flucht');
    expect(formatDocumentTitle('session-logs', 'session 2: Aufbruch')).toBe('#2 - Aufbruch');
  });

  it('does not repeat a number that is already in the name', () => {
    expect(formatDocumentTitle('session-logs', 'Session 19 - Die Flucht', 19)).toBe('#19 - Die Flucht');
    expect(formatDocumentTitle('session-logs', '#19 - Die Flucht', 19)).toBe('#19 - Die Flucht');
    expect(formatDocumentTitle('session-logs', formatDocumentTitle('session-logs', 'Die Flucht', 19))).toBe('#19 - Die Flucht');
  });

  it('prefers the backend number over a different one in the name', () => {
    expect(formatDocumentTitle('session-logs', 'Session 3 - Alt', 4)).toBe('#4 - Alt');
  });

  it('keeps a number-only name and a name without any number', () => {
    expect(formatDocumentTitle('session-logs', 'Session 5')).toBe('#5');
    expect(formatDocumentTitle('session-logs', 'Vorgeschichte')).toBe('Vorgeschichte');
    expect(formatDocumentTitle('session-logs', 'Vorgeschichte', null)).toBe('Vorgeschichte');
    expect(formatDocumentTitle('session-logs', 'Session 0', 0)).toBe('#0');
  });
});
