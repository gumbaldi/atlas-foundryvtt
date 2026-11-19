import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { expanded: true, linked: true };
vi.mock('./settings', () => ({
  getShowHudPanels: () => state.expanded,
  setShowHudPanels: vi.fn(async (value: boolean) => (state.expanded = value)),
}));
vi.mock('./auth/auth-manager', () => ({ authManager: { isLinked: () => state.linked } }));
vi.mock('./controls', () => ({ ensureAtlasGroup: vi.fn() }));
vi.mock('./i18n', () => ({ t: (key: string, data?: { count?: number }) => `${key}${data?.count !== undefined ? `:${data.count}` : ''}` }));

class FakeEl {
  id = '';
  className = '';
  title = '';
  type = '';
  textContent = '';
  parentElement: FakeEl | null = null;
  children: FakeEl[] = [];
  listeners: Record<string, () => void> = {};
  addEventListener(name: string, fn: () => void): void {
    this.listeners[name] = fn;
  }
  appendChild(child: FakeEl): FakeEl {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  replaceChildren(...nodes: FakeEl[]): void {
    this.children = [];
    nodes.forEach((n) => this.appendChild(n));
  }
  remove(): void {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    this.parentElement = null;
    hudRemoved.push(this.id);
  }
}

let hud: FakeEl;
let hudRemoved: string[];
vi.mock('./hud-right', () => ({
  getRightHud: () => hud,
  removeRightHudIfEmpty: vi.fn(),
}));

describe('HUD toggle', () => {
  beforeEach(() => {
    vi.resetModules();
    hud = new FakeEl();
    hudRemoved = [];
    state.expanded = true;
    state.linked = true;
    vi.stubGlobal('document', {
      getElementById: (id: string) => hud.children.find((c) => c.id === id) ?? null,
      createElement: () => new FakeEl(),
    });
  });

  it('shows a chevron while expanded and a count pill while collapsed', async () => {
    const { reportHudSection, HUD_TOGGLE_ID } = await import('./hud-panels');
    reportHudSection('quests', 2);
    reportHudSection('links', 3);
    const toggle = hud.children.find((c) => c.id === HUD_TOGGLE_ID)!;
    expect(toggle.className).not.toContain('collapsed');
    expect(toggle.children.map((c) => c.className)).toEqual(['fa-solid fa-chevron-up']);

    state.expanded = false;
    reportHudSection('links', 3);
    expect(toggle.className).toContain('collapsed');
    expect(toggle.title).toBe('ATLASFOUNDRY.Hud.Expand:5');
    expect(toggle.children.map((c) => c.textContent)).toEqual(['', '5']);
  });

  it('is removed once no panel has entries any more, or when signed out', async () => {
    const { reportHudSection, HUD_TOGGLE_ID } = await import('./hud-panels');
    reportHudSection('quests', 1);
    reportHudSection('links', 1);
    reportHudSection('quests', 0);
    expect(hud.children.some((c) => c.id === HUD_TOGGLE_ID)).toBe(true);
    reportHudSection('links', 0);
    expect(hud.children.some((c) => c.id === HUD_TOGGLE_ID)).toBe(false);

    reportHudSection('quests', 1);
    state.linked = false;
    reportHudSection('quests', 1);
    expect(hud.children.some((c) => c.id === HUD_TOGGLE_ID)).toBe(false);
  });

  it('flips the shared setting on click', async () => {
    const { reportHudSection, HUD_TOGGLE_ID } = await import('./hud-panels');
    const { setShowHudPanels } = await import('./settings');
    reportHudSection('quests', 1);
    hud.children.find((c) => c.id === HUD_TOGGLE_ID)!.listeners.click?.();
    expect(setShowHudPanels).toHaveBeenCalledWith(false);
  });
});
