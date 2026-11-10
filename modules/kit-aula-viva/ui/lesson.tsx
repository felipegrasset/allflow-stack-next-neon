"use client"

import { Play } from "lucide-react"
import { useState } from "react"

import { StateBlock, SuccessState } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Lección: reproductor de maqueta con subtítulos, notas con el minuto y quiz con retroalimentación. */
export function Lesson() {
  const l = copy.lesson
  const q = copy.quiz
  const [note, setNote] = useState("")
  const [notes, setNotes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [result, setResult] = useState<"ok" | "bad" | "none" | null>(null)

  function check() {
    if (!pick) return setResult("none")
    setResult(q.options.find((o) => o.id === pick)!.ok ? "ok" : "bad")
  }

  return (
    <div className="av-lesson">
      <div className="av-player">
        <div className="av-screen">
          <button type="button" className="av-play" aria-label={l.play}>
            <Play className="size-6" aria-hidden="true" />
          </button>
          <p className="av-caption">{l.captions}</p>
        </div>
        <div className="av-bar" role="presentation">
          <span style={{ width: "59%" }} />
        </div>
        <p className="kit-small">{l.time}</p>
      </div>

      <section className="kit-card av-notes" aria-labelledby="av-notes">
        <h3 id="av-notes" className="kit-h3">
          {l.notesTitle}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!note.trim()) return
            setNotes((n) => [note.trim(), ...n])
            setNote("")
            setSaved(true)
          }}
        >
          <label htmlFor="av-note" className="av-label">
            {l.notesLabel}
          </label>
          <textarea
            id="av-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="av-note-help"
          />
          <p id="av-note-help" className="kit-small">
            {l.notesHelp}
          </p>
          <button type="submit" className="av-btn">
            {l.notesSave}
          </button>
        </form>
        <p className="kit-small" role="status">
          {saved ? l.saved : ""}
        </p>
        {notes.length ? (
          <ul className="av-notelist">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="kit-small">{l.emptyNotes}</p>
        )}
      </section>

      <section className="kit-card av-quiz" aria-labelledby="av-quiz">
        <h3 id="av-quiz" className="kit-h3">
          {q.title}
        </h3>
        <fieldset>
          <legend className="av-question">{q.question}</legend>
          <div className="av-answers">
            {q.options.map((o) => (
              <label key={o.id} className="av-answer">
                <input
                  type="radio"
                  name="quiz"
                  value={o.id}
                  checked={pick === o.id}
                  onChange={() => {
                    setPick(o.id)
                    setResult(null)
                  }}
                />
                <span>{o.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" className="av-btn" onClick={check}>
          {q.check}
        </button>
        {result === "ok" ? (
          <SuccessState
            compact
            title={q.right.title}
            description={q.right.description}
          />
        ) : null}
        {result === "bad" ? (
          <StateBlock
            tone="warning"
            role="status"
            compact
            title={q.wrong.title}
            description={q.wrong.description}
            action={{
              label: q.retry,
              onClick: () => {
                setPick(null)
                setResult(null)
              },
            }}
          />
        ) : null}
        {result === "none" ? (
          <StateBlock tone="info" role="status" compact title={q.pick} />
        ) : null}
      </section>
    </div>
  )
}
