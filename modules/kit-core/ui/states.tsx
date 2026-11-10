"use client"

import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Inbox,
  Lock,
  SearchX,
  ServerCrash,
} from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/button-link"
import { cn } from "@/lib/utils"

import { kitCopy } from "./copy"
import "./kit-core.css"

export type KitTone = "neutral" | "info" | "success" | "warning" | "danger"

/** Una acción: o un callback (cliente) o un enlace (servidor). */
export type KitAction = { label: string } & (
  { onClick: () => void; href?: never } | { href: string; onClick?: never }
)

type BlockProps = {
  tone?: KitTone
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Contenido extra (por ejemplo la lista de un estado parcial). */
  children?: ReactNode
  action?: KitAction
  secondaryAction?: KitAction
  /** Menos aire: para usarlo dentro de una tarjeta o una tabla. */
  compact?: boolean
  /** `alert` (error) interrumpe; `status` (el resto) avisa sin interrumpir. */
  role?: "alert" | "status" | "region"
  className?: string
}

function ActionButton({
  action,
  primary,
}: {
  action: KitAction
  primary: boolean
}) {
  const variant = primary ? "default" : "outline"
  if (action.href !== undefined)
    return (
      <ButtonLink href={action.href} variant={variant} size="lg">
        {action.label}
      </ButtonLink>
    )
  return (
    <Button type="button" variant={variant} size="lg" onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

/** La base de los ocho estados. Úsala directo solo si ninguno encaja. */
export function StateBlock({
  tone = "neutral",
  icon,
  title,
  description,
  children,
  action,
  secondaryAction,
  compact = false,
  role = "region",
  className,
}: BlockProps) {
  return (
    <section
      className={cn("kit-state", className)}
      data-tone={tone}
      data-compact={compact}
      role={role === "region" ? undefined : role}
      aria-label={role === "region" ? title : undefined}
    >
      {icon ? (
        <span className="kit-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3 className="kit-state__title">{title}</h3>
      {description ? <p className="kit-state__text">{description}</p> : null}
      {children}
      {action || secondaryAction ? (
        <div className="kit-state__actions">
          {action ? <ActionButton action={action} primary /> : null}
          {secondaryAction ? (
            <ActionButton action={secondaryAction} primary={false} />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

type StateProps = Partial<
  Pick<
    BlockProps,
    "title" | "description" | "compact" | "className" | "children"
  >
>

/** 1 · Vacío: la lista existe pero aún no tiene nada. Invita a crear lo primero. */
export function EmptyState({
  action,
  ...p
}: StateProps & { action?: KitAction }) {
  return (
    <StateBlock
      icon={<Inbox className="size-5" />}
      title={kitCopy.empty.title}
      description={kitCopy.empty.description}
      action={action}
      {...p}
    />
  )
}

/** 2 · Cargando: esqueleto con la forma de lo que viene. `lines` filas de texto. */
export function LoadingState({
  title = kitCopy.loading.title,
  lines = 3,
  compact,
  className,
}: {
  title?: string
  lines?: number
  compact?: boolean
  className?: string
}) {
  return (
    <section
      className={cn("kit-state", className)}
      data-tone="neutral"
      data-compact={compact}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{title}</span>
      <span className="kit-skeleton" data-shape="title" aria-hidden="true" />
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="kit-skeleton"
          aria-hidden="true"
          style={{ width: i === lines - 1 ? "70%" : "100%" }}
        />
      ))}
    </section>
  )
}

/** 3 · Error con reintento: `onRetry` (cliente) o `retryHref` (servidor). */
export function ErrorState({
  onRetry,
  retryHref,
  retryLabel = kitCopy.error.retry,
  ...p
}: StateProps & {
  onRetry?: () => void
  retryHref?: string
  retryLabel?: string
}) {
  const action: KitAction | undefined = onRetry
    ? { label: retryLabel, onClick: onRetry }
    : retryHref
      ? { label: retryLabel, href: retryHref }
      : undefined
  return (
    <StateBlock
      tone="danger"
      role="alert"
      icon={<ServerCrash className="size-5" />}
      title={kitCopy.error.title}
      description={kitCopy.error.description}
      action={action}
      {...p}
    />
  )
}

/** 4 · Éxito: confirma que algo se hizo; el siguiente paso es opcional. */
export function SuccessState({
  action,
  ...p
}: StateProps & { action?: KitAction }) {
  return (
    <StateBlock
      tone="success"
      role="status"
      icon={<CheckCircle2 className="size-5" />}
      title={kitCopy.success.title}
      description={kitCopy.success.description}
      action={action}
      {...p}
    />
  )
}

/** 5 · Sin permiso: explica quién puede dar acceso; ofrece volver. */
export function ForbiddenState({
  action,
  ...p
}: StateProps & { action?: KitAction }) {
  return (
    <StateBlock
      tone="warning"
      icon={<Lock className="size-5" />}
      title={kitCopy.forbidden.title}
      description={kitCopy.forbidden.description}
      action={action}
      {...p}
    />
  )
}

/** 6 · Sin resultados: la búsqueda o el filtro no encontró nada; ofrece quitarlos. */
export function NoResultsState({
  action,
  ...p
}: StateProps & { action?: KitAction }) {
  return (
    <StateBlock
      tone="info"
      icon={<SearchX className="size-5" />}
      title={kitCopy.noResults.title}
      description={kitCopy.noResults.description}
      action={action}
      {...p}
    />
  )
}

/** 7 · Sin conexión: el navegador no tiene red; reintentar. */
export function OfflineState({
  onRetry,
  retryHref,
  retryLabel = kitCopy.offline.retry,
  ...p
}: StateProps & {
  onRetry?: () => void
  retryHref?: string
  retryLabel?: string
}) {
  const action: KitAction | undefined = onRetry
    ? { label: retryLabel, onClick: onRetry }
    : retryHref
      ? { label: retryLabel, href: retryHref }
      : undefined
  return (
    <StateBlock
      tone="warning"
      role="status"
      icon={<CloudOff className="size-5" />}
      title={kitCopy.offline.title}
      description={kitCopy.offline.description}
      action={action}
      {...p}
    />
  )
}

/** 8 · Parcial / advertencia: se muestra lo que hay y se dice qué falta. */
export function PartialState({
  issues = [],
  action,
  ...p
}: StateProps & { issues?: string[]; action?: KitAction }) {
  return (
    <StateBlock
      tone="warning"
      role="status"
      icon={<AlertTriangle className="size-5" />}
      title={kitCopy.partial.title}
      description={kitCopy.partial.description}
      action={action}
      {...p}
    >
      {issues.length ? (
        <ul className="kit-state__list">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
    </StateBlock>
  )
}
