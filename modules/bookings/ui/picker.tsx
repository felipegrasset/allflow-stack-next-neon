import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import type { Resource } from "../contracts/types"
import { es } from "../messages"

/**
 * Resource + date, as a plain GET form: works without JavaScript and leaves a
 * shareable URL (`?resource=…&date=…`).
 */
export async function Picker({
  action,
  resources,
  resourceId,
  date,
}: {
  action: string
  resources: Resource[]
  resourceId: string
  date: string
}) {
  const copy = await getModuleCopy(es)
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4"
    >
      <Field className="w-auto min-w-56">
        <FieldLabel htmlFor="bookings-resource">{copy.picker.resource}</FieldLabel>
        <NativeSelect id="bookings-resource" name="resource" defaultValue={resourceId} className="w-full">
          {resources.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name} · {copy.kinds[r.kind]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor="bookings-date">{copy.picker.date}</FieldLabel>
        <Input id="bookings-date" name="date" type="date" defaultValue={date} required />
      </Field>
      <Button type="submit" variant="outline">
        {copy.picker.submit}
      </Button>
    </form>
  )
}
