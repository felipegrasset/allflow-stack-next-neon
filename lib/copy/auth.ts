/**
 * The AUTH KIT's texts (login, sign-up, email verification, password recovery,
 * the app shell, 404/403/error) live in the i18n module's catalog:
 * `modules/i18n/messages/{es,en}.ts`, namespace `auth`. Screens read them with
 *
 *   const copy = await getCopy("auth")   // server components and actions
 *   const copy = useCopy("auth")         // client components
 *
 * `authCopy` below is the Spanish text as plain data, kept for the files the
 * genesis writes and reads as constants (`config/nav.ts`, the generated
 * landing). Do not use it in a screen: it never follows the user's language.
 */
import { sourceCopy, type NamespaceCopy } from "@/modules/i18n/copy"
import { es } from "@/modules/i18n/messages"

export type AuthCopy = NamespaceCopy<"auth">

export const authCopy: AuthCopy = sourceCopy("auth", es)
