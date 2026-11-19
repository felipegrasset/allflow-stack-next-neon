# courses — Cursos, lecciones, inscripción y progreso

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Cursos con lecciones en markdown seguro. El equipo (`course:write`) crea el curso en **borrador**, arma sus
lecciones, lo **publica** e **inscribe** a las personas por correo. Cada persona ve **solo los cursos en que
está inscrita**, abre sus lecciones y las marca como vistas; su avance es suyo. Una lección puede ser una
**clase en vivo**: lleva un enlace de videollamada (https) y una fecha opcional. Cada lección puede tener
material adjunto (PDF o imagen) guardado con `storage`.

## Qué expone
- **Rutas:**
  - `/courses`: mis cursos (inscrita/o y publicados) con barra de avance. Pide `course:read` (o `write`).
  - `/courses/[id]`: el curso y su lista de lecciones con «vista / pendiente».
  - `/courses/[id]/[lesson]`: la lección (texto, clase en vivo, material, anterior/siguiente, «marcar como vista»).
  - `/admin/courses`: el editor (`course:write`): lista, formulario de curso, publicar/volver a borrador, eliminar,
    lecciones (`?id=…&lesson=…` / `&newLesson=1`), archivos y inscripciones.
  - Todas con sesión y onboarding.
- **Tablas** (migración `0123_courses_init`): `courses_courses` (`status` draft|published, `description` markdown),
  `courses_lessons` (`position`, `body` markdown, `meeting_url` https, `starts_at`), `courses_enrollments`
  (PK `course_id,user_id`) y `courses_progress` (PK `lesson_id,user_id`). Lecciones, inscripciones y avance
  se borran en cascada con el curso. `created_by` y `user_id` son ids de `"user"` **sin llave foránea**.
- **Permisos:** recurso `course`: `read`, `write`. owner y admin reciben ambos; member, `read`. `course:write` es
  además `adminAccess` (abre la puerta de `/admin`).
- **Navegación:** «Cursos» → `/courses` (menú principal) y «Gestión de cursos» → `/admin/courses`
  (`area: "admin"`, con `course:write`).
- **Textos:** `messages.ts`, espacio `courses`, en `es` y `en`.
- **Entidades que cubre (`covers`):** curso, course, lección, lesson, clase, class, inscripción, enrollment, matrícula.

## Reglas con prueba
- **Solo ves lo tuyo:** curso y lección se ven si `canViewCourse`: gestor, o inscrita/o **y** curso publicado.
  Un curso o lección ajenos (o de otro curso, o inexistentes, o en borrador) responden **404**, no 403.
- **Borrador:** no lo ve ningún estudiante (aunque estuviera inscrito) y **no admite inscripciones**
  (`canEnroll`; la acción y `enrollUser` lo vuelven a comprobar). Quien gestiona sí lo ve (vista previa).
- **Progreso por persona e idempotente:** `markSeenAction` aplica `planMarkSeen` y hace `insert … on conflict
  (lesson_id, user_id) do nothing`: pulsar dos veces (o dos a la vez) deja una fila y responde ok. Solo quien
  está inscrita/o en un curso publicado registra avance; un gestor sin inscripción solo mira.
- **Enlace de clase:** `parseMeetingUrl`: vacío = sin enlace; si no, URL absoluta `https:` con host con punto,
  sin credenciales ni espacios. `http:`, `javascript:`, `data:` y relativos se rechazan (formulario, acción y
  `check` de la base). Se abre con `rel="noopener noreferrer"`.
- **Markdown seguro:** `contracts/markdown.ts` (mismo criterio que `help-center`, copiado, no importado): sin HTML,
  enlaces solo http(s)/mailto/relativos, sin imágenes.
- Toda acción de servidor comprueba sesión y permiso antes de tocar datos, valida con Zod y usa solo Kysely.

## `contracts/` (lo único importable por otro módulo)
```ts
import { enrollUser, canViewCourse, progressSummary } from "@/modules/courses/contracts"

// Inscribe a una persona en un curso publicado (p. ej. tras una compra). Idempotente.
// NO comprueba sesión ni permiso: quien llama decide quién puede inscribir.
const res = await enrollUser({ courseId, userId })   // { ok: true, created } | { ok: false, reason: "not_found" | "draft" | "no_user" }
```
También, puros: `canViewCourse`, `canEnroll`, `planMarkSeen`, `applySeen`, `progressSummary`, `nextLessonId`,
`parseMeetingUrl`, `courseSchemas`, `COURSE_STATUSES` y los tipos.

## Material adjunto (dependsOn `storage`)
Archivos con `entity = "course_lesson"` y `entityId = <id de la lección>`, visibilidad `members`. Se suben con
el `FileInput` de `storage`; al guardar la lección se ligan con `attachFile`. Se listan con `listFilesFor`. Al
borrar una lección o un curso se borran sus archivos (mejor esfuerzo). Solo se importa `storage/contracts`.

## Variables de entorno
Ninguna propia (`storage` necesita las suyas para subir archivos).

## Datos de ejemplo
`seed.ts`: un curso publicado de tres lecciones (una es clase en vivo con enlace de ejemplo), un curso en borrador,
la inscripción del primer usuario y su primera lección vista. Ids fijos, idempotente; sin usuarios no hace nada.

## Instalar
1. Copiar la carpeta a `modules/courses/` (requiere `modules/storage/`).
2. `pnpm modules:sync` (registros, permisos y shims de las cuatro rutas).
3. `pnpm db:migrate` (aplica `0123_courses_init` y corre el seed).

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `can-remove courses`; revertir `0123_courses_init` (borra las cuatro tablas
con inscripciones y avance) **antes** de borrar la carpeta; los archivos de `storage` con `entity = course_lesson`
quedan sueltos (bórralos desde `storage` si ya no sirven); luego borrar la carpeta y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- Las personas se inscriben desde el editor (por correo, deben tener cuenta) o con `enrollUser`; no hay autoinscripción,
  catálogo abierto, cupos, pagos ni certificados. Sin evaluaciones ni foro.
- El avance solo marca «vista»; no se puede desmarcar. Una lección sin progreso no bloquea a la siguiente.
- Las lecciones se ordenan por el número `position`; no hay arrastrar y soltar.
- La fecha de la clase (`datetime-local`) se interpreta y se muestra en la zona horaria del servidor.
- Los archivos tienen visibilidad `members`: quien tenga el enlace y `file:read` puede abrirlos aunque no esté inscrita/o
  (la lección en sí sí está protegida). Si importa, usar otra visibilidad cuando `storage` ofrezca una por entidad.
- Los listados muestran hasta 200 cursos / inscripciones, sin paginación.
- No avisa por notificaciones (el manifiesto solo depende de `storage`).
- Un solo ambiente y una sola organización (la de la app).

## Pruebas
`tests/courses.test.ts` (`node:test`, desde la raíz del repo): visibilidad (404), borrador, inscripción, progreso
idempotente y por persona, enlace https, esquemas Zod, markdown seguro, paridad `es`/`en`, permisos, manifiesto,
migración y, leyendo el código, guardas de las acciones, `on conflict do nothing` y que las páginas respondan 404.
Ejecutadas transpilando con TypeScript y `node --test`. **Sin probar contra base:** migración, consultas, seed, la
carga real de archivos y el renderizado de las páginas.

## Qué NO toca
Ningún archivo ancla ni zona protegida. De otros módulos importa solo `@/modules/storage/contracts` (y
`storage/contracts/file-input`) y `@/modules/i18n/contracts*`.
