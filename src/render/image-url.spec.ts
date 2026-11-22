import { describe, expect, it } from 'vitest';
import { safeImageUrl } from './image-url';

const BASE = 'https://atlas.example.com';

describe('safeImageUrl', () => {
  it('passes absolute https and http URLs', () => {
    expect(safeImageUrl('https://cdn.example.com/a.png', BASE)).toBe('https://cdn.example.com/a.png');
    expect(safeImageUrl('http://cdn.example.com/a.png', BASE)).toBe('http://cdn.example.com/a.png');
  });

  it('resolves a relative path against the base URL', () => {
    expect(safeImageUrl('/uploads/a.png', BASE)).toBe('https://atlas.example.com/uploads/a.png');
  });

  it('rejects javascript: and data: URLs', () => {
    expect(safeImageUrl('javascript:alert(1)', BASE)).toBe('');
    expect(safeImageUrl('data:image/png;base64,AAAA', BASE)).toBe('');
  });

  it('gives an empty string for empty and undefined input', () => {
    expect(safeImageUrl('', BASE)).toBe('');
    expect(safeImageUrl(undefined, BASE)).toBe('');
  });

  it('gives an empty string for unparsable values', () => {
    expect(safeImageUrl('http://', BASE)).toBe('');
    expect(safeImageUrl('/relative.png', '')).toBe('');
  });
});
