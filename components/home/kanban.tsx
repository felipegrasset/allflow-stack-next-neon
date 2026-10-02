"use client"

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import Link from "next/link"
import { useState, useTransition } from "react"

import { HomeEmptyState } from "./empty"
import type { HomeEmpty } from "./types"

export type KanbanColumn = { value: string; label: string }
export type KanbanCard = { id: string; title: string; subtitle?: string; status: string; href?: string }

/**
 * `kanban`: one column per enum value; drag a card to change its status
 * (`onMove` is a server action). On mobile it is a grouped list where each
 * card has a native select instead of drag and drop.
 */
export function KanbanHome({
  title,
  columns,
  cards,
  onMove,
  moveLabel = "Mover a",
  empty,
}: {
  title: string
  columns: KanbanColumn[]
  cards: KanbanCard[]
  onMove: (id: string, status: string) => Promise<void>
  moveLabel?: string
  empty: HomeEmpty
}) {
  const [state, setState] = useState(cards)
  const [, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const move = (id: string, status: string) => {
    const prev = state
    if (prev.find((c) => c.id === id)?.status === status) return
    setState((s) => s.map((c) => (c.id === id ? { ...c, status } : c)))
    startTransition(async () => {
      try {
        await onMove(id, status)
      } catch {
        setState(prev)
      }
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) move(String(e.active.id), String(e.over.id))
  }

  if (state.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <HomeEmptyState {...empty} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>

      {/* Mobile: grouped list */}
      <div className="flex flex-col gap-4 md:hidden">
        {columns.map((col) => (
          <section key={col.value} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{col.label}</h2>
            {state
              .filter((c) => c.status === col.value)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10"
                >
                  <CardBody card={c} />
                  <select
                    aria-label={`${moveLabel}: ${c.title}`}
                    value={c.status}
                    onChange={(e) => move(c.id, e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                  >
                    {columns.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </section>
        ))}
      </div>

      {/* Desktop: columns with drag and drop */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className="hidden gap-3 overflow-x-auto md:grid"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(14rem, 1fr))` }}
        >
          {columns.map((col) => (
            <Column key={col.value} col={col} cards={state.filter((c) => c.status === col.value)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function CardBody({ card }: { card: KanbanCard }) {
  return (
    <>
      {card.href ? (
        <Link href={card.href} className="font-medium hover:underline">
          {card.title}
        </Link>
      ) : (
        <span className="font-medium">{card.title}</span>
      )}
      {card.subtitle && <span className="text-xs text-muted-foreground">{card.subtitle}</span>}
    </>
  )
}

function Column({ col, cards }: { col: KanbanColumn; cards: KanbanCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.value })
  return (
    <section
      ref={setNodeRef}
      data-testid="home-kanban-column"
      className={`flex min-h-32 flex-col gap-2 rounded-xl bg-muted/50 p-2 ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      <h2 className="px-1 text-sm font-medium">
        {col.label} <span className="text-muted-foreground">{cards.length}</span>
      </h2>
      {cards.map((c) => (
        <DraggableCard key={c.id} card={c} />
      ))}
    </section>
  )
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid="home-kanban-card"
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`flex cursor-grab touch-none flex-col gap-1 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <CardBody card={card} />
    </div>
  )
}
