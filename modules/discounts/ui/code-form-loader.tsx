"use client"

import dynamic from "next/dynamic"

import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import type { CodeFormValues } from "./code-form-values"

function Loading() {
  const copy = useModuleCopy(es)
  return <p className="text-sm text-muted-foreground">{copy.admin.loading}</p>
}

/**
 * The code form, rendered only in the browser: its date inputs are in the
 * browser's time zone, which the server does not know (rendering it there
 * would mismatch on hydration).
 */
const CodeFormClient = dynamic(() => import("./code-form").then((m) => m.CodeForm), {
  ssr: false,
  loading: () => <Loading />,
})

export function CodeFormLoader(props: { codeId?: string; initial: CodeFormValues }) {
  return <CodeFormClient {...props} />
}
