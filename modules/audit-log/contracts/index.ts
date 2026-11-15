/**
 * The only thing another module may import from `audit-log`:
 *
 *   import { recordAudit, audited } from "@/modules/audit-log/contracts"
 *
 *   await recordAudit({ action: "contact.update", entity: "contact", entityId: id, before, after })
 *
 *   export const updateContact = audited(
 *     { action: "contact.update", entity: "contact", entityId: ([id]) => id, before: ([id]) => getContact(id), after: ([id]) => getContact(id) },
 *     async (id: string, patch: Patch) => { ... }
 *   )
 *
 * Server-only (reads the session). Sensitive fields (password, token, secret…)
 * are redacted before anything is stored. `buildDiff` / `redact` are pure.
 */
export { audited, recordAudit, recordAuditIn } from "../server/api"
export type { AuditSpec } from "../server/wrap"
export { AUDIT_ERROR_CODES, AuditError, isAuditError, type AuditErrorCode } from "./errors"
export {
  REDACTED,
  buildDiff,
  isSensitiveKey,
  redact,
  type AuditDiff,
  type DiffEntry,
} from "./diff"
export { auditEntrySchema, type AuditEntryInput } from "./input"
