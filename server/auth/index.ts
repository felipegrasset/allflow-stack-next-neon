/**
 * The auth instance. READ-ONLY ZONE — see options.ts and CONVENTIONS.md.
 */
import { betterAuth } from "better-auth"

import { authOptions } from "./options"

export { authOptions }

export const auth = betterAuth(authOptions)

export type Session = typeof auth.$Infer.Session
