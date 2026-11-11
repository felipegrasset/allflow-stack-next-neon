import type { Metadata } from "next"
import { Inter, Lexend } from "next/font/google"
import {
  Check,
  CloudOff,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import {
  ErrorState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
} from "@/modules/kit-core/contracts"

import { Plans } from "./billing"
import { copy } from "./copy"
import "./kit.css"

const lexend = Lexend({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-lexend" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = { title: "Producto y suscripción" }

const INCLUDE_ICONS = [FileText, Check, RefreshCw, Download]

export default function Page() {
  const { hero, mock, includes, guarantee, faq } = copy
  return (
    <div className={`${lexend.variable} ${inter.variable}`}>
      <KitTheme h={175} c={0.12}>
        <div className="ps">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/producto-suscripcion"
            links={copy.links}
            actions={
              <a href="#planes" className="ps-btn">
                Probar gratis
              </a>
            }
          />
          <main id="contenido">
            <section className="ps-band">
              <div className="kit-container kit-section grid gap-10 lg:grid-cols-2 lg:items-center">
                <div className="flex flex-col items-start gap-5">
                  <p
                    className="kit-eyebrow"
                    style={{ color: "var(--kit-tint-fg)" }}
                  >
                    {hero.eyebrow}
                  </p>
                  <h1 className="kit-display">{hero.title}</h1>
                  <p
                    className="kit-lead"
                    style={{ color: "var(--kit-tint-fg)" }}
                  >
                    {hero.text}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href="#planes" className="ps-btn">
                      {hero.cta}
                    </a>
                    <a href="#planes" className="ps-btn" data-variant="ghost">
                      {hero.ghost}
                    </a>
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--kit-tint-fg)" }}
                  >
                    {hero.note}
                  </p>
                </div>
                <div className="ps-app" aria-label="Maqueta de la app">
                  <p className="kit-h3">{mock.title}</p>
                  <ul className="mt-3 grid gap-3">
                    {mock.tasks.map(([t, d]) => (
                      <li key={t} className="flex items-center gap-3">
                        <span className="ps-check" data-done={d}>
                          {d ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : null}
                        </span>
                        <span
                          className={
                            d ? "text-muted-foreground line-through" : ""
                          }
                        >
                          {t}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-(--kit-radius-md) bg-muted p-3 text-sm text-muted-foreground">
                    {mock.note}
                  </p>
                </div>
              </div>
            </section>

            <section
              id="incluye"
              className="kit-container kit-section"
              aria-labelledby="ps-inc"
            >
              <h2 id="ps-inc" className="kit-h1">
                Qué incluye
              </h2>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                {includes.map(([t, d], i) => {
                  const Icon = INCLUDE_ICONS[i]
                  return (
                    <li key={t} className="flex gap-4">
                      <span className="ps-icon">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="kit-h3">{t}</h3>
                        <p className="mt-1 text-muted-foreground">{d}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section id="planes" className="ps-band">
              <div
                className="kit-container kit-section"
                aria-labelledby="ps-pl"
              >
                <h2 id="ps-pl" className="kit-h1">
                  Elige tu plan
                </h2>
                <div className="mt-6">
                  <Plans />
                </div>
              </div>
            </section>

            <section
              className="kit-container kit-section"
              aria-labelledby="ps-gar"
            >
              <div className="ps-card flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <span className="ps-icon">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="ps-gar" className="kit-h3">
                    {guarantee.title}
                  </h2>
                  <p className="text-muted-foreground">{guarantee.text}</p>
                </div>
              </div>
            </section>

            <section
              id="faq"
              className="kit-container max-w-3xl pb-16"
              aria-labelledby="ps-faq"
            >
              <h2 id="ps-faq" className="kit-h1">
                Preguntas frecuentes
              </h2>
              <div className="mt-4">
                {faq.map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p className="mt-2 text-muted-foreground">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="kit-container pb-16" aria-labelledby="ps-est">
              <h2 id="ps-est" className="kit-h2">
                Cuando el cobro no está listo
              </h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <LoadingState title="Cargando precios" lines={3} />
                <ErrorState
                  title="No pudimos cargar los precios"
                  description="No es tu culpa: no pudimos contactar al proveedor de pagos."
                  retryHref="#planes"
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CloudOff className="size-4" aria-hidden="true" /> Muestra estos
                estados mientras el proveedor de pagos responde o si falla.
              </p>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Notas y tareas que se quedan contigo."
            columns={[
              {
                title: "Producto",
                links: [
                  { label: "Qué incluye", href: "#incluye" },
                  { label: "Planes", href: "#planes" },
                ],
              },
              { title: "Ayuda", links: [{ label: "Preguntas", href: "#faq" }] },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
