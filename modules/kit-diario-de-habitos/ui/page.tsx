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
import { Reminders, Today } from "./today"
import "./diario.css"

export const metadata: Metadata = { title: "Kit Diario de Hábitos" }

export default function DiarioDeHabitos() {
  const s = copy.states
  const p = copy.plan
  return (
    <KitTheme h={140} c={0.14} className="dh">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/diario-de-habitos"
        links={copy.links}
        actions={
          <a className="dh-btn" href="#plan">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section id="hoy" className="dh-head" aria-labelledby="dh-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="dh-h1" className="kit-h1 mt-2">
            {copy.title}
          </h1>
          <p className="kit-lead mt-2">{copy.lead}</p>
        </section>
        <div className="dh-main">
          <Today />

          <div className="dh-two">
            <section
              id="semana"
              className="kit-card dh-panel"
              aria-labelledby="dh-sem"
            >
              <div>
                <h2 id="dh-sem" className="kit-h2">
                  {copy.weekTitle}
                </h2>
                <p className="kit-small mt-2">{copy.weekLead}</p>
              </div>
              <ul className="dh-week">
                {copy.week.map((d) => (
                  <li
                    key={d.d}
                    className="dh-day"
                    data-full={d.v === 3}
                    data-today={d.d === "Hoy"}
                  >
                    <span
                      className="dh-day__bar"
                      style={{ height: `${(d.v / 3) * 100}%` }}
                      role="img"
                      aria-label={`${d.d}: ${copy.weekUnit(d.v)}`}
                    />
                    <span className="kit-small dh-day__label">{d.d}</span>
                  </li>
                ))}
              </ul>
              <p className="dh-streak">{copy.streak}</p>
            </section>

            <div className="grid gap-6">
              <section
                id="recordatorios"
                className="kit-card dh-panel"
                aria-labelledby="dh-rec"
              >
                <h2 id="dh-rec" className="kit-h3">
                  {copy.remindersTitle}
                </h2>
                <Reminders />
              </section>
              <section
                id="plan"
                className="kit-card dh-panel"
                aria-labelledby="dh-plan"
              >
                <h2 id="dh-plan" className="kit-h3">
                  {p.title}
                </h2>
                <p className="kit-small">{p.week}</p>
                <div
                  className="dh-plan__bar"
                  role="progressbar"
                  aria-label={p.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={p.pct}
                >
                  <span style={{ width: `${p.pct}%` }} />
                </div>
                <p className="text-sm">{p.next}</p>
                <a className="dh-btn" href="#plan">
                  {p.cta}
                </a>
              </section>
            </div>
          </div>

          <section aria-labelledby="dh-estados">
            <h2 id="dh-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="dh-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#hoy" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#hoy"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#semana" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#plan" }}
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
                retryHref="#hoy"
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
