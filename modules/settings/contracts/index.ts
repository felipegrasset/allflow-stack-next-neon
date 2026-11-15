/**
 * The only thing another module may import from `settings`:
 *
 *   import { defineSetting, getSetting, setSetting } from "@/modules/settings/contracts"
 *   import { z } from "zod"
 *
 *   export const SUPPORT_EMAIL = defineSetting({
 *     key: "support.email",
 *     schema: z.email(),
 *     default: "soporte@ejemplo.cl",
 *     label: { es: "Correo de soporte", en: "Support email" },
 *   })
 *   const email = await getSetting(SUPPORT_EMAIL)      // typed: string
 *   await setSetting(SUPPORT_EMAIL, "ayuda@ejemplo.cl") // validated with the schema
 *
 * NEVER store secrets here (keys, tokens, passwords): values are plain jsonb,
 * shown in the admin screen. `getSetting` / `setSetting` / `resetSetting` are
 * server-only and do NOT check permissions: the caller decides who may use
 * them. `defineSetting` and the helpers are pure.
 */
export { getSetting, resetSetting, setSetting } from "../server/api"
export {
  SETTING_ERROR_CODES,
  SettingError,
  isSettingError,
  type SettingErrorCode,
} from "./errors"
export {
  defineSetting,
  findDefinition,
  listDefinitions,
  localize,
  type DefineSettingInput,
  type Localized,
  type SettingDefinition,
  type SettingEditor,
} from "./registry"
