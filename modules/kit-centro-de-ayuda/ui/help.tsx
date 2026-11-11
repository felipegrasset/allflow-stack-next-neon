"use client"

import { Search } from "lucide-react"
import { useState } from "react"

import {
  NoResultsState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Buscador, temas, lista, artículo con valoración: comparten estado. */
export function Help() {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("todas")
  const [aid, setAid] = useState<string | null>(null)
  const [vote, setVote] = useState<null | "yes" | "no">(null)

  const n = q.trim().toLowerCase()
  const list = copy.articles.filter(
    (a) =>
      (cat === "todas" || a.cat === cat) &&
      (!n || `${a.title} ${a.summary}`.toLowerCase().includes(n))
  )
  const art = copy.articles.find((a) => a.id === aid) ?? null
  const a = copy.article

  return (
    <div id="buscar" className="ay-help">
      <div className="ay-search">
        <Search className="size-5" aria-hidden="true" />
        <label htmlFor="ay-q" className="sr-only">
          {copy.searchLabel}
        </label>
        <input
          id="ay-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={copy.searchPlaceholder}
        />
      </div>
      <div className="ay-cats" role="group" aria-label="Temas">
        {copy.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ay-cat"
            aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="kit-small" role="status">
        {copy.count(list.length)}
      </p>

      <div className="ay-grid">
        <div>
          {list.length ? (
            <ul className="ay-list">
              {list.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="ay-item"
                    aria-pressed={x.id === aid}
                    onClick={() => {
                      setAid(x.id)
                      setVote(null)
                    }}
                  >
                    <span className="ay-item__title">{x.title}</span>
                    <span className="kit-small">{x.summary}</span>
                    <span className="kit-small">{a.time(x.mins)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <NoResultsState
              title={copy.states.noResults.title}
              description={copy.states.noResults.description}
              action={{
                label: copy.states.noResults.action,
                onClick: () => {
                  setQ("")
                  setCat("todas")
                },
              }}
            />
          )}
        </div>

        <article
          className="kit-card ay-article"
          aria-live="polite"
          aria-label="Artículo"
        >
          {art ? (
            <>
              <p className="kit-small">
                {a.time(art.mins)} · {a.updated(art.updated)}
              </p>
              <h3 className="kit-h2">{art.title}</h3>
              <p className="kit-lead">{art.summary}</p>
              <h4 className="ay-sub">{a.stepsTitle}</h4>
              <ol className="ay-steps">
                {art.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="ay-vote">
                <p className="ay-sub">{a.helpful}</p>
                {vote === null ? (
                  <div className="ay-vote__btns">
                    <button
                      type="button"
                      className="ay-btn"
                      onClick={() => setVote("yes")}
                    >
                      {a.yes}
                    </button>
                    <button
                      type="button"
                      className="ay-btn"
                      data-quiet="true"
                      onClick={() => setVote("no")}
                    >
                      {a.no}
                    </button>
                  </div>
                ) : vote === "yes" ? (
                  <SuccessState
                    compact
                    title={a.thanks.title}
                    description={a.thanks.description}
                  />
                ) : (
                  <StateBlock
                    tone="info"
                    role="status"
                    compact
                    title={a.more.title}
                    description={a.more.description}
                    action={{ label: a.more.action, href: "#contacto" }}
                  />
                )}
              </div>
            </>
          ) : (
            <StateBlock compact title={a.pick} />
          )}
        </article>
      </div>
    </div>
  )
}

export function Contact() {
  const c = copy.contact
  const [mail, setMail] = useState("")
  const [topic, setTopic] = useState(c.topics[0])
  const [msg, setMsg] = useState("")
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(false)
  const ok = /^\S+@\S+\.\S+$/.test(mail) && msg.trim().length >= 10

  if (done)
    return (
      <SuccessState
        title={c.done.title}
        description={c.done.description(mail)}
        action={{
          label: c.done.again,
          onClick: () => {
            setDone(false)
            setMsg("")
            setTried(false)
          },
        }}
      />
    )
  return (
    <form
      className="ay-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (ok) setDone(true)
      }}
    >
      <div className="ay-field">
        <label htmlFor="ay-mail">{c.mail}</label>
        <input
          id="ay-mail"
          type="email"
          autoComplete="email"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          aria-invalid={tried && !/^\S+@\S+\.\S+$/.test(mail)}
        />
      </div>
      <div className="ay-field">
        <label htmlFor="ay-topic">{c.topic}</label>
        <select
          id="ay-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          {c.topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="ay-field">
        <label htmlFor="ay-msg">{c.msg}</label>
        <textarea
          id="ay-msg"
          rows={4}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          aria-invalid={tried && msg.trim().length < 10}
        />
      </div>
      {tried && !ok ? (
        <p className="ay-warn" role="alert">
          {c.missing}
        </p>
      ) : null}
      <button type="submit" className="ay-btn">
        {c.send}
      </button>
    </form>
  )
}
