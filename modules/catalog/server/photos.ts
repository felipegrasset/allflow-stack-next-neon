/**
 * Product photos live in `storage` (`entity: "catalog_item"`, public, so the
 * public pages can show them without a session). Only through its contract.
 */
import {
  attachFile,
  canAccessFile,
  deleteFile,
  getFile,
  listFilesFor,
  type StorageFile,
} from "@/modules/storage/contracts"

import { CATALOG_PHOTO_ENTITY } from "../contracts/types"

const isImage = (f: StorageFile) => f.contentType.startsWith("image/")

/** The photos of an item, in the order they were added (the first one is the cover). */
export async function listPhotos(itemId: string): Promise<StorageFile[]> {
  return (await listFilesFor(CATALOG_PHOTO_ENTITY, itemId)).filter(isImage)
}

/** Cover photo per item (first photo), for grids. One query per item: fine for a page of ≤ 60. */
export async function coverPhotos(itemIds: readonly string[]): Promise<Map<string, StorageFile>> {
  const out = new Map<string, StorageFile>()
  const lists = await Promise.all(itemIds.map((id) => listPhotos(id)))
  itemIds.forEach((id, i) => {
    const first = lists[i][0]
    if (first) out.set(id, first)
  })
  return out
}

/**
 * Links an image the person uploaded (still unattached) to the item, as public.
 * null if it is not theirs, is already attached elsewhere, or is not an image.
 */
export async function attachPhoto(input: {
  fileId: string
  ownerId: string
  itemId: string
}): Promise<StorageFile | null> {
  const file = await getFile(input.fileId)
  if (!file || !isImage(file)) return null
  return attachFile({
    fileId: input.fileId,
    ownerId: input.ownerId,
    entity: CATALOG_PHOTO_ENTITY,
    entityId: input.itemId,
    visibility: "public",
  })
}

/**
 * Removes a photo of THIS item. The caller already checked `item:write`;
 * storage's own rule (`canAccessFile(…, "delete")`: the uploader or an admin)
 * applies on top. false when it is not a photo of the item or not allowed.
 */
export async function removePhoto(input: { fileId: string; itemId: string }): Promise<boolean> {
  const file = await getFile(input.fileId)
  if (!file || file.entity !== CATALOG_PHOTO_ENTITY || file.entityId !== input.itemId) return false
  if (!(await canAccessFile(input.fileId, "delete"))) return false
  return deleteFile(input.fileId)
}
