"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"

import {
  exportUrl,
  fileNameFromDisposition,
  isExportError,
  type ExportClientError,
} from "./download"

export type ExportButtonProps = {
  /** The id given to `registerExport`. */
  id: string
  /** Query string for the destination (current filters). The destination validates it. */
  params?: Record<string, string | undefined>
  /** Button text; default «Exportar CSV». */
  label?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg"
  disabled?: boolean
  className?: string
}

export function ExportButton({
  id,
  params,
  label,
  variant = "outline",
  size = "sm",
  disabled,
  className,
}: ExportButtonProps) {
  const copy = useModuleCopy(es)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ExportClientError | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(exportUrl(id, params), { credentials: "same-origin" })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: unknown } | null
        setError(isExportError(json?.error) ? json.error : "failed")
        return
      }
      const blob = await res.blob()
      const name = fileNameFromDisposition(res.headers.get("content-disposition"), `${id}.csv`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError("network")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={() => void download()}
      >
        {busy ? <Spinner /> : null}
        {busy ? copy.button.exporting : (label ?? copy.button.label)}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {copy.errors[error]}
        </p>
      ) : null}
    </div>
  )
}
