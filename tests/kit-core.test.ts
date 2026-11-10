/**
 * Núcleo de los kits (T17): `pnpm test:kits`. Corre sobre TODA carpeta
 * `modules/kit-*`. Cada caso negativo alimenta un kit roto a propósito y espera
 * la regla exacta: si alguien aflojara `checkKitFiles`, el caso se pondría rojo.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  checkKitDocs,
  checkKitFiles,
  kitDirs,
  readKitDir,
  scoreKitRubric,
  RUBRIC_POINTS,
  type KitRule,
} from "../modules/kit-core/testing/checks"

const ROOT = process.cwd()

const rules = (fs: [string, string][], core = false) =>
  checkKitFiles("kit-x", new Map(fs), core).map((f) => f.rule)
const IMPORT = `import { KitHeader } from "@/modules/kit-core/contracts"\n`

// ── 1 · todo kit real pasa ───────────────────────────────────────────────────

test("kit-core existe y está en la lista de kits", () => {
  assert.ok(kitDirs(ROOT).includes("kit-core"))
})

for (const id of kitDirs(ROOT)) {
  test(`${id}: sin colores literales, fuentes permitidas, usa el núcleo`, () => {
    const files = readKitDir(ROOT, id)
    assert.deepEqual(checkKitFiles(id, files, id === "kit-core"), [])
  })
  test(`${id}: documentación y rúbrica`, () => {
    const files = readKitDir(ROOT, id)
    assert.deepEqual(checkKitDocs(id, files, id === "kit-core"), [])
  })
}

// ── 2 · el núcleo cumple lo que promete ──────────────────────────────────────

test("el CSS del núcleo deriva su color de la marca y no toca globals.css", () => {
  const css = readFileSync(
    join(ROOT, "modules/kit-core/ui/kit-core.css"),
    "utf8"
  )
  assert.match(css, /--kit-tint:\s*oklch\([^;]*var\(--brand-h\)/)
  assert.match(css, /var\(--brand-c\)/)
  // Los tonos de estado tienen su propio matiz, no el de la marca.
  assert.match(css, /--kit-success-h:\s*155/)
  const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8")
  assert.ok(
    !globals.includes("--kit-"),
    "globals.css no debe declarar tokens de kit"
  )
})

test("el núcleo exporta los 8 estados, el encabezado y el pie", async () => {
  const src = readFileSync(
    join(ROOT, "modules/kit-core/contracts/index.ts"),
    "utf8"
  )
  for (const n of [
    "EmptyState",
    "LoadingState",
    "ErrorState",
    "SuccessState",
    "ForbiddenState",
    "NoResultsState",
    "OfflineState",
    "PartialState",
    "KitHeader",
    "KitFooter",
  ])
    assert.match(src, new RegExp(`\\b${n}\\b`), `contracts no exporta ${n}`)
})

test("la vista previa del núcleo existe y el shim de la ruta está generado", () => {
  assert.ok(existsSync(join(ROOT, "app/(marketing)/kits/core/page.tsx")))
})

// ── 3 · casos que DEBEN fallar ───────────────────────────────────────────────

const bad: [string, [string, string][], KitRule][] = [
  [
    "hex en tsx",
    [["ui/a.tsx", IMPORT + `const c = <p style={{ color: "#ff0000" }} />`]],
    "literal_color",
  ],
  [
    "hex corto en css",
    [
      ["ui/a.css", `.a { color: #fff; }`],
      ["ui/a.tsx", IMPORT],
    ],
    "literal_color",
  ],
  [
    "rgb()",
    [
      ["ui/a.css", `.a { background: rgb(0 0 0 / 50%); }`],
      ["ui/a.tsx", IMPORT],
    ],
    "literal_color",
  ],
  [
    "color con nombre",
    [
      ["ui/a.css", `.a { background: white; }`],
      ["ui/a.tsx", IMPORT],
    ],
    "literal_color",
  ],
  [
    "paleta de tailwind",
    [["ui/a.tsx", IMPORT + `const x = <p className="bg-red-500 p-4" />`]],
    "palette_class",
  ],
  [
    "bg-white",
    [["ui/a.tsx", IMPORT + `const x = <p className="bg-white" />`]],
    "palette_class",
  ],
  [
    "oklch sin marca",
    [
      ["ui/a.css", `.a { color: oklch(0.5 0.1 200); }`],
      ["ui/a.tsx", IMPORT],
    ],
    "oklch_not_derived",
  ],
  [
    "oklch en tsx",
    [["ui/a.tsx", IMPORT + `const c = "oklch(0.5 0.1 var(--brand-h))"`]],
    "oklch_not_derived",
  ],
  [
    "fuente fuera de la lista",
    [["ui/f.ts", `import { Roboto } from "next/font/google"\n` + IMPORT]],
    "font_not_allowed",
  ],
  [
    "font-family literal",
    [
      ["ui/a.css", `.a { font-family: "Comic Sans MS", cursive; }`],
      ["ui/a.tsx", IMPORT],
    ],
    "font_not_allowed",
  ],
  [
    "sin importar el núcleo",
    [["ui/a.tsx", `export const a = 1`]],
    "no_core_import",
  ],
]
for (const [name, fs, rule] of bad)
  test(`rechaza: ${name}`, () =>
    assert.ok(
      rules(fs).includes(rule),
      `esperaba ${rule}, salió ${rules(fs).join(",") || "nada"}`
    ))

test("acepta: oklch derivado, var de fuente, fuente permitida y un comentario con hex", () => {
  assert.deepEqual(
    rules([
      [
        "ui/a.css",
        `/* antes #ff0000 */ .a { color: oklch(0.5 calc(var(--brand-c) * 0.3) var(--brand-h)); font-family: var(--font-heading); }\n.b { font-family: "IBM Plex Sans", sans-serif; }`,
      ],
      [
        "ui/f.ts",
        `import { Inter, Geist_Mono } from "next/font/google"\n` + IMPORT,
      ],
    ]),
    []
  )
})

// ── 4 · rúbrica ──────────────────────────────────────────────────────────────

const all = (n: 0 | 1 | 2) =>
  Object.fromEntries(RUBRIC_POINTS.map((p) => [p, n]))

test("rúbrica: 16/16 pasa", () =>
  assert.equal(scoreKitRubric({ "1280": all(2), "375": all(2) }).passes, true))
test("rúbrica: 13/16 justo pasa", () => {
  const s = { ...all(2), imagen: 1, espacio: 1, estados: 1 } // 13
  assert.equal(scoreKitRubric({ "1280": s, "375": s }).passes, true)
})
test("rúbrica: 12/16 no pasa", () => {
  const s = { ...all(2), imagen: 1, espacio: 1, estados: 1, jerarquia: 1 } // 12
  assert.equal(scoreKitRubric({ "1280": s, "375": all(2) }).passes, false)
})
test("rúbrica: un 0 no pasa aunque sume 14", () => {
  const s = { ...all(2), imagen: 0 } // 14
  const r = scoreKitRubric({ "1280": s, "375": all(2) })
  assert.equal(r.passes, false)
  assert.match(r.reasons.join(" "), /imagen/)
})
test("rúbrica: falta un ancho o un valor inválido no pasa", () => {
  assert.equal(scoreKitRubric({ "1280": all(2) }).passes, false)
  assert.equal(
    scoreKitRubric({ "1280": all(2), "375": { ...all(2), jerarquia: 3 } })
      .passes,
    false
  )
  assert.equal(scoreKitRubric(null).passes, false)
})

test("docs: un kit sin secciones o sin rubrica.json se rechaza", () => {
  const f = checkKitDocs("kit-x", new Map([["MODULE.md", "# x"]]))
  assert.ok(f.some((x) => x.rule === "doc_missing"))
  assert.ok(f.some((x) => x.rule === "rubric_missing"))
})
