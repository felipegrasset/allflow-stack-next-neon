/**
 * The module contract (T1): `pnpm test:modules`.
 *
 * Every test here can fail — the validator and guard cases feed deliberately
 * broken input and expect the specific issue code, and the install test
 * type-checks a real install and then a deliberately wrong query.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import test from "node:test"

import { plan, readModules } from "../scripts/modules"
import { buildRegistryFiles, SHIM_MARKER } from "../modules/contract/generate"
import type { ModuleManifest } from "../modules/contract/types"
import {
  ANCHOR_FILES,
  PROTECTED_ZONES,
  findViolations,
} from "../modules/contract/zones"
import {
  shimPath,
  validateModules,
  type ModuleIssueCode,
  type ModuleSource,
} from "../modules/contract/validate"

const ROOT = process.cwd()
const EXAMPLE = join(ROOT, "modules", "_examples", "ping")

/** A fresh, valid `ping` source to mutate per case. */
type Editable = ModuleSource & { files: Map<string, string> }
function ping(): Editable {
  const [src] = readModules(ROOT, ["ping"], "modules/_examples")
  return {
    ...src,
    files: new Map(src.files),
    manifest: structuredClone(src.manifest),
  }
}
const codes = (mods: ModuleSource[]) => validateModules(mods).map((i) => i.code)
const manifestOf = (m: ModuleSource) => m.manifest as Record<string, unknown>

// ── 1 · generated files are in sync ──────────────────────────────────────────

test("modules/_generated and the route shims match the manifests (run `pnpm modules:sync`)", () => {
  const { issues, files } = plan(ROOT)
  assert.deepEqual(issues, [])
  for (const [path, text] of files) {
    assert.ok(
      existsSync(join(ROOT, path)),
      `${path} falta: corre pnpm modules:sync`
    )
    assert.equal(
      readFileSync(join(ROOT, path), "utf8"),
      text,
      `${path} está desactualizado: corre pnpm modules:sync`
    )
  }
})

test("the example module is valid", () => {
  assert.deepEqual(validateModules([ping()]), [])
})

// ── 1b · route handlers (webhooks) get a `route.ts` shim, pages a `page.tsx` ──

test("a route whose entry is route.ts gets a handler shim under app/, with no route group", () => {
  const m = ping()
  manifestOf(m).routes = [{ path: "/api/hooks/[kind]", entry: "ui/page.tsx" }]
  assert.equal(
    shimPath({ path: "/api/hooks/[kind]", entry: "server/hook/route.ts" }),
    "app/api/hooks/[kind]/route.ts"
  )
  assert.equal(
    shimPath({ path: "/ping", entry: "ui/page.tsx" }),
    "app/(app)/ping/page.tsx"
  )
  assert.equal(
    shimPath({ path: "/x", entry: "ui/page.tsx", group: "marketing" }),
    "app/(marketing)/x/page.tsx"
  )
  const files = buildRegistryFiles([
    {
      manifest: {
        ...(m.manifest as ModuleManifest),
        routes: [{ path: "/api/hooks/[kind]", entry: "server/hook/route.ts" }],
      },
    },
  ])
  assert.equal(
    files.get("app/api/hooks/[kind]/route.ts"),
    `${SHIM_MARKER} modules/ping/manifest.json. Do not edit.\nexport * from "@/modules/ping/server/hook/route"\n`
  )
})

// ── 2 · the validator rejects what the contract forbids ─────────────────────

const cases: [string, (m: Editable) => void, ModuleIssueCode][] = [
  ["unknown manifest key", (m) => (manifestOf(m).files = []), "manifest_shape"],
  ["bad semver", (m) => (manifestOf(m).version = "1"), "manifest_shape"],
  [
    "id differs from the folder",
    (m) => (manifestOf(m).id = "pong"),
    "id_mismatch",
  ],
  [
    "table without the module prefix",
    (m) => (manifestOf(m).tables = ["orders"]),
    "table_prefix",
  ],
  [
    "migration below 0100",
    (m) => (manifestOf(m).migrations = ["0099_ping_init"]),
    "migration_name",
  ],
  [
    "migration without the module id",
    (m) => (manifestOf(m).migrations = ["9000_init"]),
    "migration_name",
  ],
  [
    "migration file missing",
    (m) => m.files.delete("db/migrations/9000_ping_init.ts"),
    "migration_file_missing",
  ],
  [
    "migration file not listed",
    (m) => m.files.set("db/migrations/9001_ping_more.ts", "export {}"),
    "migration_unlisted",
  ],
  [
    "entrypoint file missing",
    (m) => m.files.delete("nav.ts"),
    "entrypoint_missing",
  ],
  [
    "route entry missing",
    (m) => m.files.delete("ui/page.tsx"),
    "route_invalid",
  ],
  [
    "missing MODULE.md",
    (m) => m.files.delete("MODULE.md"),
    "missing_module_md",
  ],
  [
    "imports another module's internals",
    (m) =>
      m.files.set(
        "server/x.ts",
        `import { q } from "@/modules/orders/server/queries"`
      ),
    "import_internal",
  ],
  [
    "imports another module through a relative path",
    (m) =>
      m.files.set(
        "server/x.ts",
        `import { q } from "../../orders/server/queries"`
      ),
    "import_internal",
  ],
  [
    "imports the generated registry",
    (m) =>
      m.files.set(
        "server/x.ts",
        `import { moduleNavItems } from "@/modules/_generated/nav"`
      ),
    "import_generated",
  ],
  [
    "literal colour",
    (m) =>
      m.files.set(
        "ui/page.tsx",
        `export default () => <p style={{ color: "#ff0000" }}>x</p>`
      ),
    "literal_color",
  ],
  [
    "depends on a module that is not installed",
    (m) => (manifestOf(m).dependsOn = ["orders"]),
    "depends_on_missing",
  ],
]
for (const [name, mutate, code] of cases) {
  test(`validator: ${name} → ${code}`, () => {
    const m = ping()
    mutate(m)
    assert.ok(
      codes([m]).includes(code),
      `esperaba ${code}, salió: ${codes([m]).join(", ") || "(nada)"}`
    )
  })
}

test("validator: allowed imports stay allowed (own files, contract/, another module's contracts/, app code)", () => {
  const m = ping()
  m.files.set(
    "server/ok.ts",
    [
      `import { a } from "@/modules/ping/server/queries"`,
      `import type { T } from "@/modules/contract/types"`,
      `import type { P } from "@/modules/orders/contracts"`,
      `import { b } from "../../../server/db/pool"`,
      `import { c } from "../contracts"`,
    ].join("\n")
  )
  assert.deepEqual(codes([m]), [])
})

test("validator: two modules cannot share a migration number", () => {
  const a = ping()
  const b = ping()
  manifestOf(b).id = "pang"
  manifestOf(b).tables = ["pang_pings"]
  manifestOf(b).migrations = ["9000_pang_init"]
  b.files.set("db/migrations/9000_pang_init.ts", "export {}")
  b.files.delete("db/migrations/9000_ping_init.ts")
  const withDir = { ...b, dir: "pang" }
  assert.ok(codes([a, withDir]).includes("migration_duplicate"))
})

test("validator: a module's migrations must be numbered after those of its dependsOn", () => {
  const a = ping()
  const b = ping()
  manifestOf(b).id = "pang"
  manifestOf(b).tables = ["pang_pings"]
  manifestOf(b).migrations = ["8000_pang_init"]
  manifestOf(b).dependsOn = ["ping"]
  b.files.set("db/migrations/8000_pang_init.ts", "export {}")
  b.files.delete("db/migrations/9000_ping_init.ts")
  assert.ok(codes([a, { ...b, dir: "pang" }]).includes("migration_order"))
})

test("validator: a dependsOn cycle is reported", () => {
  const a = ping()
  const b = ping()
  manifestOf(a).dependsOn = ["pang"]
  manifestOf(b).id = "pang"
  manifestOf(b).tables = ["pang_pings"]
  manifestOf(b).migrations = ["9100_pang_init"]
  manifestOf(b).dependsOn = ["ping"]
  b.files.set("db/migrations/9100_pang_init.ts", "export {}")
  b.files.delete("db/migrations/9000_ping_init.ts")
  assert.ok(codes([a, { ...b, dir: "pang" }]).includes("depends_on_cycle"))
})

// ── 3 · the guard: protected zones and anchors ──────────────────────────────

test("guard: a change in components/ui/** or server/auth/** is a violation", () => {
  for (const f of ["components/ui/button.tsx", "server/auth/options.ts"]) {
    const v = findViolations([f])
    assert.equal(v.length, 1, f)
    assert.equal(v[0].rule, "protected-zone")
  }
})

test("guard: ALLOW_PROTECTED_ZONES (label zonas-protegidas-ok) lifts only the protected-zone rule", () => {
  assert.deepEqual(
    findViolations(["components/ui/button.tsx"], { allowProtectedZones: true }),
    []
  )
  const v = findViolations(
    ["modules/orders/manifest.json", "server/db/seed.ts"],
    { allowProtectedZones: true }
  )
  assert.deepEqual(
    v.map((x) => x.rule),
    ["anchor-file"]
  )
})

test("guard: a change that adds a module may not edit any genesis anchor", () => {
  for (const anchor of ANCHOR_FILES) {
    const v = findViolations([
      "modules/orders/manifest.json",
      "modules/_generated/nav.ts",
      anchor,
    ])
    assert.deepEqual(
      v.map((x) => x.file),
      [anchor],
      anchor
    )
  }
})

test("guard: a module change that stays in its lane passes", () => {
  assert.deepEqual(
    findViolations([
      "modules/orders/manifest.json",
      "modules/orders/ui/page.tsx",
      "modules/_generated/nav.ts",
      "app/(app)/orders/page.tsx",
    ]),
    []
  )
})

test("guard: a change to the contract itself may touch the anchors (CODEOWNERS reviews it)", () => {
  assert.deepEqual(
    findViolations(["modules/contract/zones.ts", "server/db/migrate.ts"]),
    []
  )
})

test("guard: an anchor edited outside any module change is not this guard's business", () => {
  assert.deepEqual(findViolations(["config/nav.ts", "lib/copy/auth.ts"]), [])
})

test("the protected zones are the two CONVENTIONS.md names, and CODEOWNERS lists them", () => {
  assert.deepEqual([...PROTECTED_ZONES], ["components/ui/", "server/auth/"])
  const owners = readFileSync(join(ROOT, ".github/CODEOWNERS"), "utf8")
  for (const z of PROTECTED_ZONES)
    assert.ok(owners.includes(`/${z}`), `${z} no está en CODEOWNERS`)
  assert.ok(
    owners.includes("/modules/contract/"),
    "modules/contract/ no está en CODEOWNERS"
  )
})

// ── 4 · the genesis anchors survive (allflow.biz genesis.ts edits them by exact text) ──

test("the genesis anchors in schema/index.ts, migrate.ts and seed.ts are intact", () => {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  const schema = read("server/db/schema/index.ts")
  assert.ok(
    schema.includes(`import type { ColumnType, Generated } from "kysely"`)
  )
  assert.ok(schema.includes("export interface Database {"))
  const migrate = read("server/db/migrate.ts")
  assert.ok(
    migrate.includes(`import * as m0002 from "./migrations/0002_rate_limit"`)
  )
  assert.ok(migrate.includes(`  "0002_rate_limit": m0002,`))
  const seed = read("server/db/seed.ts")
  assert.ok(seed.includes(`import type { Database } from "./schema"`))
  assert.ok(seed.includes("quedaron como member`)"))
})

test("migrate.ts allows unordered migrations and spreads the module index after the core's", () => {
  const migrate = readFileSync(join(ROOT, "server/db/migrate.ts"), "utf8")
  assert.ok(migrate.includes("allowUnorderedMigrations: true"))
  const core = migrate.indexOf(`"0002_rate_limit": m0002,`)
  const spread = migrate.indexOf("...moduleMigrations")
  assert.ok(
    core > 0 && spread > core,
    "...moduleMigrations va después de las migraciones del core"
  )
})

// ── 5 · a real install in a throwaway copy of the repo ──────────────────────

function copyRepo(): string {
  const tmp = mkdtempSync(join(tmpdir(), "allflow-modules-"))
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT, encoding: "utf8" }
  )
    .split("\0")
    .filter((f) => f && existsSync(join(ROOT, f)))
  for (const f of files) {
    mkdirSync(dirname(join(tmp, f)), { recursive: true })
    cpSync(join(ROOT, f), join(tmp, f))
  }
  // Generated by `next build`/`next dev`; a fresh worktree may not have it yet.
  if (existsSync(join(ROOT, "next-env.d.ts")))
    cpSync(join(ROOT, "next-env.d.ts"), join(tmp, "next-env.d.ts"))
  symlinkSync(join(ROOT, "node_modules"), join(tmp, "node_modules"))
  return tmp
}

function listFiles(dir: string, base = dir, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) listFiles(p, base, acc)
    else acc.push(relative(base, p))
  }
  return acc
}

const run = (cwd: string, ...args: string[]) =>
  execFileSync(args[0], args.slice(1), {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

test(
  "installing the example touches no anchor and no protected zone, type-checks, and wires permissions",
  { timeout: 240_000 },
  () => {
    const tmp = copyRepo()
    try {
      cpSync(EXAMPLE, join(tmp, "modules", "ping"), { recursive: true })
      run(tmp, "pnpm", "exec", "tsx", "scripts/modules.ts", "sync")
      run(tmp, "pnpm", "exec", "tsx", "scripts/modules.ts", "check")

      // Byte-for-byte: anchors and protected zones are what the repo has.
      const sensitive = [
        ...ANCHOR_FILES,
        ...PROTECTED_ZONES.flatMap((z) =>
          listFiles(join(ROOT, z)).map((f) => `${z}${f}`)
        ),
      ]
      for (const f of sensitive) {
        assert.equal(
          readFileSync(join(tmp, f), "utf8"),
          readFileSync(join(ROOT, f), "utf8"),
          `${f} cambió al instalar el módulo`
        )
      }
      // And the install is visible exactly where the contract says.
      assert.match(
        readFileSync(join(tmp, "modules/_generated/migrations.ts"), "utf8"),
        /"9000_ping_init"/
      )
      assert.match(
        readFileSync(join(tmp, "modules/_generated/nav.ts"), "utf8"),
        /nav_ping/
      )
      assert.ok(existsSync(join(tmp, "app/(app)/ping/page.tsx")))

      // `Database` gains ping_pings by interface merging; owner/admin get the module's permissions, member only reads.
      run(tmp, "pnpm", "exec", "tsc", "--noEmit", "--incremental", "false")
      const roles = JSON.parse(
        run(
          tmp,
          "pnpm",
          "exec",
          "tsx",
          "-e",
          `import { roles } from "./lib/permissions"; console.log(JSON.stringify({ owner: roles.owner.statements.ping, admin: roles.admin.statements.ping, member: roles.member.statements.ping }))`
        )
          .trim()
          .split("\n")
          .pop()!
      )
      assert.deepEqual(roles, {
        owner: ["read", "write"],
        admin: ["read", "write"],
        member: ["read"],
      })

      // The same program must FAIL on a query the merged `Database` doesn't allow.
      writeFileSync(
        join(tmp, "modules/ping/server/__bad.ts"),
        `import { getKysely } from "@/server/db/pool"\nexport const bad = () => getKysely().selectFrom("ping_pings").select("no_such_column").execute()\n`
      )
      let failure = ""
      try {
        run(tmp, "pnpm", "exec", "tsc", "--noEmit", "--incremental", "false")
      } catch (e) {
        failure = String((e as { stdout?: string }).stdout ?? "")
      }
      assert.match(
        failure,
        /__bad\.ts[\s\S]*no_such_column/,
        "tsc debía rechazar la columna inexistente de ping_pings"
      )

      // Taking it out again leaves the app as it was.
      rmSync(join(tmp, "modules/ping"), { recursive: true })
      run(tmp, "pnpm", "exec", "tsx", "scripts/modules.ts", "sync")
      assert.ok(
        !existsSync(join(tmp, "app/(app)/ping")),
        "el shim de la ruta quedó huérfano"
      )
      for (const f of ["migrations", "nav", "permissions", "seeds"]) {
        assert.equal(
          readFileSync(join(tmp, `modules/_generated/${f}.ts`), "utf8"),
          readFileSync(join(ROOT, `modules/_generated/${f}.ts`), "utf8")
        )
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }
)
