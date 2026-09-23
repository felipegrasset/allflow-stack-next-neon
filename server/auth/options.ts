/**
 * Better Auth options — the auth of every app generated from this template.
 * Separate from index.ts so `pnpm db:migrate` can read the schema without
 * booting an auth instance.
 *
 * READ-ONLY ZONE (CONVENTIONS.md): extend it from outside (new plugins go in a
 * PR that AllFlow reviews; app behaviour goes in hooks you import), don't edit
 * it in place — AllFlow's template updates (U2) merge over this directory.
 *
 * The driver decision (S1, 23/09/2026): Kysely adapter over a TRANSACTIONAL
 * pool — Neon's WebSocket `Pool` in production, node-postgres locally — with
 * `transaction: true` declared explicitly. Never `transaction: true` over the
 * Neon HTTP driver: every sign-up fails. See CONVENTIONS.md §"El driver de Neon".
 */
import type { BetterAuthOptions } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink, organization } from "better-auth/plugins"

import { ac, roles } from "@/lib/permissions"
import { APP_TITLE, APP_URL } from "@/lib/site"
import { createDialect, getKysely } from "@/server/db/pool"
import { sendEmail } from "@/server/email/send"
import { magicLinkEmail, resetPasswordEmail, verifyEmail } from "@/server/email/templates"
import { promoteFirstAdmin } from "./bootstrap"

export const authOptions = {
  appName: APP_TITLE,
  baseURL: process.env.BETTER_AUTH_URL ?? APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: {
    dialect: createDialect(),
    type: "postgres",
    // Explicit, always: auto-detection changed between Better Auth 1.6 and 1.7.
    transaction: true,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user.email, url))
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verifyEmail(user.email, url))
    },
  },

  user: {
    additionalFields: {
      /** Set when the user finishes /onboarding (T2). Null = not onboarded. */
      onboardedAt: { type: "date", required: false, input: false },
      /** UI language. The DB default is 'es'. */
      locale: { type: "string", required: false, defaultValue: "es", input: true },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Queued by Better Auth until the sign-up transaction commits.
        after: async (user) => {
          await promoteFirstAdmin(getKysely(), user.id)
        },
      },
    },
  },

  plugins: [
    organization({
      ac,
      roles,
      dynamicAccessControl: { enabled: true },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail(magicLinkEmail(email, url))
      },
    }),
    // Must be the last plugin: lets Server Actions set the session cookie.
    nextCookies(),
  ],
} satisfies BetterAuthOptions
