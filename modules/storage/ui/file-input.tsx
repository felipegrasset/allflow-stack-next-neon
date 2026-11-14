"use client"

import { useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import {
  ALLOWED_TYPES,
  DEFAULT_MAX_BYTES,
  UPLOAD_ERROR_CODES,
  type AllowedType,
  type UploadErrorCode,
  type UploadedFile,
  type Visibility,
} from "../contracts/types"
import { es } from "../messages"

export type FileInputProps = {
  /** Name of the hidden input that carries the uploaded file's id. */
  name: string
  id?: string
  visibility?: Visibility
  /** Narrows the picker (the server still checks the real type). */
  accept?: readonly AllowedType[]
  /** Checked before uploading, to spare the round trip. The server enforces its own limit. */
  maxBytes?: number
  /** A file already uploaded (editing a form). */
  defaultFile?: UploadedFile | null
  disabled?: boolean
  /** Marks the control invalid (form-level error from the caller). */
  invalid?: boolean
  /** Extra ids for aria-describedby (the caller's description or error). */
  describedBy?: string
  onUploaded?: (file: UploadedFile) => void
  onCleared?: () => void
}

type State =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; code: UploadErrorCode | "network" }

const isCode = (v: unknown): v is UploadErrorCode =>
  typeof v === "string" && (UPLOAD_ERROR_CODES as readonly string[]).includes(v)

export function FileInput({
  name,
  id,
  visibility = "private",
  accept = ALLOWED_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  defaultFile = null,
  disabled,
  invalid,
  describedBy,
  onUploaded,
  onCleared,
}: FileInputProps) {
  const copy = useModuleCopy(es)
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const pickerRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<UploadedFile | null>(defaultFile)
  const [state, setState] = useState<State>({ kind: "idle" })

  const busy = state.kind === "uploading"
  const hasError = state.kind === "error" || !!invalid
  const mb = String(Math.floor((maxBytes / (1024 * 1024)) * 10) / 10)

  async function upload(picked: File) {
    if (picked.size === 0) return setState({ kind: "error", code: "empty" })
    if (picked.size > maxBytes)
      return setState({ kind: "error", code: "too_large" })
    setState({ kind: "uploading" })
    const body = new FormData()
    body.set("file", picked)
    body.set("visibility", visibility)
    try {
      const res = await fetch("/api/storage/upload", { method: "POST", body })
      const json = (await res.json().catch(() => null)) as {
        file?: UploadedFile
        error?: unknown
      } | null
      if (!res.ok || !json?.file) {
        const code = isCode(json?.error) ? json.error : "upload_failed"
        return setState({ kind: "error", code })
      }
      setFile(json.file)
      setState({ kind: "idle" })
      onUploaded?.(json.file)
    } catch {
      setState({ kind: "error", code: "network" })
    } finally {
      if (pickerRef.current) pickerRef.current.value = ""
    }
  }

  function clear() {
    setFile(null)
    setState({ kind: "idle" })
    onCleared?.()
  }

  const described = [hintId, state.kind === "error" ? errorId : "", describedBy]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="flex flex-col gap-2" data-invalid={hasError || undefined}>
      <input type="hidden" name={name} value={file?.id ?? ""} />
      {file ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span role="status" className="truncate">
            {copy.input.uploaded(file.name)}
          </span>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {copy.input.view}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled}
          >
            {copy.input.remove}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            ref={pickerRef}
            id={inputId}
            type="file"
            accept={accept.join(",")}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={described}
            onChange={(e) => {
              const picked = e.currentTarget.files?.[0]
              if (picked) void upload(picked)
            }}
          />
          {busy ? (
            <span
              role="status"
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <Spinner />
              {copy.input.uploading}
            </span>
          ) : null}
        </div>
      )}
      <p id={hintId} className="text-xs text-muted-foreground">
        {copy.input.hint(mb)}
      </p>
      {state.kind === "error" ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {copy.errors[state.code]}
        </p>
      ) : null}
    </div>
  )
}
