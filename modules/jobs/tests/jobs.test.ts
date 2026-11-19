/**
 * jobs v0.1 — what runs without a database: the registry, the runner (with an
 * in-memory store that mimics the lock), the secret check, the HTTP handler,
 * result serialization, the catalog and, reading the code, the guards and the
 * lock in the migration. Relative imports only, so it runs transpiled.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { handleJobRequest } from "../server/handler"
import { clearJobs, defineJob, getJob, listJobs } from "../server/registry"
import { JobTimeoutError, errorText, runJob, serializeResult, type FinishInput, type RunStore } from "../server/runner"
import { bearerToken, checkCronAuth, safeEqual } from "../server/secret"
import { formatDuration } from "../ui/format"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(process.cwd(), "modules", "jobs")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")
const SECRET = "0123456789abcdef-secret"

/** In-memory store with the same rule as the partial unique index: one open run per name. */
function memStore() {
  const open = new Set<string>()
  const runs: { id: string; name: string; kind: string; triggeredBy: string | null; lockMs: number; end?: FinishInput }[] = []
  const store: RunStore = {
    async acquire(i) {
      if (open.has(i.name)) return null
      open.add(i.name)
      const id = `run-${runs.length + 1}`
      runs.push({ id, name: i.name, kind: i.kind, triggeredBy: i.triggeredBy, lockMs: i.lockMs })
      return { id }
    },
    async finish(id, input) {
      const r = runs.find((x) => x.id === id)!
      r.end = input
      open.delete(r.name)
    },
  }
  return { store, runs, open }
}

test("defineJob: validates the name and timeout, replaces on redefinition, lists sorted", () => {
  clearJobs()
  for (const bad of ["", "Bad Name", "-x", "a/b", "x".repeat(81)]) assert.throws(() => defineJob(bad, () => {}), /invalid job name/)
  assert.throws(() => defineJob("ok", () => {}, { timeoutMs: 10 }), /timeoutMs/)
  assert.throws(() => defineJob("ok", () => {}, { timeoutMs: 99_999_999 }), /timeoutMs/)
  defineJob("b-job", () => 1, { description: "  B  ", schedule: "0 4 * * *" })
  defineJob("a-job", () => 2)
  defineJob("b-job", () => 3)
  assert.deepEqual(listJobs().map((j) => j.name), ["a-job", "b-job"])
  assert.equal(getJob("b-job")?.description, null) // replaced by the redefinition
  assert.equal(getJob("nope"), undefined)
  clearJobs()
})

test("runJob: success is recorded with its result and the lock is released", async () => {
  clearJobs()
  const def = defineJob("ok-job", async ({ name, kind }) => ({ name, kind }))
  const { store, runs, open } = memStore()
  const out = await runJob(def, store, { kind: "manual", triggeredBy: "u1" })
  assert.equal(out.status, "succeeded")
  assert.equal(runs[0].end?.status, "succeeded")
  assert.deepEqual(JSON.parse(runs[0].end!.result!), { name: "ok-job", kind: "manual" })
  assert.equal(runs[0].triggeredBy, "u1")
  assert.ok(runs[0].lockMs > def.timeoutMs)
  assert.equal(open.size, 0)
})

test("runJob: a second run while the first is alive is skipped, not queued", async () => {
  clearJobs()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const def = defineJob("slow-job", () => gate)
  const { store, runs } = memStore()
  const first = runJob(def, store, { kind: "cron" })
  await new Promise((r) => setTimeout(r, 5))
  const second = await runJob(def, store, { kind: "manual" })
  assert.deepEqual(second, { status: "skipped", name: "slow-job" })
  assert.equal(runs.length, 1)
  release()
  assert.equal((await first).status, "succeeded")
  assert.equal((await runJob(def, store, { kind: "cron" })).status, "succeeded") // lock free again
})

test("runJob: a throwing handler is recorded as failed (sync and async) and releases the lock", async () => {
  clearJobs()
  const { store, runs, open } = memStore()
  const a = await runJob(defineJob("boom-a", () => { throw new Error("sync boom") }), store, { kind: "cron" })
  const b = await runJob(defineJob("boom-b", async () => { throw "string boom" }), store, { kind: "cron" })
  assert.equal(a.status, "failed")
  assert.equal(b.status, "failed")
  assert.equal(runs[0].end?.error, "sync boom")
  assert.equal(runs[1].end?.error, "string boom")
  assert.equal(open.size, 0)
})

test("runJob: timeout fails the run, aborts the signal and releases the lock", async () => {
  clearJobs()
  let signal: AbortSignal | undefined
  const def = defineJob("hang-job", ({ signal: s }) => { signal = s; return new Promise(() => {}) }, { timeoutMs: 1_000 })
  const { store, runs, open } = memStore()
  const out = await runJob(def, store, { kind: "cron" })
  assert.equal(out.status, "failed")
  assert.match(runs[0].end!.error!, /timeout/)
  assert.equal(signal?.aborted, true)
  assert.equal(open.size, 0)
  assert.ok(new JobTimeoutError(5) instanceof Error)
})

test("runJob: a failing bookkeeping write does not change the outcome; a failing acquire propagates", async () => {
  clearJobs()
  const def = defineJob("book-job", () => "x")
  const logged: string[] = []
  const flaky: RunStore = { acquire: async () => ({ id: "r1" }), finish: async () => { throw new Error("db down") } }
  const out = await runJob(def, flaky, { kind: "cron", log: (m) => void logged.push(m) })
  assert.equal(out.status, "succeeded")
  assert.equal(logged.length, 1)
  const dead: RunStore = { acquire: async () => { throw new Error("no db") }, finish: async () => {} }
  await assert.rejects(runJob(def, dead, { kind: "cron" }), /no db/)
})

test("serializeResult / errorText: bounded and never throw", () => {
  assert.equal(serializeResult(undefined), null)
  assert.equal(serializeResult({ a: 1 }), '{"a":1}')
  const circ: Record<string, unknown> = {}
  circ.self = circ
  assert.deepEqual(JSON.parse(serializeResult(circ)!), { unserializable: true })
  assert.deepEqual(JSON.parse(serializeResult("x".repeat(20_000))!), { truncated: true })
  assert.equal(serializeResult(() => 1), null)
  assert.ok(errorText(new Error("e".repeat(5000))).length <= 2001)
})

test("secret: constant-time compare, bearer parsing, fail closed", () => {
  assert.equal(safeEqual("abc", "abc"), true)
  assert.equal(safeEqual("abc", "abd"), false)
  assert.equal(safeEqual("abc", "abcd"), false)
  assert.equal(safeEqual("", ""), true)
  assert.equal(bearerToken("Bearer tok"), "tok")
  assert.equal(bearerToken("bearer   tok "), "tok")
  for (const bad of [null, "", "Basic abc", "Bearer", "Bearer a b", "Bearertok"]) assert.equal(bearerToken(bad), null, String(bad))
  assert.equal(checkCronAuth(`Bearer ${SECRET}`, SECRET), "ok")
  assert.equal(checkCronAuth(`Bearer ${SECRET}x`, SECRET), "unauthorized")
  assert.equal(checkCronAuth(null, SECRET), "unauthorized")
  assert.equal(checkCronAuth(`Bearer ${SECRET}`, undefined), "not_configured")
  assert.equal(checkCronAuth("Bearer short", "short"), "not_configured")
})

test("handler: 503 without secret, 401 with a bad one, and never reveals which jobs exist", async () => {
  clearJobs()
  defineJob("real-job", () => ({ done: true }))
  const { store } = memStore()
  const deps = (secret: string | undefined) => ({
    secret: () => secret,
    getJob,
    run: (def: NonNullable<ReturnType<typeof getJob>>, kind: "cron" | "manual") => runJob(def, store, { kind }),
  })
  const req = (auth?: string) => new Request("https://app.example/api/jobs/real-job", { headers: auth ? { authorization: auth } : {} })
  assert.equal((await handleJobRequest(req(`Bearer ${SECRET}`), "real-job", deps(undefined))).status, 503)
  assert.equal((await handleJobRequest(req(), "real-job", deps(SECRET))).status, 401)
  assert.equal((await handleJobRequest(req("Bearer nope"), "real-job", deps(SECRET))).status, 401)
  // unauthenticated: same answer for a real and an unknown job
  assert.equal((await handleJobRequest(req("Bearer nope"), "ghost", deps(SECRET))).status, 401)
  assert.equal((await handleJobRequest(req(`Bearer ${SECRET}`), "ghost", deps(SECRET))).status, 404)
  assert.equal((await handleJobRequest(req(`Bearer ${SECRET}`), "../etc", deps(SECRET))).status, 404)
  const ok = await handleJobRequest(req(`Bearer ${SECRET}`), "real-job", deps(SECRET))
  assert.equal(ok.status, 200)
  assert.equal(((await ok.json()) as { status: string }).status, "succeeded")
})

test("handler: 409 when already running, 500 without leaking the error text", async () => {
  clearJobs()
  let release!: () => void
  defineJob("held-job", () => new Promise<void>((r) => (release = r)))
  defineJob("fail-job", () => { throw new Error("secret-detail-xyz") })
  const { store } = memStore()
  const deps = {
    secret: () => SECRET,
    getJob,
    run: (def: NonNullable<ReturnType<typeof getJob>>, kind: "cron" | "manual") => runJob(def, store, { kind, log: () => {} }),
  }
  const req = () => new Request("https://app.example/x", { method: "POST", headers: { authorization: `Bearer ${SECRET}` } })
  const first = handleJobRequest(req(), "held-job", deps)
  await new Promise((r) => setTimeout(r, 5))
  const second = await handleJobRequest(req(), "held-job", deps)
  assert.equal(second.status, 409)
  release()
  assert.equal((await first).status, 200)
  const failed = await handleJobRequest(req(), "fail-job", deps)
  assert.equal(failed.status, 500)
  assert.ok(!JSON.stringify(await failed.json()).includes("secret-detail-xyz"))
})

test("formatDuration", () => {
  assert.equal(formatDuration(null), "—")
  assert.equal(formatDuration(850), "850 ms")
  assert.equal(formatDuration(12_340), "12.3 s")
  assert.equal(formatDuration(245_000), "4 min 5 s")
})

test("catalog: same keys and same ICU arguments in es and en", () => {
  const flat = (o: object, p = ""): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)))
  const e = new Map(flat(en)), s = new Map(flat(es))
  assert.deepEqual([...e.keys()].sort(), [...s.keys()].sort())
  const args = (t: string) => [...t.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join(",")
  for (const [k, v] of s) assert.equal(args(v), args(e.get(k)!), k)
  assert.ok("jobs" in es && Object.keys(es).length === 1)
})

test("permissions: job read/run, adminAccess is read only, no member grant", () => {
  assert.deepEqual(permissions.statement, { job: ["read", "run"] })
  assert.deepEqual(permissions.adminAccess, { job: ["read"] })
  assert.equal("grants" in permissions, false)
})

test("source: page and action check their permission, the route compares the secret in constant time", () => {
  assert.match(read("ui/page.tsx"), /requirePagePermission\("\/admin\/jobs", "read"\)/)
  const action = read("server/actions.ts")
  assert.match(action, /actionSession\("\/admin\/jobs", "run"\)/)
  assert.ok(action.indexOf("actionSession(") < action.indexOf("getJob("))
  assert.match(read("server/secret.ts"), /timingSafeEqual/)
  assert.doesNotMatch(read("server/handler.ts"), /===\s*(deps\.)?secret|secret\(\)\s*===/)
  assert.match(read("server/handler/route.ts"), /handleJobRequest/)
  assert.match(read("server/handler/route.ts"), /export const GET/)
  assert.match(read("server/handler/route.ts"), /export const POST/)
  for (const f of ["server/store.ts", "server/queries.ts", "server/actions.ts"]) assert.doesNotMatch(read(f), /sql`/, f)
})

test("migration: the lock is a partial unique index on running rows", () => {
  const mig = read("db/migrations/0110_jobs_init.ts")
  assert.match(mig, /create unique index jobs_runs_one_running on jobs_runs \(name\) where status = 'running'/)
  const manifest = JSON.parse(read("manifest.json"))
  assert.deepEqual(manifest.migrations, ["0110_jobs_init"])
  assert.equal(manifest.env[0].key, "CRON_SECRET")
})
