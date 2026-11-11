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

import { Booking } from "./booking"
import { copy } from "./copy"
import "./clinica.css"

export const metadata: Metadata = { title: "Kit Clínica Sereno" }

export default function ClinicaSereno() {
  const s = copy.states
  const h = copy.history
  return (
    <KitTheme h={175} c={0.11} className="cs">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/clinica-sereno"
        links={copy.links}
        actions={
          <a className="cs-btn" data-quiet="true" href="#historial">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="cs-hero" aria-labelledby="cs-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="cs-h1" className="kit-display mt-3">
            {copy.title}
          </h1>
          <p className="kit-lead mt-4">{copy.lead}</p>
        </section>
        <div className="cs-main">
          <Booking />

          <div className="cs-two">
            <section id="historial" aria-labelledby="cs-hist">
              <h2 id="cs-hist" className="kit-h2">
                {h.title}
              </h2>
              <p className="kit-lead mt-2">{h.lead}</p>
              <ul className="cs-hist">
                {h.list.map((x) => (
                  <li key={x.d}>
                    <span className="font-semibold">{x.d}</span>
                    <span>{x.w}</span>
                    <span className="cs-tag" data-st={x.st}>
                      {h.st[x.st as keyof typeof h.st]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="kit-card cs-remind" aria-labelledby="cs-rem">
              <h2 id="cs-rem" className="kit-h3">
                {copy.reminder.title}
              </h2>
              <p className="kit-small">{copy.reminder.lead}</p>
              <ul className="grid gap-2 text-sm">
                {copy.reminder.items.map((i) => (
                  <li key={i} className="kit-tint rounded-md px-3 py-2">
                    {i}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="cs-estados">
            <h2 id="cs-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="cs-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#profesionales" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#reservar"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#historial" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#historial" }}
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
                retryHref="#reservar"
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
