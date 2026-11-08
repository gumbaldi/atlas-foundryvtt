import { getBaseUrl } from './settings';
import type { ModuleType } from './constants';

/** Atlas only has `de`/`en` — anything else (or unset) falls back to `en`, matching next-intl's default/fallback locale. */
export function resolveLocale(): 'de' | 'en' {
  return game.i18n.lang?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/**
 * Matches the Atlas frontend's document route. Fixed module types resolve to
 * `/{locale}/campaigns/{campaignId}/{moduleType}/{documentId}`; custom-module
 * documents live one path segment deeper, under
 * `/{locale}/campaigns/{campaignId}/custom/{customModuleId}/{documentId}`
 * (see `app/[locale]/campaigns/[id]/custom/[customModuleId]/[documentId]/`) —
 * the overloads make omitting `customModuleId` for `'custom'` a type error.
 */
export function atlasDocumentUrl(campaignId: string, moduleType: ModuleType, documentId: string): string;
export function atlasDocumentUrl(campaignId: string, moduleType: 'custom', documentId: string, customModuleId: string): string;
export function atlasDocumentUrl(campaignId: string, moduleType: ModuleType | 'custom', documentId: string, customModuleId?: string): string {
  const baseUrl = getBaseUrl();
  const locale = resolveLocale();
  const routeModulePath = moduleType === 'custom' ? `custom/${customModuleId}` : moduleType;
  return `${baseUrl}/${locale}/campaigns/${campaignId}/${routeModulePath}/${documentId}`;
}

/** Fallback deep-link (P8) for notifications with no document reference — Atlas has no appointment/conversation id fields on Message yet, so this is also today's route for those. */
export function atlasCampaignDashboardUrl(campaignId: string): string {
  const baseUrl = getBaseUrl();
  const locale = resolveLocale();
  return `${baseUrl}/${locale}/campaigns/${campaignId}`;
}
