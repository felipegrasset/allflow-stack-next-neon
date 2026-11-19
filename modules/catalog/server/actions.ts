"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import {
  catalogSchemas,
  toItemData,
  type CategoryFormValues,
  type ItemFormValues,
  type PhotoFormValues,
  type StockMoveFormValues,
} from "../contracts/input"
import { StockError } from "../contracts/types"
import { es } from "../messages"
import { actionSession } from "./guard"
import { attachPhoto, removePhoto } from "./photos"
import { adjustStock } from "./stock"
import {
  SkuTakenError,
  SlugTakenError,
  createCategory,
  createItem,
  getItem,
  updateItem,
} from "./store"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and `item:write` with `actionSession` BEFORE touching data, (2) validates
 * its input again with the same Zod schema as the form, (3) only then writes.
 */

const idOk = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 100

function fieldErrors<K extends string>(error: z.ZodError): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out)) out[key as K] = issue.message
  }
  return out
}

async function texts() {
  const copy = await getModuleCopy(es)
  return { copy, schemas: catalogSchemas(copy.validation) }
}

function revalidateItem(id: string, slug?: string) {
  revalidatePath("/catalog")
  revalidatePath(`/catalog/${id}`)
  revalidatePath("/productos")
  if (slug) revalidatePath(`/productos/${slug}`)
}

export async function createCategoryAction(
  values: CategoryFormValues
): Promise<FormResult<keyof CategoryFormValues>> {
  const session = await actionSession("/catalog", "write")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const parsed = schemas.categorySchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    await createCategory(getKysely(), parsed.data)
    revalidatePath("/catalog")
    revalidatePath("/productos")
    return { ok: true, message: copy.actions.categoryCreated }
  } catch (err) {
    if (err instanceof SlugTakenError)
      return { ok: false, fieldErrors: { slug: copy.validation.slugTaken } }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function createItemAction(
  values: ItemFormValues
): Promise<FormResult<keyof ItemFormValues>> {
  const session = await actionSession("/catalog", "write")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const parsed = schemas.itemSchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const item = await createItem(getKysely(), toItemData(parsed.data), {
      initialStock: parsed.data.initialStock === "" ? 0 : Number(parsed.data.initialStock),
      createdBy: session.user.id,
    })
    revalidateItem(item.id, item.slug)
    return { ok: true, redirectTo: `/catalog/${item.id}` }
  } catch (err) {
    if (err instanceof SlugTakenError)
      return { ok: false, fieldErrors: { slug: copy.validation.slugTaken } }
    if (err instanceof SkuTakenError)
      return { ok: false, fieldErrors: { sku: copy.validation.skuTaken } }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function updateItemAction(
  id: string,
  values: ItemFormValues
): Promise<FormResult<keyof ItemFormValues>> {
  const session = await actionSession("/catalog", "write")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(id)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.itemSchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const item = await updateItem(getKysely(), id, toItemData(parsed.data))
    if (!item) return { ok: false, formError: copy.errors.notFound }
    revalidateItem(item.id, item.slug)
    return { ok: true, message: copy.actions.saved }
  } catch (err) {
    if (err instanceof SlugTakenError)
      return { ok: false, fieldErrors: { slug: copy.validation.slugTaken } }
    if (err instanceof SkuTakenError)
      return { ok: false, fieldErrors: { sku: copy.validation.skuTaken } }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function adjustStockAction(
  itemId: string,
  values: StockMoveFormValues
): Promise<FormResult<keyof StockMoveFormValues>> {
  const session = await actionSession("/catalog", "write")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(itemId)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.stockMoveSchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    await adjustStock(getKysely(), {
      itemId,
      qty: Number(parsed.data.qty),
      reason: parsed.data.reason,
      note: parsed.data.note,
      createdBy: session.user.id,
    })
    revalidateItem(itemId)
    return { ok: true, message: copy.actions.stockSaved }
  } catch (err) {
    if (err instanceof StockError) {
      if (err.code === "insufficient_stock")
        return { ok: false, fieldErrors: { qty: copy.validation.belowZero(err.available ?? 0) } }
      if (err.code === "item_not_found") return { ok: false, formError: copy.errors.notFound }
      return { ok: false, formError: copy.errors.untracked }
    }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function addPhotoAction(
  itemId: string,
  values: PhotoFormValues
): Promise<FormResult<keyof PhotoFormValues>> {
  const session = await actionSession("/catalog", "write")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(itemId)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.photoSchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const item = await getItem(getKysely(), itemId)
    if (!item) return { ok: false, formError: copy.errors.notFound }
    const file = await attachPhoto({
      fileId: parsed.data.fileId,
      ownerId: session.user.id,
      itemId,
    })
    if (!file) return { ok: false, fieldErrors: { fileId: copy.validation.photo } }
    revalidateItem(itemId, item.slug)
    return { ok: true, message: copy.actions.photoAdded }
  } catch {
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function removePhotoAction(
  itemId: string,
  fileId: string
): Promise<FormResult<never>> {
  const session = await actionSession("/catalog", "write")
  const { copy } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(itemId) || !idOk(fileId)) return { ok: false, formError: copy.errors.notFound }
  try {
    const item = await getItem(getKysely(), itemId)
    if (!item) return { ok: false, formError: copy.errors.notFound }
    const removed = await removePhoto({ fileId, itemId })
    if (!removed) return { ok: false, formError: copy.errors.photoForbidden }
    revalidateItem(itemId, item.slug)
    return { ok: true, message: copy.actions.photoRemoved }
  } catch {
    return { ok: false, formError: copy.errors.generic }
  }
}
