import { getLocale } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { DEFAULT_LOCALE, formatDate, isLocale } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { listAdminSettings, type SettingRow } from "../server/queries"
import { SettingForm } from "./setting-form"

/** /admin/settings — needs `setting:read`; editing needs `setting:write`. */
export default async function SettingsPage() {
  await requirePagePermission("/admin/settings", "read")
  const [copy, canWrite, rawLocale] = await Promise.all([getModuleCopy(es), can("write"), getLocale()])
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const { rows, orphans } = await listAdminSettings(locale)

  const groups = new Map<string, SettingRow[]>()
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.page.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.page.subtitle}</p>
        <p className="text-xs text-muted-foreground">{copy.page.secretsNote}</p>
        {canWrite ? null : <p className="text-sm text-muted-foreground">{copy.page.readOnly}</p>}
      </div>

      {rows.length === 0 && orphans.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{copy.page.empty}</EmptyTitle>
            <EmptyDescription>{copy.page.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="flex flex-col gap-3" aria-labelledby={`settings-group-${group}`}>
          <h2 id={`settings-group-${group}`} className="text-base font-medium">
            {group}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((r) => (
              <article key={r.key} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-xs text-muted-foreground">{r.key}</code>
                  <Badge variant={r.source === "invalid" ? "destructive" : r.source === "stored" ? "default" : "secondary"}>
                    {r.source === "stored"
                      ? copy.row.sourceStored
                      : r.source === "default"
                        ? copy.row.sourceDefault
                        : copy.row.sourceInvalid}
                  </Badge>
                </div>
                <SettingForm
                  settingKey={r.key}
                  label={r.label}
                  description={r.description}
                  editor={r.editor}
                  options={r.options}
                  initial={r.raw}
                  stored={r.source !== "default"}
                  readOnly={!canWrite}
                />
                <p className="text-xs text-muted-foreground">
                  {copy.row.defaultIs(r.defaultRaw === "" ? "—" : r.defaultRaw)}
                  {r.updatedAt ? ` · ${copy.row.updated(formatDate(r.updatedAt, locale))}` : ""}
                  {r.updatedByName ? ` · ${copy.row.updatedBy(r.updatedByName)}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}

      {orphans.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="settings-orphans">
          <h2 id="settings-orphans" className="text-base font-medium">
            {copy.page.orphansTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.page.orphansHint}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {orphans.map((o) => (
              <li key={o.key} className="flex flex-wrap gap-2">
                <code>{o.key}</code>
                <span className="text-muted-foreground">{o.raw}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
