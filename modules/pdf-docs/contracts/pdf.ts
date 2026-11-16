/**
 * The pure half of `pdf-docs`: importable from anywhere (server, tests). No
 * database, no storage.
 *
 *   import { renderPdf, pdfResponse } from "@/modules/pdf-docs/contracts/pdf"
 */
export { renderPdf } from "../server/render"
export { pdfResponse, safePdfName } from "../server/response"
export { wrapText, PAGE_SIZES, MAX_PAGES } from "../server/layout"
export { orderTemplate, certificateTemplate, type OrderExample, type CertificateExample } from "../server/templates"
export type { Align, PageSize, PdfBlock, PdfDefinition, Rgb } from "../server/types"
