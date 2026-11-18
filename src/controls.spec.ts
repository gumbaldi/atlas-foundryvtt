import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureAtlasGroup, registerControls } from './controls';

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
      icon: 'fa-solid fa-book-atlas',
      tools: {},
    });
    expect(controls.atlas.order).toBeGreaterThan(controls.tokens.order);
    expect(controls.atlas.order).toBeGreaterThan(controls.walls.order);
  });

  it('sets no activeTool, so clicking the group does not fire a tool', () => {
    const controls: Record<string, any> = {};

    ensureAtlasGroup(controls);

    expect('activeTool' in controls.atlas).toBe(false);
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

describe('registerControls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a button tool whose onChange opens search on every call', () => {
    const on = vi.fn();
    vi.stubGlobal('Hooks', { on });
    const openSearch = vi.fn();

    registerControls(openSearch);

    expect(on).toHaveBeenCalledWith('getSceneControlButtons', expect.any(Function));
    const callback = on.mock.calls[0]![1] as (controls: Record<string, any>) => void;
    const controls: Record<string, any> = {};
    callback(controls);

    const tool = controls.atlas.tools.atlasSearch;
    expect(tool.button).toBe(true);
    tool.onChange();
    tool.onChange();
    expect(openSearch).toHaveBeenCalledTimes(2);
  });
});
