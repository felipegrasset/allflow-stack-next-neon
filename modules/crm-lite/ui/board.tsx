"use client"

import { useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVerticalIcon } from "lucide-react"
import { useLocale } from "next-intl"

import {
  useModuleCopy,
  type ModuleCopy,
} from "@/modules/i18n/contracts/client"
import { cn } from "@/lib/utils"

import {
  DEAL_STAGES,
  isDealStage,
  type BoardDeal,
  type DealStage,
} from "../contracts/domain"
import { es } from "../messages"
import { moveDealAction } from "../server/actions"
import { asLocale, formatMoney, totalsByCurrency } from "./format"

type Copy = ModuleCopy<typeof es>

/**
 * The pipeline: one droppable column per stage, one draggable card per deal.
 * Moving is optimistic (`useOptimistic`): the card jumps at once, the Server
 * Action confirms, and on failure React drops the optimistic state and the
 * card goes back. Every card also has a stage selector, so moving works without
 * a pointer (keyboard, screen reader, phone).
 */
export function Board({
  deals,
  canWrite,
}: {
  deals: BoardDeal[]
  canWrite: boolean
}) {
  const copy = useModuleCopy(es)
  const locale = asLocale(useLocale())
  const [, startTransition] = useTransition()
  const [status, setStatus] = useState("")
  const [view, applyMove] = useOptimistic(
    deals,
    (state, m: { id: string; to: DealStage }) =>
      state.map((d) => (d.id === m.id ? { ...d, stage: m.to } : d))
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const byId = new Map(view.map((d) => [d.id, d]))
  const nameOf = (id: string | number) => byId.get(String(id))?.name ?? ""
  const stageName = (id: string | number | undefined) =>
    isDealStage(id) ? copy.stages[id] : ""

  const move = (deal: BoardDeal, to: DealStage) => {
    if (!canWrite || deal.stage === to) return
    const from = deal.stage
    startTransition(async () => {
      applyMove({ id: deal.id, to })
      const res = await moveDealAction({ id: deal.id, from, to })
      if (res.ok) setStatus(copy.pipeline.moved(deal.name, copy.stages[to]))
      else if (res.reason === "conflict")
        setStatus(copy.pipeline.moveConflict(deal.name))
      else if (res.reason === "forbidden") setStatus(copy.pipeline.readOnly)
      else setStatus(copy.pipeline.moveFailed(deal.name))
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const deal = byId.get(String(active.id))
    if (deal && over && isDealStage(over.id)) move(deal, over.id)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => copy.pipeline.dnd.start(nameOf(active.id)),
    onDragOver: ({ active, over }) =>
      over
        ? copy.pipeline.dnd.over(nameOf(active.id), stageName(over.id))
        : copy.pipeline.dnd.overNone(nameOf(active.id)),
    onDragEnd: ({ active, over }) =>
      over
        ? copy.pipeline.dnd.end(nameOf(active.id), stageName(over.id))
        : copy.pipeline.dnd.endNone(nameOf(active.id)),
    onDragCancel: ({ active }) => copy.pipeline.dnd.cancel(nameOf(active.id)),
  }

  return (
    <div className="flex flex-col gap-2">
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">{copy.pipeline.readOnly}</p>
      ) : null}
      <DndContext
        id="crm-lite-board"
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: copy.pipeline.dnd.instructions,
          },
        }}
      >
        <div
          role="group"
          aria-label={copy.pipeline.boardLabel}
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
        >
          {DEAL_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              deals={view.filter((d) => d.stage === stage)}
              copy={copy}
              locale={locale}
              canWrite={canWrite}
              onMove={move}
            />
          ))}
        </div>
      </DndContext>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

function Column({
  stage,
  deals,
  copy,
  locale,
  canWrite,
  onMove,
}: {
  stage: DealStage
  deals: BoardDeal[]
  copy: Copy
  locale: ReturnType<typeof asLocale>
  canWrite: boolean
  onMove: (deal: BoardDeal, to: DealStage) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const headingId = `crm-stage-${stage}`
  const total = totalsByCurrency(deals, locale)
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "flex min-h-32 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2 transition-colors",
        isOver && "border-ring bg-accent"
      )}
    >
      <header className="flex flex-col gap-0.5 px-1">
        <h2 id={headingId} className="text-sm font-semibold">
          {copy.stages[stage]}
        </h2>
        <span className="text-xs text-muted-foreground">
          {copy.pipeline.columnCount(deals.length)}
          {total ? ` · ${total}` : ""}
        </span>
      </header>
      {deals.length === 0 ? (
        <p className="px-1 py-4 text-xs text-muted-foreground">
          {copy.pipeline.emptyStage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              copy={copy}
              locale={locale}
              canWrite={canWrite}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function DealCard({
  deal,
  copy,
  locale,
  canWrite,
  onMove,
}: {
  deal: BoardDeal
  copy: Copy
  locale: ReturnType<typeof asLocale>
  canWrite: boolean
  onMove: (deal: BoardDeal, to: DealStage) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id, disabled: !canWrite })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined
  const selectId = `crm-deal-stage-${deal.id}`
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-card-foreground shadow-xs",
        isDragging && "relative z-10 shadow-lg ring-2 ring-ring"
      )}
    >
      <div className="flex items-start gap-1">
        {canWrite ? (
          <button
            type="button"
            className="-ml-0.5 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            aria-label={copy.pipeline.dragHandle(deal.name)}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{deal.name}</span>
          <Link
            href={`/crm/contacts/${deal.contactId}`}
            className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {deal.contactCompany
              ? `${deal.contactName} · ${deal.contactCompany}`
              : deal.contactName}
          </Link>
        </div>
      </div>
      <span className="text-sm tabular-nums">
        {formatMoney(deal.amountMinor, deal.currency, locale)}
      </span>
      {canWrite ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            {copy.pipeline.moveLabel(deal.name)}
          </label>
          <select
            id={selectId}
            value={deal.stage}
            onChange={(e) => {
              if (isDealStage(e.target.value)) onMove(deal, e.target.value)
            }}
            className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {copy.stages[s]}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </li>
  )
}
