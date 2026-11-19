import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRightHud, HUD_RIGHT_ID, removeRightHudIfEmpty } from './hud-right';

class FakeEl {
  id = '';
  className = '';
  style: Record<string, string> = {};
  parentElement: FakeEl | null = null;
  children: FakeEl[] = [];
  constructor(private readonly registry: Map<string, FakeEl>) {}
  appendChild(child: FakeEl): FakeEl {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    if (child.id) this.registry.set(child.id, child);
    return child;
  }
  removeChild(child: FakeEl): void {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
  }
  remove(): void {
    this.parentElement?.removeChild(this);
    if (this.id) this.registry.delete(this.id);
  }
}

describe('right HUD column', () => {
  let registry: Map<string, FakeEl>;
  let body: FakeEl;

  beforeEach(() => {
    registry = new Map();
    body = new FakeEl(registry);
    vi.stubGlobal('document', {
      body,
      getElementById: (id: string) => registry.get(id) ?? null,
      createElement: () => new FakeEl(registry),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function addSidebar(): FakeEl {
    const sidebar = new FakeEl(registry);
    sidebar.id = 'ui-right';
    registry.set('ui-right', sidebar);
    body.appendChild(sidebar);
    return sidebar;
  }

  it('creates the column inside #ui-right', () => {
    const sidebar = addSidebar();
    const hud = getRightHud() as unknown as FakeEl;
    expect(hud.id).toBe(HUD_RIGHT_ID);
    expect(hud.parentElement).toBe(sidebar);
    expect(hud.className).not.toContain('fixed');
  });

  it('falls back to the body with the fixed class when #ui-right is missing', () => {
    const hud = getRightHud() as unknown as FakeEl;
    expect(hud.parentElement).toBe(body);
    expect(hud.className).toContain('atlas-foundry-hud-right-fixed');
  });

  it('is idempotent', () => {
    addSidebar();
    expect(getRightHud()).toBe(getRightHud());
    expect(body.children.length).toBe(1);
  });

  it('moves the column into #ui-right once that appears', () => {
    const first = getRightHud();
    const sidebar = addSidebar();
    const second = getRightHud();
    expect(second).toBe(first);
    expect((second as unknown as FakeEl).parentElement).toBe(sidebar);
  });

  it('pins the column left of the visible sidebar panel, and resets to the CSS placement when it cannot be measured', () => {
    vi.stubGlobal('window', { innerWidth: 2000, addEventListener: vi.fn() });
    const sidebar = addSidebar();
    const rectOf = (rect: { top: number; left: number; width: number }) => () => rect;
    (sidebar as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = rectOf({ top: 0, left: 1500, width: 500 });
    const panel = new FakeEl(registry);
    panel.id = 'sidebar';
    registry.set('sidebar', panel);
    (panel as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = rectOf({ top: 0, left: 1740, width: 260 });

    const hud = getRightHud() as unknown as FakeEl;
    expect(hud.style.position).toBe('fixed');
    expect(hud.style.top).toBe('8px');
    expect(hud.style.right).toBe('268px');

    registry.delete('sidebar');
    getRightHud();
    expect(hud.style.position).toBe('');
    expect(hud.style.right).toBe('');
  });

  it('removes the column only when it is empty', () => {
    addSidebar();
    const hud = getRightHud() as unknown as FakeEl;
    hud.appendChild(new FakeEl(registry));
    removeRightHudIfEmpty();
    expect(registry.has(HUD_RIGHT_ID)).toBe(true);
    hud.children = [];
    removeRightHudIfEmpty();
    expect(registry.has(HUD_RIGHT_ID)).toBe(false);
  });
});
