import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import {
  BookOpen,
  CalendarDays,
  Download,
  GraduationCap,
  Plus,
  Ticket,
} from "lucide-react"

import {
  KitFooter,
  KitHeader,
  KitTheme,
  NoResultsState,
} from "@/modules/kit-core/contracts"

import { clp, copy } from "./copy"
import "./kit.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
})

export const metadata: Metadata = { title: "Tienda de un Enlace" }

const KIND_ICON = {
  Plantilla: BookOpen,
  Curso: GraduationCap,
  Asesoría: CalendarDays,
} as const

export default function Page() {
  const {
    profile,
    products,
    booking,
    coupon,
    checkout,
    downloads,
    stats,
    clients,
  } = copy
  const sub = checkout.lines.reduce((s, [, p]) => s + p, 0)
  return (
    <div className={jakarta.variable}>
      <KitTheme h={300} c={0.2}>
        <div className="ue">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/tienda-un-enlace"
            links={[
              { label: "Mi tienda", href: "#tienda" },
              { label: "Panel", href: "#panel" },
            ]}
          />
          <main
            id="contenido"
            className="kit-container grid gap-8 py-6 lg:grid-cols-[26rem_1fr] lg:items-start lg:py-10"
          >
            <div id="tienda" className="ue-phone">
              <header className="flex flex-col items-center gap-2 py-2 text-center">
                <span className="ue-avatar" aria-hidden="true">
                  SA
                </span>
                <h1 className="kit-h1">{profile.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {profile.handle}
                </p>
                <p className="max-w-[32ch]">{profile.bio}</p>
              </header>

              <ul className="flex flex-col gap-3" aria-label="Productos">
                {products.map((p) => {
                  const Icon = KIND_ICON[p.kind as keyof typeof KIND_ICON]
                  return (
                    <li key={p.name}>
                      <a href="#pago" className="ue-link">
                        <span className="ue-icon">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {p.kind}
                            {"badge" in p && p.badge ? ` · ${p.badge}` : ""}
                          </span>
                          <strong className="block">{p.name}</strong>
                          <span className="text-sm text-muted-foreground">
                            {p.desc}
                          </span>
                        </span>
                        <strong>{clp(p.price)}</strong>
                      </a>
                    </li>
                  )
                })}
              </ul>

              <section className="ue-card" aria-labelledby="ue-res">
                <h2 id="ue-res" className="kit-h3">
                  {booking.title}
                </h2>
                <p className="mt-3 text-sm font-semibold">{booking.days[0]}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {booking.slots.map((s, i) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="ue-slot"
                        aria-pressed={i === 1}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  También: {booking.days.slice(1).join(" · ")}
                </p>
              </section>

              <div className="ue-coupon flex items-center gap-3">
                <Ticket
                  className="size-6 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p>
                  <strong className="block">
                    {coupon.code} · {coupon.off}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {coupon.note}
                  </span>
                </p>
              </div>

              <section id="pago" className="ue-card" aria-labelledby="ue-pago">
                <h2 id="ue-pago" className="kit-h3">
                  Pago
                </h2>
                <ul className="mt-3 grid gap-2 text-sm">
                  {checkout.lines.map(([n, p]) => (
                    <li key={n} className="flex justify-between gap-3">
                      <span>{n}</span>
                      <span>{clp(p)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3">
                    <span>Cupón {coupon.code}</span>
                    <span>−{clp(checkout.discount)}</span>
                  </li>
                  <li className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold">
                    <span>Total</span>
                    <span>{clp(sub - checkout.discount)}</span>
                  </li>
                </ul>
                <div className="mt-4 grid gap-1">
                  <label htmlFor="ue-mail" className="text-sm font-medium">
                    Correo para enviarte la compra
                  </label>
                  <input
                    id="ue-mail"
                    type="email"
                    autoComplete="email"
                    className="ue-input"
                  />
                </div>
                <button type="button" className="ue-btn mt-4 w-full">
                  Pagar {clp(sub - checkout.discount)}
                </button>
              </section>

              <section className="ue-card" aria-labelledby="ue-desc">
                <h2 id="ue-desc" className="kit-h3">
                  Tus descargas
                </h2>
                <ul className="mt-3 grid gap-2">
                  {downloads.map(([n, s]) => (
                    <li key={n}>
                      <a
                        href="#pago"
                        className="flex items-center gap-3 rounded-(--kit-radius-md) py-2"
                      >
                        <Download
                          className="size-5 text-primary"
                          aria-hidden="true"
                        />
                        <span className="flex-1">{n}</span>
                        <span className="text-sm text-muted-foreground">
                          {s}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div id="panel" className="flex flex-col gap-6">
              <section aria-labelledby="ue-est">
                <h2 id="ue-est" className="kit-h2">
                  Estadísticas del mes
                </h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                  {stats.map(([l, v]) => (
                    <li key={l} className="ue-card">
                      <p className="text-sm text-muted-foreground">{l}</p>
                      <p className="text-2xl font-bold break-words">{v}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="ue-card" aria-labelledby="ue-cli">
                <h2 id="ue-cli" className="kit-h2">
                  Últimos clientes
                </h2>
                <ul className="mt-3 divide-y divide-border">
                  {clients.map(([n, p, m]) => (
                    <li
                      key={n}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <p>
                        <strong className="block">{n}</strong>
                        <span className="text-sm text-muted-foreground">
                          {p}
                        </span>
                      </p>
                      <strong>{m}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="ue-card" aria-labelledby="ue-ed">
                <h2 id="ue-ed" className="kit-h2">
                  Editor del enlace
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <label htmlFor="ue-nombre" className="text-sm font-medium">
                      Nombre visible
                    </label>
                    <input
                      id="ue-nombre"
                      className="ue-input"
                      defaultValue={profile.name}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="ue-slug" className="text-sm font-medium">
                      Tu enlace
                    </label>
                    <input
                      id="ue-slug"
                      className="ue-input"
                      defaultValue="unlink.example/sofiaaraya"
                    />
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Meta del mes: $1.500.000
                </p>
                <div
                  className="ue-bar mt-2"
                  role="img"
                  aria-label="86 % de la meta"
                >
                  <span style={{ width: "86%" }} />
                </div>
                <button type="button" className="ue-btn mt-5">
                  <Plus className="size-4" aria-hidden="true" /> Agregar
                  producto
                </button>
              </section>

              <NoResultsState
                title="Aún no hay reseñas"
                description="Cuando tus clientes dejen una, la verás aquí."
                compact
              />
            </div>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Una página para vender todo lo que haces."
            columns={[
              {
                title: "Creadores",
                links: [
                  { label: "Mi tienda", href: "#tienda" },
                  { label: "Panel", href: "#panel" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
