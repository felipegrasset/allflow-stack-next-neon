import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// i18n module (modules/i18n): per-request locale and catalog.
const withNextIntl = createNextIntlPlugin("./modules/i18n/request.ts")

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() → app/forbidden.tsx with a real 403 (auth kit, T2). Still
    // experimental in Next 16.3; if it is removed, switch requireAdmin() in
    // server/session.ts to redirect("/403").
    authInterrupts: true,
  },
}

export default withNextIntl(nextConfig)
