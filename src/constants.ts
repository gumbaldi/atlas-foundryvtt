export const MODULE_ID = 'atlas-foundry';
export const SOCKET_EVENT = `module.${MODULE_ID}`;

export const MODULE_TYPES = [
  'characters',
  'locations',
  'creatures',
  'items',
  'lore',
  'notes',
  'quests',
  'organizations',
  'cultures',
  'session-logs',
  'chronicles',
  'calendars',
] as const;

export type ModuleType = (typeof MODULE_TYPES)[number];

export const MODULE_TYPE_ICONS: Record<ModuleType, string> = {
  characters: 'fa-solid fa-user',
  locations: 'fa-solid fa-map-location-dot',
  creatures: 'fa-solid fa-dragon',
  items: 'fa-solid fa-box',
  lore: 'fa-solid fa-book-open',
  notes: 'fa-solid fa-note-sticky',
  quests: 'fa-solid fa-scroll',
  organizations: 'fa-solid fa-users',
  cultures: 'fa-solid fa-globe',
  'session-logs': 'fa-solid fa-clipboard-list',
  chronicles: 'fa-solid fa-timeline',
  calendars: 'fa-solid fa-calendar-days',
};
