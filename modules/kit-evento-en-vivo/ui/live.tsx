"use client"

import { Download, Search } from "lucide-react"
import { useState } from "react"

import {
  NoResultsState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Agenda con pestañas por día (flechas del teclado incluidas). */
export function Agenda() {
  const [i, setI] = useState(0)
  const day = copy.days[i]
  return (
    <div>
      <div role="tablist" aria-label="Días del evento" className="ev-tabs">
        {copy.days.map((d, k) => (
          <button
            key={d.id}
            id={`ev-tab-${d.id}`}
            role="tab"
            type="button"
            className="ev-tab"
            aria-selected={k === i}
            aria-controls="ev-panel"
            tabIndex={k === i ? 0 : -1}
            onClick={() => setI(k)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setI((i + 1) % copy.days.length)
              if (e.key === "ArrowLeft")
                setI((i + copy.days.length - 1) % copy.days.length)
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div
        id="ev-panel"
        role="tabpanel"
        aria-labelledby={`ev-tab-${day.id}`}
        tabIndex={0}
      >
        <ol className="ev-agenda">
          {day.items.map((x) => (
            <li key={x.t} className="ev-session">
              <time>{x.t}</time>
              <span className="ev-session__body">
                <span className="ev-session__name">{x.n}</span>
                <span className="kit-small">{x.who}</span>
              </span>
              <span className="ev-kind">{x.kind}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function Register() {
  const r = copy.register
  const [name, setName] = useState("")
  const [mail, setMail] = useState("")
  const [mode, setMode] = useState(r.roles[0])
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(false)
  const valid = name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(mail)

  if (done)
    return (
      <SuccessState
        title={r.done.title}
        description={r.done.description(mail)}
        action={{
          label: r.done.again,
          onClick: () => {
            setDone(false)
            setName("")
            setMail("")
            setTried(false)
          },
        }}
      />
    )
  return (
    <form
      className="ev-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (valid) setDone(true)
      }}
    >
      <div className="ev-field">
        <label htmlFor="ev-name">{r.name}</label>
        <input
          id="ev-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={tried && name.trim().length < 2}
        />
      </div>
      <div className="ev-field">
        <label htmlFor="ev-mail">{r.mail}</label>
        <input
          id="ev-mail"
          type="email"
          autoComplete="email"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          aria-invalid={tried && !/^\S+@\S+\.\S+$/.test(mail)}
        />
      </div>
      <fieldset className="ev-radios">
        <legend>{r.role}</legend>
        {r.roles.map((o) => (
          <label key={o} className="ev-radio">
            <input
              type="radio"
              name="mode"
              checked={mode === o}
              onChange={() => setMode(o)}
            />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
      {tried && !valid ? (
        <p className="ev-warn" role="alert">
          {r.missing}
        </p>
      ) : null}
      <button type="submit" className="ev-btn">
        {r.cta}
      </button>
    </form>
  )
}

export function Waiting() {
  const w = copy.waiting
  const [msgs, setMsgs] = useState(w.messages)
  const [text, setText] = useState("")
  return (
    <div className="ev-chat">
      {msgs.length ? (
        <ul className="ev-msgs" aria-live="polite">
          {msgs.map((m, i) => (
            <li key={i} data-own={m.who === "Tú"}>
              <span className="kit-small">
                {m.who} · {m.ago}
              </span>
              <span>{m.t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <StateBlock compact title={w.empty} />
      )}
      <form
        className="ev-chatform"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          setMsgs((a) => [...a, { who: "Tú", t: text.trim(), ago: "ahora" }])
          setText("")
        }}
      >
        <label htmlFor="ev-msg" className="sr-only">
          {w.label}
        </label>
        <input
          id="ev-msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={w.label}
        />
        <button type="submit" className="ev-btn">
          {w.send}
        </button>
      </form>
    </div>
  )
}

export function Poll() {
  const p = copy.poll
  const [pick, setPick] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const total = p.options.reduce((a, o) => a + o.v, 0) + (voted ? 1 : 0)
  return (
    <div className="ev-poll">
      {!voted ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (pick) setVoted(true)
          }}
        >
          <fieldset className="ev-radios">
            <legend className="ev-q">{p.question}</legend>
            {p.options.map((o) => (
              <label key={o.id} className="ev-radio">
                <input
                  type="radio"
                  name="poll"
                  checked={pick === o.id}
                  onChange={() => setPick(o.id)}
                />
                <span>{o.t}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="ev-btn" disabled={!pick}>
            {p.cta}
          </button>
          {!pick ? <p className="kit-small mt-2">{p.pick}</p> : null}
        </form>
      ) : (
        <div>
          <p className="ev-q">{p.thanks}</p>
          <ul className="ev-results">
            {p.options.map((o) => {
              const v = o.v + (o.id === pick ? 1 : 0)
              const pct = Math.round((v / total) * 100)
              return (
                <li key={o.id}>
                  <span>
                    {o.t} · {pct} %
                  </span>
                  <span className="ev-bar" role="presentation">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Directory() {
  const d = copy.directory
  const [q, setQ] = useState("")
  const n = q.trim().toLowerCase()
  const list = d.people.filter(
    (x) => !n || `${x.n} ${x.c} ${x.i}`.toLowerCase().includes(n)
  )
  return (
    <div>
      <div className="ev-search">
        <Search className="size-4" aria-hidden="true" />
        <label htmlFor="ev-q" className="sr-only">
          {d.label}
        </label>
        <input
          id="ev-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={d.placeholder}
        />
      </div>
      {list.length ? (
        <ul className="ev-people">
          {list.map((x) => (
            <li key={x.n} className="kit-card ev-person">
              <span className="ev-avatar" aria-hidden="true">
                {x.n
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </span>
              <span className="ev-session__body">
                <span className="ev-session__name">{x.n}</span>
                <span className="kit-small">
                  {x.c} · {x.i}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <NoResultsState
          compact
          title={d.none.title}
          description={d.none.description}
          action={{ label: d.none.action, onClick: () => setQ("") }}
        />
      )}
    </div>
  )
}

export function Materials() {
  const m = copy.materials
  return (
    <ul className="ev-materials">
      {m.list.map((x) => (
        <li key={x.n}>
          <span className="ev-session__body">
            <span className="ev-session__name">{x.n}</span>
            <span className="kit-small">{x.s}</span>
          </span>
          {x.ready ? (
            <a
              className="ev-btn"
              data-quiet="true"
              href="#material"
              aria-label={`${m.get}: ${x.n}`}
            >
              <Download className="size-4" aria-hidden="true" />
              {m.get}
            </a>
          ) : (
            <span className="ev-kind">{m.soon}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
