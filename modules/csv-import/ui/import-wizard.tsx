"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { MAX_CSV_BYTES } from "../contracts/parse"
import { isCellErrorCode } from "../contracts/plan"
import { es } from "../messages"
import { previewImportAction, runImportAction } from "../server/actions"
import type { PreviewPayload } from "../server/payload"

export type WizardTarget = {
  id: string
  label: string
  description: string | null
  fields: { key: string; label: string; required: boolean }[]
}

type Delim = "auto" | "," | ";" | "\t"
type Preview = Extract<PreviewPayload, { ok: true }>

/**
 * Upload → preview (mapping, counts, errors by row) → import. The server
 * parses and validates the file again on every call: this component only
 * carries the text and the mapping the person chose.
 */
export function ImportWizard({ targets, maxKb, maxRows }: { targets: WizardTarget[]; maxKb: number; maxRows: number }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "")
  const [delimiter, setDelimiter] = useState<Delim>("auto")
  const [text, setText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapping, setMapping] = useState<Record<string, number | null> | null>(null)
  const [skipInvalid, setSkipInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const target = targets.find((t) => t.id === targetId)
  const fieldLabel = (key: string | null) =>
    key === null ? copy.wizard.wholeRow : (target?.fields.find((f) => f.key === key)?.label ?? key)

  function reset() {
    setPreview(null)
    setMapping(null)
    setError(null)
    setDone(null)
  }

  async function onFile(file: File | undefined) {
    reset()
    if (!file) {
      setText(null)
      setFileName(null)
      return
    }
    if (file.size > MAX_CSV_BYTES) {
      setText(null)
      setFileName(null)
      setError(copy.wizard.tooLarge(maxKb))
      return
    }
    setFileName(file.name)
    setText(await file.text())
  }

  const input = () => ({ targetId, text: text ?? "", fileName, delimiter, mapping: mapping ?? undefined, skipInvalid })

  function onPreview() {
    if (text === null) return
    setError(null)
    setDone(null)
    startTransition(async () => {
      const res = await previewImportAction(input())
      if (!res.ok) {
        setPreview(null)
        setError(res.error)
        return
      }
      setPreview(res)
      setMapping(res.mapping)
    })
  }

  function onRun() {
    if (text === null) return
    setError(null)
    startTransition(async () => {
      const res = await runImportAction(input())
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDone(copy.wizard.done(res.imported))
      setPreview(null)
      setMapping(null)
      router.refresh()
    })
  }

  const canRun =
    preview !== null && preview.missing.length === 0 && preview.validRows + (skipInvalid ? 0 : preview.errorRows) > 0
  const blockedByErrors = preview !== null && preview.errorRows > 0 && !skipInvalid

  return (
    <div className="flex flex-col gap-6">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert variant="success">{done}</FormAlert> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="csv-import-target">{copy.wizard.target}</FieldLabel>
          <NativeSelect
            id="csv-import-target"
            value={targetId}
            disabled={pending}
            onChange={(e) => {
              setTargetId(e.target.value)
              reset()
            }}
          >
            {targets.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {target?.description ? <FieldDescription>{target.description}</FieldDescription> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="csv-import-file">{copy.wizard.file}</FieldLabel>
          <Input
            id="csv-import-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            disabled={pending}
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-describedby="csv-import-file-hint"
          />
          <FieldDescription id="csv-import-file-hint">{copy.wizard.fileHint(maxKb, maxRows)}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="csv-import-delimiter">{copy.wizard.delimiter}</FieldLabel>
          <NativeSelect
            id="csv-import-delimiter"
            value={delimiter}
            disabled={pending}
            onChange={(e) => {
              setDelimiter(e.target.value as Delim)
              reset()
            }}
          >
            <NativeSelectOption value="auto">{copy.wizard.delimAuto}</NativeSelectOption>
            <NativeSelectOption value=",">{copy.wizard.delimComma}</NativeSelectOption>
            <NativeSelectOption value=";">{copy.wizard.delimSemicolon}</NativeSelectOption>
            <NativeSelectOption value={"\t"}>{copy.wizard.delimTab}</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>

      <SubmitButton
        type="button"
        variant="outline"
        pending={pending && preview === null}
        disabled={pending || text === null}
        label={copy.wizard.preview}
        pendingLabel={copy.wizard.previewing}
        onClick={onPreview}
        className="self-start"
      />

      {preview && target && mapping ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3" aria-labelledby="csv-import-mapping">
            <h2 id="csv-import-mapping" className="text-base font-medium">
              {copy.wizard.mappingTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.wizard.mappingHint}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {target.fields.map((f) => (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`csv-import-map-${f.key}`}>
                    {f.label}
                    {f.required ? ` (${copy.wizard.required})` : ""}
                  </FieldLabel>
                  <NativeSelect
                    id={`csv-import-map-${f.key}`}
                    value={mapping[f.key] === null || mapping[f.key] === undefined ? "" : String(mapping[f.key])}
                    disabled={pending}
                    onChange={(e) => {
                      const v = e.target.value
                      setMapping({ ...mapping, [f.key]: v === "" ? null : Number(v) })
                      setPreview(null)
                    }}
                  >
                    <NativeSelectOption value="">{copy.wizard.unmapped}</NativeSelectOption>
                    {preview.headers.map((h, i) => (
                      <NativeSelectOption key={i} value={String(i)}>
                        {h === "" ? `#${i + 1}` : h}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
            </div>
          </section>

          {preview.missing.length > 0 ? (
            <FormAlert>{copy.wizard.missingRequired(preview.missing.map(fieldLabel).join(", "))}</FormAlert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {[copy.wizard.totalRows(preview.totalRows), copy.wizard.validRows(preview.validRows), copy.wizard.errorRows(preview.errorRows)].join(" · ")}
              </p>

              <section className="flex flex-col gap-3" aria-labelledby="csv-import-sample">
                <h2 id="csv-import-sample" className="text-base font-medium">
                  {copy.wizard.sampleTitle}
                </h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      {target.fields.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sample.map((s) => (
                      <TableRow key={s.row}>
                        <TableCell className="text-muted-foreground">{s.row}</TableCell>
                        {target.fields.map((f) => (
                          <TableCell key={f.key}>{s.cells[f.key] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              {preview.errors.length > 0 ? (
                <section className="flex flex-col gap-3" aria-labelledby="csv-import-errors">
                  <h2 id="csv-import-errors" className="text-base font-medium">
                    {copy.wizard.errorsTitle}
                  </h2>
                  <ul className="flex flex-col gap-1 text-sm">
                    {preview.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">{copy.wizard.row(e.row)}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {fieldLabel(e.field)}
                          {" · "}
                          {isCellErrorCode(e.code) ? copy.cellErrors[e.code] : copy.cellErrors.invalid_value}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {preview.errorRows > new Set(preview.errors.map((e) => e.row)).size ? (
                    <p className="text-xs text-muted-foreground">{copy.wizard.errorsMore(preview.errors.length)}</p>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipInvalid}
                      disabled={pending}
                      onChange={(e) => setSkipInvalid(e.target.checked)}
                    />
                    {copy.wizard.skipInvalid}
                  </label>
                  {blockedByErrors ? <p className="text-sm text-muted-foreground">{copy.wizard.mustFix}</p> : null}
                </section>
              ) : null}

              <SubmitButton
                type="button"
                pending={pending}
                disabled={pending || !canRun || blockedByErrors}
                label={copy.wizard.run}
                pendingLabel={copy.wizard.running}
                onClick={onRun}
                className="self-start"
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
