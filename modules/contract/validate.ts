/**
 * The manifest validator (T1). Pure — `scripts/modules.ts` reads the folders
 * and hands them over as `ModuleSource`s, so the tests can feed it broken
 * modules without touching the disk.
 */
import { z } from "zod"

import { ANCHOR_FILES, PROTECTED_ZONES } from "./zones"
import { MODULE_MIGRATION_MIN, type ModuleManifest } from "./types"

export type ModuleSource = {
  /** Folder name under modules/. */
  dir: string
  /** Parsed manifest.json (unknown: the validator is what checks its shape). */
  manifest: unknown
  /** Every file of the folder: path relative to the module folder → text. */
  files: ReadonlyMap<string, string>
}

export type ModuleIssueCode =
  | "manifest_shape"
  | "id_mismatch"
  | "table_prefix"
  | "migration_name"
  | "migration_file_missing"
  | "migration_unlisted"
  | "migration_duplicate"
  | "migration_order"
  | "entrypoint_missing"
  | "route_invalid"
  | "route_duplicate"
  | "depends_on_missing"
  | "depends_on_cycle"
  | "import_internal"
  | "import_generated"
  | "literal_color"
  | "missing_module_md"

export type ModuleIssue = {
  code: ModuleIssueCode
  module: string
  message: string
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const MIGRATION_NAME = /^(\d{4})_([a-z0-9_]+)$/

const relPath = z
  .string()
  .min(1)
  .refine(
    (p) => !p.startsWith("/") && !p.split("/").includes(".."),
    "ruta relativa dentro del módulo"
  )

const manifestSchema = z
  .object({
    schema: z.literal(1),
    feature: z.string().min(1),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    env: z
      .array(
        z
          .object({
            key: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
            description: z.string().min(1),
            example: z.string().optional(),
          })
          .strict()
      )
      .optional(),
    dependsOn: z.array(z.string()).optional(),
    id: z.string(),
    version: z.string().regex(SEMVER, "semver (1.2.3)"),
    title: z.string().min(1),
    description: z.string().min(1),
    tables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).optional(),
    migrations: z.array(z.string()).optional(),
    routes: z
      .array(
        z
          .object({
            path: z
              .string()
              .regex(/^\/[A-Za-z0-9\-_/[\]]*$/, "ruta que empieza con /"),
            entry: relPath,
            group: z.enum(["app", "marketing"]).optional(),
          })
          .strict()
      )
      .optional(),
    entrypoints: z
      .object({
        nav: relPath.optional(),
        permissions: relPath.optional(),
        header: relPath.optional(),
        seed: relPath.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

/** Parses a manifest; undefined when its shape is wrong (the issues say why). */
export function parseManifest(
  dir: string,
  raw: unknown,
  issues: ModuleIssue[]
): ModuleManifest | undefined {
  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      issues.push({
        code: "manifest_shape",
        module: dir,
        message: `manifest.json: ${i.path.join(".") || "(raíz)"}: ${i.message}`,
      })
    }
    return undefined
  }
  return parsed.data as ModuleManifest
}

export const tablePrefix = (id: string) => id.replace(/-/g, "_")

/** A route whose entry is a Next route handler (`route.ts`), not a page. */
export const isHandlerEntry = (entry: string) => /(^|\/)route\.ts$/.test(entry)

/**
 * Where the shim of a route lands. Shared by the validator and the generator.
 * A page goes under its route group; a route handler (webhooks, callbacks)
 * goes straight under `app/`, with no group: it has no layout, and the auth
 * proxy only matches the private prefixes (proxy.ts).
 */
export function shimPath(route: {
  path: string
  entry: string
  group?: "app" | "marketing"
}): string {
  const segs = route.path.split("/").filter(Boolean)
  if (isHandlerEntry(route.entry)) return ["app", ...segs, "route.ts"].join("/")
  const group = route.group === "marketing" ? "(marketing)" : "(app)"
  return ["app", group, ...segs, "page.tsx"].join("/")
}

const IMPORT_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g

function importsOf(text: string): string[] {
  return [...text.matchAll(IMPORT_RE)].map((m) => m[1])
}

/**
 * Resolves a relative import against `fileRel` (inside module `id`) to a path
 * relative to modules/. Null when it climbs out of modules/ (app code: fine).
 */
function resolveRelative(
  id: string,
  fileRel: string,
  spec: string
): string | null {
  const parts = [id, ...fileRel.split("/").slice(0, -1)]
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue
    if (seg === "..") {
      if (parts.length === 0) return null
      parts.pop()
    } else parts.push(seg)
  }
  return parts.join("/")
}

export function validateModules(mods: readonly ModuleSource[]): ModuleIssue[] {
  const issues: ModuleIssue[] = []
  const parsed: { src: ModuleSource; m: ModuleManifest }[] = []

  for (const src of mods) {
    const m = parseManifest(src.dir, src.manifest, issues)
    if (!m) continue
    parsed.push({ src, m })
    const at = src.dir
    const push = (code: ModuleIssueCode, message: string) =>
      issues.push({ code, module: at, message })

    if (!KEBAB.test(m.id) || m.id !== src.dir) {
      push(
        "id_mismatch",
        `id "${m.id}" debe ser kebab-case y igual al nombre de la carpeta "${src.dir}"`
      )
    }
    if (!src.files.has("MODULE.md"))
      push(
        "missing_module_md",
        "falta MODULE.md (el contrato en texto plano que lee el agente)"
      )

    const prefix = tablePrefix(m.id)
    for (const t of m.tables ?? []) {
      if (t !== prefix && !t.startsWith(`${prefix}_`)) {
        push(
          "table_prefix",
          `la tabla "${t}" debe llamarse "${prefix}" o empezar con "${prefix}_"`
        )
      }
    }

    const listed = new Set(m.migrations ?? [])
    for (const name of listed) {
      const mm = MIGRATION_NAME.exec(name)
      if (
        !mm ||
        Number(mm[1]) < MODULE_MIGRATION_MIN ||
        !(mm[2] === prefix || mm[2].startsWith(`${prefix}_`))
      ) {
        push(
          "migration_name",
          `migración "${name}": el nombre es NNNN_<módulo>_<algo> con NNNN >= ${String(MODULE_MIGRATION_MIN).padStart(4, "0")} y el id del módulo (${prefix}) después del número`
        )
      }
      if (!src.files.has(`db/migrations/${name}.ts`)) {
        push(
          "migration_file_missing",
          `migración "${name}": no existe db/migrations/${name}.ts`
        )
      }
    }
    for (const f of src.files.keys()) {
      const fm = /^db\/migrations\/(.+)\.ts$/.exec(f)
      if (fm && !listed.has(fm[1]))
        push(
          "migration_unlisted",
          `${f} no está en "migrations" del manifiesto: no correría nunca`
        )
    }

    for (const [role, file] of Object.entries(m.entrypoints ?? {})) {
      if (file && !src.files.has(file))
        push("entrypoint_missing", `entrypoints.${role}: no existe ${file}`)
    }

    const seenRoutes = new Set<string>()
    for (const r of m.routes ?? []) {
      const shim = shimPath(r)
      if (!src.files.has(r.entry))
        push("route_invalid", `ruta ${r.path}: no existe ${r.entry}`)
      if (seenRoutes.has(shim))
        push("route_duplicate", `ruta ${r.path} repetida en el manifiesto`)
      seenRoutes.add(shim)
      if (
        (PROTECTED_ZONES as readonly string[]).some((z) =>
          shim.startsWith(z)
        ) ||
        (ANCHOR_FILES as readonly string[]).includes(shim)
      ) {
        push(
          "route_invalid",
          `ruta ${r.path}: el shim ${shim} cae en una zona protegida o un ancla`
        )
      }
    }

    for (const [rel, text] of src.files) {
      if (!/\.(ts|tsx)$/.test(rel)) continue
      for (const spec of importsOf(text)) {
        let target: string | null = null
        if (spec.startsWith("@/modules/"))
          target = spec.slice("@/modules/".length)
        else if (spec.startsWith(".")) target = resolveRelative(m.id, rel, spec)
        if (target === null) continue
        const [first, second] = target.split("/")
        if (first === "_generated") {
          push(
            "import_generated",
            `${rel} importa ${spec}: el registro generado lo lee la app, nunca un módulo (ciclo)`
          )
        } else if (first && first !== m.id && first !== "contract") {
          if (
            second !== "contracts" &&
            !/^contracts(\.|$)/.test(second ?? "")
          ) {
            push(
              "import_internal",
              `${rel} importa ${spec}: de otro módulo solo se importa su carpeta contracts/`
            )
          }
        }
      }
      if (
        /\.(tsx|css)$/.test(rel) &&
        /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(text)
      ) {
        push(
          "literal_color",
          `${rel} tiene un color literal: usa tokens (bg-primary, text-muted-foreground…)`
        )
      }
    }
  }

  // Cross-module rules.
  const byId = new Map(parsed.map((p) => [p.m.id, p]))
  const seenMigration = new Map<string, string>()
  for (const { m } of parsed) {
    for (const name of m.migrations ?? []) {
      const other = seenMigration.get(name)
      if (other)
        issues.push({
          code: "migration_duplicate",
          module: m.id,
          message: `la migración "${name}" ya la declara ${other}`,
        })
      seenMigration.set(name, m.id)
      const num = /^(\d{4})_/.exec(name)?.[1]
      const clash = [...seenMigration].find(
        ([n, owner]) => owner !== m.id && n.slice(0, 4) === num
      )
      if (num && clash) {
        issues.push({
          code: "migration_duplicate",
          module: m.id,
          message: `el número ${num} ya lo usa "${clash[0]}" de ${clash[1]}: cada módulo reserva sus propios números`,
        })
      }
    }
    for (const dep of m.dependsOn ?? []) {
      const d = byId.get(dep)
      if (!d) {
        issues.push({
          code: "depends_on_missing",
          module: m.id,
          message: `dependsOn "${dep}": ese módulo no está instalado`,
        })
        continue
      }
      const mine = Math.min(
        ...(m.migrations ?? []).map((n) => Number(n.slice(0, 4))),
        Infinity
      )
      const theirs = Math.max(
        ...(d.m.migrations ?? []).map((n) => Number(n.slice(0, 4))),
        -Infinity
      )
      if (Number.isFinite(mine) && Number.isFinite(theirs) && mine <= theirs) {
        issues.push({
          code: "migration_order",
          module: m.id,
          message: `sus migraciones (desde ${mine}) deben numerarse después de las de "${dep}" (hasta ${theirs}): Kysely las ordena por nombre`,
        })
      }
    }
  }
  for (const { m } of parsed) {
    const seen = new Set<string>()
    const stack = [m.id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const dep of byId.get(cur)?.m.dependsOn ?? []) {
        if (dep === m.id) {
          issues.push({
            code: "depends_on_cycle",
            module: m.id,
            message: `ciclo de dependsOn que vuelve a "${m.id}"`,
          })
          stack.length = 0
          break
        }
        if (!seen.has(dep)) {
          seen.add(dep)
          stack.push(dep)
        }
      }
    }
  }
  return issues
}
