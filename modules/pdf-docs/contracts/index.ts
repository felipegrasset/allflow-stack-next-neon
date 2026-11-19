/**
 * What another module (or the app) imports from `pdf-docs`, on the server.
 *
 *   import { renderPdf, pdfResponse, savePdf } from "@/modules/pdf-docs/contracts"
 *
 *   const bytes = renderPdf({ blocks: [{ type: "title", text: "Orden 42" }] })
 *   return pdfResponse(bytes, { filename: "orden-42" })              // route handler
 *   const file = await savePdf({ definition, name: "orden-42", ownerId: userId,
 *     entity: "order", entityId: "42" })                              // -> storage file
 *
 * Neither function checks session or permission: the caller already did.
 */
import { saveFile, type StorageFile, type Visibility } from "@/modules/storage/contracts"

import { renderPdf } from "../server/render"
import { safePdfName } from "../server/response"
import type { PdfDefinition } from "../server/types"

export * from "./pdf"

export type SavePdfInput = {
  /** Either a definition to render, or the bytes of a PDF you already have. */
  definition?: PdfDefinition
  bytes?: Uint8Array
  /** File name for display and download; `.pdf` is added. */
  name: string
  /** `"user".id` of the owner, or null for a file the app owns. */
  ownerId: string | null
  /** Default "private" (storage's default). */
  visibility?: Visibility
  entity?: string
  entityId?: string
  maxBytes?: number
}

/** Renders (or takes) a PDF and stores it with `storage`. Returns the storage record (`file.url` opens it with permission checks). */
export function savePdf(input: SavePdfInput): Promise<StorageFile> {
  const data = input.bytes ?? (input.definition ? renderPdf(input.definition) : null)
  if (!data) throw new Error("savePdf: pass `definition` or `bytes`")
  return saveFile({
    data,
    name: safePdfName(input.name),
    ownerId: input.ownerId,
    visibility: input.visibility,
    entity: input.entity,
    entityId: input.entityId,
    allowedTypes: ["application/pdf"],
    maxBytes: input.maxBytes,
  })
}
