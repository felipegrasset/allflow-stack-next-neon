import type { Metadata } from "next"
import { Bell, Check, CreditCard, UserPlus } from "lucide-react"

import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  OfflineState,
  PartialState,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { Accounts } from "./accounts"
import { copy } from "./copy"
import "./panel.css"

export const metadata: Metadata = { title: "Kit Panel de Ciclos" }

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)

export default function PanelDeCiclos() {
  const { onboarding: ob, billing: b, states: s } = copy
  return (
    <KitTheme h={265} c={0.2} className="pc">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/panel-de-ciclos"
        links={copy.links}
        actions={
          <a className="pc-btn" href="#equipo">
            <UserPlus className="size-4" aria-hidden="true" />
            {copy.invite}
          </a>
        }
      />
      <div className="kit-container pc-wrap">
        <nav className="pc-side" aria-label="Secciones del panel">
          <ul>
            {copy.links.map((l, i) => (
              <li key={l.href}>
                <a href={l.href} aria-current={i === 0 ? "true" : undefined}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main id="contenido" className="pc-main">
          <section id="resumen" aria-labelledby="pc-h1" className="grid gap-5">
            <div className="pc-head">
              <div>
                <p className="kit-eyebrow">{copy.cycle}</p>
                <h1 id="pc-h1" className="kit-h1 mt-2">
                  {copy.title}
                </h1>
                <p className="kit-lead mt-2">{copy.lead}</p>
              </div>
            </div>
            <ul className="pc-kpis">
              {copy.kpis.map((k) => (
                <li key={k.label} className="kit-card pc-kpi">
                  <span className="kit-small">{k.label}</span>
                  <span className="pc-kpi__value">{k.value}</span>
                  <span className="pc-delta" data-up={k.up}>
                    {k.delta} vs. ciclo anterior
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="pc-split pc-split--main">
            <section
              id="cuentas"
              aria-labelledby="pc-cuentas"
              className="kit-card pc-panel"
            >
              <header>
                <h2 id="pc-cuentas" className="kit-h3">
                  {copy.accountsTitle}
                </h2>
              </header>
              <Accounts accounts={copy.accounts} />
            </section>

            <div className="pc-side-col">
              <section aria-labelledby="pc-ob" className="kit-card pc-panel">
                <header>
                  <h2 id="pc-ob" className="kit-h3">
                    {ob.title}
                  </h2>
                  <span className="kit-small">
                    {ob.done} de {ob.steps.length}
                  </span>
                </header>
                <div
                  className="pc-progress"
                  role="progressbar"
                  aria-label={ob.title}
                  aria-valuemin={0}
                  aria-valuemax={ob.steps.length}
                  aria-valuenow={ob.done}
                >
                  <span
                    style={{ width: `${(ob.done / ob.steps.length) * 100}%` }}
                  />
                </div>
                <ul className="pc-steps">
                  {ob.steps.map((st) => (
                    <li key={st.label} data-done={st.done}>
                      <span className="pc-check" aria-hidden="true">
                        {st.done ? <Check className="size-3" /> : null}
                      </span>
                      <span>
                        {st.label}
                        <span className="sr-only">
                          {st.done ? " (hecho)" : " (pendiente)"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <a className="pc-btn" href="#cuentas">
                  {ob.cta}
                </a>
              </section>

              <section
                id="facturacion"
                aria-labelledby="pc-bill"
                className="kit-card pc-panel"
              >
                <header>
                  <h2 id="pc-bill" className="kit-h3">
                    {b.title}
                  </h2>
                  <CreditCard className="size-4" aria-hidden="true" />
                </header>
                <div>
                  <p className="pc-plan">{b.plan}</p>
                  <p className="kit-small">
                    {b.price}. {b.next}
                  </p>
                </div>
                <div>
                  <p className="kit-small">{b.seats}</p>
                  <div
                    className="pc-progress mt-2"
                    role="progressbar"
                    aria-label="Puestos usados"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={b.seatsPct}
                  >
                    <span style={{ width: `${b.seatsPct}%` }} />
                  </div>
                </div>
                <ul className="pc-invoices">
                  {b.invoices.map((i) => (
                    <li key={i.n}>
                      <span>
                        {i.n} · {i.d}
                      </span>
                      <span className="pc-num">{i.v}</span>
                    </li>
                  ))}
                </ul>
                <a className="pc-btn" data-quiet="true" href="#facturacion">
                  {b.manage}
                </a>
              </section>
            </div>
          </div>

          <div className="pc-split">
            <section
              id="equipo"
              aria-labelledby="pc-team"
              className="kit-card pc-panel"
            >
              <header>
                <h2 id="pc-team" className="kit-h3">
                  {copy.teamTitle}
                </h2>
              </header>
              <ul className="pc-team">
                {copy.team.map((m, i) => (
                  <li key={m.mail} className="pc-member">
                    <div className="pc-who">
                      <span className="pc-avatar" aria-hidden="true">
                        {initials(m.name)}
                      </span>
                      <div>
                        <span className="pc-name">{m.name}</span>
                        <span className="kit-small">{m.mail}</span>
                      </div>
                    </div>
                    <div>
                      <label className="sr-only" htmlFor={`pc-role-${i}`}>
                        Rol de {m.name}
                      </label>
                      <select
                        id={`pc-role-${i}`}
                        className="pc-select w-full"
                        defaultValue={m.role}
                      >
                        {copy.roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="pc-notes" className="kit-card pc-panel">
              <header>
                <h2 id="pc-notes" className="kit-h3">
                  {copy.notifications.title}
                </h2>
                <Bell className="size-4" aria-hidden="true" />
              </header>
              <ul className="pc-notes">
                {copy.notifications.items.map((n) => (
                  <li key={n.t}>
                    <span>{n.t}</span>
                    <span className="kit-small">{n.when}</span>
                  </li>
                ))}
              </ul>
              <a className="pc-btn" data-quiet="true" href="#resumen">
                {copy.notifications.markAll}
              </a>
            </section>
          </div>

          <section aria-labelledby="pc-estados" className="grid gap-5">
            <div>
              <h2 id="pc-estados" className="kit-h2">
                {s.title}
              </h2>
              <p className="kit-lead mt-2">{s.lead}</p>
            </div>
            <div className="pc-states">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#cuentas" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#cuentas"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#cuentas" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#resumen" }}
              />
              <PartialState compact issues={s.partial.issues} />
              <OfflineState
                compact
                title={s.offline.title}
                description={s.offline.description}
                retryHref="#cuentas"
              />
            </div>
          </section>
        </main>
      </div>
      <KitFooter
        brand={copy.brand}
        tagline={copy.footer.tagline}
        columns={copy.footer.columns}
      />
    </KitTheme>
  )
}
