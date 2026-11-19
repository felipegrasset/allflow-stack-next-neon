/**
 * The module's catalog (entrypoint `messages`). Data only: plain object
 * literals of string literals, and no runtime import. The only top-level key
 * is the module id, so every key is `ping.…` (the nav label is "ping.nav").
 * `es` is the source (`as const`: the copy object reads the ICU arguments from
 * its literal types); `en` has exactly its keys and its arguments.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  ping: {
    nav: "Ping",
    title: "Pings",
    empty: "Todavía no hay pings.",
    header: {
      count: "{n, plural, =0 {Sin pings} one {# ping} other {# pings}}",
      who: "Pings vistos por {name}",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  ping: {
    nav: "Ping",
    title: "Pings",
    empty: "No pings yet.",
    header: {
      count: "{n, plural, =0 {No pings} one {# ping} other {# pings}}",
      who: "Pings seen by {name}",
    },
  },
}
