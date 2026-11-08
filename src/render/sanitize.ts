/**
 * DOM-based whitelist sanitizer for Atlas entry HTML (S3 fix — P1's viewer
 * rendered Atlas content via raw `innerHTML` with no sanitization at all).
 * Deliberately hand-written instead of a DOMPurify dependency (~100 lines,
 * plan-approved alternative); a `<template>` element is used to parse
 * without ever executing scripts or loading resources, then the tree is
 * walked and anything not explicitly allowed is dropped.
 *
 * The SVG tag/attribute set here matches the mention icons Atlas actually
 * emits (packages/frontend/components/editor/mention-rendering.js) — the
 * plan's "path/g only" note undersold the real shape (also polyline, line,
 * circle, rect), so the allowlist below is grounded in that source instead.
 */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'em', 'u', 's', 'span', 'a', 'hr', 'br',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
  // Mention-icon SVGs only.
  'svg', 'path', 'polyline', 'line', 'circle', 'rect', 'g',
]);

/** Allowed on any element in ALLOWED_TAGS. `data-*` is handled separately (always allowed). */
const GLOBAL_ALLOWED_ATTRS = new Set(['class']);

const TAG_ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  span: new Set(['style']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  svg: new Set(['xmlns', 'viewbox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']),
  path: new Set(['d']),
  polyline: new Set(['points']),
  line: new Set(['x1', 'x2', 'y1', 'y2']),
  circle: new Set(['cx', 'cy', 'r']),
  rect: new Set(['width', 'height', 'x', 'y', 'rx', 'ry']),
};

const URL_ATTRS = new Set(['href', 'src']);
const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'font-family']);

function isSafeAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function sanitizeStyleValue(value: string): string {
  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex < 0) return false;
      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      return ALLOWED_STYLE_PROPERTIES.has(property);
    })
    .join('; ');
}

function sanitizeAttributes(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const tagAllowed = TAG_ALLOWED_ATTRS[tag];

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();

    if (name.startsWith('on')) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name.startsWith('data-')) continue; // mention metadata — always kept, see module docblock

    if (name === 'style') {
      const cleaned = sanitizeStyleValue(attr.value);
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
      continue;
    }
    if (URL_ATTRS.has(name)) {
      if (!isSafeAbsoluteUrl(attr.value)) el.removeAttribute(attr.name);
      continue;
    }
    if (GLOBAL_ALLOWED_ATTRS.has(name) || tagAllowed?.has(name)) continue;

    el.removeAttribute(attr.name);
  }
}

function sanitizeChildren(root: ParentNode): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }

    sanitizeAttributes(el);
    sanitizeChildren(el);
  }
}

export function sanitizeEntryHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  sanitizeChildren(template.content);
  return template.innerHTML;
}
