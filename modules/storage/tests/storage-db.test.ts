/**
 * storage contra Postgres de verdad: guardar, leer, ligar a una entidad,
 * listar y borrar, con el proveedor en memoria. Crea su propio schema (con una
 * tabla "user" mínima para la llave foránea) y lo borra al terminar.
 *
 * Sin DATABASE_URL se salta —y lo dice—.
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { UnsupportedTypeError, type StorageProvider } from "../contracts/types"
import { up } from "../db/migrations/0102_storage_init"
import {
  attachFile,
  deleteFile,
  getFile,
  listFilesFor,
  saveFile,
  type FilesDeps,
} from "../server/files"
import { memoryProvider } from "../server/providers/memory"

const url = process.env.DATABASE_URL
const skip = url
  ? false
  : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `storage_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let pool: pg.Pool
let db: Kysely<Database>
let mem: ReturnType<typeof memoryProvider>
let deps: FilesDeps

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
const PDF = new TextEncoder().encode("%PDF-1.7\n%fake\n")

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 4 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await pool.query(`create table "user" (id text primary key)`)
  await pool.query(`insert into "user" (id) values ('u1'), ('u2')`)
  await up(db as unknown as Kysely<unknown>)
  mem = memoryProvider()
  deps = { db, provider: () => mem, providerFor: () => mem }
})

after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

test("saveFile guarda la fila con el tipo detectado y el objeto en el proveedor", { skip }, async () => {
  const f = await saveFile(deps, { data: PDF, name: "../boleta marzo.pdf", ownerId: "u1" })
  assert.equal(f.contentType, "application/pdf")
  assert.equal(f.name, "boleta marzo.pdf")
  assert.equal(f.visibility, "private")
  assert.equal(f.url, `/api/storage/${f.id}`)
  const again = await getFile(deps, f.id)
  assert.equal(again?.size, PDF.byteLength)
})

test("saveFile rechaza un tipo no admitido sin tocar proveedor ni base", { skip }, async () => {
  const before = mem.size
  await assert.rejects(
    saveFile(deps, { data: new TextEncoder().encode("<svg/>"), name: "x.png", ownerId: "u1" }),
    UnsupportedTypeError
  )
  assert.equal(mem.size, before)
})

test("si la fila falla, el objeto subido se borra", { skip }, async () => {
  const before = mem.size
  await assert.rejects(
    saveFile(deps, { data: PNG, name: "x.png", ownerId: "no-existe" }) // FK
  )
  assert.equal(mem.size, before)
})

test("attachFile: solo el dueño, solo un archivo suelto; listFilesFor en orden", { skip }, async () => {
  const a = await saveFile(deps, { data: PNG, name: "a.png", ownerId: "u1" })
  const b = await saveFile(deps, { data: PNG, name: "b.png", ownerId: "u1" })
  assert.equal(await attachFile(deps, { fileId: a.id, ownerId: "u2", entity: "ticket", entityId: "t1" }), null)
  assert.ok(await attachFile(deps, { fileId: a.id, ownerId: "u1", entity: "ticket", entityId: "t1" }))
  assert.ok(await attachFile(deps, { fileId: a.id, ownerId: "u1", entity: "ticket", entityId: "t1" }))
  assert.equal(await attachFile(deps, { fileId: a.id, ownerId: "u1", entity: "ticket", entityId: "t2" }), null)
  await attachFile(deps, { fileId: b.id, ownerId: "u1", entity: "ticket", entityId: "t1", visibility: "members" })
  const list = await listFilesFor(deps, "ticket", "t1")
  assert.deepEqual(list.map((f) => f.id), [a.id, b.id])
  assert.equal(list[1]!.visibility, "members")
})

test("deleteFile borra objeto y fila; un proveedor que falla deja la fila", { skip }, async () => {
  const f = await saveFile(deps, { data: PNG, name: "c.png", ownerId: "u1" })
  const broken: StorageProvider = { ...mem, name: "memory", delete: async () => { throw new Error("caído") } }
  await assert.rejects(deleteFile({ db, providerFor: () => broken }, f.id))
  assert.ok(await getFile(deps, f.id))
  assert.equal(await deleteFile(deps, f.id), true)
  assert.equal(await getFile(deps, f.id), null)
  assert.equal(await deleteFile(deps, f.id), false)
})
