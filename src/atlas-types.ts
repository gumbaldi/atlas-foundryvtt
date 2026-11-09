import { z } from 'zod';
import { MODULE_TYPES } from './constants';

/**
 * DTO shapes are hand-aligned with the backend's Foundry/messages endpoints
 * (packages/backend/src/foundry/, packages/backend/src/messages/).
 * Deliberately duplicated, not imported — this addon must not depend on
 * @atlas/shared.
 *
 * P9: defined as zod schemas (not plain interfaces) so the same definition
 * backs both the compile-time types used throughout `src/` (via `z.infer`,
 * re-exported under their original names below — every existing `import
 * type { AtlasX } from './atlas-types'` keeps working unchanged) and the
 * runtime contract tests in `contract/` that validate these shapes against
 * a live backend. One definition, two consumers — the drift the P9 plan
 * calls out (manually kept-in-sync duplicate types) is no longer possible
 * without a contract-test failure.
 */

const MODULE_TYPE_OR_CUSTOM = [...MODULE_TYPES, 'custom'] as const;
export const ModuleTypeOrCustomSchema = z.enum(MODULE_TYPE_OR_CUSTOM);

export const AtlasDocumentSummarySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  moduleType: ModuleTypeOrCustomSchema,
  name: z.string(),
  imageUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  tags: z.array(z.string()),
  updatedAt: z.string(),
});
export type AtlasDocumentSummary = z.infer<typeof AtlasDocumentSummarySchema>;

export const AtlasDocumentDetailSchema = AtlasDocumentSummarySchema.extend({
  entry: z.string(),
  readAccess: z.array(z.string()),
  createdAt: z.string(),
  /** Only present when `moduleType === 'custom'` (see foundry-user-documents.service.ts's toDto). */
  customModuleId: z.string().optional(),
  customModuleLabel: z.string().optional(),
});
export type AtlasDocumentDetail = z.infer<typeof AtlasDocumentDetailSchema>;

export const AtlasNotificationPayloadSchema = z.object({
  campaignId: z.string(),
  body: z.string(),
  bodyPlainText: z.string().optional(),
  documentId: z.string().optional(),
  documentModuleType: ModuleTypeOrCustomSchema.optional(),
  documentName: z.string().optional(),
  documentImageUrl: z.string().optional(),
  /** Only present when documentModuleType === 'custom' — needed to build the nested Atlas deep link. */
  customModuleId: z.string().optional(),
  senderName: z.string().optional(),
  createdAt: z.string(),
});
export type AtlasNotificationPayload = z.infer<typeof AtlasNotificationPayloadSchema>;

export const TokenExchangeResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
  scopes: z.array(z.string()),
  campaignId: z.string(),
  worldId: z.string().nullable(),
});
export type TokenExchangeResponse = z.infer<typeof TokenExchangeResponseSchema>;

/**
 * Mirrors `packages/backend/src/search/search.service.ts`'s `search()` result
 * shape (read from source per the P6 plan, not guessed) — a doc-result and a
 * post-result share this same flattened shape; `postTitle` is only present
 * for the latter. `moduleType` can be `'custom'` for custom-module hits;
 * `customModuleId`/`customModuleLabel` are only present in that case and are
 * enough to open the document (viewer) or build its Atlas deep link.
 */
export const AtlasSearchResultSchema = z.object({
  id: z.string(),
  moduleType: ModuleTypeOrCustomSchema,
  name: z.string(),
  postTitle: z.string().optional(),
  entryPlainText: z.string().optional(),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()),
  category: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
  isPinned: z.boolean().optional(),
  readAccess: z.array(z.string()).optional(),
  customModuleId: z.string().optional(),
  customModuleLabel: z.string().optional(),
});
export type AtlasSearchResult = z.infer<typeof AtlasSearchResultSchema>;

export const AtlasSearchResponseSchema = z.object({
  data: z.array(AtlasSearchResultSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
export type AtlasSearchResponse = z.infer<typeof AtlasSearchResponseSchema>;

/** Mirrors quest.schema.ts's `status` enum (read from source, not guessed, see P7 plan). */
export const AtlasQuestStatusSchema = z.enum(['open', 'completed', 'failed']);
export type AtlasQuestStatus = z.infer<typeof AtlasQuestStatusSchema>;

/**
 * Mirrors `foundry-user-documents.service.ts`'s `listQuests()`/`toQuestDto()`.
 * Atlas quests have no dedicated `objectives`/`locationIds`/`characterIds`/
 * `parentQuestId` fields (checked against the real schema) — `characterIds`/
 * `locationIds` here are recovered from the quest's own mentions server-side,
 * and `parentId` is the same generic tree field every module type has.
 */
export const AtlasQuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: AtlasQuestStatusSchema,
  category: z.string().nullable(),
  parentId: z.string().nullable(),
  tags: z.array(z.string()),
  entryPlainText: z.string(),
  isGmOnly: z.boolean(),
  characterIds: z.array(z.string()),
  locationIds: z.array(z.string()),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type AtlasQuest = z.infer<typeof AtlasQuestSchema>;

export const AtlasQuestRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type AtlasQuestRef = z.infer<typeof AtlasQuestRefSchema>;

export const AtlasQuestsResponseSchema = z.object({
  quests: z.array(AtlasQuestSchema),
  refs: z.object({
    characters: z.array(AtlasQuestRefSchema),
    locations: z.array(AtlasQuestRefSchema),
  }),
});
export type AtlasQuestsResponse = z.infer<typeof AtlasQuestsResponseSchema>;

/**
 * Mirrors `messages/messages.service.ts`'s `MessageDto` (read from source,
 * not guessed — P8 plan). `senderName` is deliberately absent: the Messages
 * API never returns it (only `senderId`), and P8 doesn't add a users-lookup
 * endpoint for it — the center shows subject/body only.
 */
export const AtlasMessageSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  senderId: z.string(),
  recipientId: z.string(),
  type: z.enum(['message', 'notification']),
  subject: z.string().optional(),
  body: z.string(),
  bodyPlainText: z.string().optional(),
  documentId: z.string().optional(),
  documentModuleType: ModuleTypeOrCustomSchema.optional(),
  documentName: z.string().optional(),
  documentImageUrl: z.string().optional(),
  customModuleId: z.string().optional(),
  targetCategoryId: z.string().optional(),
  channels: z.array(z.string()),
  /** Mirrors Atlas' `NotificationKind` (shared message.types.ts). Kinds without a document fall back to the campaign dashboard when opened. */
  kind: z.enum([
    'gm-announcement',
    'document-new',
    'document-updated',
    'document-media',
    'support-ticket',
    'diary-invite',
    'diary-entry',
    'agent-content',
  ]),
  folder: z.string(),
  customFolderId: z.string().optional(),
  isRead: z.boolean(),
  readAt: z.string().optional(),
  dismissedFromSlider: z.boolean().optional(),
  isSenderCopy: z.boolean().optional(),
  trashedAt: z.string().optional(),
  createdAt: z.string(),
});
export type AtlasMessage = z.infer<typeof AtlasMessageSchema>;

export const AtlasUnreadCountSchema = z.object({
  count: z.number(),
});
export type AtlasUnreadCount = z.infer<typeof AtlasUnreadCountSchema>;
