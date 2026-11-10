import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Check, Plus, Sparkles } from "lucide-react"

import { KitFooter, KitHeader, KitTheme } from "@/modules/kit-core/contracts"

import { copy } from "./copy"
import "./kit.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = { title: "Landing de IA Nocturna" }

export default function Page() {
  const { hero, mock, logos, features, steps, plans, faq, quote, cta } = copy
  return (
    // `dark` fuerza los tokens oscuros en este árbol, aunque el sitio esté en claro.
    <div className={`dark ${inter.variable}`}>
      <KitTheme h={220} c={0.12}>
        <div className="ia">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/landing-ia-nocturna"
            links={copy.links}
            actions={
              <a className="ia-btn" href="#precios">
                {hero.primary}
              </a>
            }
          />
          <main id="contenido">
            <section className="ia-glow">
              <div className="kit-container kit-section grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                <div className="flex flex-col items-start gap-5">
                  <p className="ia-pill">
                    <Sparkles className="size-4" aria-hidden="true" />{" "}
                    {hero.eyebrow}
                  </p>
                  <h1 className="kit-h1">{hero.title}</h1>
                  <p className="kit-lead">{hero.text}</p>
                  <div className="flex flex-wrap gap-3">
                    <a className="ia-btn" href="#precios">
                      {hero.primary}
                    </a>
                    <a className="ia-btn" data-variant="ghost" href="#como">
                      {hero.secondary}
                    </a>
                  </div>
                </div>
                <div
                  className="ia-window"
                  aria-label="Maqueta de una conversación"
                >
                  <div className="ia-window__bar" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="flex flex-col gap-3 p-5">
                    <p className="ia-bubble" data-who="me">
                      {mock.question}
                    </p>
                    <p className="ia-bubble" data-who="ai">
                      {mock.answer}
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {mock.source}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="kit-container py-8"
              aria-label="Empresas que usan Lumen"
            >
              <p className="kit-eyebrow text-center">Confían en Lumen</p>
              <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
                {logos.map((l) => (
                  <li key={l} className="kit-h3 text-muted-foreground">
                    {l}
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="funciones"
              className="kit-container kit-section"
              aria-labelledby="ia-f"
            >
              <h2 id="ia-f" className="kit-h1 max-w-2xl">
                Todo lo que necesitas para confiar en una respuesta
              </h2>
              <ul className="mt-8 grid gap-4 md:grid-cols-3">
                {features.map((f) => (
                  <li
                    key={f.title}
                    className={`ia-card ${f.wide ? "md:col-span-2" : ""}`}
                  >
                    <h3 className="kit-h3">{f.title}</h3>
                    <p className="mt-2 text-muted-foreground">{f.text}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="como"
              className="kit-container kit-section"
              aria-labelledby="ia-c"
            >
              <h2 id="ia-c" className="kit-h1">
                Cómo funciona
              </h2>
              <ol className="mt-8 grid gap-6 md:grid-cols-3">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex flex-col gap-3">
                    <span className="ia-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className="kit-h3">{s.title}</h3>
                    <p className="text-muted-foreground">{s.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              id="precios"
              className="kit-container kit-section"
              aria-labelledby="ia-p"
            >
              <h2 id="ia-p" className="kit-h1">
                Precios simples
              </h2>
              <ul className="mt-8 grid gap-4 md:grid-cols-3">
                {plans.map((p) => (
                  <li
                    key={p.name}
                    className="ia-card flex flex-col gap-4"
                    data-featured={p.featured}
                  >
                    <h3 className="kit-h3">{p.name}</h3>
                    <p>
                      <span className="kit-h1">{p.price}</span>{" "}
                      <span className="text-sm text-muted-foreground">
                        {p.note}
                      </span>
                    </p>
                    <ul className="grid gap-2 text-sm">
                      {p.items.map((i) => (
                        <li key={i} className="flex gap-2">
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />{" "}
                          {i}
                        </li>
                      ))}
                    </ul>
                    <a
                      className="ia-btn mt-auto"
                      data-variant={p.featured ? undefined : "ghost"}
                      href="#cta"
                    >
                      {p.cta}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="kit-container kit-section"
              aria-labelledby="ia-q"
            >
              <h2 id="ia-q" className="sr-only">
                Lo que dicen los clientes
              </h2>
              <figure className="ia-card mx-auto max-w-3xl text-center">
                <blockquote className="kit-h2">“{quote.text}”</blockquote>
                <figcaption className="mt-4 text-sm text-muted-foreground">
                  <strong className="text-foreground">{quote.who}</strong> ·{" "}
                  {quote.role}
                </figcaption>
              </figure>
            </section>

            <section
              id="faq"
              className="kit-container kit-section max-w-3xl"
              aria-labelledby="ia-faq"
            >
              <h2 id="ia-faq" className="kit-h1">
                Preguntas frecuentes
              </h2>
              <div className="mt-6">
                {faq.map(([q, a]) => (
                  <details key={q}>
                    <summary>
                      {q}{" "}
                      <Plus className="size-4 shrink-0" aria-hidden="true" />
                    </summary>
                    <p className="mt-2 text-muted-foreground">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section id="cta" className="kit-container kit-section">
              <div className="ia-card ia-glow flex flex-col items-center gap-4 py-12 text-center">
                <h2 className="kit-h1">{cta.title}</h2>
                <p className="kit-lead">{cta.text}</p>
                <a className="ia-btn" href="#cta">
                  {cta.button}
                </a>
              </div>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Respuestas con fuente para tu equipo."
            columns={[
              {
                title: "Producto",
                links: [
                  { label: "Funciones", href: "#funciones" },
                  { label: "Precios", href: "#precios" },
                ],
              },
              {
                title: "Ayuda",
                links: [
                  { label: "Preguntas", href: "#faq" },
                  { label: "Cómo funciona", href: "#como" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
