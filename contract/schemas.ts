import { z } from 'zod';

/**
 * Re-exports the zod schemas defined in `src/atlas-types.ts` — that file is
 * the single source of truth (its `z.infer`d types are what the rest of
 * `src/` imports), this module just gives the contract tests their own
 * conventional entry point per the P9 plan's file layout.
 */
export {
  ModuleTypeOrCustomSchema,
  AtlasDocumentSummarySchema,
  AtlasDocumentDetailSchema,
  AtlasNotificationPayloadSchema,
  TokenExchangeResponseSchema,
  AtlasSearchResultSchema,
  AtlasSearchResponseSchema,
  AtlasQuestStatusSchema,
  AtlasQuestSchema,
  AtlasQuestRefSchema,
  AtlasQuestsResponseSchema,
  AtlasMessageSchema,
  AtlasUnreadCountSchema,
} from '../src/atlas-types';

/**
 * Schemas for routes whose response shape only ever lived as hand-written
 * interfaces outside `atlas-types.ts` (device-flow.ts, auth-manager.ts) —
 * kept here rather than folded into that file's refactor, since the P9 plan
 * scopes the zod conversion to the addon's already-duplicated *document*
 * DTOs, not the auth/device-flow ones. Still contract-tested (the plan lists
 * "me" and "device start/poll" as consumed routes), just schema-defined
 * locally instead of feeding a `src/` type alias.
 */
export const FoundryMeSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  campaignId: z.string(),
  campaignName: z.string().optional(),
  role: z.string(),
});

export const DeviceFlowStartSchema = z.object({
  deviceCode: z.string(),
  userCode: z.string(),
  verificationUri: z.string(),
  verificationUriComplete: z.string(),
  expiresIn: z.number(),
  interval: z.number(),
});

export const DeviceFlowPollApprovedSchema = z.object({
  status: z.literal('approved'),
  token: z.string(),
  tokenId: z.string(),
  campaignId: z.string(),
  expiresAt: z.string(),
});

export const VisibilityCheckResponseSchema = z.object({
  visible: z.array(
    z.object({
      documentId: z.string(),
      moduleType: z.string(),
      name: z.string(),
    }),
  ),
});
