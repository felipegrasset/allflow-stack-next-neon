# storage — archivos (v0.1)

Sube, guarda y sirve archivos (fotos, boletas, adjuntos) para cualquier módulo.
Los bytes van a un **proveedor** (Vercel Blob, o memoria en pruebas y
desarrollo); la tabla `storage_files` guarda los metadatos, el dueño, la
visibilidad y, si corresponde, a qué entidad de otro módulo pertenece el archivo.

## Qué trae

| Pieza | Dónde |
|---|---|
| Tabla `storage_files` (migración `0102_storage_init`) | `db/` |
| `POST /api/storage/upload` (multipart: `file`, `visibility`) | `server/upload/route.ts` |
| `GET /api/storage/[id]` (`?download=1` para descargar) | `server/file/route.ts` |
| API de servidor para otros módulos | `contracts/index.ts` |
| Componente `FileInput` (cliente) | `contracts/file-input.tsx` → `ui/file-input.tsx` |
| Permisos `file: upload, read, delete` | `permissions.ts` |
| Textos `storage.*` en `es` y `en` | `messages.ts` |

`covers`: archivo, file, adjunto, attachment. Sin página, sin navegación y sin
seed (un seed con filas cuyos bytes no existen en el proveedor solo daría 404).

## Reglas

- **Tipo real, nunca el del navegador.** El tipo sale de los primeros bytes
  (`server/sniff.ts`). Lista blanca: JPEG, PNG, WebP, GIF y PDF. SVG y HTML no
  se aceptan (servidos desde el dominio de la app podrían correr script).
- **Tamaño:** 4 MB por defecto (`DEFAULT_MAX_BYTES`). La subida pasa por una
  función de Vercel, que acepta 4,5 MB de cuerpo como máximo.
- **Visibilidad** (`private` por defecto):
  - `private`: el dueño, o un admin/owner de la organización de la app; siempre con `file:read`.
  - `members`: cualquiera con sesión y `file:read` (adjuntos de algo compartido, como un ticket).
  - `public`: cualquiera, sin sesión (fotos de producto, avatares).
- **Borrar:** el dueño o un admin/owner, con `file:delete`.
- Un archivo que la persona no puede abrir responde **404**, igual que uno que no existe.
- Roles: owner y admin tienen todo; member tiene `upload`, `read` y `delete`,
  acotados por la regla de dueño. Quitar una acción a `member` (o a un rol
  dinámico) la quita de verdad: se consulta con `auth.api.hasPermission`.
- La clave en el proveedor es `storage/<uuid>.<ext>` más un sufijo aleatorio:
  el nombre que subió la persona nunca llega a la URL.
- Público en un store `public`: la ruta redirige (302) a la URL del blob.
  Todo lo demás se transmite desde la ruta, con `X-Content-Type-Options: nosniff`
  y `Cache-Control: private, no-store`; la URL del blob de un archivo no público
  nunca sale del servidor.

## Cómo se usa desde otro módulo

El flujo normal tiene dos pasos: el navegador sube, y **tu** server action liga
el archivo a tu entidad después de comprobar **tu** permiso.

```tsx
// En el formulario (componente de cliente)
import { FileInput } from "@/modules/storage/contracts/file-input"

<FileInput name="receiptId" visibility="members" />
// Sube al elegir; deja el id del archivo en un <input type="hidden" name="receiptId">.
```

```ts
// En tu server action
import { attachFile, listFilesFor } from "@/modules/storage/contracts"

const session = await requireOnboardedUser("/tickets")
// …tu validación (Zod) y tu permiso sobre el ticket…
const file = await attachFile({
  fileId: parsed.receiptId,
  ownerId: session.user.id,   // solo liga archivos que subió esta persona
  entity: "ticket",
  entityId: ticket.id,
})
if (!file) return { ok: false }  // no existe, no es suyo o ya está ligado a otra cosa

// Al mostrar el ticket
const adjuntos = await listFilesFor("ticket", ticket.id)  // f.url → /api/storage/<id>
```

API de `@/modules/storage/contracts` (todo de servidor):

| Función | Qué hace |
|---|---|
| `saveFile({ data, name, ownerId, visibility?, entity?, entityId?, allowedTypes?, maxBytes? })` | Guarda bytes generados en el servidor. Valida tamaño y tipo real. Lanza `FileTooLargeError`, `EmptyFileError`, `UnsupportedTypeError`, `StorageNotConfiguredError` o `StorageProviderError` |
| `getFile(id)` | Metadatos (`StorageFile`) o `null` |
| `listFilesFor(entity, entityId)` | Los archivos ligados, del más antiguo al más nuevo |
| `attachFile({ fileId, ownerId, entity, entityId, visibility? })` | Liga un archivo suelto del dueño; `null` si no corresponde. Repetirlo con la misma entidad no hace nada |
| `deleteFile(id)` | Borra el objeto y luego la fila. **No comprueba permisos** |
| `canAccessFile(id, "read" \| "delete")` | La misma regla que la ruta, para la persona con sesión. Úsala antes de `deleteFile` |
| `fileUrl(id)` | `/api/storage/<id>` |

Fuera de `canAccessFile`, ninguna función comprueba sesión ni permisos: las
llama código de servidor que ya lo hizo. `entity` va en minúsculas
(`[a-z0-9_.:-]`, hasta 64); `entityId`, hasta 200 caracteres.

Tipos y constantes (`StorageFile`, `UploadedFile`, `Visibility`,
`ALLOWED_TYPES`, `DEFAULT_MAX_BYTES`, `StorageProvider`, errores) se exportan
desde el mismo `contracts` (y son puros: `contracts/types.ts`).

## Configuración

| Variable | |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Token del store de Vercel Blob. Sin él: en producción las subidas responden 503 (`not_configured`); en desarrollo se usa memoria (se pierde al reiniciar, y las filas quedan apuntando a nada: 404). |
| `STORAGE_BLOB_ACCESS` | `private` (por defecto) o `public`; **tiene que coincidir con cómo se creó el store**. Si no coincide, Vercel rechaza la subida (`upload_failed` y un error en el log). |

El proveedor de Vercel Blob está hecho con `fetch` imitando a `@vercel/blob`
2.8 (API `https://vercel.com/api/blob`, `x-api-version: 12`). El token nunca se
manda a una URL que no sea `*.blob.vercel-storage.com`.

## Límites conocidos

- **Sin subida directa del navegador al proveedor** (client uploads de Vercel):
  todo pasa por la función, de ahí el tope de ~4 MB.
- **Archivos huérfanos:** lo que se sube y nunca se liga queda en la tabla y en
  el proveedor. No hay limpieza automática (falta un cron que borre los sueltos
  de más de N horas).
- Sin reintentos ni subida por partes hacia Vercel Blob; sin miniaturas ni
  redimensionado; un archivo por `FileInput`.
- Sin texto plano, CSV, Office ni HEIC (no se reconocen por bytes de forma
  fiable). En iOS, `accept` con JPEG hace que el sistema convierta las fotos HEIC.
- Al borrar un usuario, sus archivos quedan con `owner_id` nulo: los
  `private` solo los ve un admin.
- Un archivo denegado responde 404 aunque la persona no tenga sesión (no
  redirige a /login).

## Pruebas

- `tests/storage.test.ts` — sin base: tipos por bytes, reglas de acceso,
  nombres, Vercel Blob contra un `fetch` falso, memoria, configuración, y los
  dos handlers con dependencias inyectadas. **Se ejecutó (31/31).**
- `tests/storage-db.test.ts` — contra Postgres (se salta sin `DATABASE_URL`):
  guardar, rechazo de tipo, limpieza si falla la fila, `attachFile`,
  `listFilesFor`, `deleteFile`. **Sin ejecutar todavía.**
- Sin probar: la llamada real a Vercel Blob (forma de los encabezados tomada
  del SDK), `auth.api.hasPermission` con el recurso `file` (requiere
  `modules:sync`), y `FileInput` en un navegador.

## Quitar

Seguir `modules/README.md` («Desinstalar»): revertir `0102_storage_init` (borra
la tabla; **no** borra los objetos en Vercel Blob: vaciar el store aparte si
corresponde), quitar la carpeta, `pnpm modules:sync`, quitar las dos `env`.
Antes, que ningún módulo importe `@/modules/storage/contracts`.
