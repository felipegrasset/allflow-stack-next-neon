"use client"

import { useMemo, useState } from "react"

import { EmptyState, SuccessState } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

const money = (n: number) => "$ " + n.toLocaleString("es-CL")

/** Una hora está ocupada según el día y el profesional (determinista, para la maqueta). */
function taken(dayIdx: number, proIdx: number, slotIdx: number) {
  return (dayIdx * 5 + proIdx * 3 + slotIdx * 7) % 4 === 0
}

export function Booking() {
  const [service, setService] = useState("corte")
  const [pro, setPro] = useState("any")
  const [day, setDay] = useState("d10")
  const [slot, setSlot] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [remind, setRemind] = useState(true)
  const [done, setDone] = useState(false)
  const [tried, setTried] = useState(false)

  const svc = copy.services.find((s) => s.id === service)!
  const dayIdx = copy.days.findIndex((d) => d.id === day)
  const dayObj = copy.days[dayIdx]
  const proIdx = copy.pros.findIndex((p) => p.id === pro)
  const proObj = copy.pros[proIdx]
  const free = useMemo(
    () => copy.slots.map((t, i) => ({ t, busy: taken(dayIdx, proIdx, i) })),
    [dayIdx, proIdx]
  )
  const whenLabel = slot ? `${dayObj.dow} ${dayObj.num} a las ${slot}` : null
  const ready = Boolean(slot && name.trim() && phone.trim())

  function reset() {
    setDone(false)
    setSlot(null)
    setTried(false)
  }

  if (done)
    return (
      <div className="rs-done">
        <SuccessState
          title={copy.done.title}
          description={copy.done.description(
            `${dayObj.dow} ${dayObj.num} a las ${slot}`,
            name.split(" ")[0]
          )}
          action={{ label: copy.done.again, onClick: reset }}
        />
      </div>
    )

  return (
    <form
      className="rs-grid"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (ready) setDone(true)
      }}
      noValidate
    >
      <div className="rs-steps">
        <fieldset className="rs-step">
          <legend className="kit-h3">{copy.steps.service}</legend>
          <div className="rs-options">
            {copy.services.map((s) => (
              <label key={s.id} className="rs-option">
                <input
                  type="radio"
                  name="service"
                  value={s.id}
                  checked={service === s.id}
                  onChange={() => setService(s.id)}
                />
                <span className="rs-option__body">
                  <span className="rs-option__title">{s.name}</span>
                  <span className="kit-small">
                    {s.mins} min · {s.note}
                  </span>
                </span>
                <span className="rs-price">{money(s.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rs-step">
          <legend className="kit-h3">{copy.steps.pro}</legend>
          <div className="rs-pros">
            {copy.pros.map((p) => (
              <label key={p.id} className="rs-pro">
                <input
                  type="radio"
                  name="pro"
                  value={p.id}
                  checked={pro === p.id}
                  onChange={() => {
                    setPro(p.id)
                    setSlot(null)
                  }}
                />
                <span className="rs-pro__body">
                  <span className="rs-avatar" aria-hidden="true">
                    {p.id === "any" ? "★" : p.name[0]}
                  </span>
                  <span className="rs-option__title">{p.name}</span>
                  <span className="kit-small">{p.role}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rs-step">
          <legend className="kit-h3">{copy.steps.when}</legend>
          <div className="rs-days">
            {copy.days.map((d) => (
              <label key={d.id} className="rs-day" data-closed={!d.open}>
                <input
                  type="radio"
                  name="day"
                  value={d.id}
                  checked={day === d.id}
                  onChange={() => {
                    setDay(d.id)
                    setSlot(null)
                  }}
                />
                <span className="rs-day__body">
                  <span className="kit-small rs-day__dow">{d.dow}</span>
                  <span className="rs-day__num">{d.num}</span>
                </span>
              </label>
            ))}
          </div>
          {dayObj.open ? (
            <>
              <div
                className="rs-slots"
                role="group"
                aria-label="Horas disponibles"
              >
                {free.map(({ t, busy }) => (
                  <button
                    key={t}
                    type="button"
                    className="rs-slot"
                    disabled={busy}
                    aria-pressed={slot === t}
                    onClick={() => setSlot(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="kit-small">{copy.slotsLegend}</p>
            </>
          ) : (
            <EmptyState
              compact
              title={copy.closed.title}
              description={copy.closed.description}
              action={{
                label: copy.closed.action,
                onClick: () => setDay("d16"),
              }}
            />
          )}
        </fieldset>

        <fieldset className="rs-step">
          <legend className="kit-h3">{copy.steps.you}</legend>
          <div className="rs-fields">
            <div className="rs-field">
              <label htmlFor="rs-name">{copy.form.name}</label>
              <input
                id="rs-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={tried && !name.trim()}
              />
            </div>
            <div className="rs-field">
              <label htmlFor="rs-phone">{copy.form.phone}</label>
              <input
                id="rs-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={tried && !phone.trim()}
              />
            </div>
            <div className="rs-field rs-field--wide">
              <label htmlFor="rs-note">{copy.form.note}</label>
              <textarea id="rs-note" rows={2} />
            </div>
          </div>
          <label className="rs-check">
            <input
              type="checkbox"
              checked={remind}
              onChange={(e) => setRemind(e.target.checked)}
            />
            <span>{copy.form.remind}</span>
          </label>
        </fieldset>
      </div>

      <aside className="rs-summary kit-card" aria-labelledby="rs-sum">
        <h2 id="rs-sum" className="kit-h3">
          {copy.summary.title}
        </h2>
        <dl className="rs-dl">
          <div>
            <dt>{svc.name}</dt>
            <dd>{money(svc.price)}</dd>
          </div>
          <div>
            <dt>{copy.summary.who}</dt>
            <dd>{proObj.name}</dd>
          </div>
          <div>
            <dt>{copy.summary.when}</dt>
            <dd>{whenLabel ?? copy.summary.empty}</dd>
          </div>
          <div className="rs-total">
            <dt>{copy.summary.total}</dt>
            <dd>{money(svc.price)}</dd>
          </div>
        </dl>
        {tried && !ready ? (
          <p className="rs-warn" role="alert">
            {copy.form.missing}
          </p>
        ) : null}
        <button type="submit" className="rs-btn">
          {copy.form.submit}
        </button>
        <p className="kit-small">
          {remind ? "Recordatorio activado." : "Sin recordatorio."}
        </p>
      </aside>
    </form>
  )
}
