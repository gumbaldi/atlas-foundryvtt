/**
 * F1 fix: in Foundry v13+ `SceneControls.controls` and each group's `tools`
 * are Records keyed by tool name, not Arrays — `tools.push(...)` used to be
 * a silent no-op (`Array.prototype.push` doesn't exist on a plain object),
 * so the Atlas button never appeared. `onClick` is also deprecated in favor
 * of `onChange` in v13+.
 *
 * Visible to every user, not just the GM — players use search too.
 */
export function registerControls(openSearch: () => void): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    const tokens = controls.tokens;
    if (!tokens?.tools) return;

    tokens.tools.atlasSearch = {
      name: 'atlasSearch',
      title: 'ATLASFOUNDRY.Controls.OpenSearch',
      icon: 'fa-solid fa-search',
      button: true,
      order: 100,
      onChange: () => openSearch(),
    };
  });
}
