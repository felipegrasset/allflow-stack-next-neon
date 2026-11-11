import type { Metadata } from "next"
import { Outfit } from "next/font/google"

import { KitFooter, KitHeader, KitTheme } from "@/modules/kit-core/contracts"

import { copy } from "./copy"
import "./kit.css"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })

export const metadata: Metadata = { title: "Estudio Contraste" }

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")

export default function Page() {
  const { hero, services, cases, steps, team, plans, quotes, form } = copy
  return (
    <div className={outfit.variable}>
      <KitTheme h={25} c={0.2}>
        <div className="ec">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/estudio-contraste"
            links={copy.links}
            actions={
              <a className="ec-btn" href="#contacto">
                Cotizar
              </a>
            }
          />
          <main id="contenido">
            <section className="kit-container kit-section">
              <p className="ec-tag">{hero.eyebrow}</p>
              <h1 className="kit-display mt-5 max-w-4xl">{hero.title}</h1>
              <p
                className="kit-lead ec-soft mt-5"
                style={{ color: "var(--ec-ink-soft)" }}
              >
                {hero.text}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a className="ec-btn" href="#contacto">
                  {hero.cta}
                </a>
                <a className="ec-btn" data-variant="ghost" href="#casos">
                  {hero.ghost}
                </a>
              </div>
            </section>

            <section
              id="servicios"
              className="kit-container kit-section"
              aria-labelledby="ec-s"
            >
              <h2 id="ec-s" className="kit-h1">
                Qué hacemos
              </h2>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {services.map(([t, d], i) => (
                  <li key={t} className="ec-box p-6">
                    <p className="ec-bignum" aria-hidden="true">
                      0{i + 1}
                    </p>
                    <h3 className="kit-h3 mt-3">{t}</h3>
                    <p className="mt-2">{d}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="casos"
              className="kit-container kit-section"
              aria-labelledby="ec-c"
            >
              <h2 id="ec-c" className="kit-h1">
                Casos que hablan solos
              </h2>
              <ul className="mt-8 grid gap-5 md:grid-cols-3">
                {cases.map((c, i) => (
                  <li
                    key={c.name}
                    className="ec-box flex flex-col gap-3 p-6"
                    data-featured={i === 0}
                  >
                    <p className="ec-tag">{c.kind}</p>
                    <h3 className="kit-h2">{c.name}</h3>
                    <p>{c.result}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="proceso"
              className="kit-container kit-section"
              aria-labelledby="ec-p"
            >
              <h2 id="ec-p" className="kit-h1">
                Cuatro pasos, sin sorpresas
              </h2>
              <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map(([t, d], i) => (
                  <li
                    key={t}
                    className="flex flex-col gap-2 border-t-2 border-(--ec-ink) pt-4"
                  >
                    <span className="ec-bignum" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className="kit-h3">{t}</h3>
                    <p className="ec-soft">{d}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="kit-container kit-section"
              aria-labelledby="ec-t"
            >
              <h2 id="ec-t" className="kit-h1">
                Quiénes somos
              </h2>
              <ul className="mt-8 grid gap-5 sm:grid-cols-3">
                {team.map(([n, r]) => (
                  <li key={n} className="flex items-center gap-4">
                    <span className="ec-avatar" aria-hidden="true">
                      {initials(n)}
                    </span>
                    <p>
                      <strong className="block">{n}</strong>
                      <span className="ec-soft">{r}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="precios"
              className="kit-container kit-section"
              aria-labelledby="ec-pr"
            >
              <h2 id="ec-pr" className="kit-h1">
                Precios claros
              </h2>
              <ul className="mt-8 grid gap-5 md:grid-cols-3">
                {plans.map((p) => (
                  <li
                    key={p.name}
                    className="ec-box flex flex-col gap-4 p-6"
                    data-featured={p.featured ?? false}
                  >
                    <h3 className="kit-h2">{p.name}</h3>
                    <p className="kit-h1">{p.price}</p>
                    <ul className="grid gap-1">
                      {p.items.map((i) => (
                        <li key={i}>— {i}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="kit-container kit-section"
              aria-labelledby="ec-q"
            >
              <h2 id="ec-q" className="kit-h1">
                Lo que dicen
              </h2>
              <ul className="mt-8 grid gap-5 md:grid-cols-2">
                {quotes.map(([q, w]) => (
                  <li key={w}>
                    <figure className="ec-box p-6">
                      <blockquote className="kit-h3">“{q}”</blockquote>
                      <figcaption className="ec-soft mt-3 text-sm">
                        {w}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="contacto"
              className="kit-container kit-section"
              aria-labelledby="ec-f"
            >
              <div className="ec-box grid gap-8 p-6 md:grid-cols-2 md:p-10">
                <div>
                  <h2 id="ec-f" className="kit-h1">
                    {form.title}
                  </h2>
                  <p className="ec-soft mt-3">{form.note}</p>
                </div>
                <form className="grid gap-4">
                  {(
                    [
                      ["Nombre", "name", "text"],
                      ["Correo", "email", "email"],
                    ] as const
                  ).map(([l, ac, t]) => (
                    <div key={ac} className="grid gap-1">
                      <label htmlFor={`ec-${ac}`} className="font-semibold">
                        {l}
                      </label>
                      <input
                        id={`ec-${ac}`}
                        type={t}
                        autoComplete={ac}
                        className="ec-field"
                      />
                    </div>
                  ))}
                  <div className="grid gap-1">
                    <label htmlFor="ec-msg" className="font-semibold">
                      Tu proyecto
                    </label>
                    <textarea id="ec-msg" rows={3} className="ec-field" />
                  </div>
                  <button type="button" className="ec-btn">
                    {form.button}
                  </button>
                </form>
              </div>
            </section>

            <section
              className="kit-container kit-section text-center"
              aria-labelledby="ec-cta"
            >
              <h2 id="ec-cta" className="kit-display">
                {copy.cta}
              </h2>
              <a className="ec-btn mt-6" href="#contacto">
                {hero.cta}
              </a>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Estudio de marca y web. Valparaíso."
            columns={[
              {
                title: "Estudio",
                links: [
                  { label: "Servicios", href: "#servicios" },
                  { label: "Casos", href: "#casos" },
                ],
              },
              {
                title: "Contacto",
                links: [
                  { label: "Cotizar", href: "#contacto" },
                  { label: "Precios", href: "#precios" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
