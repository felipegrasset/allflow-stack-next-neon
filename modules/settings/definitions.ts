/**
 * Settings that ship with the module, and the place where an app lists its
 * own. A setting appears in /admin/settings only if its `defineSetting` has
 * run in the server process, and the admin page imports THIS file: put your
 * app's `defineSetting` calls here (or import the files that hold them).
 */
import { z } from "zod"

import { defineSetting } from "./contracts/registry"

export const APP_NAME = defineSetting({
  key: "app.name",
  schema: z.string().trim().min(1).max(80),
  default: "Mi app",
  label: { es: "Nombre de la app", en: "App name" },
  description: {
    es: "El nombre que ven las personas en textos y correos que lo usen.",
    en: "The name people see in texts and emails that use it.",
  },
})

export const SUPPORT_EMAIL = defineSetting({
  key: "app.support_email",
  schema: z.union([z.literal(""), z.email()]),
  default: "",
  label: { es: "Correo de soporte", en: "Support email" },
  description: {
    es: "Déjalo vacío si no quieres mostrar uno.",
    en: "Leave it empty if you do not want to show one.",
  },
})

export const DEFAULT_PAGE_SIZE = defineSetting({
  key: "app.default_page_size",
  schema: z.number().int().min(5).max(100),
  default: 20,
  label: { es: "Filas por página", en: "Rows per page" },
  description: {
    es: "Entre 5 y 100. Lo usan las listas que lean este ajuste.",
    en: "Between 5 and 100. Used by the lists that read this setting.",
  },
})
