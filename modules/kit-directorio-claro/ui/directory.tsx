"use client"

import { Heart, Search } from "lucide-react"
import { useState } from "react"

import {
  NoResultsState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Buscador con filtros, lista y mapa, ficha, favoritos, contacto y comparador. */
export function Directory() {
  const [q, setQ] = useState("")
  const [kind, setKind] = useState("Todos")
  const [zone, setZone] = useState("Todas")
  const [max, setMax] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [favs, setFavs] = useState<string[]>([])
  const [cmp, setCmp] = useState<string[]>([])
  const [name, setName] = useState("")
  const [mail, setMail] = useState("")
  const [msg, setMsg] = useState(copy.contact.msgDefault)
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState(false)

  const n = q.trim().toLowerCase()
  const list = copy.listings.filter(
    (l) =>
      (kind === "Todos" || l.kind === kind) &&
      (zone === "Todas" || l.zone === zone) &&
      (!max || l.price <= max) &&
      (!n || `${l.title} ${l.zone}`.toLowerCase().includes(n))
  )
  const item = copy.listings.find((l) => l.id === sel) ?? null
  const toggle = (arr: string[], id: string, cap = 99) =>
    arr.includes(id)
      ? arr.filter((x) => x !== id)
      : arr.length >= cap
        ? arr
        : [...arr, id]
  const validMail = /^\S+@\S+\.\S+$/.test(mail)
  const compared = cmp
    .map((id) => copy.listings.find((l) => l.id === id)!)
    .filter(Boolean)
  const clear = () => {
    setQ("")
    setKind("Todos")
    setZone("Todas")
    setMax(0)
  }

  return (
    <div className="dc">
      <div id="buscar" className="dc-filters">
        <div className="dc-search">
          <Search className="size-4" aria-hidden="true" />
          <label htmlFor="dc-q" className="sr-only">
            {copy.searchLabel}
          </label>
          <input
            id="dc-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>
        <div className="dc-chips" role="group" aria-label="Tipo">
          {copy.kinds.map((k) => (
            <button
              key={k}
              type="button"
              className="dc-chip"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="dc-selects">
          <label className="dc-select">
            <span>{copy.zoneLabel}</span>
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {copy.zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label className="dc-select">
            <span>{copy.maxLabel}</span>
            <select
              value={max}
              onChange={(e) => setMax(Number(e.target.value))}
            >
              {copy.maxes.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </label>
          <p className="kit-small dc-count" role="status">
            {copy.count(list.length)} · {copy.fav.count(favs.length)}
          </p>
        </div>
      </div>

      <div className="dc-grid">
        <div>
          {list.length ? (
            <ul className="dc-list">
              {list.map((l) => (
                <li
                  key={l.id}
                  className="kit-card dc-card"
                  data-sel={l.id === sel}
                >
                  <button
                    type="button"
                    className="dc-card__main"
                    aria-pressed={l.id === sel}
                    onClick={() => {
                      setSel(l.id)
                      setSent(false)
                    }}
                  >
                    <span className="dc-thumb" aria-hidden="true">
                      {l.kind[0]}
                    </span>
                    <span className="dc-card__text">
                      <span className="dc-price">
                        {copy.money(l.price)} <small>{copy.unitMonth}</small>
                      </span>
                      <span className="dc-title">{l.title}</span>
                      <span className="kit-small">
                        {l.zone} · {l.m2} m² · {copy.detail.rooms(l.rooms)}
                      </span>
                    </span>
                  </button>
                  <div className="dc-card__actions">
                    <button
                      type="button"
                      className="dc-icon"
                      aria-pressed={favs.includes(l.id)}
                      aria-label={`${favs.includes(l.id) ? copy.fav.on : copy.fav.off}: ${l.title}`}
                      onClick={() => setFavs((f) => toggle(f, l.id))}
                    >
                      <Heart className="size-4" aria-hidden="true" />
                    </button>
                    <label className="dc-cmp">
                      <input
                        type="checkbox"
                        checked={cmp.includes(l.id)}
                        onChange={() => setCmp((c) => toggle(c, l.id, 2))}
                        aria-label={`${copy.compare.add}: ${l.title}`}
                      />
                      <span>{copy.compare.add}</span>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <NoResultsState
              title={copy.states.noResults.title}
              description={copy.states.noResults.description}
              action={{ label: copy.states.noResults.action, onClick: clear }}
            />
          )}
        </div>

        <div className="dc-side">
          <section className="kit-card dc-mapcard" aria-labelledby="dc-map">
            <h3 id="dc-map" className="kit-h3">
              {copy.mapTitle}
            </h3>
            <p className="kit-small">{copy.mapHelp}</p>
            <div className="dc-map">
              {list.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="dc-pin"
                  style={{ left: `${l.x}%`, top: `${l.y}%` }}
                  aria-pressed={l.id === sel}
                  aria-label={copy.pin(l.title)}
                  onClick={() => {
                    setSel(l.id)
                    setSent(false)
                  }}
                >
                  <span aria-hidden="true">{Math.round(l.price / 1000)}</span>
                </button>
              ))}
            </div>
          </section>

          <section
            className="kit-card dc-detail"
            aria-labelledby="dc-det"
            aria-live="polite"
          >
            <h3 id="dc-det" className="kit-h3">
              {copy.detail.title}
            </h3>
            {item ? (
              <>
                <p className="dc-title">{item.title}</p>
                <p className="dc-price">
                  {copy.money(item.price)} <small>{copy.unitMonth}</small>
                </p>
                <p className="kit-small">
                  {item.zone} · {item.m2} m² · {copy.detail.rooms(item.rooms)}
                </p>
                <p className="text-sm">{item.about}</p>
                {sent ? (
                  <SuccessState
                    compact
                    title={copy.contact.done.title}
                    description={copy.contact.done.description(item.agent)}
                    action={{
                      label: copy.contact.done.again,
                      onClick: () => {
                        setSent(false)
                        setTried(false)
                      },
                    }}
                  />
                ) : (
                  <form
                    className="dc-form"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      setTried(true)
                      if (name.trim().length > 1 && validMail) setSent(true)
                    }}
                  >
                    <p className="dc-label">
                      {copy.contact.title}: {item.agent}
                    </p>
                    <div className="dc-field">
                      <label htmlFor="dc-name">{copy.contact.name}</label>
                      <input
                        id="dc-name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={tried && name.trim().length < 2}
                      />
                    </div>
                    <div className="dc-field">
                      <label htmlFor="dc-mail">{copy.contact.mail}</label>
                      <input
                        id="dc-mail"
                        type="email"
                        autoComplete="email"
                        value={mail}
                        onChange={(e) => setMail(e.target.value)}
                        aria-invalid={tried && !validMail}
                      />
                    </div>
                    <div className="dc-field">
                      <label htmlFor="dc-msg">{copy.contact.msg}</label>
                      <textarea
                        id="dc-msg"
                        rows={3}
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                      />
                    </div>
                    {tried && !(name.trim().length > 1 && validMail) ? (
                      <p className="dc-warn" role="alert">
                        {copy.contact.missing}
                      </p>
                    ) : null}
                    <button type="submit" className="dc-btn">
                      {copy.contact.send}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <StateBlock compact title={copy.detail.pick} />
            )}
          </section>
        </div>
      </div>

      <section id="comparar" aria-labelledby="dc-cmp" className="dc-compare">
        <h2 id="dc-cmp" className="kit-h2">
          {copy.compare.title}
        </h2>
        <p className="kit-small mt-2">{copy.compare.max}</p>
        {compared.length === 2 ? (
          <table className="dc-table mt-4">
            <caption className="sr-only">{copy.compare.title}</caption>
            <thead>
              <tr>
                <td />
                {compared.map((c) => (
                  <th key={c.id} scope="col">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                (c: (typeof compared)[0]) => copy.money(c.price),
                (c: (typeof compared)[0]) => String(c.rooms),
                (c: (typeof compared)[0]) => `${c.m2} m²`,
                (c: (typeof compared)[0]) => c.zone,
                (c: (typeof compared)[0]) =>
                  copy.money(Math.round(c.price / c.m2)),
              ].map((fn, i) => (
                <tr key={i}>
                  <th scope="row">{copy.compare.rows[i]}</th>
                  {compared.map((c) => (
                    <td key={c.id}>{fn(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-4">
            <StateBlock compact title={copy.compare.pick} />
          </div>
        )}
      </section>
    </div>
  )
}
