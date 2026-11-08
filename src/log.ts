import { t } from './i18n';

const PREFIX = 'Atlas Foundry |';

export const log = {
  info(message: string, ...rest: unknown[]): void {
    console.info(PREFIX, message, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    console.warn(PREFIX, message, ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    console.error(PREFIX, message, ...rest);
  },
};

/**
 * Logs the technical error to the console and shows the user only the
 * localized short version — never leak stack traces / raw messages into the UI.
 */
export function notifyError(err: unknown, i18nKey: string, data?: Record<string, unknown>): void {
  log.error(i18nKey, err);
  ui.notifications.error(t(i18nKey, data));
}
