import { describe, expect, it } from 'vitest';
import { MODULE_TYPES } from '../constants';
import { getTypeStyle } from './type-style';

describe('getTypeStyle', () => {
  it.each([...MODULE_TYPES, 'custom'] as const)('has an icon and a colour for %s', (type) => {
    const style = getTypeStyle(type);
    expect(style.icon).toMatch(/^fa-solid fa-/);
    expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('uses the puzzle-piece icon for custom modules', () => {
    expect(getTypeStyle('custom').icon).toBe('fa-solid fa-puzzle-piece');
  });

  it('gives the document kinds different colours', () => {
    const colors = new Set(MODULE_TYPES.map((type) => getTypeStyle(type).color));
    expect(colors.size).toBeGreaterThan(8);
  });
});
