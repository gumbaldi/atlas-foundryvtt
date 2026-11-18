import { MODULE_TYPES, MODULE_TYPE_ICONS, type ModuleType } from '../constants';

export interface TypeStyle {
  /** Font Awesome class string. */
  icon: string;
  /** Accent colour (left border, icon tile) — never used as a text colour. */
  color: string;
}

const TYPE_COLORS: Record<ModuleType, string> = {
  characters: '#3b82f6',
  locations: '#10b981',
  creatures: '#ef4444',
  items: '#f59e0b',
  lore: '#8b5cf6',
  notes: '#eab308',
  quests: '#f97316',
  organizations: '#06b6d4',
  cultures: '#14b8a6',
  'session-logs': '#6366f1',
  chronicles: '#ec4899',
  calendars: '#84cc16',
  deadlines: '#dc2626',
};

const CUSTOM_STYLE: TypeStyle = { icon: 'fa-solid fa-puzzle-piece', color: '#94a3b8' };

const KNOWN = new Set<string>(MODULE_TYPES);

export function getTypeStyle(moduleType: ModuleType | 'custom'): TypeStyle {
  if (moduleType === 'custom' || !KNOWN.has(moduleType)) return CUSTOM_STYLE;
  return { icon: MODULE_TYPE_ICONS[moduleType], color: TYPE_COLORS[moduleType] };
}
