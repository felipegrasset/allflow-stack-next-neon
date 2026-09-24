import { AVATAR_ACCEPT, AVATAR_MAX_UPLOAD_BYTES, AVATAR_SIZE } from "@/lib/schemas/profile"

/**
 * Browser-side avatar processing (no storage overlay in the floor): validate
 * the file BEFORE anything is uploaded, then center-crop it square and
 * resize it to 256 px on a canvas, and return a small data URL for "user".image.
 */

export type AvatarCheck = { ok: true } | { ok: false; reason: "type" | "size" }

export function checkAvatarFile(file: File): AvatarCheck {
  if (!(AVATAR_ACCEPT as readonly string[]).includes(file.type)) return { ok: false, reason: "type" }
  if (file.size > AVATAR_MAX_UPLOAD_BYTES) return { ok: false, reason: "size" }
  return { ok: true }
}

export async function toAvatarDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas 2d no disponible")
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    // WebP where supported (smallest); browsers without it return PNG → use JPEG.
    const webp = canvas.toDataURL("image/webp", 0.85)
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85)
  } finally {
    bitmap.close()
  }
}
