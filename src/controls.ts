/**
 * Returns the `tools` record of the Atlas scene-controls group, creating the
 * group first when absent. Idempotent, so every feature can keep its own
 * `getSceneControlButtons` listener and call this without importing the others.
 * The group is ordered after every other group so it sits at the bottom of the
 * left toolbar. No `layer` is set: clicking the group switches no canvas layer.
 * No `activeTool` either: Foundry would activate it on a group click and the
 * search tool is a button tool, so the group click would open search.
 */
export function ensureAtlasGroup(controls: Record<string, any>): Record<string, any> {
  if (!controls.atlas) {
    const maxOrder = Object.values(controls).reduce<number>(
      (max, group) => (typeof group?.order === 'number' && group.order > max ? group.order : max),
      0,
    );
    controls.atlas = {
      name: 'atlas',
      title: 'ATLASFOUNDRY.Controls.Group',
      icon: 'fa-solid fa-book-atlas',
      order: maxOrder + 1,
      visible: true,
      tools: {},
    };
  }
  return controls.atlas.tools;
}

/**
 * In Foundry v13+ `SceneControls.controls` and each group's `tools` are
 * Records keyed by name, not Arrays (`tools.push(...)` is a silent no-op), and
 * `onClick` is deprecated in favor of `onChange`. The tool lives in the Atlas
 * group (see `ensureAtlasGroup`).
 *
 * Visible to every user, not just the GM — players use search too.
 */
export function registerControls(openSearch: () => void): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    ensureAtlasGroup(controls).atlasSearch = {
      name: 'atlasSearch',
      title: 'ATLASFOUNDRY.Controls.OpenSearch',
      icon: 'fa-solid fa-search',
      button: true,
      order: 100,
      onChange: () => openSearch(),
    };
  });
}
