import { describe, expect, it } from 'vitest';
import { ensureAtlasGroup } from './controls';

describe('ensureAtlasGroup', () => {
  it('creates the atlas group with an empty tools record ordered after every other group', () => {
    const controls: Record<string, any> = {
      tokens: { order: 0, tools: {} },
      walls: { order: 7, tools: {} },
    };

    const tools = ensureAtlasGroup(controls);

    expect(tools).toEqual({});
    expect(controls.atlas).toMatchObject({
      name: 'atlas',
      icon: 'atlas-foundry-group-icon',
      tools: {},
    });
    expect(controls.atlas.order).toBeGreaterThan(controls.tokens.order);
    expect(controls.atlas.order).toBeGreaterThan(controls.walls.order);
  });

  it('is idempotent: a second call returns the same tools object and keeps one group', () => {
    const controls: Record<string, any> = { tokens: { order: 0, tools: {} } };

    const first = ensureAtlasGroup(controls);
    first.atlasSearch = { name: 'atlasSearch' };
    const second = ensureAtlasGroup(controls);

    expect(second).toBe(first);
    expect(Object.keys(controls).filter((k) => k === 'atlas')).toHaveLength(1);
    expect(Object.keys(controls)).toHaveLength(2);
  });

  it('still ends up last when other modules use a high order', () => {
    const controls: Record<string, any> = {
      tokens: { order: 0, tools: {} },
      other: { order: 500, tools: {} },
    };

    ensureAtlasGroup(controls);

    expect(controls.atlas.order).toBeGreaterThan(500);
  });
});
