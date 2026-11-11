import type { Metadata } from "next"
import { Fraunces, Inter } from "next/font/google"

import {
  ErrorState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  NoResultsState,
} from "@/modules/kit-core/contracts"

import { Plate } from "./art"
import { clp, copy } from "./copy"
import "./kit.css"

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = { title: "Atelier de Papel" }

export default function Page() {
  const { hero, collections, products, detail, cart, lookbook, newsletter } =
    copy
  const total = cart.lines.reduce((s, [, p]) => s + p, 0)
  return (
    <div className={`${fraunces.variable} ${inter.variable}`}>
      <KitTheme h={40} c={0.08}>
        <div className="ap">
          <KitHeader
            brand={<span className="ap-serif">{copy.brand}</span>}
            brandHref="/kits/atelier-de-papel"
            links={copy.links}
            actions={
              <a href="#bolsa" className="ap-link text-sm">
                Bolsa ({cart.lines.length})
              </a>
            }
          />
          <main id="contenido">
            <section className="kit-container grid gap-10 py-10 md:grid-cols-12 md:py-20">
              <div className="flex flex-col justify-center gap-6 md:col-span-7">
                <p className="ap-eyebrow">{hero.eyebrow}</p>
                <h1 className="kit-display">{hero.title}</h1>
                <p className="kit-lead">{hero.text}</p>
                <div className="flex flex-wrap gap-3">
                  <a className="ap-btn" href="#tienda">
                    {hero.cta}
                  </a>
                  <a className="ap-btn" data-variant="ghost" href="#lookbook">
                    {hero.ghost}
                  </a>
                </div>
              </div>
              <div
                className="ap-plate md:col-span-5"
                style={{ aspectRatio: "4 / 5" }}
              >
                <Plate variant={0} className="h-full" />
              </div>
            </section>

            <section
              id="colecciones"
              className="kit-container ap-rule py-12"
              aria-labelledby="ap-col"
            >
              <h2 id="ap-col" className="kit-h2">
                Colecciones
              </h2>
              <ul className="mt-8 grid gap-6 md:grid-cols-3">
                {collections.map((c) => (
                  <li key={c.name}>
                    <a href="#tienda" className="group block">
                      <div className="ap-plate">
                        <Plate variant={c.variant} />
                      </div>
                      <p className="kit-h3 ap-link mt-3">{c.name}</p>
                      <p className="ap-eyebrow mt-1">{c.count}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="tienda"
              className="kit-container ap-rule py-12"
              aria-labelledby="ap-tie"
            >
              <h2 id="ap-tie" className="kit-h2">
                Lo nuevo
              </h2>
              <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                {products.map((p) => (
                  <li key={p.name}>
                    <a href="#ficha" className="block">
                      <div className="ap-plate">
                        <Plate variant={p.variant} />
                      </div>
                      <p className="mt-3 font-medium">{p.name}</p>
                      <p className="ap-eyebrow mt-1">{p.mat}</p>
                      <p className="mt-1">{clp(p.price)}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="ficha"
              className="kit-container ap-rule grid gap-10 py-12 md:grid-cols-2"
              aria-labelledby="ap-det"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="ap-plate col-span-3">
                  <Plate variant={0} />
                </div>
                {[1, 2, 3].map((v) => (
                  <div key={v} className="ap-plate">
                    <Plate variant={v} />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-5">
                <p className="ap-eyebrow">Ficha</p>
                <h2 id="ap-det" className="kit-h1">
                  {detail.name}
                </h2>
                <p className="text-xl">{clp(detail.price)}</p>
                <p className="kit-body">{detail.desc}</p>
                <div
                  role="group"
                  aria-label="Talla"
                  className="flex flex-wrap gap-2"
                >
                  {detail.sizes.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className="ap-size"
                      aria-pressed={i === 2}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <ul className="grid gap-1 text-sm">
                  {detail.notes.map((n) => (
                    <li key={n}>— {n}</li>
                  ))}
                </ul>
                <a className="ap-btn self-start" href="#bolsa">
                  Agregar a la bolsa
                </a>
              </div>
            </section>

            <section
              id="bolsa"
              className="kit-container ap-rule py-12"
              aria-labelledby="ap-bol"
            >
              <div className="ap-drawer max-w-lg md:ml-auto">
                <h2 id="ap-bol" className="kit-h2">
                  {cart.title}
                </h2>
                <ul className="mt-4 divide-y divide-border">
                  {cart.lines.map(([n, p]) => (
                    <li key={n} className="flex justify-between gap-3 py-3">
                      <span>{n}</span>
                      <span>{clp(p)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between py-3 font-medium">
                    <span>Subtotal</span>
                    <span>{clp(total)}</span>
                  </li>
                </ul>
                <a className="ap-btn mt-4 w-full" href="#bolsa">
                  Ir a pagar
                </a>
              </div>
            </section>

            <section
              id="lookbook"
              className="kit-container ap-rule py-12"
              aria-labelledby="ap-look"
            >
              <h2 id="ap-look" className="kit-h2">
                Lookbook
              </h2>
              <ol className="mt-8 grid gap-8 md:grid-cols-3">
                {lookbook.map((t, i) => (
                  <li key={t} className="flex flex-col gap-3">
                    <div
                      className="ap-plate"
                      style={{ aspectRatio: i === 1 ? "4 / 5" : "1 / 1" }}
                    >
                      <Plate variant={i + 2} className="h-full" />
                    </div>
                    <p className="ap-serif text-lg">{t}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="kit-container ap-rule py-12"
              aria-labelledby="ap-est"
            >
              <h2 id="ap-est" className="kit-h2">
                Cuando algo no está listo
              </h2>
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <LoadingState lines={3} />
                <ErrorState retryHref="#tienda" />
                <NoResultsState
                  action={{ label: "Quitar filtros", href: "#tienda" }}
                />
              </div>
            </section>

            <section
              id="boletin"
              className="kit-container ap-rule py-16"
              aria-labelledby="ap-nl"
            >
              <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
                <h2 id="ap-nl" className="kit-h1">
                  {newsletter.title}
                </h2>
                <p className="kit-lead">{newsletter.text}</p>
                <form className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 text-left">
                    <label htmlFor="ap-mail" className="ap-eyebrow">
                      Tu correo
                    </label>
                    <input
                      id="ap-mail"
                      type="email"
                      autoComplete="email"
                      className="ap-input"
                    />
                  </div>
                  <button type="button" className="ap-btn">
                    {newsletter.button}
                  </button>
                </form>
              </div>
            </section>
          </main>
          <KitFooter
            brand={<span className="ap-serif">{copy.brand}</span>}
            tagline="Ropa lenta, cortada en Santiago."
            columns={[
              {
                title: "Tienda",
                links: [
                  { label: "Colecciones", href: "#colecciones" },
                  { label: "Lo nuevo", href: "#tienda" },
                ],
              },
              {
                title: "Taller",
                links: [
                  { label: "Lookbook", href: "#lookbook" },
                  { label: "Boletín", href: "#boletin" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
