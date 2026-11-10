/**
 * The PROFILE KIT's texts (onboarding, profile, avatar, security, admin of
 * users, loading states) live in the i18n module's catalog, namespace
 * `profile`: `modules/i18n/messages/{es,en}.ts`. Read them with
 * `await getCopy("profile")` (server) or `useCopy("profile")` (client).
 */
import type { NamespaceCopy } from "@/modules/i18n/copy"

export type ProfileCopy = NamespaceCopy<"profile">
