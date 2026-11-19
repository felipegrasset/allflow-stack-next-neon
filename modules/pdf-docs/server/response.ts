/** HTTP helpers for a rendered PDF. Pure (uses only the standard `Response`). */

/** `name.pdf`, with path characters and control characters removed; `fallback` when nothing is left. */
export function safePdfName(name: string | undefined, fallback = "documento"): string {
  const cleaned = (name ?? "")
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.]+/, "")
    .slice(0, 100)
    .trim()
  const base = (cleaned || fallback).replace(/\.pdf$/i, "") || fallback
  return `${base}.pdf`
}

function dispositionHeader(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/%/g, "_")
  const utf8 = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

/** A `Response` carrying the PDF. `download: true` forces a download instead of opening in the browser. */
export function pdfResponse(
  bytes: Uint8Array,
  options: { filename?: string; download?: boolean; status?: number } = {}
): Response {
  const body = new Uint8Array(bytes) // copy, so the Response owns a plain ArrayBuffer-backed view
  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/pdf",
      "content-length": String(body.byteLength),
      "content-disposition": dispositionHeader(options.download ? "attachment" : "inline", safePdfName(options.filename)),
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  })
}
