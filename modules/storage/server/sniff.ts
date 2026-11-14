import type { AllowedType } from "../contracts/types"

/**
 * The real type of a file, from its first bytes. The browser's `type` (and the
 * extension) is whatever the client says, so it is never trusted. SVG and HTML
 * are deliberately not recognised: served from the app's origin they could
 * run script.
 */
export function sniffType(bytes: Uint8Array): AllowedType | null {
  const at = (i: number, sig: number[]) =>
    bytes.length >= i + sig.length && sig.every((b, k) => bytes[i + k] === b)
  const ascii = (i: number, s: string) =>
    at(
      i,
      [...s].map((c) => c.charCodeAt(0))
    )

  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif"
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp"
  if (ascii(0, "%PDF-")) return "application/pdf"
  return null
}

export const EXTENSIONS: Record<AllowedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}
