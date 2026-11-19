# forms — Formularios y encuestas

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Formularios y encuestas **definidos como datos**: un título y una lista de campos tipados,
validados con Zod. Cada formulario tiene una página pública (`/f/[slug]`) donde cualquiera
responde, y una pantalla de resultados para el equipo (`/forms/[id]`) con el agregado por
pregunta y las respuestas recientes. Estados: `draft` (invisible al público), `open`
(recibe respuestas), `closed` (la página dice que ya no recibe).

Tipos de campo: `text`, `textarea`, `number`, `single` (opción única), `multiple`, `scale`
(escala entera `from`..`to`), `date`, `email`, `consent` (casilla de consentimiento).
Cada campo: `id` (`[a-z][a-z0-9_]*`), `label` y `help` (texto o `{ es, en }`), `required`, y lo
propio del tipo (`maxLength`, `min`/`max`, `integer`, `options`, `maxChoices`, `lowLabel`/`highLabel`).

## Qué expone
- **Rutas:**
  - `/forms` (con sesión, `form:read`): lista y, con `form:write`, crear formulario.
  - `/forms/[id]` (con sesión, `form:read`): resultados; con `form:write`, publicar/cerrar/reabrir y eliminar.
  - `/f/[slug]` (**pública**, grupo `marketing`): responder. Borrador o slug inexistente → 404.
- **Tablas** (migración `0115_forms_init`):
  - `forms_forms`: `id`, `slug` único, `title` (copia en español para listar), `status`,
    `one_per_person`, `definition` jsonb (validada), `created_by` (id de usuario **sin llave foránea**), fechas.
  - `forms_responses`: `form_id` → `forms_forms` (cascade), `answers` jsonb (id de campo → valor),
    `respondent_key` (`u:<userId>` solo si el formulario pide una respuesta por persona), `locale`, `created_at`.
    Índice único parcial `(form_id, respondent_key)`: lo que hace cumplir «una por persona».
- **Permisos:** recurso `form` con `read` y `write`. owner y admin reciben ambos; member solo `read`
  (los resultados pueden tener datos personales). Se comprueban con `auth.api.hasPermission`
  (`server/authz.ts`, con un cast acotado hasta que `modules:sync` registre el recurso). Responder un
  formulario público no pide ningún permiso.
- **Navegación:** «Formularios» → `/forms`.
- **Textos:** `messages.ts`, espacio `forms` en `es` y `en`. Los textos de cada formulario (título,
  preguntas, opciones) NO están ahí: son datos de su definición. `seed.*` y `starter.*` son los textos de
  los formularios de ejemplo.
- **Entidades que cubre (`covers`):** formulario / form, encuesta / survey, respuesta / response.

## Cómo se define un formulario
```ts
import { createForm } from "@/modules/forms/contracts"

await createForm({
  slug: "satisfaccion",                 // /f/satisfaccion
  status: "open",                       // por defecto "draft"
  onePerPerson: false,
  definition: {
    title: { es: "Satisfacción", en: "Satisfaction" },
    fields: [
      { id: "rating", type: "scale", label: { es: "¿Qué tal?", en: "How was it?" }, required: true, from: 1, to: 5 },
      { id: "channel", type: "single", label: "Canal", options: [{ value: "web", label: "Web" }, { value: "wsp", label: "WhatsApp" }] },
      { id: "ok", type: "consent", label: "Acepto que me contacten", required: true },
    ],
  },
})
```
En la pantalla `/forms` se crea pegando la misma definición como JSON (parte de un ejemplo); los
problemas de la definición se listan campo por campo.

## `contracts/` (lo único importable por otro módulo)
- `createForm({ slug, definition, onePerPerson?, status?, createdBy? })` — servidor; valida y guarda.
  **No comprueba permisos**: quien lo llama decide. Falla con `FormError` (`invalid_input`,
  `invalid_definition`, `slug_taken`).
- Puro: `defineForm`, `formDefinitionSchema`, `fieldSchema`, `slugSchema`, `validateAnswers(def, raw)`
  (→ `{ ok, answers } | { ok: false, errors }`), `answerText`, `summarize(def, filas)`, `resolveText`,
  `isIsoDate` y los tipos.
- `FormError` / `FORM_ERROR_CODES`: `unauthenticated`, `forbidden`, `invalid_input`,
  `invalid_definition`, `not_found`, `slug_taken`, `closed`, `login_required`, `already_responded`, `rate_limited`.

## Garantías (y dónde viven)
- **Validación del servidor, siempre:** la acción pública vuelve a validar contra la definición guardada
  (`contracts/answers.ts`); solo se leen campos de la definición, el resto se descarta. Errores por campo
  con código (`required`, `invalid`, `too_long`, `too_small`, `too_big`, `not_option`, `too_many`).
- **Honeypot:** el campo señuelo `website` (fuera de vista y del orden de tabulación). Si trae algo, la
  respuesta se descarta **sin guardar** y se contesta «ok» igual que a una persona (`server/submission.ts`).
- **Límite de tasa:** `consume()` de `server/rate-limit.ts` del template (Postgres, ventana deslizante):
  10 envíos por minuto por IP y formulario. Se aplica antes de validar o escribir.
- **Una respuesta por persona:** con `one_per_person` hay que iniciar sesión (la página pública manda a
  `/login?next=/f/slug`); la persona sale **de la sesión**, nunca del input; el índice único parcial
  rechaza la segunda (`already_responded`).
- **Admin:** las tres acciones (`createFormAction`, `setStatusAction`, `deleteFormAction`) llaman a
  `actionSession(..., "write")` antes de leer la entrada; las páginas exigen `form:read`.
- Un borrador no es visible ni responsable desde el público (404 / `not_found`).

## Variables de entorno
Ninguna. Sin dependencias npm nuevas (zod, react-hook-form no se usa: el formulario público envía a mano
para no perder lo escrito si hay un error).

## Datos de ejemplo
`seed.ts` guarda dos formularios abiertos (`satisfaccion-demo`, `taller-demo`) y 6 respuestas inventadas
para el primero (ids fijos, `on conflict do nothing`: idempotente, nunca pisa lo que se editó).

## Instalar
1. Copiar la carpeta a `modules/forms/`.
2. `pnpm modules:sync` (registros, permisos, textos y los shims de `/forms`, `/forms/[id]` y `/f/[slug]`).
3. `pnpm db:migrate` (aplica `0115_forms_init` y corre el seed).
4. Crear formularios desde `/forms` o con `createForm(...)`.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove forms`; respaldar
(`pg_dump -t 'forms_*'`) si las respuestas importan; revertir `0115_forms_init` (borra las dos tablas con
sus respuestas) **antes** de borrar la carpeta; borrar `modules/forms/` y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- **No hay editor visual** ni edición de un formulario ya creado: se define con JSON y, para cambiarlo,
  se crea otro (o se cierra y se elimina). Cambiar la definición con respuestas guardadas no está soportado
  (el resumen ignora lo que ya no calza, pero no hay migración de respuestas).
- Sin exportación a CSV, sin lógica condicional (mostrar pregunta si…), sin subida de archivos, sin
  páginas/secciones, sin plazo de cierre automático ni límite de respuestas total.
- Los resultados agregan las 5000 respuestas más recientes y la tabla muestra las 50 últimas y las 6
  primeras preguntas; los textos libres, las últimas 10 por pregunta.
- «Una por persona» exige sesión: no hay identificación anónima (cookie, IP, correo). Un formulario sin esa
  opción admite varias respuestas de la misma persona (el límite de tasa frena solo el abuso).
- El límite de tasa se cuenta por IP (cabecera `x-forwarded-for`); varias personas tras una misma IP
  comparten el cupo de 10 por minuto. Si la base está caída, enviar falla (igual que el login).
- Los textos de la definición tienen tope de 300 caracteres; `title` se guarda también en español en la
  columna `title` para listar.
- Sin avisos al recibir una respuesta (no depende de `notifications`).

## Pruebas
`tests/forms.test.ts` (`node:test`): esquema de la definición (rechazos), validación de los nueve tipos,
normalización, resumen/agregado, reglas de envío (honeypot, cerrado, una por persona), ejemplos, paridad
`es`/`en`, permisos, manifiesto y, leyendo el código, las guardas de las acciones. Corrido: 14/14
transpilado con `tsc` + `node --test`. **Sin probar contra base**: la migración, las consultas, el índice
único, el límite de tasa y la concurrencia no se ejecutaron en ninguna base; las páginas y los componentes
no se renderizaron ni se probaron en un navegador (ni accesibilidad con teclado/lector de pantalla).

## Qué NO toca
Ningún archivo ancla ni zona protegida. De otros módulos importa solo `@/modules/i18n/contracts*`;
del template, `@/server/{auth,session,rate-limit,db/pool}` y `components/ui/*`.
