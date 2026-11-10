import type { Locale } from "../contracts"

import { en } from "./en"
import { es } from "./es"
import type { Messages } from "./types"

export type { Messages }
/** Every locale's catalog, keyed by locale. `Record<Locale, …>` makes adding a locale without a catalog a type error. */
export const messages: Record<Locale, Messages> = { es, en }
export { es }
