# settings — Ajustes de la app

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Guarda **ajustes de la app en clave-valor**, cada uno con su esquema Zod y su valor por defecto,
y trae la pantalla `/admin/settings` para verlos y cambiarlos sin tocar el código. Un ajuste se
declara con `defineSetting` (en cualquier módulo o en la app) y se lee con `getSetting`, tipado.
Solo las claves que alguien cambió tienen fila: sin fila, vale el valor por defecto del código.

**No guardes secretos aquí** (claves de API, tokens, contraseñas): los valores son jsonb en
claro y se muestran en la pantalla. Eso va en variables de entorno. Como red de seguridad,
`defineSetting` rechaza claves que parezcan secretos (`secret`, `passw…`, `token`, `api_key`,
`private_key`, `credential`) con `SettingError("secret_key")`; es una heurística, no una garantía.

## Qué expone
- **Ruta:** `/admin/settings` (sesión + onboarding + permiso `setting:read`). Agrupa por prefijo de
  la clave (`app.name` → grupo `app`), muestra si el valor es guardado, por defecto o inválido, quién
  y cuándo lo cambió, y permite guardar o volver al valor por defecto con `setting:write`.
  `setting:read` es además `adminAccess`: un rol propio con ese permiso pasa la puerta de
  `app/(app)/admin/layout.tsx` y llega sin ser admin.
- **Tabla** (migración `0116_settings_init`): `settings` — `key` (pk, `[a-z][a-z0-9_.-]{0,99}`),
  `value` jsonb, `updated_by` (id de usuario, **sin llave foránea**), `updated_at`.
- **Permisos:** recurso `setting` con `read` y `write`. owner y admin reciben ambos; member ninguno.
  Se comprueban con `auth.api.hasPermission` (roles estáticos y dinámicos).
- **Navegación:** «Ajustes de la app» → `/admin/settings` (`area: "admin"`, visible con `setting:read`).
- **Textos:** `messages.ts`, espacio `settings` en `es` y `en`. La etiqueta y descripción de cada
  ajuste NO están ahí: son datos de su definición (`string` o `{ es, en }`).
- **Entidades que cubre (`covers`):** ajuste / setting, configuración / configuration, preferencia
  de la app / app preference.
- **Ajustes de fábrica** (`definitions.ts`): `app.name`, `app.support_email`, `app.default_page_size`.
  Son ejemplos: nada en el template los lee todavía.

## `contracts/` (lo único importable por otro módulo)
```ts
import { defineSetting, getSetting, setSetting, resetSetting, SettingError } from "@/modules/settings/contracts"
import { z } from "zod"

export const SUPPORT_EMAIL = defineSetting({
  key: "support.email",                         // [a-z][a-z0-9_.-], máx. 100
  schema: z.email(),                            // valida lo que se guarda y lo que se lee
  default: "soporte@ejemplo.cl",                // debe pasar su propio esquema
  label: { es: "Correo de soporte", en: "Support email" },   // string o { es, en }
  description?: { es: "…", en: "…" },
  group?: "support",                            // por defecto, el prefijo de la clave
  options?: ["a", "b"],                         // solo string: se edita con un select
})

const email = await getSetting(SUPPORT_EMAIL)   // string (tipado) — también getSetting("support.email")
await setSetting(SUPPORT_EMAIL, "ayuda@ejemplo.cl")  // valida; SettingError("invalid_value") si no pasa
await resetSetting(SUPPORT_EMAIL)               // borra la fila: vuelve al valor por defecto
```
Errores (`SettingError.code`): `unauthenticated`, `forbidden`, `invalid_key`, `invalid_definition`,
`secret_key`, `unknown_setting`, `invalid_value`.

- `getSetting`, `setSetting` y `resetSetting` son de servidor y **no comprueban permisos**: quien
  los llama decide quién puede cambiar qué. `setSetting` anota `updated_by` si hay sesión (y `null`
  si se llama sin request, p. ej. desde un job).
- Un valor guardado que **ya no pasa el esquema** (porque el esquema cambió) se lee como el valor
  por defecto y la pantalla lo marca como inválido. Se guarda el valor *ya validado* (con sus
  transformaciones, p. ej. `trim`), así que el esquema debe aceptar de vuelta su propia salida.
- El editor de la pantalla se infiere del valor por defecto: boolean → Sí/No, number → número,
  string → texto (o select con `options`), cualquier otro → JSON en un área de texto.
- También exporta `defineSetting`, `findDefinition`, `listDefinitions`, `localize` y los tipos.

## Cómo aparece un ajuste en la pantalla (importante)
El registro de definiciones vive **en memoria del proceso**: un ajuste sale en `/admin/settings`
(y se puede guardar desde ahí) solo si su `defineSetting` ya se ejecutó en ese proceso. La página y
las acciones importan `modules/settings/definitions.ts`, así que **declara los ajustes de la app
ahí** (o importa desde ahí los archivos que los declaran). Un ajuste definido solo en el archivo
de otro módulo que la pantalla no carga no aparece; si tiene fila guardada se lista en «Valores sin
definición» (solo lectura). `getSetting(def)` funciona siempre, aparezca o no en la pantalla.

## Garantías (y dónde viven)
- Toda acción de servidor (`saveSettingAction`, `resetSettingAction`) comprueba sesión +
  `setting:write` **antes** de buscar la definición o tocar datos, valida con el esquema del ajuste
  y solo entonces escribe (`server/actions.ts`, comprobado leyendo el código en las pruebas).
- Una clave que no esté definida no se puede guardar desde la pantalla.
- Escritura con Kysely (`onConflict … doUpdateSet`), sin SQL concatenado; la clave tiene un `check`
  de formato en la base.

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` guarda `app.support_email = "soporte@ejemplo.cl"` y `app.default_page_size = 25` si esas
claves no tienen fila (idempotente; nunca pisa un valor cambiado). `app.name` queda con su valor
por defecto.

## Instalar
1. Copiar la carpeta a `modules/settings/`.
2. `pnpm modules:sync` (registros y shim de `/admin/settings`).
3. `pnpm db:migrate` (aplica `0116_settings_init` y corre el seed).
4. Declarar los ajustes de la app en `modules/settings/definitions.ts`.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove settings`,
revertir `0116_settings_init` (borra la tabla y sus valores; respaldar antes si importan) **antes**
de borrar la carpeta, y `pnpm modules:sync`. Si otro código llama a `getSetting`, se quita antes.

## Límites conocidos (v0.1)
- Registro en memoria (ver arriba): no hay descubrimiento automático de ajustes de otros módulos.
- Sin historial de cambios (solo quién y cuándo fue el último), sin ajustes por usuario ni por
  organización, sin caché: cada `getSetting` es una consulta.
- Sin cifrado ni enmascarado de valores; por eso no son para secretos.
- La heurística de claves secretas solo mira el nombre de la clave, no el contenido.
- El editor JSON valida con el esquema, pero no ofrece formulario por campos.
- Editar dos personas el mismo ajuste a la vez: gana la última escritura.

## Pruebas
`tests/settings.test.ts` (`node:test`, lógica pura): definiciones y registro, claves inválidas y
de apariencia secreta, validación y transformaciones, resolución de valor guardado/por defecto/
inválido, lectura de formularios, `localize`, paridad `es`/`en`, permisos, manifiesto y, leyendo el
código, la guarda de las acciones. **Sin probar contra base**: la migración, `server/store.ts`,
`queries.ts` y el seed no se ejecutaron en ninguna base; las páginas y el formulario no se
renderizaron (ni se probó el permiso real con Better Auth).

## Qué NO toca
Ningún archivo ancla ni zona protegida. No importa otros módulos salvo `@/modules/i18n/contracts*`.
