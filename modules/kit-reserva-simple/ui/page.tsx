import type { Metadata } from "next"
import { Phone } from "lucide-react"

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
import "./reserva.css"

export const metadata: Metadata = { title: "Kit Reserva Simple" }

export default function ReservaSimple() {
  const s = copy.states
  return (
    <KitTheme h={40} c={0.16} className="rs">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/reserva-simple"
        links={copy.links}
        actions={
          <a className="rs-call" href="#reservar">
            <Phone className="mr-2 size-4" aria-hidden="true" />
            {copy.callLabel}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="rs-hero" aria-labelledby="rs-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="rs-h1" className="kit-display mt-3">
            {copy.title}
          </h1>
          <p className="kit-lead">{copy.lead}</p>
        </section>

        <section
          id="reservar"
          className="kit-section"
          aria-label="Reservar una hora"
          style={{ paddingTop: 0 }}
        >
          <Booking />
        </section>

        <section
          id="agenda"
          className="kit-section"
          aria-labelledby="rs-agenda"
          style={{ paddingTop: 0 }}
        >
          <h2 id="rs-agenda" className="kit-h2">
            {copy.agenda.title}
          </h2>
          <p className="kit-lead mt-2">{copy.agenda.lead}</p>
          <ul className="rs-agenda mt-5">
            {copy.agenda.rows.map((r) => (
              <li key={r.t} className="rs-row" data-st={r.st}>
                <time>{r.t}</time>
                <span>
                  <span className="rs-row__name font-semibold">{r.n}</span>
                  {r.s ? <span className="kit-small block">{r.s}</span> : null}
                </span>
                <span className="kit-small">{r.p}</span>
                <span className="rs-row__tag">
                  {copy.agenda.state[r.st as keyof typeof copy.agenda.state]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="kit-section"
          aria-labelledby="rs-estados"
          style={{ paddingTop: 0 }}
        >
          <h2 id="rs-estados" className="kit-h2">
            {s.title}
          </h2>
          <p className="kit-lead mt-2">{s.lead}</p>
          <div className="rs-states mt-5">
            <EmptyState
              compact
              title={s.empty.title}
              description={s.empty.description}
              action={{ label: s.empty.action, href: "#reservar" }}
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
              action={{ label: s.success.action, href: "#agenda" }}
            />
            <ForbiddenState
              compact
              title={s.forbidden.title}
              description={s.forbidden.description}
              action={{ label: s.forbidden.action, href: "#reservar" }}
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
      </main>
      <KitFooter
        brand={copy.brand}
        tagline={copy.footer.tagline}
        columns={copy.footer.columns}
      />
    </KitTheme>
  )
}
