import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import {
  Bike,
  BookOpen,
  Heart,
  Laptop,
  MapPin,
  Armchair,
  Search,
  Send,
  Shirt,
  Baby,
  Speaker,
} from "lucide-react"

import {
  ErrorState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  NoResultsState,
} from "@/modules/kit-core/contracts"

import { clp, copy } from "./copy"
import "./kit.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })

export const metadata: Metadata = { title: "Segunda Vuelta" }

const ICON: Record<string, typeof Bike> = {
  Deportes: Bike,
  Tecnología: Laptop,
  Hogar: Armchair,
  Niños: Baby,
  Libros: BookOpen,
  Ropa: Shirt,
}

export default function Page() {
  const { cats, items, detail, chat, filters, profile } = copy
  const favs = items.filter((i) => i.fav)
  return (
    <div className={`${inter.variable} ${manrope.variable}`}>
      <KitTheme h={250} c={0.16}>
        <div className="sv">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/segunda-vuelta"
            links={[
              { label: "Explorar", href: "#explorar" },
              { label: "Favoritos", href: "#favoritos" },
              { label: "Mensajes", href: "#chat" },
            ]}
            actions={
              <a href="#publicar" className="sv-btn">
                Vender
              </a>
            }
          />
          <main
            id="contenido"
            className="kit-container flex flex-col gap-10 py-6"
          >
            <section
              id="explorar"
              aria-labelledby="sv-h"
              className="flex flex-col gap-4"
            >
              <h1 id="sv-h" className="kit-h1">
                Lo que otros ya no usan, a buen precio
              </h1>
              <form role="search" className="flex gap-2">
                <label htmlFor="sv-q" className="sr-only">
                  Buscar en Segunda Vuelta
                </label>
                <input
                  id="sv-q"
                  className="sv-input"
                  placeholder="Busca bicicleta, sofá, notebook…"
                />
                <button type="button" className="sv-btn" aria-label="Buscar">
                  <Search className="size-5" aria-hidden="true" />
                </button>
              </form>
              <div className="sv-scroll" role="group" aria-label="Categorías">
                {cats.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    className="sv-chip"
                    aria-pressed={i === 0}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {items.map((it) => {
                  const Icon = ICON[it.cat] ?? Speaker
                  return (
                    <li key={it.name} className="sv-card p-2">
                      <div className="sv-thumb">
                        <Icon className="size-10" aria-hidden="true" />
                        <button
                          type="button"
                          className="sv-fav"
                          aria-label={`Guardar ${it.name}`}
                          aria-pressed={it.fav}
                        >
                          <Heart
                            className={`size-5 ${it.fav ? "fill-current" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      <div className="p-1 pt-2">
                        <p className="text-lg font-bold">{clp(it.price)}</p>
                        <h2 className="text-sm leading-snug">{it.name}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {it.where} · {it.ago}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section
              aria-labelledby="sv-det"
              className="sv-card grid gap-6 p-4 md:grid-cols-2 md:p-6"
            >
              <div className="sv-thumb" style={{ aspectRatio: "4 / 3" }}>
                <Bike className="size-20" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-3xl font-extrabold">{clp(detail.price)}</p>
                <h2 id="sv-det" className="kit-h2">
                  {detail.name}
                </h2>
                <p>{detail.desc}</p>
                <dl className="grid gap-2 text-sm">
                  {detail.facts.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-3 border-b border-border pb-2"
                    >
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4" aria-hidden="true" />{" "}
                  {detail.seller.name} · {detail.seller.note}
                </p>
                <a href="#chat" className="sv-btn">
                  Escribir al vendedor
                </a>
              </div>
            </section>

            <section
              id="chat"
              aria-labelledby="sv-chat"
              className="sv-card flex flex-col gap-3 p-4 md:p-6"
            >
              <h2 id="sv-chat" className="kit-h2">
                Chat con el vendedor
              </h2>
              <ul className="flex flex-col gap-2">
                {chat.map((m) => (
                  <li key={m.text} className="sv-bubble" data-who={m.who}>
                    {m.text}
                  </li>
                ))}
              </ul>
              <form className="mt-2 flex gap-2">
                <label htmlFor="sv-msg" className="sr-only">
                  Tu mensaje
                </label>
                <input
                  id="sv-msg"
                  className="sv-input"
                  placeholder="Escribe un mensaje"
                />
                <button type="button" className="sv-btn" aria-label="Enviar">
                  <Send className="size-5" aria-hidden="true" />
                </button>
              </form>
            </section>

            <section
              id="publicar"
              aria-labelledby="sv-pub"
              className="sv-card p-4 md:p-6"
            >
              <h2 id="sv-pub" className="kit-h2">
                Publica en un minuto
              </h2>
              <form className="mt-4 grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["Título", "sv-t", "Ej.: Bicicleta aro 26"],
                    ["Precio", "sv-p", "$"],
                  ] as const
                ).map(([l, id, ph]) => (
                  <div key={id} className="grid gap-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {l}
                    </label>
                    <input id={id} className="sv-input" placeholder={ph} />
                  </div>
                ))}
                <div className="grid gap-1 md:col-span-2">
                  <label htmlFor="sv-d" className="text-sm font-medium">
                    Descripción
                  </label>
                  <textarea id="sv-d" rows={3} className="sv-input py-2" />
                </div>
                <button type="button" className="sv-btn md:col-span-2">
                  Publicar gratis
                </button>
              </form>
            </section>

            <section
              id="favoritos"
              aria-labelledby="sv-fav"
              className="flex flex-col gap-3"
            >
              <h2 id="sv-fav" className="kit-h2">
                Tus favoritos
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {favs.map((f) => (
                  <li
                    key={f.name}
                    className="sv-card flex items-center gap-3 p-3"
                  >
                    <span
                      className="sv-thumb size-16 shrink-0"
                      style={{ aspectRatio: "1 / 1" }}
                    >
                      <Heart
                        className="size-6 fill-current"
                        aria-hidden="true"
                      />
                    </span>
                    <p>
                      <strong className="block">{f.name}</strong>
                      <span className="text-sm text-muted-foreground">
                        {clp(f.price)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-labelledby="sv-perfil"
              className="sv-card flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-6"
            >
              <span
                className="sv-thumb size-20 shrink-0 text-2xl font-extrabold"
                aria-hidden="true"
              >
                PM
              </span>
              <div>
                <h2 id="sv-perfil" className="kit-h2">
                  {profile.name}
                </h2>
                <p className="text-sm text-muted-foreground">{profile.since}</p>
              </div>
              <ul className="flex gap-6 md:ml-auto">
                {profile.stats.map(([v, l]) => (
                  <li key={l} className="text-center">
                    <strong className="block text-xl">{v}</strong>
                    <span className="text-xs text-muted-foreground">{l}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-labelledby="sv-fil"
              className="mx-auto w-full max-w-md"
            >
              <h2 id="sv-fil" className="sr-only">
                Filtros en hoja
              </h2>
              <div className="sv-sheet">
                <div className="sv-grab" aria-hidden="true" />
                <p className="kit-h3">{filters.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {filters.range}
                </p>
                <ul className="mt-3 grid gap-2">
                  {filters.options.map((o, i) => (
                    <li key={o}>
                      <label className="flex min-h-11 items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked={i === 0}
                          className="size-5 accent-primary"
                        />{" "}
                        {o}
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="button" className="sv-btn mt-4 w-full">
                  Ver 128 resultados
                </button>
              </div>
            </section>

            <section aria-labelledby="sv-est" className="flex flex-col gap-4">
              <h2 id="sv-est" className="kit-h2">
                Cuando algo no sale como esperabas
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <LoadingState lines={3} />
                <ErrorState retryHref="#explorar" />
                <NoResultsState
                  action={{ label: "Quitar filtros", href: "#explorar" }}
                />
              </div>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Compra y vende entre vecinos, sin comisión."
            columns={[
              {
                title: "Explorar",
                links: [
                  { label: "Categorías", href: "#explorar" },
                  { label: "Favoritos", href: "#favoritos" },
                ],
              },
              {
                title: "Vender",
                links: [
                  { label: "Publicar", href: "#publicar" },
                  { label: "Mensajes", href: "#chat" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
