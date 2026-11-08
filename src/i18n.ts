/** Thin wrapper around `game.i18n` so call sites don't touch the Foundry global directly. */
export function t(key: string, data?: Record<string, unknown>): string {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}
