import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

import { kitCopy } from "./copy"
import "./kit-core.css"

export type KitLink = { label: string; href: string }

/**
 * Encabezado de un kit: marca a la izquierda, navegación y un espacio para
 * acciones (botón de ingreso, carrito, selector de tema) a la derecha.
 * `current` marca el enlace activo con aria-current="page".
 */
export function KitHeader({
  brand,
  brandHref = "/",
  links = [],
  current,
  actions,
  navLabel = kitCopy.nav.label,
  className,
}: {
  brand: ReactNode
  brandHref?: string
  links?: KitLink[]
  current?: string
  actions?: ReactNode
  navLabel?: string
  className?: string
}) {
  return (
    <header className={cn("kit-header", className)}>
      <div className="kit-container kit-header__bar">
        <Link href={brandHref} className="kit-header__brand">
          {brand}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {links.length ? (
            <nav className="kit-header__nav" aria-label={navLabel}>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={l.href === current ? "page" : undefined}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  )
}

export type KitFooterColumn = { title: string; links: KitLink[] }

/**
 * Pie de un kit: bloque de marca + hasta 4 columnas de enlaces + línea legal.
 * Los enlaces son del kit; el núcleo no inventa páginas.
 */
export function KitFooter({
  brand,
  tagline,
  columns = [],
  legal = kitCopy.footer.legal,
  navLabel = kitCopy.nav.footerLabel,
  className,
}: {
  brand: ReactNode
  tagline?: ReactNode
  columns?: KitFooterColumn[]
  legal?: ReactNode
  navLabel?: string
  className?: string
}) {
  return (
    <footer
      className={cn("kit-footer", className)}
      style={
        {
          "--kit-footer-cols": Math.min(Math.max(columns.length, 1), 4),
        } as CSSProperties
      }
    >
      <div className="kit-container">
        <div className="kit-footer__grid">
          <div>
            <p className="kit-header__brand">{brand}</p>
            {tagline ? <p className="mt-2 max-w-[36ch]">{tagline}</p> : null}
          </div>
          {columns.slice(0, 4).map((c) => (
            <nav key={c.title} aria-label={`${navLabel}: ${c.title}`}>
              <p className="kit-footer__title">{c.title}</p>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="kit-footer__legal">{legal}</div>
      </div>
    </footer>
  )
}

/**
 * Sección con su propia marca: `<KitTheme h={30} c={0.14}>…</KitTheme>`.
 * Solo para galerías y comparaciones; la marca de la app no se toca desde acá.
 */
export function KitTheme({
  h,
  c,
  children,
  className,
}: {
  h: number
  c: number
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("kit-theme", className)}
      style={{ "--brand-h": h, "--brand-c": c } as CSSProperties}
    >
      {children}
    </div>
  )
}
