/**
 * The module's data operations, with the database and the provider injected
 * (contracts/index.ts wires the real ones; the tests, their own). No session
 * or permission checks here: they are the caller's (the routes, or the module
 * that calls the contract).
 */
import type { Kysely, Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  ALLOWED_TYPES,
  DEFAULT_MAX_BYTES,
  EmptyFileError,
  FileTooLargeError,
  UnsupportedTypeError,
  type AllowedType,
  type SaveFileInput,
  type StorageFile,
  type StorageProvider,
  type Visibility,
} from "../contracts/types"
import type { StorageFilesTable } from "../db/types"
import { cleanFileName, fileUrl, objectPath } from "./policy"
import { sniffType } from "./sniff"

export type FilesDeps = {
  db: Kysely<Database>
  /** Provider for new files. */
  provider: () => StorageProvider
  /** Provider that stored an existing file, by its name. */
  providerFor: (name: string) => StorageProvider
  newId?: () => string
}

type Row = Selectable<StorageFilesTable>

export function toFile(r: Row): StorageFile {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    contentType: r.content_type as AllowedType,
    size: r.size_bytes,
    visibility: r.visibility,
    entity: r.entity,
    entityId: r.entity_id,
    createdAt: r.created_at,
    url: fileUrl(r.id),
  }
}

const ENTITY = /^[a-z0-9][a-z0-9_.:-]{0,63}$/
function checkEntity(entity?: string, entityId?: string) {
  if ((entity === undefined) !== (entityId === undefined))
    throw new Error("storage: entity y entityId van juntos")
  if (entity !== undefined && !ENTITY.test(entity))
    throw new Error(`storage: entity inválida «${entity}» (minúsculas, a-z0-9_.:-)`)
  if (entityId !== undefined && (entityId.length === 0 || entityId.length > 200))
    throw new Error("storage: entityId debe tener entre 1 y 200 caracteres")
}

/**
 * Checks, then stores the bytes, then the row. If the row fails, the object is
 * deleted (best effort). Throws FileTooLargeError, EmptyFileError,
 * UnsupportedTypeError, StorageNotConfiguredError or StorageProviderError.
 */
export async function saveFile(
  deps: FilesDeps,
  input: SaveFileInput
): Promise<StorageFile> {
  const data =
    input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data)
  const max = input.maxBytes ?? DEFAULT_MAX_BYTES
  if (data.byteLength === 0) throw new EmptyFileError()
  if (data.byteLength > max) throw new FileTooLargeError(data.byteLength, max)
  const type = sniffType(data)
  const allowed = input.allowedTypes ?? ALLOWED_TYPES
  if (!type || !allowed.includes(type)) throw new UnsupportedTypeError(type)
  checkEntity(input.entity, input.entityId)

  const id = (deps.newId ?? (() => crypto.randomUUID()))()
  const provider = deps.provider()
  const { key } = await provider.put(objectPath(id, type), data, {
    contentType: type,
  })
  try {
    const row = await deps.db
      .insertInto("storage_files")
      .values({
        id,
        owner_id: input.ownerId,
        name: cleanFileName(input.name),
        content_type: type,
        size_bytes: data.byteLength,
        provider: provider.name,
        provider_key: key,
        visibility: input.visibility ?? "private",
        entity: input.entity ?? null,
        entity_id: input.entityId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return toFile(row)
  } catch (err) {
    await provider.delete(key).catch(() => undefined)
    throw err
  }
}

export async function getFileRow(
  deps: Pick<FilesDeps, "db">,
  id: string
): Promise<Row | null> {
  const row = await deps.db
    .selectFrom("storage_files")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()
  return row ?? null
}

export async function getFile(
  deps: Pick<FilesDeps, "db">,
  id: string
): Promise<StorageFile | null> {
  const row = await getFileRow(deps, id)
  return row ? toFile(row) : null
}

/** Oldest first: the order they were attached. */
export async function listFilesFor(
  deps: Pick<FilesDeps, "db">,
  entity: string,
  entityId: string
): Promise<StorageFile[]> {
  const rows = await deps.db
    .selectFrom("storage_files")
    .selectAll()
    .where("entity", "=", entity)
    .where("entity_id", "=", entityId)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute()
  return rows.map(toFile)
}

/**
 * Links an uploaded, still unattached file to an entity. Only the uploader's
 * own file (`ownerId`), so a form cannot claim somebody else's upload by id.
 * Returns the file, or null if it does not exist, is not theirs or is already
 * attached elsewhere. Attaching again to the same entity is a no-op.
 */
export async function attachFile(
  deps: Pick<FilesDeps, "db">,
  input: {
    fileId: string
    ownerId: string
    entity: string
    entityId: string
    visibility?: Visibility
  }
): Promise<StorageFile | null> {
  checkEntity(input.entity, input.entityId)
  const row = await deps.db
    .updateTable("storage_files")
    .set({
      entity: input.entity,
      entity_id: input.entityId,
      ...(input.visibility ? { visibility: input.visibility } : {}),
    })
    .where("id", "=", input.fileId)
    .where("owner_id", "=", input.ownerId)
    .where((eb) =>
      eb.or([
        eb("entity", "is", null),
        eb.and([
          eb("entity", "=", input.entity),
          eb("entity_id", "=", input.entityId),
        ]),
      ])
    )
    .returningAll()
    .executeTakeFirst()
  return row ? toFile(row) : null
}

/**
 * Deletes the object first, then the row: if the provider fails, the row stays
 * and the delete can be retried (the reverse would leave an orphan object
 * nobody can find). Returns false if the file did not exist.
 */
export async function deleteFile(
  deps: Pick<FilesDeps, "db" | "providerFor">,
  id: string
): Promise<boolean> {
  const row = await getFileRow(deps, id)
  if (!row) return false
  await deps.providerFor(row.provider).delete(row.provider_key)
  const res = await deps.db
    .deleteFrom("storage_files")
    .where("id", "=", id)
    .executeTakeFirst()
  return Number(res.numDeletedRows) > 0
}
