import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, type Locale } from "@/modules/i18n/contracts"
import { getModuleCopy, type ModuleCopy } from "@/modules/i18n/contracts/server"

import type { WhatsAppMessage } from "../contracts/types"
import { es } from "../messages"
import { canSendWhatsApp, requireWhatsAppAccess } from "../server/authz"
import { readConfig } from "../server/config"
import { store } from "../server/runtime"
import { activeLocale } from "./locale"
import { OptOutButton } from "./opt-out-button"
import { SendForm } from "./send-form"

type Copy = ModuleCopy<typeof es>

function EmptyBox({ title, description }: { title: string; description?: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  )
}

function content(m: WhatsAppMessage, copy: Copy): string {
  if (m.kind === "template")
    return copy.messages.template(m.templateName ?? "?", m.templateLang ?? "?")
  if (m.kind === "other") return copy.messages.other
  // The body is personal data: the table shows its kind, never the text.
  return copy.messages.text
}

function reason(m: WhatsAppMessage, copy: Copy): string | null {
  if (!m.errorCode) return null
  const known = copy.errors as unknown as Record<string, unknown>
  const label =
    m.errorCode !== "provider_error" && typeof known[m.errorCode] === "string"
      ? (known[m.errorCode] as string)
      : m.errorCode
  return copy.messages.reason(label)
}

function MessagesTable({ items, copy, locale }: { items: WhatsAppMessage[]; copy: Copy; locale: Locale }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{copy.messages.date}</TableHead>
          <TableHead>{copy.messages.direction}</TableHead>
          <TableHead>{copy.messages.phone}</TableHead>
          <TableHead>{copy.messages.content}</TableHead>
          <TableHead>{copy.messages.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => {
          const why = reason(m, copy)
          return (
            <TableRow key={m.id}>
              <TableCell>
                <time dateTime={m.createdAt.toISOString()}>{formatDateTime(m.createdAt, locale)}</time>
              </TableCell>
              <TableCell>{m.direction === "inbound" ? copy.messages.inbound : copy.messages.outbound}</TableCell>
              <TableCell className="font-mono text-xs">{m.phone}</TableCell>
              <TableCell>{content(m, copy)}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={m.status === "failed" || m.status === "blocked" ? "destructive" : "secondary"}>
                    {copy.messages.statusLabels[m.status]}
                  </Badge>
                  {why ? <span className="text-xs text-muted-foreground">{why}</span> : null}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export default async function WhatsAppAdminPage() {
  await requireWhatsAppAccess("/admin/whatsapp")
  const s = store()
  const [copy, locale, canSend, consents, messages] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    canSendWhatsApp(),
    s.listConsents({ limit: 50 }),
    s.listMessages({ limit: 50 }),
  ])
  const cfg = readConfig()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.page.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.page.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.config.title}</CardTitle>
          <CardDescription>
            {cfg.provider ? copy.config.provider(cfg.provider) : copy.config.notConfigured}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {cfg.missing.length > 0 ? <p>{copy.config.missing(cfg.missing.join(", "))}</p> : null}
          {cfg.provider === "fulvia" ? <p>{copy.config.fulviaPending}</p> : null}
          {cfg.provider === "memory" ? <p>{copy.config.memory}</p> : null}
          <p className="text-muted-foreground">{copy.config.webhook("/api/whatsapp/webhook")}</p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="whatsapp-send">
        <h2 id="whatsapp-send" className="text-base font-medium">
          {copy.send.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.send.hint}</p>
        {canSend ? <SendForm /> : <p className="text-sm">{copy.send.noPermission}</p>}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="whatsapp-consents">
        <h2 id="whatsapp-consents" className="text-base font-medium">
          {copy.consents.title}
        </h2>
        {consents.length === 0 ? (
          <EmptyBox title={copy.consents.empty} description={copy.consents.emptyHint} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.consents.phone}</TableHead>
                <TableHead>{copy.consents.status}</TableHead>
                <TableHead>{copy.consents.source}</TableHead>
                <TableHead>{copy.consents.updated}</TableHead>
                <TableHead>{copy.consents.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consents.map((c) => {
                const at = c.status === "opted_out" ? c.optedOutAt : c.optedInAt
                return (
                  <TableRow key={c.phone}>
                    <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "opted_out" ? "outline" : "secondary"}>
                        {c.status === "opted_out"
                          ? copy.consents.statusLabels.opted_out
                          : copy.consents.statusLabels.opted_in}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.source ? copy.consents.sourceLabels[c.source] : null}</TableCell>
                    <TableCell>
                      {at ? <time dateTime={at.toISOString()}>{formatDateTime(at, locale)}</time> : null}
                    </TableCell>
                    <TableCell>{c.status === "opted_in" ? <OptOutButton phone={c.phone} /> : null}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="whatsapp-messages">
        <h2 id="whatsapp-messages" className="text-base font-medium">
          {copy.messages.title}
        </h2>
        {messages.length === 0 ? (
          <EmptyBox title={copy.messages.empty} />
        ) : (
          <MessagesTable items={messages} copy={copy} locale={locale} />
        )}
      </section>
    </div>
  )
}
