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
import { Agenda, Directory, Materials, Poll, Register, Waiting } from "./live"
import "./evento.css"

export const metadata: Metadata = { title: "Kit Evento en Vivo" }

export default function EventoEnVivo() {
  const s = copy.states
  const c = copy.countdown
  return (
    <KitTheme h={60} c={0.19} className="ev">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/evento-en-vivo"
        links={copy.links}
        actions={
          <a className="ev-btn" href="#registro">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="ev-hero" aria-labelledby="ev-h1">
          <div>
            <p className="kit-eyebrow">{copy.eyebrow}</p>
            <h1 id="ev-h1" className="kit-display mt-3">
              {copy.title}
            </h1>
            <p className="kit-lead mt-4">{copy.lead}</p>
          </div>
          <div className="ev-count">
            <p className="kit-eyebrow" style={{ color: "inherit" }}>
              {c.label}
            </p>
            <div className="ev-count__parts" role="timer" aria-label={c.aria}>
              {c.parts.map((p) => (
                <span key={p.u} className="ev-count__part">
                  <span className="ev-count__n">{p.n}</span>
                  <span className="kit-small" style={{ color: "inherit" }}>
                    {p.u}
                  </span>
                </span>
              ))}
            </div>
            <a className="ev-btn" href="#registro">
              {copy.headerAction}
            </a>
          </div>
        </section>

        <div className="ev-main">
          <section id="agenda" aria-labelledby="ev-agenda">
            <h2 id="ev-agenda" className="kit-h2 mb-5">
              {copy.agendaTitle}
            </h2>
            <Agenda />
          </section>

          <section id="ponentes" aria-labelledby="ev-pon">
            <h2 id="ev-pon" className="kit-h2 mb-5">
              {copy.speakersTitle}
            </h2>
            <ul className="ev-speakers">
              {copy.speakers.map((p) => (
                <li key={p.name} className="kit-card ev-speaker">
                  <span className="ev-portrait" aria-hidden="true">
                    {p.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")}
                  </span>
                  <h3 className="kit-h3">{p.name}</h3>
                  <p className="kit-small">{p.role}</p>
                  <p className="kit-small">{p.topic}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="ev-two">
            <section
              id="registro"
              className="kit-card ev-panel"
              aria-labelledby="ev-reg"
            >
              <h2 id="ev-reg" className="kit-h2">
                {copy.register.title}
              </h2>
              <p className="kit-small">{copy.register.lead}</p>
              <Register />
            </section>
            <section className="kit-card ev-panel" aria-labelledby="ev-wait">
              <h2 id="ev-wait" className="kit-h2">
                {copy.waiting.title}
              </h2>
              <p className="kit-small">{copy.waiting.lead}</p>
              <Waiting />
            </section>
          </div>

          <div className="ev-two">
            <section
              id="material"
              className="kit-card ev-panel"
              aria-labelledby="ev-mat"
            >
              <h2 id="ev-mat" className="kit-h3">
                {copy.materials.title}
              </h2>
              <p className="kit-small">{copy.materials.lead}</p>
              <Materials />
            </section>
            <section className="kit-card ev-panel" aria-labelledby="ev-poll">
              <h2 id="ev-poll" className="kit-h3">
                {copy.poll.title}
              </h2>
              <Poll />
            </section>
          </div>

          <section id="comunidad" aria-labelledby="ev-com">
            <h2 id="ev-com" className="kit-h2">
              {copy.directory.title}
            </h2>
            <p className="kit-lead mt-2 mb-5">{copy.directory.lead}</p>
            <Directory />
          </section>

          <section aria-labelledby="ev-estados">
            <h2 id="ev-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="ev-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#registro" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#agenda"
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
                action={{ label: s.forbidden.action, href: "#registro" }}
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
                retryHref="#agenda"
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
