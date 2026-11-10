import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import {
  Apple,
  Beef,
  Check,
  Croissant,
  Milk,
  PawPrint,
  Plus,
  Search,
  ShoppingBasket,
  Star,
  Truck,
  Wheat,
} from "lucide-react"

import { ButtonLink } from "@/components/button-link"
import {
  EmptyState,
  KitFooter,
  KitHeader,
  KitTheme,
} from "@/modules/kit-core/contracts"

import { copy, money } from "./copy"
import "./kit.css"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })

export const metadata: Metadata = { title: "Mercadito de Barrio" }

const ICONS = [Apple, Beef, Milk, Croissant, Wheat, PawPrint]

export default function Page() {
  const { hero, categories, products, detail, cart, tracking, reviews } = copy
  const subtotal = cart.lines.reduce((s, [, p]) => s + p, 0)
  return (
    <KitTheme h={145} c={0.14} className={outfit.variable}>
      <div className="mb">
        <KitHeader
          brand={copy.brand}
          brandHref="/kits/mercadito-de-barrio"
          links={copy.links}
          actions={
            <a href="#pedido" className="mb-chip">
              <ShoppingBasket className="size-4" aria-hidden="true" /> Pedido ·{" "}
              {cart.lines.length}
            </a>
          }
        />
        <main
          id="contenido"
          className="kit-container flex flex-col gap-12 py-6 md:py-8"
        >
          <section className="mb-hero px-6 py-10 md:px-12 md:py-16">
            <div className="relative z-10 max-w-xl">
              <p
                className="mb-badge"
                style={{
                  background: "var(--primary-foreground)",
                  color: "var(--primary)",
                }}
              >
                <Truck className="mr-1 inline size-3.5" aria-hidden="true" />
                {hero.eyebrow}
              </p>
              <h1 className="kit-display mt-4">{hero.title}</h1>
              <p className="mt-4 text-lg opacity-95">{hero.text}</p>
              <form
                className="mt-6 flex flex-col gap-3 sm:flex-row"
                role="search"
              >
                <label className="sr-only" htmlFor="mb-q">
                  {hero.placeholder}
                </label>
                <input
                  id="mb-q"
                  className="mb-input flex-1"
                  placeholder={hero.placeholder}
                />
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-(--kit-radius-md) bg-foreground px-5 font-semibold text-background"
                >
                  <Search className="size-4" aria-hidden="true" /> {hero.search}
                </button>
              </form>
            </div>
          </section>

          <section id="categorias" aria-labelledby="mb-cat">
            <h2 id="mb-cat" className="kit-h2">
              Categorías
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {categories.map((c, i) => {
                const Icon = ICONS[i]
                return (
                  <li key={c}>
                    <a href="#ofertas" className="mb-chip">
                      <Icon className="size-4" aria-hidden="true" /> {c}
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>

          <section id="ofertas" aria-labelledby="mb-of">
            <div className="flex items-end justify-between gap-4">
              <h2 id="mb-of" className="kit-h2">
                Ofertas de hoy
              </h2>
              <ButtonLink href="#ofertas" variant="link">
                Ver todo
              </ButtonLink>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {products.map((p) => (
                <li key={p.name} className="mb-surface flex flex-col gap-2 p-3">
                  <div className="mb-thumb relative">
                    <Apple className="size-8" aria-hidden="true" />
                    {p.tag ? (
                      <span className="mb-badge absolute top-2 left-2">
                        {p.tag}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm leading-snug font-semibold md:text-base">
                    {p.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{p.unit}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p>
                      <span className="font-bold">{money(p.price)}</span>
                      {p.was ? (
                        <span className="ml-1 text-xs text-muted-foreground line-through">
                          {money(p.was)}
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      className="mb-add"
                      aria-label={`Agregar ${p.name}`}
                    >
                      <Plus className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="mb-det"
            className="mb-surface grid gap-6 p-5 md:grid-cols-2 md:p-8"
          >
            <div className="mb-thumb" style={{ aspectRatio: "1 / 1" }}>
              <Apple className="size-16" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-3">
              <p className="kit-eyebrow">Ficha de producto</p>
              <h2 id="mb-det" className="kit-h1">
                {detail.name}
              </h2>
              <p className="text-sm text-muted-foreground">{detail.unit}</p>
              <p className="text-2xl font-bold">
                {money(detail.price)}{" "}
                <span className="text-base font-normal text-muted-foreground line-through">
                  {money(detail.was)}
                </span>
              </p>
              <p>{detail.desc}</p>
              <ul className="grid gap-2 text-sm">
                {detail.points.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />{" "}
                    {t}
                  </li>
                ))}
              </ul>
              <ButtonLink href="#pedido" size="lg" className="mt-2 self-start">
                Agregar al pedido
              </ButtonLink>
            </div>
          </section>

          <section
            id="pedido"
            aria-labelledby="mb-ped"
            className="grid gap-6 md:grid-cols-2"
          >
            <div className="mb-surface p-5 md:p-6">
              <h2 id="mb-ped" className="kit-h2">
                {cart.title}
              </h2>
              <ul className="mt-4 divide-y divide-border">
                {cart.lines.map(([n, p]) => (
                  <li
                    key={n}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <span>{n}</span>
                    <span className="font-semibold">{money(p)}</span>
                  </li>
                ))}
                <li className="flex justify-between py-3 text-sm">
                  <span>Despacho</span>
                  <span>{money(cart.shipping)}</span>
                </li>
                <li className="flex justify-between pt-3 text-lg font-bold">
                  <span>Total</span>
                  <span>{money(subtotal + cart.shipping)}</span>
                </li>
              </ul>
            </div>
            <form
              className="mb-surface flex flex-col gap-4 p-5 md:p-6"
              aria-labelledby="mb-pago"
            >
              <h2 id="mb-pago" className="kit-h2">
                Datos de entrega
              </h2>
              {(
                [
                  ["Nombre", "name", "Camila Rojas"],
                  ["Dirección", "street-address", "Los Aromos 123, Ñuñoa"],
                  ["Teléfono", "tel", "+56 9 1234 5678"],
                ] as const
              ).map(([l, ac, ph]) => (
                <div key={l} className="grid gap-1">
                  <label htmlFor={`mb-${ac}`} className="text-sm font-medium">
                    {l}
                  </label>
                  <input
                    id={`mb-${ac}`}
                    autoComplete={ac}
                    placeholder={ph}
                    className="mb-input"
                  />
                </div>
              ))}
              <ButtonLink href="#seguimiento" size="lg">
                Pagar {money(subtotal + cart.shipping)}
              </ButtonLink>
            </form>
          </section>

          <section
            id="seguimiento"
            aria-labelledby="mb-seg"
            className="mb-surface p-5 md:p-6"
          >
            <h2 id="mb-seg" className="kit-h2">
              Seguimiento
            </h2>
            <ol className="mt-4 grid gap-5">
              {tracking.map((s) => (
                <li key={s.label} className="mb-step">
                  <span className="mb-dot" data-done={s.done}>
                    {s.done ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </span>
                  <p className={s.done ? "font-semibold" : ""}>
                    {s.label}
                    {s.note ? (
                      <span className="block text-sm font-normal text-muted-foreground">
                        {s.note}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section id="resenas" aria-labelledby="mb-res">
            <h2 id="mb-res" className="kit-h2">
              Lo que dicen los vecinos
            </h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-3">
              {reviews.map((r) => (
                <li key={r.who} className="mb-surface flex flex-col gap-3 p-5">
                  <p
                    className="flex gap-0.5 text-primary"
                    role="img"
                    aria-label={`${r.stars} de 5 estrellas`}
                  >
                    {Array.from({ length: r.stars }, (_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-current"
                        aria-hidden="true"
                      />
                    ))}
                  </p>
                  <p>{r.text}</p>
                  <p className="text-sm font-semibold">{r.who}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="mb-vac">
            <h2 id="mb-vac" className="kit-h2">
              Cuando el carrito está vacío
            </h2>
            <div className="mt-4">
              <EmptyState
                title="Tu pedido está vacío"
                description="Agrega algo rico de las ofertas de hoy y lo armamos por ti."
                action={{ label: "Ir a las ofertas", href: "#ofertas" }}
              />
            </div>
          </section>
        </main>
        <KitFooter
          brand={copy.brand}
          tagline="Del barrio, para el barrio. Despachamos de lunes a domingo."
          columns={[
            {
              title: "Comprar",
              links: [
                { label: "Ofertas", href: "#ofertas" },
                { label: "Categorías", href: "#categorias" },
              ],
            },
            {
              title: "Ayuda",
              links: [
                { label: "Seguimiento", href: "#seguimiento" },
                { label: "Reseñas", href: "#resenas" },
              ],
            },
          ]}
        />
      </div>
    </KitTheme>
  )
}
