/**
 * storage — lo que se prueba SIN base de datos: el tipo real por bytes, las
 * reglas de acceso, los nombres, el proveedor Vercel Blob contra un fetch
 * falso (lo que manda y cómo lee las respuestas), el de memoria y los dos
 * handlers HTTP con dependencias inyectadas. Lo que necesita Postgres está en
 * storage-db.test.ts.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_MAX_BYTES,
  StorageNotConfiguredError,
  StorageProviderError,
  UnsupportedTypeError,
  type SaveFileInput,
  type StorageFile,
  type Visibility,
} from "../contracts/types"
import { handleServe, handleUpload } from "../server/handlers"
import {
  canDelete,
  canRead,
  cleanFileName,
  contentDisposition,
  objectPath,
  type FileAction,
  type Viewer,
} from "../server/policy"
import { blobAccess, currentProvider, providerByName } from "../server/provider"
import { memoryProvider } from "../server/providers/memory"
import {
  isBlobUrl,
  storeIdFromToken,
  vercelBlobProvider,
} from "../server/providers/vercel-blob"
import { sniffType } from "../server/sniff"

const bytes = (...b: number[]) => new Uint8Array(b)
const ascii = (s: string) => new TextEncoder().encode(s)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)
const ID = "0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e"

// ── tipo real ────────────────────────────────────────────────────────────────

test("sniffType reconoce los cinco tipos por sus bytes", () => {
  assert.equal(sniffType(JPEG), "image/jpeg")
  assert.equal(sniffType(PNG), "image/png")
  assert.equal(sniffType(ascii("GIF89a....")), "image/gif")
  assert.equal(sniffType(ascii("RIFF\x10\x00\x00\x00WEBPVP8 ")), "image/webp")
  assert.equal(sniffType(ascii("%PDF-1.7\n")), "application/pdf")
})

test("sniffType rechaza SVG, HTML, texto, RIFF que no es WEBP y archivos cortos", () => {
  assert.equal(sniffType(ascii("<svg xmlns='http://www.w3.org/2000/svg'>")), null)
  assert.equal(sniffType(ascii("<!doctype html><script>")), null)
  assert.equal(sniffType(ascii("hola,mundo\n")), null)
  assert.equal(sniffType(ascii("RIFF\x10\x00\x00\x00WAVEfmt ")), null)
  assert.equal(sniffType(bytes(0xff, 0xd8)), null)
  assert.equal(sniffType(bytes()), null)
})

// ── reglas de acceso ─────────────────────────────────────────────────────────

const viewer = (
  id: string,
  grants: FileAction[],
  isAdmin = false
): Viewer => ({ id, isAdmin, can: async (a) => grants.includes(a) })
const f = (visibility: Visibility, ownerId: string | null = "u1") => ({
  visibility,
  ownerId,
})

test("public: cualquiera, incluso sin sesión", async () => {
  assert.equal(await canRead(f("public"), null), true)
})

test("members: sesión con file:read, de quien sea el archivo", async () => {
  assert.equal(await canRead(f("members"), null), false)
  assert.equal(await canRead(f("members"), viewer("u2", [])), false)
  assert.equal(await canRead(f("members"), viewer("u2", ["read"])), true)
})

test("private: el dueño o un admin, y siempre con file:read", async () => {
  assert.equal(await canRead(f("private"), null), false)
  assert.equal(await canRead(f("private"), viewer("u1", ["read"])), true)
  assert.equal(await canRead(f("private"), viewer("u1", [])), false)
  assert.equal(await canRead(f("private"), viewer("u2", ["read"])), false)
  assert.equal(await canRead(f("private"), viewer("u2", ["read"], true)), true)
  assert.equal(await canRead(f("private", null), viewer("u2", ["read"])), false)
})

test("borrar: el dueño o un admin, con file:delete; nunca sin sesión", async () => {
  assert.equal(await canDelete(f("public"), null), false)
  assert.equal(await canDelete(f("public"), viewer("u1", ["delete"])), true)
  assert.equal(await canDelete(f("public"), viewer("u1", ["read"])), false)
  assert.equal(await canDelete(f("members"), viewer("u2", ["delete"])), false)
  assert.equal(await canDelete(f("members"), viewer("u2", ["delete"], true)), true)
})

// ── nombres ──────────────────────────────────────────────────────────────────

test("cleanFileName quita rutas, controles y comillas; nunca queda vacío", () => {
  assert.equal(cleanFileName("C:\\fotos\\boleta.jpg"), "boleta.jpg")
  assert.equal(cleanFileName("../../etc/passwd"), "passwd")
  assert.equal(cleanFileName('a"b<c>\u0000d.pdf'), "abcd.pdf")
  assert.equal(cleanFileName(".."), "archivo")
  assert.equal(cleanFileName("   "), "archivo")
  assert.equal(cleanFileName("x".repeat(500)).length, 200)
})

test("objectPath usa el id y la extensión detectada, no el nombre del usuario", () => {
  assert.equal(objectPath(ID, "application/pdf"), `storage/${ID}.pdf`)
})

test("contentDisposition: respaldo ASCII sin comillas y nombre UTF-8", () => {
  const h = contentDisposition('boleta "ñandú".pdf', "attachment")
  assert.match(h, /^attachment; filename="boleta _/)
  assert.ok(!h.slice(h.indexOf('"') + 1, h.lastIndexOf('"')).includes('"'))
  assert.match(h, /filename\*=UTF-8''boleta%20%22%C3%B1and%C3%BA%22\.pdf$/)
})

// ── Vercel Blob con fetch falso ──────────────────────────────────────────────

type Call = { url: string; init: RequestInit }
function fakeFetch(respond: (c: Call) => Response) {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return respond(call)
  }) as typeof fetch
  return { fn, calls }
}
const TOKEN = "vercel_blob_rw_store123_secreto"
const BLOB_URL = `https://store123.private.blob.vercel-storage.com/storage/${ID}-abc.png`
const hdr = (c: Call) => c.init.headers as Record<string, string>

test("storeIdFromToken e isBlobUrl", () => {
  assert.equal(storeIdFromToken(TOKEN), "store123")
  assert.equal(isBlobUrl(BLOB_URL), true)
  assert.equal(isBlobUrl("https://evil.example/blob.vercel-storage.com"), false)
  assert.equal(isBlobUrl("http://store123.public.blob.vercel-storage.com/x"), false)
  assert.equal(isBlobUrl("memory:storage/x"), false)
})

test("put manda PUT con los encabezados del SDK y devuelve la url como clave", async () => {
  const { fn, calls } = fakeFetch(() => Response.json({ url: BLOB_URL }))
  const p = vercelBlobProvider({ token: TOKEN, access: "private", fetch: fn })
  const { key } = await p.put(`storage/${ID}.png`, PNG, { contentType: "image/png" })
  assert.equal(key, BLOB_URL)
  const c = calls[0]!
  assert.equal(c.init.method, "PUT")
  assert.equal(c.url, `https://vercel.com/api/blob/?pathname=storage%2F${ID}.png`)
  assert.equal(hdr(c).authorization, `Bearer ${TOKEN}`)
  assert.equal(hdr(c)["x-api-version"], "12")
  assert.equal(hdr(c)["x-vercel-blob-store-id"], "store123")
  assert.equal(hdr(c)["x-vercel-blob-access"], "private")
  assert.equal(hdr(c)["x-content-type"], "image/png")
  assert.equal(hdr(c)["x-add-random-suffix"], "1")
  assert.equal(hdr(c)["x-content-length"], String(PNG.byteLength))
})

test("put: un error del API es StorageProviderError con el código del proveedor", async () => {
  const { fn } = fakeFetch(() =>
    Response.json({ error: { code: "forbidden", message: "nope" } }, { status: 403 })
  )
  const p = vercelBlobProvider({ token: TOKEN, access: "private", fetch: fn })
  await assert.rejects(
    p.put("storage/x.png", PNG, { contentType: "image/png" }),
    (e: unknown) => e instanceof StorageProviderError && e.status === 403 && /forbidden/.test(e.message)
  )
})

test("put: una respuesta sin url de blob no se guarda", async () => {
  const { fn } = fakeFetch(() => Response.json({ url: "https://evil.example/x" }))
  const p = vercelBlobProvider({ token: TOKEN, access: "private", fetch: fn })
  await assert.rejects(p.put("storage/x.png", PNG, { contentType: "image/png" }), StorageProviderError)
})

test("get: con token si el store es privado, sin token si es público; 404 → null", async () => {
  const priv = fakeFetch(() => new Response(PNG))
  const p1 = vercelBlobProvider({ token: TOKEN, access: "private", fetch: priv.fn })
  assert.ok(await p1.get(BLOB_URL))
  assert.equal(hdr(priv.calls[0]!).authorization, `Bearer ${TOKEN}`)

  const pub = fakeFetch(() => new Response(null, { status: 404 }))
  const p2 = vercelBlobProvider({ token: TOKEN, access: "public", fetch: pub.fn })
  assert.equal(await p2.get(BLOB_URL), null)
  assert.equal(hdr(pub.calls[0]!).authorization, undefined)
})

test("get y delete nunca mandan el token a una URL que no es de Vercel Blob", async () => {
  const { fn, calls } = fakeFetch(() => new Response(PNG))
  const p = vercelBlobProvider({ token: TOKEN, access: "private", fetch: fn })
  assert.equal(await p.get("https://evil.example/x.png"), null)
  await p.delete("https://evil.example/x.png")
  assert.equal(calls.length, 0)
})

test("delete: POST /delete con la url; 404 no es error", async () => {
  const { fn, calls } = fakeFetch(() => new Response(null, { status: 404 }))
  const p = vercelBlobProvider({ token: TOKEN, access: "private", fetch: fn })
  await p.delete(BLOB_URL)
  assert.equal(calls[0]!.url, "https://vercel.com/api/blob/delete")
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { urls: [BLOB_URL] })
})

test("publicUrl solo en un store público", () => {
  const priv = vercelBlobProvider({ token: TOKEN, access: "private" })
  const pub = vercelBlobProvider({ token: TOKEN, access: "public" })
  assert.equal(priv.publicUrl(BLOB_URL), null)
  assert.equal(pub.publicUrl(BLOB_URL), BLOB_URL)
})

// ── memoria y configuración ──────────────────────────────────────────────────

test("memoria: put, get, delete y nada de URL directa", async () => {
  const m = memoryProvider()
  const { key } = await m.put("storage/a.png", PNG, { contentType: "image/png" })
  const got = await m.get(key)
  assert.ok(got)
  assert.deepEqual(new Uint8Array(await new Response(got.body).arrayBuffer()), PNG)
  assert.equal(m.publicUrl(key), null)
  await m.delete(key)
  assert.equal(await m.get(key), null)
  assert.equal(m.size, 0)
})

test("configuración: sin token en producción falla; en desarrollo usa memoria", () => {
  assert.throws(() => currentProvider({ NODE_ENV: "production" }), StorageNotConfiguredError)
  assert.equal(currentProvider({ NODE_ENV: "development" }).name, "memory")
  assert.equal(currentProvider({ BLOB_READ_WRITE_TOKEN: TOKEN }).name, "vercel-blob")
  assert.throws(() => providerByName("vercel-blob", {}), StorageNotConfiguredError)
  assert.throws(() => providerByName("s3", { BLOB_READ_WRITE_TOKEN: TOKEN }))
  assert.equal(blobAccess({}), "private")
  assert.equal(blobAccess({ STORAGE_BLOB_ACCESS: "public" }), "public")
  assert.equal(blobAccess({ STORAGE_BLOB_ACCESS: "PUBLICO" }), "private")
})

// ── handler de subida ────────────────────────────────────────────────────────

const stored = (over: Partial<StorageFile> = {}): StorageFile => ({
  id: ID,
  ownerId: "u1",
  name: "boleta.png",
  contentType: "image/png",
  size: PNG.byteLength,
  visibility: "private",
  entity: null,
  entityId: null,
  createdAt: new Date("2026-11-14T12:00:00Z"),
  url: `/api/storage/${ID}`,
  ...over,
})

function uploadReq(form: FormData | null, headers: Record<string, string> = {}) {
  return new Request("https://app.test/api/storage/upload", {
    method: "POST",
    body: form ?? "x",
    headers,
  })
}
const formWith = (data: Uint8Array, name = "boleta.png", type = "image/png") => {
  const fd = new FormData()
  fd.set("file", new Blob([new Uint8Array(data)], { type }), name)
  return fd
}

test("subida: sin sesión 401, sin file:upload 403, y no se guarda nada", async () => {
  let saved = 0
  const save = async () => (saved++, stored())
  let r = await handleUpload(uploadReq(formWith(PNG)), { viewer: async () => null, save })
  assert.equal(r.status, 401)
  r = await handleUpload(uploadReq(formWith(PNG)), { viewer: async () => viewer("u1", ["read"]), save })
  assert.equal(r.status, 403)
  assert.deepEqual(await r.json(), { error: "forbidden" })
  assert.equal(saved, 0)
})

test("subida: el dueño es quien sube; el tipo del navegador no se pasa", async () => {
  let got: SaveFileInput | undefined
  const r = await handleUpload(uploadReq(formWith(PNG, "boleta.png", "application/pdf")), {
    viewer: async () => viewer("u1", ["upload"]),
    save: async (input) => ((got = input), stored()),
  })
  assert.equal(r.status, 201)
  assert.equal(got?.ownerId, "u1")
  assert.equal(got?.visibility, "private")
  assert.equal(got?.name, "boleta.png")
  assert.deepEqual(new Uint8Array(got!.data as Uint8Array), PNG)
  assert.ok(!("contentType" in got!))
  const body = (await r.json()) as { file: { id: string; url: string } }
  assert.equal(body.file.id, ID)
  assert.ok(!("ownerId" in body.file))
})

test("subida: Content-Length declarado demasiado grande → 413 sin leer el cuerpo", async () => {
  let read = false
  const req = uploadReq(formWith(PNG), { "content-length": String(DEFAULT_MAX_BYTES * 2) })
  const r = await handleUpload(req, {
    viewer: async () => viewer("u1", ["upload"]),
    save: async () => ((read = true), stored()),
  })
  assert.equal(r.status, 413)
  assert.equal(read, false)
})

test("subida: archivo sobre el límite → 413; sin archivo o visibilidad rara → 400", async () => {
  const deps = { viewer: async () => viewer("u1", ["upload"]), save: async () => stored(), maxBytes: 4 }
  assert.equal((await handleUpload(uploadReq(formWith(PNG)), deps)).status, 413)
  const noFile = new FormData()
  noFile.set("file", "texto")
  assert.equal((await handleUpload(uploadReq(noFile), { ...deps, maxBytes: 100 })).status, 400)
  const badVis = formWith(PNG)
  badVis.set("visibility", "world")
  assert.equal((await handleUpload(uploadReq(badVis), { ...deps, maxBytes: 100 })).status, 400)
  const notMultipart = uploadReq(null, { "content-type": "text/plain" })
  assert.equal((await handleUpload(notMultipart, deps)).status, 400)
})

test("subida: los errores del módulo vuelven como código; otro error es upload_failed", async () => {
  const v = async () => viewer("u1", ["upload"])
  let r = await handleUpload(uploadReq(formWith(PNG)), {
    viewer: v,
    save: async () => { throw new UnsupportedTypeError(null) },
  })
  assert.equal(r.status, 415)
  assert.deepEqual(await r.json(), { error: "unsupported_type" })
  const logged: string[] = []
  r = await handleUpload(uploadReq(formWith(PNG)), {
    viewer: v,
    save: async () => { throw new Error("db caída") },
    log: (m) => logged.push(m),
  })
  assert.equal(r.status, 502)
  assert.deepEqual(await r.json(), { error: "upload_failed" })
  assert.equal(logged.length, 1)
})

// ── handler de lectura ───────────────────────────────────────────────────────

function serveDeps(file: StorageFile | null, v: Viewer | null, provider = memoryProvider()) {
  let viewerCalls = 0
  return {
    deps: {
      viewer: async () => (viewerCalls++, v),
      find: async () => (file ? { file, provider: provider.name, key: "k" } : null),
      providerFor: () => provider,
    },
    viewerCalls: () => viewerCalls,
  }
}
const getReq = (q = "") => new Request(`https://app.test/api/storage/${ID}${q}`)
async function memWith(data: Uint8Array) {
  const store = new Map([["k", { data, contentType: "image/png" }]])
  return memoryProvider(store)
}

test("lectura: id que no es UUID → 404 sin tocar la base", async () => {
  let found = 0
  const r = await handleServe("../../etc", getReq(), {
    viewer: async () => null,
    find: async () => ((found++), null),
    providerFor: () => memoryProvider(),
  })
  assert.equal(r.status, 404)
  assert.equal(found, 0)
})

test("lectura: privado ajeno o sin sesión → 404, igual que uno inexistente", async () => {
  const mem = await memWith(PNG)
  for (const v of [null, viewer("u2", ["read"])]) {
    const { deps } = serveDeps(stored(), v, mem)
    assert.equal((await handleServe(ID, getReq(), deps)).status, 404)
  }
  assert.equal((await handleServe(ID, getReq(), serveDeps(null, viewer("u1", ["read"])).deps)).status, 404)
})

test("lectura: el dueño recibe los bytes con tipo detectado, nosniff y no-store", async () => {
  const mem = await memWith(PNG)
  const r = await handleServe(ID, getReq(), serveDeps(stored(), viewer("u1", ["read"]), mem).deps)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get("content-type"), "image/png")
  assert.equal(r.headers.get("x-content-type-options"), "nosniff")
  assert.equal(r.headers.get("cache-control"), "private, no-store")
  assert.match(r.headers.get("content-disposition")!, /^inline;/)
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG)
})

test("lectura: ?download=1 → attachment", async () => {
  const mem = await memWith(PNG)
  const r = await handleServe(ID, getReq("?download=1"), serveDeps(stored(), viewer("u1", ["read"]), mem).deps)
  assert.match(r.headers.get("content-disposition")!, /^attachment;/)
})

test("lectura: público sin sesión; no se consulta la sesión", async () => {
  const mem = await memWith(PNG)
  const s = serveDeps(stored({ visibility: "public" }), null, mem)
  const r = await handleServe(ID, getReq(), s.deps)
  assert.equal(r.status, 200)
  assert.equal(s.viewerCalls(), 0)
})

test("lectura: público en store público → 302 a la URL del proveedor; privado nunca", async () => {
  const pub = vercelBlobProvider({
    token: TOKEN,
    access: "public",
    fetch: (async () => new Response(PNG)) as typeof fetch,
  })
  const find = (file: StorageFile) => async () => ({ file, provider: pub.name, key: BLOB_URL })
  let r = await handleServe(ID, getReq(), {
    viewer: async () => null,
    find: find(stored({ visibility: "public" })),
    providerFor: () => pub,
  })
  assert.equal(r.status, 302)
  assert.equal(r.headers.get("location"), BLOB_URL)
  r = await handleServe(ID, getReq(), {
    viewer: async () => viewer("u1", ["read"]),
    find: find(stored({ visibility: "members" })),
    providerFor: () => pub,
  })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get("location"), null)
})

test("lectura: objeto perdido en el proveedor → 404", async () => {
  const r = await handleServe(ID, getReq(), serveDeps(stored(), viewer("u1", ["read"]), memoryProvider()).deps)
  assert.equal(r.status, 404)
})
