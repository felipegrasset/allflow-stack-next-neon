"use client"

import { Mail, Phone, Upload } from "lucide-react"
import { useState } from "react"

import { StateBlock } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Contactos con ficha, tareas del día y carga de CSV: lo que cambia con la interacción. */
export function Contacts() {
  const [id, setId] = useState(copy.contacts[0].id)
  const c = copy.contacts.find((x) => x.id === id)!
  const open = copy.deals.filter((d) => d.contact === c.id && d.stage !== "won")
  return (
    <div className="tc-contacts">
      <ul className="tc-list" role="list">
        {copy.contacts.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              className="tc-contact"
              aria-pressed={k.id === id}
              onClick={() => setId(k.id)}
            >
              <span className="tc-avatar" aria-hidden="true">
                {k.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </span>
              <span className="tc-contact__text">
                <span className="tc-deal__name">{k.name}</span>
                <span className="kit-small">{k.company}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <article
        className="kit-card tc-detail"
        aria-label={`${copy.contactLabel}: ${c.name}`}
      >
        <h3 className="kit-h3">{c.name}</h3>
        <p className="kit-small">
          {c.role} en {c.company}
        </p>
        <dl className="tc-dl">
          <div>
            <dt>
              <Mail className="size-4" aria-hidden="true" /> {copy.detail.mail}
            </dt>
            <dd>{c.mail}</dd>
          </div>
          <div>
            <dt>
              <Phone className="size-4" aria-hidden="true" />{" "}
              {copy.detail.phone}
            </dt>
            <dd>{c.phone}</dd>
          </div>
          <div>
            <dt>{copy.detail.last}</dt>
            <dd>{c.last}</dd>
          </div>
          <div>
            <dt>{copy.detail.deals}</dt>
            <dd>
              {open.length
                ? open.map((d) => d.name).join(", ")
                : copy.detail.none}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  )
}

export function Tasks() {
  const t = copy.tasks
  const [items, setItems] = useState(t.items)
  const [text, setText] = useState("")
  const left = items.filter((i) => !i.done).length
  return (
    <div className="grid gap-4">
      <ul className="tc-tasks">
        {items.map((i) => (
          <li key={i.id}>
            <label className="tc-task">
              <input
                type="checkbox"
                checked={i.done}
                onChange={() =>
                  setItems((all) =>
                    all.map((x) =>
                      x.id === i.id ? { ...x, done: !x.done } : x
                    )
                  )
                }
              />
              <span data-done={i.done}>{i.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <form
        className="tc-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          setItems((all) => [
            ...all,
            { id: `n${all.length}`, text: text.trim(), done: false },
          ])
          setText("")
        }}
      >
        <label htmlFor="tc-new" className="sr-only">
          {t.placeholder}
        </label>
        <input
          id="tc-new"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
        />
        <button type="submit" className="tc-btn">
          {t.add}
        </button>
      </form>
      <p className="kit-small" role="status">
        {left ? t.left(left) : t.clear}
      </p>
    </div>
  )
}

export function ImportCsv() {
  const m = copy.import
  const [file, setFile] = useState<string | null>(null)
  return (
    <div className="tc-import">
      <label className="tc-drop">
        <Upload className="size-5" aria-hidden="true" />
        <span className="tc-deal__name">{m.label}</span>
        <span className="kit-small">{m.help}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      {file ? (
        <StateBlock tone="info" role="status" compact title={m.chosen(file)} />
      ) : null}
    </div>
  )
}
