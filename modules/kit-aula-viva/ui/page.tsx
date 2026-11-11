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

import { Catalog } from "./catalog"
import { copy } from "./copy"
import { Lesson } from "./lesson"
import "./aula.css"

export const metadata: Metadata = { title: "Kit Aula Viva" }

export default function AulaViva() {
  const { continue: cont, route, cert, forum, states: s } = copy
  return (
    <KitTheme h={275} c={0.2} className="av">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/aula-viva"
        links={copy.links}
        actions={
          <a className="av-btn" data-quiet="true" href="#continuar">
            {copy.login}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section id="continuar" className="av-hero" aria-labelledby="av-h1">
          <div>
            <p className="kit-eyebrow">{copy.eyebrow}</p>
            <h1 id="av-h1" className="kit-display mt-3">
              {copy.title}
            </h1>
            <p className="kit-lead mt-4">{copy.lead}</p>
          </div>
          <section className="kit-card av-continue" aria-labelledby="av-cont">
            <p
              id="av-cont"
              className="kit-eyebrow"
              style={{ color: "inherit" }}
            >
              {cont.label}
            </p>
            <div className="av-continue__row">
              <div
                className="av-ring"
                style={{ "--_p": cont.pct } as React.CSSProperties}
                role="img"
                aria-label={`${cont.pct} % completado`}
              >
                <span>{cont.pct}%</span>
              </div>
              <div>
                <h2 className="kit-h3">{cont.course}</h2>
                <p className="kit-small">{cont.lesson}</p>
                <p className="kit-small">{cont.left}</p>
              </div>
            </div>
            <a className="av-btn" href="#leccion">
              {cont.cta}
            </a>
          </section>
        </section>

        <section
          id="leccion"
          className="kit-section"
          aria-labelledby="av-lesson"
          style={{ paddingTop: 0 }}
        >
          <h2 id="av-lesson" className="kit-h2 mb-5">
            {copy.lesson.title}
          </h2>
          <Lesson />
        </section>

        <section
          id="ruta"
          className="kit-section"
          aria-labelledby="av-route"
          style={{ paddingTop: 0 }}
        >
          <h2 id="av-route" className="kit-h2">
            {route.title}
          </h2>
          <p className="kit-lead mt-2">{route.lead}</p>
          <ol className="av-route">
            {route.modules.map((m) => (
              <li
                key={m.id}
                className="av-module"
                data-state={m.state}
                aria-current={m.state === "current" ? "step" : undefined}
              >
                <span className="av-module__name">{m.name}</span>
                <span className="kit-small">{m.lessons}</span>
                <span className="av-state">
                  {route.stateLabel[m.state as keyof typeof route.stateLabel]}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="catalogo"
          className="kit-section"
          aria-labelledby="av-cat"
          style={{ paddingTop: 0 }}
        >
          <h2 id="av-cat" className="kit-h2">
            {copy.catalog.title}
          </h2>
          <p className="kit-lead mt-2 mb-5">{copy.catalog.lead}</p>
          <Catalog />
        </section>

        <div className="av-two kit-section" style={{ paddingTop: 0 }}>
          <section aria-labelledby="av-cert">
            <h2 id="av-cert" className="kit-h2 mb-5">
              {cert.title}
            </h2>
            <div className="av-cert">
              <p className="kit-eyebrow">{cert.lead}</p>
              <p className="av-cert__name">{cert.name}</p>
              <p className="kit-small">{cert.owner}</p>
              <p className="kit-small">{cert.need}</p>
              <a className="av-btn" data-quiet="true" href="#ruta">
                {cert.cta}
              </a>
            </div>
          </section>
          <section id="foro" aria-labelledby="av-foro">
            <h2 id="av-foro" className="kit-h2">
              {forum.title}
            </h2>
            <p className="kit-lead mt-2">{forum.lead}</p>
            <ul className="av-threads">
              {forum.threads.map((t) => (
                <li key={t.t}>
                  <span className="font-semibold">
                    {t.t}
                    {t.solved ? (
                      <span className="av-solved">{forum.solved}</span>
                    ) : null}
                  </span>
                  <span className="kit-small">
                    {t.who} · {forum.replies(t.n)} · {t.ago}
                  </span>
                </li>
              ))}
            </ul>
            <a className="av-btn mt-4" href="#foro">
              {forum.cta}
            </a>
          </section>
        </div>

        <section
          className="kit-section"
          aria-labelledby="av-estados"
          style={{ paddingTop: 0 }}
        >
          <h2 id="av-estados" className="kit-h2">
            {s.title}
          </h2>
          <p className="kit-lead mt-2">{s.lead}</p>
          <div className="av-states mt-5">
            <EmptyState
              compact
              title={s.empty.title}
              description={s.empty.description}
              action={{ label: s.empty.action, href: "#catalogo" }}
            />
            <LoadingState compact title={s.loading} lines={3} />
            <ErrorState
              compact
              title={s.error.title}
              description={s.error.description}
              retryHref="#leccion"
            />
            <SuccessState
              compact
              title={s.success.title}
              description={s.success.description}
              action={{ label: s.success.action, href: "#leccion" }}
            />
            <ForbiddenState
              compact
              title={s.forbidden.title}
              description={s.forbidden.description}
              action={{ label: s.forbidden.action, href: "#ruta" }}
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
              retryHref="#leccion"
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
