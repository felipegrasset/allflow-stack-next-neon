import { APP_TITLE } from "@/lib/site"

/**
 * The app's visual identity beyond colour. `logo` is a path under /public (or
 * null → the header shows the name). AllFlow's genesis writes it together
 * with public/brand/logo.*; header, auth screens and landing read it from here.
 */
export const brand: { logo: string | null; alt: string } = {
  logo: null,
  alt: APP_TITLE,
}
