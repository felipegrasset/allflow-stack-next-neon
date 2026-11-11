import type { Metadata } from "next"

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
  SuccessState,
} from "@/modules/kit-core/contracts"

import { Analytics } from "./analytics"
import { copy } from "./copy"
import "./noche.css"

export const metadata: Metadata = { title: "Kit Noche de Cifras" }

/** La superficie es siempre oscura: `.dark` del tema + la marca de la vista previa. */
export default function NocheDeCifras() {
  const s = copy.states
  return (
    <div className="dark">
      <KitTheme h={125} c={0.17} className="nc">
        <KitHeader
          brand={copy.brand}
          brandHref="/kits/noche-de-cifras"
          links={copy.links}
          actions={
            <a className="nc-btn" href="#alertas">
              {copy.headerAction}
            </a>
          }
        />
        <main id="contenido" className="kit-container">
          <section className="nc-head" aria-labelledby="nc-h1">
            <p className="kit-eyebrow">{copy.eyebrow}</p>
            <h1 id="nc-h1" className="kit-h1 mt-2">
              {copy.title}
            </h1>
            <p className="kit-lead mt-2">{copy.lead}</p>
          </section>
          <div className="nc-main">
            <Analytics />

            <section id="alertas" aria-labelledby="nc-alertas">
              <h2 id="nc-alertas" className="kit-h2 mb-5">
                {copy.alertsTitle}
              </h2>
              <ul className="nc-alerts">
                {copy.alerts.map((a) => (
                  <li key={a.t} className="nc-alert" data-sev={a.sev}>
                    <span className="nc-alert__tag">
                      {copy.sev[a.sev as keyof typeof copy.sev]}
                    </span>
                    <span>{a.t}</span>
                    <span className="kit-small" style={{ color: "inherit" }}>
                      {a.when}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="nc-estados">
              <h2 id="nc-estados" className="kit-h2">
                {s.title}
              </h2>
              <p className="kit-lead mt-2">{s.lead}</p>
              <div className="nc-states mt-5">
                <EmptyState
                  compact
                  title={s.empty.title}
                  description={s.empty.description}
                  action={{ label: s.empty.action, href: "#resumen" }}
                />
                <LoadingState compact title={s.loading} lines={3} />
                <ErrorState
                  compact
                  title={s.error.title}
                  description={s.error.description}
                  retryHref="#resumen"
                />
                <SuccessState
                  compact
                  title={s.success.title}
                  description={s.success.description}
                  action={{ label: s.success.action, href: "#resumen" }}
                />
                <ForbiddenState
                  compact
                  title={s.forbidden.title}
                  description={s.forbidden.description}
                  action={{ label: s.forbidden.action, href: "#resumen" }}
                />
                <NoResultsState
                  compact
                  title={s.noResults.title}
                  description={s.noResults.description}
                />
                <OfflineState
                  compact
                  title={s.offline.title}
                  description={s.offline.description}
                  retryHref="#resumen"
                />
                <PartialState compact issues={s.partial.issues} />
              </div>
            </section>
          </div>
        </main>
        <KitFooter
          brand={copy.brand}
          tagline={copy.footer.tagline}
          columns={copy.footer.columns}
        />
      </KitTheme>
    </div>
  )
}
