import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { starterJson } from "../examples"
import { es } from "../messages"
import { can, requirePagePermission } from "../server/authz"
import { listForms } from "../server/store"
import { resolveText } from "../contracts/definition"
import { CreateForm } from "./create-form"
import { activeLocale } from "./locale"
import { LINK_CLASS } from "./styles"

export default async function FormsPage() {
  await requirePagePermission("/forms", "read")
  const [copy, locale, forms, canWrite] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    listForms(),
    can("write"),
  ])
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.list.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.list.subtitle}</p>
      </div>

      {forms.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{copy.list.empty}</EmptyTitle>
            {canWrite ? <EmptyDescription>{copy.list.emptyHint}</EmptyDescription> : null}
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">{resolveText(f.definition.title, locale)}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={f.status === "open" ? "default" : "outline"}>{copy.status[f.status]}</Badge>
                  <span>{copy.list.responses(f.responseCount)}</span>
                  <span>{`/f/${f.slug}`}</span>
                  {f.onePerPerson ? <span>{copy.list.onePerPerson}</span> : null}
                </span>
              </div>
              <Link href={`/forms/${f.id}`} className={LINK_CLASS}>
                {copy.list.open}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <section className="flex flex-col gap-3" aria-labelledby="forms-create">
          <h2 id="forms-create" className="text-base font-medium">
            {copy.create.title}
          </h2>
          <CreateForm starter={starterJson()} />
        </section>
      ) : null}
    </div>
  )
}
