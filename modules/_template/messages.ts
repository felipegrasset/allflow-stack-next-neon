/**
 * Textos del módulo (punto de extensión `messages`, ver modules/README.md).
 * Reemplaza `"mi-modulo"` por el id de tu módulo: es la ÚNICA clave de primer
 * nivel. Solo datos: textos literales y objetos, nada de variables, funciones,
 * spreads ni imports que no sean `import type`.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  "mi-modulo": {
    nav: "Mi módulo",
    title: "Mis ítems",
    empty: "Todavía no hay ítems.",
    count: "{n, plural, =0 {Sin ítems} one {# ítem} other {# ítems}}",
  },
} as const

export const en: WidenMessages<typeof es> = {
  "mi-modulo": {
    nav: "My module",
    title: "My items",
    empty: "No items yet.",
    count: "{n, plural, =0 {No items} one {# item} other {# items}}",
  },
}
