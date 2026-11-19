# jobs — Tareas programadas

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Ejecuta tareas programadas y deja registro de cada corrida. Una tarea se declara con `defineJob(nombre, handler)`.
Un handler HTTP `GET|POST /api/jobs/<nombre>`, autenticado con `CRON_SECRET`, la ejecuta (Vercel Cron lo llama por
GET). Cada corrida es una fila de `jobs_runs` (estado, duración, error, resultado). **Un candado en la base** impide
que dos corridas de la misma tarea se solapen: la segunda responde «skipped» (HTTP 409) en vez de esperar.
`/admin/jobs` lista las tareas con su última corrida, el historial y un botón «Correr ahora».

## Qué expone
- **Rutas:** `GET|POST /api/jobs/[name]` (público, se autentica solo) y `/admin/jobs` (sesión + permiso `job:read`; si no, 403).
- **Tabla** (migración `0110_jobs_init`): `jobs_runs`: `id`, `name`, `kind` (`cron`|`manual`), `status`
  (`running`|`succeeded`|`failed`), `triggered_by?` (id de usuario, sin llave foránea), `started_at`, `finished_at?`,
  `duration_ms?`, `lock_expires_at`, `error?` (≤2000 caracteres), `result?` (jsonb, ≤8 KB).
- **Permisos:** recurso `job`: `read` (ver la pantalla y el historial) y `run` (correr a mano). owner y admin los reciben;
  member nada. `job:read` es además `adminAccess`. El handler de cron no usa permisos: lo autentica `CRON_SECRET`.
- **Navegación:** «Tareas programadas» → `/admin/jobs` (`area: "admin"`, con `job:read`). Sin cabecera.
- **Textos:** `messages.ts`, espacio `jobs` en `es` y `en`.
- **Entidades que cubre (`covers`):** tarea programada / scheduled task, cron, job, trabajo programado / scheduled job.
- **Tarea incluida:** `jobs-prune` borra del historial las corridas terminadas hace más de 30 días (nunca una en curso).

## Variables de entorno
- `CRON_SECRET` (obligatoria para el cron): mínimo 16 caracteres. Sin ella, o más corta, el handler responde 503 y no
  corre nada (falla cerrado). Vercel la manda sola como `Authorization: Bearer <CRON_SECRET>` si la defines en el proyecto.

## Cómo se usa
```ts
// lib/jobs/send-reminders.ts   (fuera de modules/, o un archivo de jobs que exponga otro módulo)
import { defineJob } from "@/modules/jobs/contracts"

defineJob("send-reminders", async ({ signal, runId }) => {
  // trabajo; si `signal.aborted`, parar. Lo que devuelva se guarda (truncado) como resultado.
  return { sent: 12 }
}, { description: "Recordatorios diarios", schedule: "0 12 * * *", timeoutMs: 120_000 })
```
1. **Registrar:** una tarea solo existe cuando su archivo se importa. Agrega una línea a `modules/jobs/register.ts`
   (es el único archivo del módulo pensado para editarse a mano): `import "@/lib/jobs/send-reminders"`.
   Lo importan el handler y `/admin/jobs`.
2. **Programar:** el cron lo ejecuta Vercel y se declara en `vercel.json`, **que está fuera de `modules/` y este módulo
   no lo toca**. La app debe agregar un bloque `crons` (una entrada por tarea; `path` = `/api/jobs/<nombre>`):
```json
{
  "crons": [
    { "path": "/api/jobs/jobs-prune", "schedule": "0 4 * * *" },
    { "path": "/api/jobs/send-reminders", "schedule": "0 12 * * *" }
  ]
}
```
   El `schedule` de `defineJob` es solo texto para la pantalla: no programa nada. Los horarios de Vercel Cron son UTC.
3. **Probar a mano:** `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/jobs/send-reminders`.

Respuestas del handler: 200 `{status:"succeeded", runId, durationMs}` · 401 secreto incorrecto o ausente · 404 tarea
desconocida · 409 `{status:"skipped"}` (ya hay una corrida en curso) · 500 `{status:"failed", runId}` (el detalle del
error queda en el historial, no en la respuesta) · 503 `CRON_SECRET` sin configurar. La autenticación va **antes** que
la búsqueda del nombre: sin secreto válido no se sabe qué tareas existen. El secreto se compara en tiempo constante
(SHA-256 de ambos lados + `timingSafeEqual`).

## `contracts/` (lo único importable por otro módulo)
`defineJob`, `getJob`, `listJobs`, `JOB_NAME`, `DEFAULT_TIMEOUT_MS`, `MAX_TIMEOUT_MS` y los tipos `JobContext`,
`JobHandler`, `JobOptions`, `JobDefinition`, `RunKind`. Sin imports en tiempo de ejecución. El nombre es
`[a-z0-9][a-z0-9_.:-]{0,79}`; `defineJob` lanza si el nombre o el `timeoutMs` (1 s a 15 min, 5 min por defecto) no
son válidos, y redefinir un nombre reemplaza la tarea (así funcionan las recargas en desarrollo).

## Cómo funciona el candado
Índice único parcial `jobs_runs_one_running (name) where status = 'running'`: como mucho una fila «en curso» por
tarea, así que el `insert` de una segunda corrida falla y se responde «skipped». Al empezar, una corrida cierra como
fallida las filas «en curso» de esa tarea cuyo `lock_expires_at` ya venció (una corrida que se cayó sin terminar),
y recién entonces intenta insertar. El candado dura `timeoutMs` + 30 s. Si el handler pasa el `timeoutMs`, la corrida
se marca fallida, se aborta `signal` y el candado se libera; el handler no se puede matar a la fuerza, así que debe
respetar `signal`.

## Datos de ejemplo
`seed.ts` inserta 4 corridas inventadas (`seed-job-0001…`, idempotente; ninguna «en curso»). Los nombres
`send-reminders` no existen como tarea real: la pantalla las muestra solo en el historial.

## Instalar
1. Copiar la carpeta a `modules/jobs/`.
2. `pnpm modules:sync` (registros y shims de `/admin/jobs` y `/api/jobs/[name]`).
3. Definir `CRON_SECRET` (en Vercel y en `.env.local`).
4. `pnpm db:migrate` (aplica `0110_jobs_init` y corre el seed).
5. Registrar las tareas en `modules/jobs/register.ts` y agregar el bloque `crons` a `vercel.json`.

## Desinstalar
Sigue «Desinstalar» de `modules/README.md`: `can-remove jobs`, respaldar (`pg_dump -t jobs_runs`), revertir
`0110_jobs_init`, borrar la carpeta y `pnpm modules:sync`. Después quita las entradas `crons` de `vercel.json`
y los imports de `defineJob` de la app (apuntan a `@/modules/jobs/contracts`).

## Límites conocidos (v0.1)
- Sin reintentos automáticos, sin cola, sin ejecución en paralelo de la misma tarea ni parámetros por corrida.
- El horario NO lo gestiona el módulo: depende de `vercel.json` (fuera de `modules/`) y de que la app lo mantenga
  alineado con las tareas registradas. Una tarea sin entrada en `crons` solo corre a mano.
- Vercel Cron puede entregar un aviso dos veces o con retraso; el candado evita el solape, no la repetición
  consecutiva: las tareas deben ser idempotentes.
- Una tarea solo existe si su archivo está importado en `register.ts`; el módulo no descubre archivos solo.
- El registro vive en memoria de cada instancia (en `globalThis`): `/admin/jobs` muestra las tareas registradas, no
  las que corrieron alguna vez y ya no existen (esas solo aparecen en el historial).
- «Correr ahora» ejecuta dentro de la acción de servidor: está limitado por la duración máxima de la función de Vercel.
- Un handler colgado no se puede detener; solo se marca fallido y se libera el candado.
- No avisa por fallo (no usa `notifications`); no deja huella en `audit-log`.
- Requiere un template con el contrato `adminAccess`.

## Pruebas
`tests/jobs.test.ts` (`node:test`, 15 pruebas): registro, corridas con un almacén en memoria que imita el índice
único (éxito, solape → skipped, fallo síncrono y asíncrono, timeout con `signal`, escritura de cierre fallida),
serialización y tope de resultados, secreto (tiempo constante, Bearer, falla cerrado), handler HTTP (503/401/404/409/
500/200, sin filtrar nombres ni texto de error), duración, paridad `es`/`en`, permisos y, leyendo el código, guardas
de página y acción, el handler y el índice del candado. Corridas: transpilado con `tsc` + `node --test`.
**Sin probar contra base:** la migración, el índice único con concurrencia real, `acquire`/`finish`/`pruneRuns`,
las consultas (`distinctOn`), la página, el botón ni el handler real con Vercel Cron.

## Qué NO toca
Ningún ancla, zona protegida ni `vercel.json`. De otros módulos no importa nada.
