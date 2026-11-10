"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { LOCALES, type Locale } from "../contracts"
import { setLocaleAction } from "../server/actions"
import { useCopy } from "./use-copy"

/** The language picker. Saves the choice in a cookie and re-renders the page in place. */
export function LanguageSelector({ current }: { current: Locale }) {
  const copy = useCopy("i18n")
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <NativeSelect
      size="sm"
      aria-busy={pending}
      aria-label={copy.selectorLabel}
      title={copy.selectorHelp}
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        startTransition(async () => {
          const res = await setLocaleAction(next)
          if (res.ok) router.refresh()
        })
      }}
    >
      {LOCALES.map((l) => (
        <NativeSelectOption key={l} value={l}>
          {copy.locales[l]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
