import type { Metadata } from "next"

import {
  EmptyState,
  ForbiddenState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  NoResultsState,
  PartialState,
  SuccessState,
} from "../contracts"
import { Retry } from "./preview-retry"

export const metadata: Metadata = { title: "Kit core" }

const SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"] as const
const SPACES = [1, 2, 3, 4, 5, 6, 7] as const
const RADII = ["sm", "md", "lg", "xl"] as const
const SHADOWS = ["sm", "md", "lg"] as const
const SWATCHES = [
  ["--kit-tint", "tint"],
  ["--kit-tint-strong", "tint fuerte"],
  ["--kit-success-bg", "éxito"],
  ["--kit-warning-bg", "advertencia"],
  ["--kit-danger-bg", "peligro"],
] as const

export default function KitCorePreview() {
  return (
    <div className="bg-background text-foreground">
      <KitHeader
        brand="Kit core"
        brandHref="/kits/core"
        links={[
          { label: "Tokens", href: "#tokens" },
          { label: "Estados", href: "#estados" },
          { label: "Marca", href: "#marca" },
        ]}
      />
      <main id="contenido">
        <section className="kit-container kit-section">
          <p className="kit-eyebrow">Núcleo de los kits</p>
          <h1 className="kit-display mt-3">
            Un kit cambia de marca con dos números
          </h1>
          <p className="kit-lead mt-4">
            Tokens OKLCH, ocho estados, encabezado y pie. Todo se deriva de{" "}
            <code>--brand-h</code> y <code>--brand-c</code>.
          </p>
        </section>

        <section
          id="tokens"
          className="kit-container kit-section"
          aria-labelledby="t-tokens"
        >
          <h2 id="t-tokens" className="kit-h2">
            Tokens
          </h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div className="kit-card p-5">
              <h3 className="kit-h3">Tipografía</h3>
              <ul className="mt-3 grid gap-2">
                {SIZES.map((s) => (
                  <li
                    key={s}
                    style={{
                      fontSize: `var(--kit-text-${s})`,
                      lineHeight: "var(--kit-leading-snug)",
                    }}
                  >
                    text-{s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="kit-card p-5">
              <h3 className="kit-h3">Espacio</h3>
              <ul className="mt-3 grid gap-2">
                {SPACES.map((s) => (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-muted-foreground">
                      space-{s}
                    </span>
                    <span
                      className="block h-3 rounded-sm bg-primary"
                      style={{ width: `var(--kit-space-${s})` }}
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="kit-card p-5">
              <h3 className="kit-h3">Radio y sombra</h3>
              <div className="mt-3 flex flex-wrap gap-4">
                {RADII.map((r) => (
                  <span
                    key={r}
                    className="grid size-16 place-items-center border border-border bg-muted text-xs"
                    style={{ borderRadius: `var(--kit-radius-${r})` }}
                  >
                    {r}
                  </span>
                ))}
                {SHADOWS.map((s) => (
                  <span
                    key={s}
                    className="grid size-16 place-items-center bg-card text-xs"
                    style={{
                      boxShadow: `var(--kit-shadow-${s})`,
                      borderRadius: "var(--kit-radius-md)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="kit-card p-5">
              <h3 className="kit-h3">Color derivado de la marca</h3>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SWATCHES.map(([v, n]) => (
                  <li key={v} className="grid gap-1 text-xs">
                    <span
                      className="block h-10 border border-border"
                      style={{
                        background: `var(${v})`,
                        borderRadius: "var(--kit-radius-sm)",
                      }}
                      aria-hidden="true"
                    />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="estados"
          className="kit-container kit-section"
          aria-labelledby="t-estados"
        >
          <h2 id="t-estados" className="kit-h2">
            Los ocho estados
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <EmptyState
              action={{ label: "Crear el primero", href: "#estados" }}
            />
            <LoadingState />
            <Retry kind="error" />
            <SuccessState
              action={{ label: "Ver el resultado", href: "#estados" }}
            />
            <ForbiddenState
              action={{ label: "Volver al inicio", href: "/kits/core" }}
            />
            <NoResultsState
              action={{ label: "Quitar filtros", href: "#estados" }}
            />
            <Retry kind="offline" />
            <PartialState
              issues={[
                "Las ventas del mes no respondieron",
                "El tipo de cambio está desactualizado",
              ]}
            />
          </div>
        </section>

        <section
          id="marca"
          className="kit-container kit-section"
          aria-labelledby="t-marca"
        >
          <h2 id="t-marca" className="kit-h2">
            Misma pieza, tres marcas
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {(
              [
                [195, 0.12],
                [30, 0.14],
                [300, 0.13],
              ] as const
            ).map(([h, c]) => (
              <KitTheme key={h} h={h} c={c} className="kit-card p-4">
                <p className="kit-eyebrow">
                  h {h} · c {c}
                </p>
                <p className="mt-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                  Botón principal
                </p>
                <p className="kit-tint mt-3 rounded-md px-3 py-2 text-sm">
                  Sección con tinte
                </p>
              </KitTheme>
            ))}
          </div>
        </section>
      </main>
      <KitFooter
        brand="Kit core"
        tagline="Base compartida de los kits de UI."
        columns={[
          {
            title: "Núcleo",
            links: [
              { label: "Tokens", href: "#tokens" },
              { label: "Estados", href: "#estados" },
            ],
          },
          { title: "Marca", links: [{ label: "Tres marcas", href: "#marca" }] },
        ]}
      />
    </div>
  )
}
