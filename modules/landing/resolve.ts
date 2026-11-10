/**
 * De `landing.json` + un juego de copy a una lista de bloques listos para
 * pintar. Todo lo que puede estar mal (bloque mal formado, clave de copy que no
 * existe, texto que no cumple el esquema de su bloque, variante a la que le
 * falta un campo) se junta en un solo `LandingError` con el id del bloque
 * culpable: el build falla con el motivo, no una página a medias.
 */
import type { BlockType, LandingDoc } from "./contracts"
import {
  COPY_SCHEMAS,
  VARIANTS,
  VARIANT_NEEDS,
  landingSchema,
  type CopyOf,
  type CopySet,
} from "./schema"

export class LandingError extends Error {
  constructor(readonly issues: string[]) {
    super(`landing inválida:\n- ${issues.join("\n- ")}`)
    this.name = "LandingError"
  }
}

export type ResolvedBlock = {
  [T in BlockType]: {
    id: string
    type: T
    variant: (typeof VARIANTS)[T][number]
    copy: CopyOf<T>
  }
}[BlockType]

export function parseLanding(raw: unknown): LandingDoc {
  const r = landingSchema.safeParse(raw)
  if (!r.success)
    throw new LandingError(
      r.error.issues.map(
        (i) => `landing.json ${i.path.join(".")}: ${i.message}`
      )
    )
  return r.data as LandingDoc
}

/** Reemplaza `{app}`, `{year}`… en todo string del copy. Lo desconocido se deja. */
export function interpolate<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === "string")
    return value.replace(/\{(\w+)\}/g, (m, k: string) =>
      k in vars ? vars[k] : m
    ) as T
  if (Array.isArray(value)) return value.map((v) => interpolate(v, vars)) as T
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)])
    ) as T
  return value
}

export function resolveLanding(
  doc: LandingDoc,
  copy: CopySet,
  vars: Record<string, string> = {}
): ResolvedBlock[] {
  const issues: string[] = []
  const out: ResolvedBlock[] = []
  for (const b of doc.blocks) {
    if (!(b.copy in copy)) {
      issues.push(`bloque «${b.id}»: no hay copy para la clave «${b.copy}»`)
      continue
    }
    const r = COPY_SCHEMAS[b.type].safeParse(copy[b.copy])
    if (!r.success) {
      for (const i of r.error.issues)
        issues.push(
          `bloque «${b.id}» (copy «${b.copy}») ${i.path.join(".") || "(raíz)"}: ${i.message}`
        )
      continue
    }
    const missing = (VARIANT_NEEDS[`${b.type}/${b.variant}`] ?? []).filter(
      (k) => (r.data as Record<string, unknown>)[k] === undefined
    )
    if (missing.length) {
      issues.push(
        `bloque «${b.id}»: la variante «${b.variant}» necesita ${missing.join(", ")} en el copy «${b.copy}»`
      )
      continue
    }
    out.push({
      id: b.id,
      type: b.type,
      variant: b.variant,
      copy: interpolate(r.data, vars),
    } as ResolvedBlock)
  }
  if (issues.length) throw new LandingError(issues)
  return out
}
