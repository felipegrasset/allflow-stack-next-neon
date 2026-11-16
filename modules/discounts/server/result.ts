import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import type { DiscountErrorCode } from "../contracts/types"
import { es } from "../messages"

/** A failed action, with the translated text of `code` (never a raw error message). */
export async function fail<K extends string>(
  code: DiscountErrorCode,
  fieldErrors?: Partial<Record<K, string>>
): Promise<FormResult<K>> {
  const copy = await getModuleCopy(es)
  return { ok: false, formError: copy.errors[code], fieldErrors }
}
