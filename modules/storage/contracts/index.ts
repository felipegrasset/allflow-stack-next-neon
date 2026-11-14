/**
 * Lo único que otro módulo (o la app) puede importar de `storage`, del lado
 * del servidor. El componente de cliente está en `./file-input`.
 *
 *   import { saveFile, attachFile, listFilesFor, canAccessFile } from "@/modules/storage/contracts"
 *
 *   // En la server action de tu módulo, después de comprobar TU permiso:
 *   const file = await attachFile({ fileId, ownerId: session.user.id,
 *     entity: "ticket", entityId: ticket.id })
 *   const adjuntos = await listFilesFor("ticket", ticket.id)  // file.url → /api/storage/<id>
 *
 * Ninguna de estas funciones comprueba sesión ni permiso (salvo
 * `canAccessFile`): las llama código de servidor que ya lo hizo.
 */
import { getKysely } from "@/server/db/pool"

import { currentViewer } from "../server/access"
import * as files from "../server/files"
import { canDelete, canRead, fileUrl } from "../server/policy"
import { currentProvider, providerByName } from "../server/provider"

import type { SaveFileInput, StorageFile, Visibility } from "./types"

const deps = (): files.FilesDeps => ({
  db: getKysely(),
  provider: () => currentProvider(),
  providerFor: (name) => providerByName(name),
})

/** Guarda bytes del servidor (un PDF generado, una imagen descargada). Valida tamaño y tipo real. */
export const saveFile = (input: SaveFileInput): Promise<StorageFile> =>
  files.saveFile(deps(), input)

/** Metadatos de un archivo, sin comprobar permisos. */
export const getFile = (id: string): Promise<StorageFile | null> =>
  files.getFile(deps(), id)

/** Borra el objeto y su fila. No comprueba permisos: usa `canAccessFile(id, "delete")` antes. */
export const deleteFile = (id: string): Promise<boolean> =>
  files.deleteFile(deps(), id)

/** Los archivos ligados a una entidad, del más antiguo al más nuevo. */
export const listFilesFor = (
  entity: string,
  entityId: string
): Promise<StorageFile[]> => files.listFilesFor(deps(), entity, entityId)

/** Liga un archivo subido (y todavía suelto) de `ownerId` a una entidad. null si no es suyo o ya está ligado a otra. */
export const attachFile = (input: {
  fileId: string
  ownerId: string
  entity: string
  entityId: string
  visibility?: Visibility
}): Promise<StorageFile | null> => files.attachFile(deps(), input)

/** ¿Puede la persona con sesión abrir (`read`) o borrar (`delete`) el archivo? Misma regla que la ruta. */
export async function canAccessFile(
  id: string,
  action: "read" | "delete"
): Promise<boolean> {
  const file = await getFile(id)
  if (!file) return false
  const viewer = await currentViewer()
  return action === "read" ? canRead(file, viewer) : canDelete(file, viewer)
}

export { fileUrl }
export * from "./types"
