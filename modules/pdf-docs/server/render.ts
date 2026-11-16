import { layoutDocument } from "./layout"
import { buildPdf } from "./pdf-writer"
import type { PdfDefinition } from "./types"

/** Renders a declarative definition to the bytes of a PDF 1.4 file. Pure and synchronous. */
export function renderPdf(definition: PdfDefinition): Uint8Array {
  const pages = layoutDocument(definition)
  return buildPdf(pages, {
    title: definition.title,
    author: definition.author,
    subject: definition.subject,
    createdAt: definition.createdAt,
  })
}
