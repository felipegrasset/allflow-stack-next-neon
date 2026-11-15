import { z } from "zod"

/** "contact.update", "deal.stage_changed": lower case, dots/colons allowed. */
const NAME = /^[a-z0-9][a-z0-9_.:-]{0,79}$/

export const actorSchema = z.union([
  z.literal("system"),
  z.object({ id: z.string().trim().min(1).max(200), name: z.string().trim().max(200).nullish() }),
])
export type AuditActorInput = z.infer<typeof actorSchema>

export const auditEntrySchema = z.object({
  /** What happened, as `<entity>.<verb>`: "contact.update". */
  action: z.string().trim().regex(NAME),
  /** The app's entity, lower case: "contact", "purchase_order". */
  entity: z.string().trim().regex(NAME),
  /** Id of the record. */
  entityId: z.string().trim().min(1).max(200),
  /** State before / after; the module computes and redacts the diff. Missing before = creation, missing after = deletion. */
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  /** Or a ready-made diff (`{ field: { from?, to? } }`); wins over before/after. Redacted anyway. */
  diff: z.record(z.string().max(200), z.unknown()).optional(),
  /** Extra field names to redact besides the built-in list. */
  sensitive: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  /** Default: the signed-in user. "system" or `{ id, name }` for jobs and webhooks. */
  actor: actorSchema.optional(),
})
export type AuditEntryInput = z.input<typeof auditEntrySchema>
