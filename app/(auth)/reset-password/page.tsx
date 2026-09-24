import { redirect } from "next/navigation"

/**
 * Better Auth's own callback (/api/auth/reset-password/<token>?callbackURL=
 * /reset-password) lands here with ?token= or ?error=. The emails already point
 * to /reset-password/<token>; this only keeps the API link working too.
 */
export default async function ResetPasswordRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  redirect(token ? `/reset-password/${encodeURIComponent(token)}` : "/reset-password/invalido")
}
