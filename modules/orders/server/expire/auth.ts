import { createHash, timingSafeEqual } from "node:crypto"

/**
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends). Constant
 * time (SHA-256 of both sides). No secret, or one shorter than 16 chars,
 * means "not configured": the caller answers 503 and runs nothing.
 * Pure (node:crypto only): tested directly.
 */
export function checkCronAuth(header: string | null, secret: string | undefined): "ok" | "unauthorized" | "not_configured" {
  if (!secret || secret.length < 16) return "not_configured"
  const given = header?.startsWith("Bearer ") ? header.slice(7) : ""
  const a = createHash("sha256").update(given).digest()
  const b = createHash("sha256").update(secret).digest()
  return given.length > 0 && timingSafeEqual(a, b) ? "ok" : "unauthorized"
}
