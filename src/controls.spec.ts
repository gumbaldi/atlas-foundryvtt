import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAtlasGroup, registerControls } from './controls';

const { isLinked, openLoginDialog } = vi.hoisted(() => ({
  isLinked: vi.fn(() => true),
  openLoginDialog: vi.fn(),
}));

vi.mock('./auth/auth-manager', () => ({ authManager: { isLinked }, revokeUnlinkedToken: vi.fn() }));
vi.mock('./auth/login-app', () => ({ openLoginDialog }));

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
  beforeEach(() => {
    isLinked.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    openLoginDialog.mockClear();
  });

  function registerAndCollect(openSearch: () => void): (controls: Record<string, any>) => void {
    const on = vi.fn();
    vi.stubGlobal('Hooks', { on });
    registerControls(openSearch);
    expect(on).toHaveBeenCalledWith('getSceneControlButtons', expect.any(Function));
    return on.mock.calls.find(([name]) => name === 'getSceneControlButtons')![1] as (controls: Record<string, any>) => void;
  }

  it('registers a button tool whose onChange opens search on every call', () => {
    const openSearch = vi.fn();
    const callback = registerAndCollect(openSearch);
    const controls: Record<string, any> = {};
    callback(controls);

    const tool = controls.atlas.tools.atlasSearch;
    expect(tool.button).toBe(true);
    tool.onChange();
    tool.onChange();
    expect(openSearch).toHaveBeenCalledTimes(2);
    expect(controls.atlas.tools.atlasConnect).toBeUndefined();
  });

  it('shows only the connect tool while signed out, and it opens the login dialog', () => {
    isLinked.mockReturnValue(false);
    const openSearch = vi.fn();
    const callback = registerAndCollect(openSearch);
    const controls: Record<string, any> = {};
    callback(controls);

    expect(Object.keys(controls.atlas.tools)).toEqual(['atlasConnect']);
    controls.atlas.tools.atlasConnect.onChange();
    expect(openLoginDialog).toHaveBeenCalledTimes(1);
    expect(openSearch).not.toHaveBeenCalled();
  });

  it('redraws the controls when the auth state changes', () => {
    const on = vi.fn();
    vi.stubGlobal('Hooks', { on });
    const render = vi.fn();
    vi.stubGlobal('ui', { controls: { render } });

    registerControls(vi.fn());
    const authHandler = on.mock.calls.find(([name]) => name === 'atlas-foundry.authChanged')![1] as () => void;
    authHandler();

    expect(render).toHaveBeenCalledTimes(1);
  });
});
