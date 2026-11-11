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

import { Board, Scan } from "./board"
import { copy } from "./copy"
import "./ruta.css"

export const metadata: Metadata = { title: "Kit Ruta Viva" }

export default function RutaViva() {
  const s = copy.states
  return (
    <KitTheme h={200} c={0.15} className="rv">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/ruta-viva"
        links={copy.links}
        actions={
          <a className="rv-btn" href="#rutas">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="rv-head" aria-labelledby="rv-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="rv-h1" className="kit-h1 mt-2">
            {copy.title}
          </h1>
          <p className="kit-lead mt-2">{copy.lead}</p>
        </section>
        <div className="rv-main">
          <ul className="rv-kpis">
            {copy.kpis.map((k) => (
              <li key={k.label} className="kit-card rv-kpi">
                <span className="kit-small">{k.label}</span>
                <span className="rv-kpi__value">{k.value}</span>
                <span className="kit-small">{k.note}</span>
              </li>
            ))}
          </ul>

          <section id="rutas" aria-labelledby="rv-rutas">
            <h2 id="rv-rutas" className="kit-h2 mb-5">
              {copy.routesTitle}
            </h2>
            <Board />
          </section>

          <div className="rv-two">
            <section id="zonas" aria-labelledby="rv-zonas">
              <h2 id="rv-zonas" className="kit-h2">
                {copy.zonesTitle}
              </h2>
              <p className="kit-lead mt-2 mb-5">{copy.zonesLead}</p>
              <ul className="rv-map">
                {copy.zones.map((z) => (
                  <li key={z.id} className="rv-zone" data-load={z.load}>
                    <span className="rv-zone__id" aria-hidden="true">
                      {z.id}
                    </span>
                    <span>
                      <strong>
                        Zona {z.id} · {z.name}
                      </strong>
                      <small>
                        {copy.zoneUnit(z.n)} ·{" "}
                        {copy.loadLabel[z.load as keyof typeof copy.loadLabel]}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="kit-card rv-panel" aria-labelledby="rv-drv">
              <h2 id="rv-drv" className="kit-h3">
                {copy.drivers.title}
              </h2>
              <ul className="rv-drivers">
                {copy.drivers.list.map((d) => (
                  <li key={d.name}>
                    <span className="rv-driver">
                      <strong>{d.name}</strong>
                      <span className="rv-pill" data-st={d.st}>
                        {
                          copy.drivers.label[
                            d.st as keyof typeof copy.drivers.label
                          ]
                        }
                      </span>
                    </span>
                    <span className="kit-small">{d.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="rv-two">
            <section id="escaneo" aria-labelledby="rv-scan">
              <h2 id="rv-scan" className="kit-h2">
                {copy.scan.title}
              </h2>
              <p className="kit-lead mt-2 mb-5">{copy.scan.lead}</p>
              <Scan />
            </section>
            <section
              id="incidencias"
              className="kit-card rv-panel"
              aria-labelledby="rv-inc"
            >
              <h2 id="rv-inc" className="kit-h3">
                {copy.incidents.title}
              </h2>
              <ul className="rv-incidents">
                {copy.incidents.list.map((i) => (
                  <li key={i.t}>
                    <span className="rv-driver">
                      <strong>{i.t}</strong>
                    </span>
                    <span className="kit-small">
                      {i.who} · {i.when}
                    </span>
                    <span
                      className="rv-pill"
                      data-sev={i.sev}
                      style={{ justifySelf: "start" }}
                    >
                      {
                        copy.incidents.sev[
                          i.sev as keyof typeof copy.incidents.sev
                        ]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="rv-estados">
            <h2 id="rv-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="rv-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#rutas" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#rutas"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#rutas" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#rutas" }}
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
                retryHref="#rutas"
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
  )
}
