/**
 * Typed, grouped access to a namespace of the catalog.
 *
 * Screens used to read `authCopy.login.title`. They still do, through a "copy
 * object" with the same shape: `const copy = await getCopy("auth")` (server) or
 * `useCopy("auth")` (client). A message with ICU arguments becomes a function
 * of its arguments, in the order they first appear in the Spanish message:
 * `"Hola, {name}"` → `copy.shell.welcome(name)`.
 */
import type { es } from "./messages/es"
import type { Messages } from "./messages/types"

type Catalog = typeof es
export type Namespace = keyof Catalog

type ArgValue = string | number
/** One positional argument per ICU argument; a `plural` counts as one. */
type Args<S extends string> = S extends `${string}{${infer P}}${infer R}`
  ? P extends `${string},${string}`
    ? [ArgValue]
    : [ArgValue, ...Args<R>]
  : []

type Leaf<S extends string> =
  Args<S> extends [] ? string : (...args: Args<S>) => string

export type Copy<T> = {
  -readonly [K in keyof T]: T[K] extends string ? Leaf<T[K]> : Copy<T[K]>
}
export type NamespaceCopy<N extends Namespace> = Copy<Catalog[N]>

/** `useTranslations(ns)` / `getTranslations(ns)` reduced to what the builder needs. */
export type Translate = (
  key: string,
  values?: Record<string, ArgValue>
) => string

/** Names of the ICU arguments of a message, in order of first appearance. */
export function argNames(message: string): string[] {
  const names: string[] = []
  for (const m of message.matchAll(/\{\s*(\w+)\s*(?:,|\})/g))
    if (!names.includes(m[1])) names.push(m[1])
  return names
}

/**
 * Builds the copy object of a namespace. `shape` is the Spanish subtree (it
 * only supplies the keys and the argument names; the text comes from `t`).
 */
export function buildCopy<T extends Record<string, unknown>>(
  t: Translate,
  shape: T,
  prefix = ""
): Copy<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      const names = argNames(value)
      out[key] =
        names.length === 0
          ? t(path)
          : (...args: ArgValue[]) =>
              t(path, Object.fromEntries(names.map((n, i) => [n, args[i]])))
    } else {
      out[key] = buildCopy(t, value as Record<string, unknown>, path)
    }
  }
  return out as Copy<T>
}

/**
 * Text of a namespace (any locale) as plain data. For the files the genesis writes
 * and reads as constants (`config/nav.ts`, the generated landing): they keep
 * working in the source locale; `translateLabel` (ui/labels.ts) turns a nav
 * label back into the active locale.
 */
export function sourceCopy<N extends Namespace>(
  namespace: N,
  catalog: Messages
): NamespaceCopy<N> {
  const shape = catalog[namespace] as Record<string, unknown>
  const t: Translate = (key, values) => {
    let node: unknown = shape
    for (const part of key.split("."))
      node = (node as Record<string, unknown>)[part]
    let text = String(node)
    for (const [k, v] of Object.entries(values ?? {}))
      text = text.replaceAll(`{${k}}`, String(v))
    return text
  }
  return buildCopy(t, shape) as NamespaceCopy<N>
}
