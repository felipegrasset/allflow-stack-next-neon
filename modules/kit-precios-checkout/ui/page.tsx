import type { Metadata } from "next"
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google"

import {
  ErrorState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { Checkout } from "./checkout"
import { copy } from "./copy"
import "./kit.css"
import { Pricing } from "./pricing"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
})
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
})

export const metadata: Metadata = { title: "Precios y checkout" }

export default function Page() {
  const { hero, plans, features } = copy
  return (
    <div className={`${jakarta.variable} ${plex.variable}`}>
      <KitTheme h={330} c={0.17}>
        <div className="pc">
          <KitHeader
            brand={copy.brand}
            brandHref="/kits/precios-checkout"
            links={copy.links}
            actions={
              <a href="#pagar" className="pc-btn">
                Pagar
              </a>
            }
          />
          <main id="contenido">
            <section id="precios" className="pc-band">
              <div className="kit-container kit-section" aria-labelledby="pc-h">
                <p className="kit-eyebrow">{hero.eyebrow}</p>
                <h1 id="pc-h" className="kit-display mt-3 max-w-3xl">
                  {hero.title}
                </h1>
                <p className="kit-lead mt-4">{hero.text}</p>
                <div className="mt-8">
                  <Pricing />
                </div>
              </div>
            </section>

            <section
              id="comparar"
              className="kit-container kit-section"
              aria-labelledby="pc-cmp"
            >
              <h2 id="pc-cmp" className="kit-h1">
                Compara los planes
              </h2>
              <div
                className="pc-scroll mt-6"
                role="region"
                aria-label="Tabla comparativa de planes"
                tabIndex={0}
              >
                <table className="pc-table">
                  <caption className="sr-only">
                    Comparación de funciones por plan
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Función</th>
                      {plans.map((p) => (
                        <th key={p.id} scope="col">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map(([f, a, b, c]) => (
                      <tr key={f}>
                        <th scope="row">{f}</th>
                        <td>{a}</td>
                        <td>{b}</td>
                        <td>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="pagar" className="pc-band">
              <div
                className="kit-container kit-section"
                aria-labelledby="pc-pg"
              >
                <h2 id="pc-pg" className="kit-h1">
                  Finaliza tu compra
                </h2>
                <p className="kit-lead mt-2">
                  Prueba el código BIENVENIDA para ver el descuento.
                </p>
                <div className="mt-6">
                  <Checkout />
                </div>
              </div>
            </section>

            <section
              className="kit-container kit-section"
              aria-labelledby="pc-est"
            >
              <h2 id="pc-est" className="kit-h1">
                Estados del pago
              </h2>
              <p className="kit-lead mt-2">
                Los tres momentos después de «Continuar al pago seguro».
              </p>
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <LoadingState title="Procesando el pago" lines={2} />
                <SuccessState
                  title="Pago recibido"
                  description="Te enviamos el recibo a tu correo. Ya puedes usar el plan Pro."
                  action={{ label: "Ir a mi cuenta", href: "#precios" }}
                />
                <ErrorState
                  title="No pudimos cobrar"
                  description="Tu banco rechazó el pago. Prueba con otro medio o inténtalo de nuevo."
                  retryLabel="Reintentar el pago"
                  retryHref="#pagar"
                />
              </div>
            </section>
          </main>
          <KitFooter
            brand={copy.brand}
            tagline="Precios claros, sin letra chica."
            columns={[
              {
                title: "Planes",
                links: [
                  { label: "Precios", href: "#precios" },
                  { label: "Comparar", href: "#comparar" },
                ],
              },
              { title: "Compra", links: [{ label: "Pagar", href: "#pagar" }] },
            ]}
          />
        </div>
      </KitTheme>
    </div>
  )
}
