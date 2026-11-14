import { defineDashboard } from "./contracts/definition"

/**
 * The dashboard `seed.ts` stores: users of the app, over the core `"user"`
 * table. Its whitelist leaves out name, email and image on purpose.
 */
export const usersDashboard = defineDashboard({
  id: "usuarios",
  title: { es: "Usuarios", en: "Users" },
  description: {
    es: "Altas, verificación e idioma de las personas registradas.",
    en: "Sign-ups, verification and language of registered people.",
  },
  sources: {
    users: {
      table: "user",
      dateColumn: "createdAt",
      columns: {
        createdAt: "date",
        onboardedAt: "date",
        emailVerified: "boolean",
        locale: "text",
      },
    },
  },
  cards: [
    { kind: "kpi", id: "total", title: { es: "Usuarios", en: "Users" }, source: "users" },
    {
      kind: "kpi",
      id: "verified",
      title: { es: "Correo verificado", en: "Verified email" },
      source: "users",
      filters: [{ column: "emailVerified", op: "eq", value: true }],
    },
    {
      kind: "kpi",
      id: "onboarded",
      title: { es: "Completaron el inicio", en: "Finished onboarding" },
      source: "users",
      filters: [{ column: "onboardedAt", op: "not_null" }],
    },
    {
      kind: "series",
      id: "signups",
      title: { es: "Altas", en: "Sign-ups" },
      source: "users",
      interval: "week",
      points: 12,
    },
    {
      kind: "breakdown",
      id: "by-locale",
      title: { es: "Por idioma", en: "By language" },
      source: "users",
      by: "locale",
    },
  ],
})
