import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() → app/forbidden.tsx with a real 403 (auth kit, T2). Still
    // experimental in Next 16.3; if it is removed, switch requireAdmin() in
    // server/session.ts to redirect("/403").
    authInterrupts: true,
  },
}

export default nextConfig
