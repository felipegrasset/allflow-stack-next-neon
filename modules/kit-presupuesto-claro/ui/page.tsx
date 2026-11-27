import type { Metadata } from "next"
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google"

import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  NoResultsState,
  OfflineState,
  PartialState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { Builder } from "./builder"
import { copy } from "./copy"
import { Documento } from "./documento"
import { Lista } from "./lista"
import "./presupuesto.css"

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
})

export const metadata: Metadata = { title: "Presupuesto claro" }

export default function Page() {
  const { hero } = copy
  return (
    <div className={`${fraunces.variable} ${inter.variable} ${plex.variable}`}>
      <KitTheme h={65} c={0.1}>
        <div className="pz">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/presupuesto-claro"
            links={copy.links}
            actions={
              <a href="#armar" className="pz-btn">
                Nuevo
              </a>
            }
          />
          <main id="contenido">
            <section className="pz-hero" aria-labelledby="pz-h">
              <div className="kit-container pz-hero-in">
                <div>
                  <p className="kit-eyebrow">{hero.eyebrow}</p>
                  <h1 id="pz-h" className="pz-display">
                    {hero.title}
                  </h1>
                  <p className="kit-lead pz-lead">{hero.text}</p>
                  <div className="pz-cta">
                    <a href="#armar" className="pz-btn">
                      Armar un presupuesto
                    </a>
                    <a href="#documento" className="pz-btn" data-variant="ghost">
                      Ver el documento
                    </a>
                  </div>
                </div>
                <ol className="pz-track" aria-label="Recorrido de un presupuesto">
                  {hero.steps.map((s, i) => (
                    <li key={s}>
                      <span className="pz-dot pz-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section id="armar" className="kit-container kit-section" aria-labelledby="pz-a">
              <h2 id="pz-a" className="pz-h2">
                Arma el presupuesto
              </h2>
              <p className="kit-lead pz-lead">
                Cambia cantidades y precios: el total se recalcula al instante.
              </p>
              <Builder />
            </section>

            <section id="documento" className="pz-band" aria-labelledby="pz-d">
              <div className="kit-container kit-section">
                <h2 id="pz-d" className="pz-h2">
                  Lo que ve tu cliente
                </h2>
                <p className="kit-lead pz-lead">
                  Una hoja limpia con las líneas, el total y dos salidas claras.
                </p>
                <Documento />
              </div>
            </section>

            <section id="lista" className="kit-container kit-section" aria-labelledby="pz-l">
              <h2 id="pz-l" className="pz-h2">
                Mis presupuestos
              </h2>
              <p className="kit-lead pz-lead">Busca por cliente y filtra por estado.</p>
              <Lista />
            </section>

            <section id="estados" className="pz-band" aria-labelledby="pz-e">
              <div className="kit-container kit-section">
                <h2 id="pz-e" className="pz-h2">
                  Estados
                </h2>
                <p className="kit-lead pz-lead">
                  Los ocho del núcleo y uno propio de este kit: «Vencido».
                </p>
                <div className="pz-states">
                  <EmptyState
                    compact
                    title="Sin presupuestos todavía"
                    description="Cuando envíes el primero aparecerá aquí."
                    action={{ label: "Armar el primero", href: "#armar" }}
                  />
                  <LoadingState compact title="Cargando tus presupuestos" lines={2} />
                  <ErrorState
                    compact
                    title="No pudimos cargar la lista"
                    retryHref="#lista"
                  />
                  <SuccessState
                    compact
                    title="Presupuesto enviado"
                    description="Tu cliente lo recibirá por correo."
                    action={{ label: "Ver la lista", href: "#lista" }}
                  />
                  <ForbiddenState
                    compact
                    title="Solo quien lo creó puede editarlo"
                    action={{ label: "Pedir acceso", href: "#estados" }}
                  />
                  <NoResultsState
                    compact
                    title="Nada coincide con tu búsqueda"
                    action={{ label: "Quitar filtros", href: "#lista" }}
                  />
                  <OfflineState compact retryHref="#estados" />
                  <PartialState
                    compact
                    title="Mostramos lo que alcanzamos a cargar"
                    issues={["Faltan los presupuestos de 2025."]}
                    action={{ label: "Reintentar", href: "#lista" }}
                  />
                  <StateBlock
                    compact
                    tone="warning"
                    title="Este presupuesto venció"
                    description="La vigencia terminó el 15 de noviembre. Puedes duplicarlo con fecha nueva."
                    action={{ label: "Duplicar con fecha nueva", href: "#armar" }}
                  />
                </div>
              </div>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Cotizar sin letra chica."
            columns={[
              {
                title: "Presupuestos",
                links: [
                  { label: "Armar", href: "#armar" },
                  { label: "Mis presupuestos", href: "#lista" },
                ],
              },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
