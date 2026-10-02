import { Geist as HeadingFont } from "next/font/google"
import { Geist as BodyFont } from "next/font/google"
import { Geist_Mono } from "next/font/google"

/**
 * The three typefaces. next/font needs literal arguments and a named import
 * per family, so Forge picks the families by rewriting the first two import
 * lines (see allflow.sentinels.json); everything else here is fixed. Both
 * `weight` arrays are listed so non-variable families (IBM Plex) also build.
 */
export const heading = HeadingFont({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading-face",
})
export const body = BodyFont({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})
export const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
