/**
 * Which push endpoints the server will POST to. The endpoint comes from the
 * browser, so without a check a signed-in person could make the server send
 * requests to any URL (SSRF). Only HTTPS, default port, no credentials, and a
 * host of a known push service.
 */

/** Hosts (exact) and host suffixes (leading dot) of the browsers' push services. */
export const PUSH_SERVICE_HOSTS: readonly string[] = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium on Android), Opera, Brave, Samsung Internet
  "android.googleapis.com", // legacy GCM endpoints still handed out by some Chromium builds
  ".push.services.mozilla.com", // Firefox (updates.push.services.mozilla.com)
  ".push.apple.com", // Safari on macOS and iOS/iPadOS home-screen apps (web.push.apple.com)
  ".notify.windows.com", // Edge on Windows (WNS)
]

export const MAX_ENDPOINT_LENGTH = 2048

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase()
  return allowed.some((a) => (a.startsWith(".") ? h.endsWith(a) && h.length > a.length : h === a))
}

/** The parsed endpoint when it is acceptable; `null` otherwise. */
export function checkEndpoint(raw: string, allowed: readonly string[] = PUSH_SERVICE_HOSTS): URL | null {
  if (raw.length === 0 || raw.length > MAX_ENDPOINT_LENGTH) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:") return null
  if (url.username || url.password || url.port) return null
  if (!hostAllowed(url.hostname, allowed)) return null
  return url
}

/** What a log line may say about an endpoint: its host only (the full URL is a bearer capability). */
export function endpointHost(raw: string): string {
  try {
    return new URL(raw).hostname
  } catch {
    return "invalid"
  }
}
