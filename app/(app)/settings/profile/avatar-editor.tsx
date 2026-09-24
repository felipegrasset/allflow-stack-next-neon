"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TrashIcon, UploadIcon } from "lucide-react"

import { FormAlert } from "@/components/form-alert"
import { UserAvatar } from "@/components/user-avatar"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { checkAvatarFile, toAvatarDataUrl } from "@/lib/avatar-image"
import { profileCopy } from "@/lib/copy/profile"
import { describedBy } from "@/lib/forms"
import { AVATAR_ACCEPT } from "@/lib/schemas/profile"
import { updateAvatarAction } from "../actions"

/**
 * Avatar (8b): initials when there is no photo; type/size checked BEFORE
 * uploading; the cropped preview shows right away (optimistic) and rolls back
 * if saving fails; removing asks for confirmation.
 */
export function AvatarEditor({ name, image }: { name: string; image: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(image)
  const [preview, setPreview] = useState(image)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const c = profileCopy.avatar

  const save = (next: string | null) => {
    const previous = saved
    setPreview(next) // optimistic
    startTransition(async () => {
      const res = await updateAvatarAction({ image: next })
      if (!res.ok) {
        setPreview(previous)
        setError(res.formError ?? c.failed)
        return
      }
      setSaved(next)
      toast.add({ title: next ? c.saved : c.removed, type: "success" })
      router.refresh() // header avatar
    })
  }

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    const check = checkAvatarFile(file)
    if (!check.ok) {
      setError(check.reason === "type" ? c.invalidType : c.tooLarge)
      return
    }
    try {
      save(await toAvatarDataUrl(file))
    } catch {
      setError(c.unreadable)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{c.title}</h2>
        </CardTitle>
        <CardDescription id="avatar-description">{c.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative" data-testid="avatar-preview" data-has-image={preview ? "true" : "false"}>
            <UserAvatar name={name} image={preview} alt={c.alt(name)} className="size-16 text-lg" />
            {isPending && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                <Spinner aria-hidden />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={AVATAR_ACCEPT.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="avatar-input"
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = "" // choosing the same file again still fires change
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              aria-busy={isPending || undefined}
              aria-describedby={describedBy("avatar-description")}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon aria-hidden />
              {preview ? c.change : c.choose}
            </Button>
            {saved && (
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger render={<Button type="button" variant="ghost" disabled={isPending} />}>
                  <TrashIcon aria-hidden />
                  {c.remove}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{c.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{c.confirmDescription}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{profileCopy.common.cancel}</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setConfirmOpen(false)
                        save(null)
                      }}
                    >
                      {c.confirmAction}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {isPending && (
          <Progress value={null} aria-valuetext={c.uploading}>
            <ProgressLabel className="font-normal text-muted-foreground">{c.uploading}</ProgressLabel>
          </Progress>
        )}
      </CardContent>
    </Card>
  )
}
