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

import { copy } from "./copy"
import { Pipeline } from "./pipeline"
import { Contacts, ImportCsv, Tasks } from "./workbench"
import "./taller.css"

export const metadata: Metadata = { title: "Kit Taller Claro" }

export default function TallerClaro() {
  const s = copy.states
  return (
    <KitTheme h={255} c={0.15} className="tc">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/taller-claro"
        links={copy.links}
        actions={
          <a className="tc-btn" href="#pipeline">
            {copy.newDeal}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="tc-head" aria-labelledby="tc-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="tc-h1" className="kit-h1 mt-2">
            {copy.title}
          </h1>
          <p className="kit-lead mt-2">{copy.lead}</p>
        </section>

        <div className="tc-main">
          <section id="pipeline" aria-label="Tablero de tratos">
            <Pipeline />
          </section>

          <section id="contactos" aria-labelledby="tc-contactos">
            <h2 id="tc-contactos" className="kit-h2 mb-5">
              {copy.contactsTitle}
            </h2>
            <Contacts />
          </section>

          <div className="tc-trio">
            <section
              id="tareas"
              className="kit-card tc-panel"
              aria-labelledby="tc-tareas"
            >
              <h2 id="tc-tareas" className="kit-h3">
                {copy.tasks.title}
              </h2>
              <Tasks />
            </section>
            <section className="kit-card tc-panel" aria-labelledby="tc-act">
              <h2 id="tc-act" className="kit-h3">
                {copy.activity.title}
              </h2>
              <ul className="tc-feed">
                {copy.activity.items.map((a) => (
                  <li key={a.what}>
                    <span>
                      <strong>{a.who}</strong> {a.what}
                    </span>
                    <span className="kit-small">{a.when}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="kit-card tc-panel" aria-labelledby="tc-week">
              <h2 id="tc-week" className="kit-h3">
                {copy.week.title}
              </h2>
              <ul className="tc-week">
                {copy.week.days.map((d) => (
                  <li
                    key={d.n}
                    className="tc-day"
                    data-today={d.today ? "true" : undefined}
                  >
                    <span className="kit-small">{d.d}</span>
                    <span className="tc-day__n">{d.n}</span>
                    <span className="kit-small">{copy.week.events(d.e)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section id="importar" aria-labelledby="tc-imp">
            <h2 id="tc-imp" className="kit-h2">
              {copy.import.title}
            </h2>
            <p className="kit-lead mt-2 mb-5">{copy.import.lead}</p>
            <ImportCsv />
          </section>

          <section aria-labelledby="tc-estados">
            <h2 id="tc-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="tc-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#importar" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#pipeline"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#contactos" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#pipeline" }}
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
                retryHref="#pipeline"
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
