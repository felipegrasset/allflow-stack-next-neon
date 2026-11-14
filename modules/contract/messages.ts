/**
 * Static reading of a module's `messages` entrypoint (validator, T1). Pure and
 * deliberately small: the contract asks for plain object literals of string
 * literals, so a tiny scanner is enough to compare `es` and `en` key by key
 * and argument by argument without running the file (sync must not execute
 * module code). Anything it cannot read (a spread, a computed key, a
 * concatenation, a variable) is reported, not guessed.
 */
import { MODULE_MESSAGE_LOCALES, MODULE_MESSAGE_SOURCE_LOCALE } from "./types"

/** Flattened catalog: `"ping.header.count"` → the message text (raw, as written). */
export type FlatCatalog = Map<string, string>

export type CatalogReadResult =
  | { ok: true; keys: FlatCatalog; topLevel: string[] }
  | { ok: false; error: string }

/** Names of the ICU arguments of a message (`{name}`, `{n, plural, …}`), sorted. */
export function icuArgs(message: string): string[] {
  const names = new Set<string>()
  for (const m of message.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)) names.add(m[1])
  return [...names].sort()
}

const isIdStart = (c: string) => /[A-Za-z_$]/.test(c)
const isId = (c: string) => /[\w$]/.test(c)

class Scanner {
  i = 0
  constructor(readonly s: string) {}
  skip() {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++
      if (this.s.startsWith("//", this.i)) {
        const nl = this.s.indexOf("\n", this.i)
        this.i = nl < 0 ? this.s.length : nl + 1
      } else if (this.s.startsWith("/*", this.i)) {
        const end = this.s.indexOf("*/", this.i + 2)
        this.i = end < 0 ? this.s.length : end + 2
      } else return
    }
  }
  /** A '…', "…" or `…` literal (no `${}`); returns its raw content, or null. */
  string(): string | null {
    const q = this.s[this.i]
    if (q !== '"' && q !== "'" && q !== "`") return null
    let j = this.i + 1
    let out = ""
    while (j < this.s.length && this.s[j] !== q) {
      if (this.s[j] === "\\") {
        out += this.s.slice(j, j + 2)
        j += 2
        continue
      }
      if (q === "`" && this.s.startsWith("${", j)) return null
      out += this.s[j]
      j++
    }
    if (j >= this.s.length) return null
    this.i = j + 1
    return out
  }
  ident(): string | null {
    if (!isIdStart(this.s[this.i] ?? "")) return null
    const start = this.i
    while (this.i < this.s.length && isId(this.s[this.i])) this.i++
    return this.s.slice(start, this.i)
  }
}

/** Reads `{ key: "text", nested: { … } }` starting at `sc.i` (on the `{`). */
function readObject(
  sc: Scanner,
  prefix: string,
  out: FlatCatalog,
  top: string[] | null
): string | null {
  if (sc.s[sc.i] !== "{") return "se esperaba un objeto literal"
  sc.i++
  for (;;) {
    sc.skip()
    if (sc.s[sc.i] === "}") {
      sc.i++
      return null
    }
    const key = sc.string() ?? sc.ident()
    if (key === null)
      return `clave ilegible cerca de «${sc.s.slice(sc.i, sc.i + 20)}» (sin spreads ni claves calculadas)`
    const path = prefix ? `${prefix}.${key}` : key
    top?.push(key)
    sc.skip()
    if (sc.s[sc.i] !== ":")
      return `${path}: se esperaba «:» (sin propiedades abreviadas)`
    sc.i++
    sc.skip()
    if (sc.s[sc.i] === "{") {
      const err = readObject(sc, path, out, null)
      if (err) return err
    } else {
      const text = sc.string()
      if (text === null)
        return `${path}: el valor debe ser un texto literal o un objeto (sin variables, funciones ni concatenaciones)`
      if (out.has(path)) return `${path}: clave repetida`
      out.set(path, text)
    }
    sc.skip()
    if (sc.s[sc.i] === ",") sc.i++
    else if (sc.s[sc.i] !== "}")
      return `${path}: se esperaba «,» o «}» (¿una concatenación?)`
  }
}

/** Reads `export const <name> … = { … }` of a messages file. */
export function readCatalog(text: string, name: string): CatalogReadResult {
  const m = new RegExp(`export\\s+const\\s+${name}\\b[^=]*=\\s*`).exec(text)
  if (!m) return { ok: false, error: `no exporta \`${name}\`` }
  const sc = new Scanner(text)
  sc.i = m.index + m[0].length
  const keys: FlatCatalog = new Map()
  const topLevel: string[] = []
  const err = readObject(sc, "", keys, topLevel)
  return err ? { ok: false, error: `${name}: ${err}` } : { ok: true, keys, topLevel }
}

/** Runtime imports of a messages file (it must be data: only `import type`). */
export function runtimeImports(text: string): string[] {
  return [
    ...text.matchAll(
      /^\s*import\s+(?!type\b)[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|^\s*export\s*(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s*from\s*["']([^"']+)["']/gm
    ),
  ].map((x) => x[1] ?? x[2] ?? x[3])
}

/**
 * Every problem of a messages file for module `id`, as human sentences (the
 * validator wraps each in a `messages_invalid` issue). Empty: it is valid.
 */
export function checkMessagesFile(id: string, text: string): string[] {
  const problems: string[] = []
  for (const spec of runtimeImports(text))
    problems.push(
      `importa ${spec} en tiempo de ejecución: un catálogo es solo datos (usa \`import type\`)`
    )
  const source = readCatalog(text, MODULE_MESSAGE_SOURCE_LOCALE)
  if (!source.ok) return [...problems, source.error]
  if (source.topLevel.length !== 1 || source.topLevel[0] !== id)
    problems.push(
      `${MODULE_MESSAGE_SOURCE_LOCALE}: la única clave de primer nivel debe ser el id del módulo ("${id}"); tiene ${source.topLevel.map((k) => `"${k}"`).join(", ") || "ninguna"}`
    )
  for (const [k, v] of source.keys)
    if (!v.trim()) problems.push(`${MODULE_MESSAGE_SOURCE_LOCALE}: ${k} está vacío`)
  for (const locale of MODULE_MESSAGE_LOCALES) {
    if (locale === MODULE_MESSAGE_SOURCE_LOCALE) continue
    const other = readCatalog(text, locale)
    if (!other.ok) {
      problems.push(other.error)
      continue
    }
    for (const k of source.keys.keys())
      if (!other.keys.has(k)) problems.push(`${locale}: falta ${k}`)
    for (const [k, v] of other.keys) {
      const src = source.keys.get(k)
      if (src === undefined) {
        problems.push(`${locale}: sobra ${k} (no está en ${MODULE_MESSAGE_SOURCE_LOCALE})`)
        continue
      }
      if (!v.trim()) problems.push(`${locale}: ${k} está vacío`)
      if (icuArgs(src).join() !== icuArgs(v).join())
        problems.push(
          `${locale}: ${k} usa los argumentos {${icuArgs(v).join(", ")}} y ${MODULE_MESSAGE_SOURCE_LOCALE} {${icuArgs(src).join(", ")}}`
        )
    }
  }
  return problems
}
