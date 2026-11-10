import type { Metadata } from "next"
import { IBM_Plex_Mono, Outfit } from "next/font/google"

import {
  ErrorState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  EmptyState,
} from "@/modules/kit-core/contracts"

import { Piece } from "./art"
import { clp, copy } from "./copy"
import "./kit.css"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
})

export const metadata: Metadata = { title: "Hecho a Mano" }

export default function Page() {
  const { hero, projects, shop, about, rates, gallery, newsletter } = copy
  return (
    <div className={`${outfit.variable} ${plex.variable}`}>
      <KitTheme h={40} c={0.18}>
        <div className="hm">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/hecho-a-mano"
            links={copy.links}
            actions={
              <a className="hm-btn" href="#contacto">
                Escríbeme
              </a>
            }
          />
          <main
            id="contenido"
            className="kit-container flex flex-col gap-16 py-8 md:py-12"
          >
            <section className="hm-hero grid gap-8 p-6 md:grid-cols-5 md:p-10">
              <div className="flex flex-col items-start gap-5 md:col-span-3">
                <p className="hm-sticker hm-mono">{hero.tag}</p>
                <h1 className="kit-h1">{hero.title}</h1>
                <p className="kit-lead" style={{ color: "inherit" }}>
                  {hero.text}
                </p>
                <div className="flex flex-wrap gap-3">
                  <a className="hm-btn" href="#proyectos">
                    {hero.cta}
                  </a>
                  <a className="hm-btn" data-variant="ghost" href="#contacto">
                    {hero.ghost}
                  </a>
                </div>
              </div>
              <div
                className="hm-card md:col-span-2"
                style={{ transform: "rotate(2deg)" }}
              >
                <Piece variant={0} />
              </div>
            </section>

            <section id="proyectos" aria-labelledby="hm-pro">
              <h2 id="hm-pro" className="kit-h1">
                Proyectos
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {projects.map((p) => (
                  <li key={p.name} className="hm-card">
                    <Piece variant={p.variant} />
                    <div className="border-t-[3px] border-foreground p-4">
                      <p className="hm-mono text-muted-foreground">
                        {p.kind} · {p.year}
                      </p>
                      <h3 className="kit-h3 mt-1">{p.name}</h3>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section id="tienda" aria-labelledby="hm-tie">
              <h2 id="hm-tie" className="kit-h1">
                Tienda
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-3">
                {shop.map((s) => (
                  <li key={s.name} className="hm-card flex flex-col">
                    <Piece variant={s.variant} />
                    <div className="flex flex-1 flex-col gap-3 border-t-[3px] border-foreground p-4">
                      <h3 className="kit-h3">{s.name}</h3>
                      <p className="hm-mono">{clp(s.price)}</p>
                      <a href="#contacto" className="hm-btn mt-auto">
                        Lo quiero
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-labelledby="hm-sob"
              className="hm-card grid gap-6 p-6 md:grid-cols-2 md:p-8"
            >
              <div className="flex flex-col gap-4">
                <h2 id="hm-sob" className="kit-h1">
                  {about.title}
                </h2>
                <p className="kit-body">{about.text}</p>
              </div>
              <ul className="flex flex-col items-start gap-3">
                {about.facts.map((f, i) => (
                  <li
                    key={f}
                    className="hm-sticker hm-mono"
                    style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </section>

            <section id="tarifas" aria-labelledby="hm-tar">
              <h2 id="hm-tar" className="kit-h1">
                Tarifas
              </h2>
              <ul className="mt-6 grid gap-6 md:grid-cols-3">
                {rates.map((r) => (
                  <li key={r.name} className="hm-card flex flex-col gap-2 p-5">
                    <h3 className="kit-h3">{r.name}</h3>
                    <p className="kit-h2">{r.price}</p>
                    <p className="hm-mono text-muted-foreground">{r.note}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="hm-gal">
              <h2 id="hm-gal" className="kit-h1">
                Galería
              </h2>
              <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                {gallery.map((v, i) => (
                  <li
                    key={i}
                    className="hm-card"
                    style={{ transform: `rotate(${(i % 3) - 1}deg)` }}
                  >
                    <Piece variant={v} />
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="contacto"
              aria-labelledby="hm-con"
              className="hm-card grid gap-6 p-6 md:grid-cols-2 md:p-8"
            >
              <div>
                <h2 id="hm-con" className="kit-h1">
                  Cuéntame qué tienes en mente
                </h2>
                <p className="hm-mono mt-3">Respondo en 2 a 3 días.</p>
              </div>
              <form className="grid gap-4">
                {(
                  [
                    ["Tu nombre", "name", "text"],
                    ["Tu correo", "email", "email"],
                  ] as const
                ).map(([l, ac, t]) => (
                  <div key={ac} className="grid gap-1">
                    <label htmlFor={`hm-${ac}`} className="font-semibold">
                      {l}
                    </label>
                    <input
                      id={`hm-${ac}`}
                      type={t}
                      autoComplete={ac}
                      className="hm-input"
                    />
                  </div>
                ))}
                <button type="button" className="hm-btn">
                  Enviar mensaje
                </button>
              </form>
            </section>

            <section
              aria-labelledby="hm-nl"
              className="hm-hero flex flex-col items-center gap-3 p-8 text-center"
            >
              <h2 id="hm-nl" className="kit-h1">
                {newsletter.title}
              </h2>
              <p className="kit-lead" style={{ color: "inherit" }}>
                {newsletter.text}
              </p>
              <a href="#contacto" className="hm-btn">
                {newsletter.button}
              </a>
            </section>

            <section aria-labelledby="hm-est">
              <h2 id="hm-est" className="kit-h2">
                Cuando algo no está listo
              </h2>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <LoadingState lines={3} />
                <ErrorState retryHref="#proyectos" />
                <EmptyState
                  title="Aún no hay piezas"
                  description="Pronto subo lo nuevo del taller."
                  action={{ label: "Ver proyectos", href: "#proyectos" }}
                />
              </div>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Hecho en Valdivia, con barro y tinta."
            columns={[
              {
                title: "Mira",
                links: [
                  { label: "Proyectos", href: "#proyectos" },
                  { label: "Tienda", href: "#tienda" },
                ],
              },
              {
                title: "Habla",
                links: [
                  { label: "Tarifas", href: "#tarifas" },
                  { label: "Contacto", href: "#contacto" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
