"use client"

import { Search } from "lucide-react"
import { useState } from "react"

import {
  NoResultsState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Buscador + ficha + reserva en tres pasos, todo en un solo estado compartido. */
export function Booking() {
  const [q, setQ] = useState("")
  const [spec, setSpec] = useState("Todas")
  const [pid, setPid] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [rut, setRut] = useState("")
  const [mail, setMail] = useState("")
  const [remind, setRemind] = useState(true)
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(false)

  const n = q.trim().toLowerCase()
  const list = copy.pros.filter(
    (p) =>
      (spec === "Todas" || p.spec === spec) &&
      (!n || `${p.name} ${p.spec}`.toLowerCase().includes(n))
  )
  const pro = copy.pros.find((p) => p.id === pid) ?? null
  const dataOk =
    name.trim().length > 2 &&
    rut.trim().length > 5 &&
    /^\S+@\S+\.\S+$/.test(mail)

  function reset() {
    setDone(false)
    setStep(1)
    setSlot(null)
    setTried(false)
  }

  return (
    <div className="cs-grid">
      <div id="profesionales" className="cs-find">
        <div className="cs-search">
          <Search className="size-4" aria-hidden="true" />
          <label htmlFor="cs-q" className="sr-only">
            {copy.searchLabel}
          </label>
          <input
            id="cs-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>
        <div className="cs-chips" role="group" aria-label="Especialidad">
          {copy.specs.map((s) => (
            <button
              key={s}
              type="button"
              className="cs-chip"
              aria-pressed={spec === s}
              onClick={() => setSpec(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {list.length ? (
          <ul className="cs-pros">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="cs-pro"
                  aria-pressed={p.id === pid}
                  onClick={() => {
                    setPid(p.id)
                    setSlot(null)
                    setStep(1)
                    setDone(false)
                  }}
                >
                  <span className="cs-avatar" aria-hidden="true">
                    {p.name
                      .replace(/^(Dra?\.|Nut\.)\s/, "")
                      .split(" ")
                      .map((x) => x[0])
                      .join("")}
                  </span>
                  <span className="cs-pro__text">
                    <span className="cs-pro__name">{p.name}</span>
                    <span className="kit-small">
                      {p.spec} · {p.place}
                    </span>
                    <span className="kit-small">
                      {copy.profile.next}: {p.next}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <NoResultsState
            compact
            title={copy.states.noResults.title}
            description={copy.states.noResults.description}
            action={{
              label: copy.states.noResults.action,
              onClick: () => {
                setQ("")
                setSpec("Todas")
              },
            }}
          />
        )}
      </div>

      <section
        id="reservar"
        className="kit-card cs-panel"
        aria-labelledby="cs-res"
      >
        {done && pro ? (
          <SuccessState
            compact
            title={copy.done.title}
            description={copy.done.description(pro.name, slot ?? "")}
            action={{ label: copy.done.again, onClick: reset }}
          />
        ) : !pro ? (
          <>
            <h2 id="cs-res" className="kit-h3">
              Reserva
            </h2>
            <StateBlock compact title={copy.profile.pick} />
          </>
        ) : (
          <>
            <h2 id="cs-res" className="kit-h3">
              {pro.name}
            </h2>
            <p className="kit-small">
              {pro.spec} · {copy.profile.years(pro.years)}
            </p>
            <p className="cs-about">{pro.about}</p>
            <ol className="cs-steps" aria-label={copy.stepLabel(step, 3)}>
              {copy.steps.map((s, i) => (
                <li
                  key={s}
                  data-state={
                    i + 1 < step ? "done" : i + 1 === step ? "now" : "next"
                  }
                  aria-current={i + 1 === step ? "step" : undefined}
                >
                  {i + 1}. {s}
                </li>
              ))}
            </ol>

            {step === 1 ? (
              <div className="cs-step">
                <p className="cs-label">
                  {copy.dayLabel} · {copy.slotsLabel}
                </p>
                <div
                  className="cs-slots"
                  role="group"
                  aria-label={copy.slotsLabel}
                >
                  {pro.times.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="cs-slot"
                      aria-pressed={slot === t}
                      onClick={() => setSlot(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="cs-btn"
                  disabled={!slot}
                  onClick={() => setStep(2)}
                >
                  {copy.form.next}
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <form
                className="cs-step"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  setTried(true)
                  if (dataOk) setStep(3)
                }}
              >
                <div className="cs-field">
                  <label htmlFor="cs-name">{copy.form.name}</label>
                  <input
                    id="cs-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={tried && name.trim().length < 3}
                  />
                </div>
                <div className="cs-field">
                  <label htmlFor="cs-rut">{copy.form.rut}</label>
                  <input
                    id="cs-rut"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    aria-invalid={tried && rut.trim().length < 6}
                  />
                </div>
                <div className="cs-field">
                  <label htmlFor="cs-mail">{copy.form.mail}</label>
                  <input
                    id="cs-mail"
                    type="email"
                    autoComplete="email"
                    value={mail}
                    onChange={(e) => setMail(e.target.value)}
                    aria-invalid={tried && !/^\S+@\S+\.\S+$/.test(mail)}
                  />
                </div>
                <div className="cs-field">
                  <label htmlFor="cs-why">{copy.form.reason}</label>
                  <textarea id="cs-why" rows={2} />
                </div>
                <label className="cs-check">
                  <input
                    type="checkbox"
                    checked={remind}
                    onChange={(e) => setRemind(e.target.checked)}
                  />
                  <span>{copy.form.remind}</span>
                </label>
                {tried && !dataOk ? (
                  <p className="cs-warn" role="alert">
                    {copy.form.missing}
                  </p>
                ) : null}
                <div className="cs-actions">
                  <button
                    type="button"
                    className="cs-btn"
                    data-quiet="true"
                    onClick={() => setStep(1)}
                  >
                    {copy.form.back}
                  </button>
                  <button type="submit" className="cs-btn">
                    {copy.form.next}
                  </button>
                </div>
              </form>
            ) : null}

            {step === 3 ? (
              <div className="cs-step">
                <dl className="cs-dl">
                  <div>
                    <dt>{copy.summary.with}</dt>
                    <dd>{pro.name}</dd>
                  </div>
                  <div>
                    <dt>{copy.summary.where}</dt>
                    <dd>{pro.place}</dd>
                  </div>
                  <div>
                    <dt>{copy.summary.when}</dt>
                    <dd>Mar 10 nov · {slot}</dd>
                  </div>
                  <div>
                    <dt>{copy.summary.who}</dt>
                    <dd>{name}</dd>
                  </div>
                </dl>
                <p className="kit-small">
                  {remind
                    ? "Recordatorio por correo activado."
                    : "Sin recordatorio."}
                </p>
                <div className="cs-actions">
                  <button
                    type="button"
                    className="cs-btn"
                    data-quiet="true"
                    onClick={() => setStep(2)}
                  >
                    {copy.form.back}
                  </button>
                  <button
                    type="button"
                    className="cs-btn"
                    onClick={() => setDone(true)}
                  >
                    {copy.form.confirm}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
