// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeEntryHtml } from './sanitize';

describe('sanitizeEntryHtml', () => {
  it('removes <script> elements entirely, including their content', () => {
    const result = sanitizeEntryHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('strips on* attributes from an otherwise-allowed element like <img>', () => {
    const result = sanitizeEntryHtml('<img src="https://atlas.example.com/x.png" onerror="alert(1)" onload="alert(2)">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).toContain('src="https://atlas.example.com/x.png"');
  });

  it('strips a javascript: href but keeps the anchor and its text', () => {
    const result = sanitizeEntryHtml('<a href="javascript:alert(1)">click me</a>');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('click me');
    expect(result).toContain('<a');
  });

  it('keeps an absolute http(s) href untouched', () => {
    const result = sanitizeEntryHtml('<a href="https://atlas.example.com/foo">link</a>');
    expect(result).toContain('href="https://atlas.example.com/foo"');
  });

  it('removes iframe/object/embed/form/input entirely', () => {
    const result = sanitizeEntryHtml(
      '<iframe src="https://evil.example.com"></iframe>' +
        '<object data="x"></object>' +
        '<embed src="x">' +
        '<form action="https://evil.example.com"><input name="x"></form>',
    );
    expect(result).toBe('');
  });

  it('only keeps color and font-family from a style attribute, dropping the rest', () => {
    const result = sanitizeEntryHtml(
      '<span style="color: red; font-family: serif; position: fixed; background: url(javascript:alert(1))">t</span>',
    );
    expect(result).toContain('color: red');
    expect(result).toContain('font-family: serif');
    expect(result).not.toContain('position');
    expect(result).not.toContain('background');
    expect(result).not.toContain('javascript:');
  });

  it('preserves a nested mention SVG icon with its allowed attributes', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor">' +
      '<path d="M12 7v14"></path>' +
      '<circle cx="12" cy="10" r="3"></circle>' +
      '</svg>';
    const result = sanitizeEntryHtml(svg);
    expect(result).toContain('<svg');
    expect(result).toContain('<path');
    expect(result).toContain('d="M12 7v14"');
    expect(result).toContain('<circle');
    expect(result).toContain('cx="12"');
  });

  it('drops an onerror handler smuggled onto an <svg> child element', () => {
    const result = sanitizeEntryHtml('<svg><path d="M0 0" onload="alert(1)"></path></svg>');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).toContain('<path');
  });

  it('keeps a mention span with all of its data-* attributes intact', () => {
    const html =
      '<a class="mention" data-document-id="64f0000000000000000000ab" data-module-type="characters" ' +
      'data-document-name="Bob" data-label="Bob the Brave" data-type="mention">Bob the Brave</a>';
    const result = sanitizeEntryHtml(html);
    expect(result).toContain('data-document-id="64f0000000000000000000ab"');
    expect(result).toContain('data-module-type="characters"');
    expect(result).toContain('data-document-name="Bob"');
    expect(result).toContain('data-label="Bob the Brave"');
    expect(result).toContain('data-type="mention"');
    expect(result).toContain('class="mention"');
  });

  it('removes an unrecognized/unexpected tag along with its subtree', () => {
    const result = sanitizeEntryHtml('<div class="not-in-schema"><p>kept</p><marquee>nope</marquee></div>');
    expect(result).not.toContain('div');
    expect(result).not.toContain('marquee');
    expect(result).not.toContain('nope');
  });

  it('keeps ordinary rich-text structure untouched (paragraphs, lists, tables, formatting)', () => {
    const html =
      '<h2>Title</h2><p><strong>bold</strong> <em>em</em> <u>u</u> <s>s</s></p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>' +
      '<blockquote>quote</blockquote><pre><code>code</code></pre><hr><br>';
    expect(sanitizeEntryHtml(html)).toBe(html);
  });
});
