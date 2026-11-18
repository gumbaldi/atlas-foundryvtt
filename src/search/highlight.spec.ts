import { describe, expect, it } from 'vitest';
import { highlightTerms } from './highlight';

describe('highlightTerms', () => {
  it('wraps a plain match in <mark>', () => {
    expect(highlightTerms('The dragon sleeps', 'dragon')).toBe('The <mark>dragon</mark> sleeps');
  });

  it('matches case-insensitively and keeps the original casing', () => {
    expect(highlightTerms('Dragon DRAGON dragon', 'dRaGoN')).toBe(
      '<mark>Dragon</mark> <mark>DRAGON</mark> <mark>dragon</mark>',
    );
  });

  it('marks every query word', () => {
    expect(highlightTerms('red dragon and blue wyrm', 'dragon wyrm')).toBe(
      'red <mark>dragon</mark> and blue <mark>wyrm</mark>',
    );
  });

  it('matches regex metacharacters literally without throwing', () => {
    expect(highlightTerms('see a.b and axb', 'a.b')).toBe('see <mark>a.b</mark> and axb');
    expect(() => highlightTerms('some (text)', '(')).not.toThrow();
    expect(highlightTerms('call f(x) now', 'f(x)')).toBe('call <mark>f(x)</mark> now');
  });

  it('escapes HTML in the text', () => {
    expect(highlightTerms('<script>alert(1)</script>', 'alert')).toBe(
      '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;',
    );
  });

  it('does not corrupt entities when the query matches inside one', () => {
    expect(highlightTerms('Tom & Jerry', 'amp')).toBe('Tom &amp; Jerry');
    expect(highlightTerms('Tom & Jerry', 'Tom')).toBe('<mark>Tom</mark> &amp; Jerry');
  });

  it('returns only the escaped text for an empty query or words under 2 characters', () => {
    expect(highlightTerms('a <b> c', '')).toBe('a &lt;b&gt; c');
    expect(highlightTerms('a <b> c', '   ')).toBe('a &lt;b&gt; c');
    expect(highlightTerms('a b c', 'a')).toBe('a b c');
  });

  it('uses at most 5 query words', () => {
    expect(highlightTerms('aa bb cc dd ee ff', 'aa bb cc dd ee ff')).toBe(
      '<mark>aa</mark> <mark>bb</mark> <mark>cc</mark> <mark>dd</mark> <mark>ee</mark> ff',
    );
  });
});
