"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"
import { FileInput } from "@/modules/storage/contracts/file-input"

import { es } from "../messages"
import { addPhotoAction, removePhotoAction } from "../server/actions"

export type PhotoView = { id: string; url: string; name: string }

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const

/** Photos of a product: the list (first = cover), remove, and add one (upload, then attach). */
export function PhotosManager({
  itemId,
  itemName,
  photos,
  canWrite,
}: {
  itemId: string
  itemName: string
  photos: PhotoView[]
  canWrite: boolean
}) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fileId, setFileId] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const done = (res: { ok: boolean; message?: string; formError?: string; fieldErrors?: Partial<Record<string, string>> }) => {
    if (res.ok) {
      setMessage({ ok: true, text: res.message ?? copy.actions.saved })
      setFileId(null)
      setInputKey((k) => k + 1)
      router.refresh()
    } else {
      const field = Object.values(res.fieldErrors ?? {}).find(Boolean)
      setMessage({ ok: false, text: field ?? res.formError ?? copy.errors.generic })
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileId) return setMessage({ ok: false, text: copy.validation.photo })
    setMessage(null)
    startTransition(async () => done(await addPhotoAction(itemId, { fileId })))
  }

  const remove = (id: string) => {
    setMessage(null)
    startTransition(async () => done(await removePhotoAction(itemId, id)))
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <FormAlert variant={message.ok ? "success" : undefined}>{message.text}</FormAlert> : null}
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.photos.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/storage, not a static asset */}
              <img
                src={p.url}
                alt={i === 0 ? copy.photos.coverAlt(itemName) : copy.photos.alt(itemName, i + 1)}
                className="aspect-square w-full rounded-lg border border-border object-cover"
                loading="lazy"
              />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{i === 0 ? copy.photos.cover : copy.photos.number(i + 1)}</span>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    aria-label={copy.photos.removeLabel(i + 1)}
                    onClick={() => remove(p.id)}
                  >
                    {copy.photos.remove}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form onSubmit={add} noValidate className="flex flex-col gap-3" aria-label={copy.photos.addTitle}>
          <label htmlFor="catalog-photo-file" className="text-sm font-medium">
            {copy.photos.addLabel}
          </label>
          <FileInput
            key={inputKey}
            id="catalog-photo-file"
            name="fileId"
            visibility="public"
            accept={IMAGE_TYPES}
            disabled={isPending}
            onUploaded={(f) => setFileId(f.id)}
            onCleared={() => setFileId(null)}
          />
          <SubmitButton
            pending={isPending}
            disabled={!fileId}
            label={copy.actions.addPhoto}
            pendingLabel={copy.actions.saving}
            variant="outline"
            className="self-start"
          />
        </form>
      ) : null}
    </div>
  )
}
