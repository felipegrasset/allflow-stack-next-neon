"use client"

import { useState } from "react"

import { ErrorState, OfflineState } from "../contracts"

/** Vista previa del reintento: el botón hace algo visible (cuenta los intentos). */
export function Retry({ kind }: { kind: "error" | "offline" }) {
  const [n, setN] = useState(0)
  const props = {
    onRetry: () => setN((v) => v + 1),
    ...(n ? { description: `Intento número ${n + 1}.` } : {}),
  }
  return kind === "error" ? (
    <ErrorState {...props} />
  ) : (
    <OfflineState {...props} />
  )
}
