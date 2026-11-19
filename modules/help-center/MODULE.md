# help-center — Centro de ayuda

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Artículos de ayuda con categorías, búsqueda y «¿te sirvió?». Las personas visitantes leen y
buscan en `/ayuda` (público); el equipo escribe, publica y mide en `/admin/help`.
El contenido es **texto plano o markdown mínimo**, mostrado sin HTML crudo.

## Qué expone
- **Rutas:**
  - `/ayuda` (público, grupo `marketing`): buscador (`?q=`), categorías (`?category=`) y lista
    de artículos publicados, agrupada por categoría. Muestra los del idioma activo; si no hay
    ninguno en ese idioma, muestra todos y avisa.
  - `/ayuda/[slug]` (público): un artículo publicado + formulario «¿te sirvió?». Quien tiene
    `article:read` puede ver además los **borradores** (vista previa, con aviso); el resto, 404.
  - `/admin/help` (con sesión): lista de artículos con sus valoraciones y comentarios; con
    `article:write`, formulario para crear (`?new=1`) o editar (`?id=<id>`), publicar/pasar a
    borrador y borrar (con confirmación en dos pasos).
- **Tablas** (migración `0117_help_center_init`):
  - `help_center_articles`: `id`, `slug` único, `title`, `summary?`, `body`, `category?`
    (texto libre: el mismo nombre agrupa), `locale` (`es`/`en`), `sort_order`, `published`,
    `published_at`, `author_id` (**sin llave foránea**: el artículo sobrevive a su autor), fechas.
    `check` en la base para slug, largos y locale.
  - `help_center_feedback`: `article_id` (cascade), `voter_hash`, `helpful`, `comment?`, fechas;
    **único (article_id, voter_hash)**: una valoración por visitante y artículo, votar de nuevo la reemplaza.
- **Permisos:** recurso `article` con `read` y `write`. owner y admin: ambos; member: solo `read`.
  Se comprueban con `auth.api.hasPermission` (`server/guard.ts`). Lo público no pide permiso.
  `article:write` es además `adminAccess` (abre la puerta de `/admin`); `article:read` solo no: un
  member con solo `read` no pasa el layout de `/admin`.
- **Navegación:** «Centro de ayuda» → `/admin/help` (`area: "admin"`, visible con `article:write`). El enlace público `/ayuda` lo
  pone la app donde quiera (pie, menú).
- **Textos:** `messages.ts`, espacio `help-center` en `es` y `en`. Los artículos NO están ahí:
  son contenido (cada uno con su `locale`).
- **Entidades que cubre (`covers`):** artículo de ayuda / help article, categoría de ayuda /
  help category, pregunta frecuente / FAQ, centro de ayuda / help center. Deliberadamente NO
  cubre «artículo» ni «categoría» a secas (serían de un blog o un catálogo).

## Markdown soportado (`contracts/markdown.ts`)
`#`/`##` título, `###` subtítulo, párrafos, listas con `-`/`*` o `1.`, `>` cita, bloque ```` ``` ````,
y en línea `**negrita**`, `*cursiva*`, `` `código` `` y `[texto](url)`. Sin imágenes ni tablas.
**Seguridad:** el parser produce un árbol de datos y la UI lo pinta con elementos de React; no se
usa ninguna API de HTML crudo, así que `<script>` o `<img onerror>` se ven como texto. Los enlaces
solo pueden ser `http(s)://`, `mailto:` o rutas del sitio (`/…`); `javascript:`, `data:`, `//host`
y similares pierden el enlace y dejan el texto. Los externos llevan `rel="noopener noreferrer nofollow"`.

## `contracts/` (lo único importable por otro módulo)
```ts
import { getPublishedArticle, searchPublishedArticles, listPublishedArticles, helpArticleHref } from "@/modules/help-center/contracts"

const hits = await searchPublishedArticles("contraseña", { locale: "es", limit: 5 }) // ArticleSummary[]
const a = await getPublishedArticle("como-cambiar-tu-contrasena")                   // Article | null
<Link href={helpArticleHref("como-cambiar-tu-contrasena")}>…</Link>                  // "/ayuda/<slug>"
```
Las funciones de lectura son de servidor, devuelven **solo publicados** y no comprueban permisos
(el contenido es público). También exporta lo puro: `parseBody`, `parseInline`, `safeHref`,
`toPlainText`, `slugify`, `articleSchemas`, `rankArticles`, `groupByCategory` y los tipos.
No hay función para escribir desde otro módulo en v0.1.

## «¿Te sirvió?»
Acción pública (`server/feedback-action.ts`): valida con Zod, solo acepta el slug de un artículo
**publicado**, guarda `sha256` de una cookie anónima (`help_center_voter`, httpOnly, 1 año) —nunca el
valor de la cookie ni un id de usuario— y un comentario opcional de hasta 500 caracteres. El
editor ve conteos y comentarios, nunca el hash. Tiene límite de tasa por IP (10 por minuto, con
`consume()` de `@/server/rate-limit`, como `forms`): al pasarse responde un mensaje de «espera un minuto».

## Variables de entorno y dependencias
Ninguna. No necesita paquetes nuevos.

## Datos de ejemplo
`seed.ts`: 7 artículos inventados (5 en español —uno en borrador— y 2 en inglés) y 4 valoraciones.
Idempotente (ids y slugs fijos, `on conflict do nothing`; no pisa lo que el equipo editó).

## Instalar
1. Copiar la carpeta a `modules/help-center/`.
2. `pnpm modules:sync` (registros, permisos y los shims de `/ayuda`, `/ayuda/[slug]`, `/admin/help`).
3. `pnpm db:migrate` (aplica `0117_help_center_init` y corre el seed).
4. Enlazar `/ayuda` desde la app donde corresponda.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove help-center`,
revertir `0117_help_center_init` (borra artículos y valoraciones; respaldar antes con
`pg_dump -t 'help_center_*'`), borrar la carpeta y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- El límite de «¿te sirvió?» es por IP (10 por minuto): quien borra sus cookies sigue pudiendo votar
  de nuevo, solo que más despacio; no hay detección de abuso más allá de eso. Usa la tabla
  `rate_limit_hit` del template (migración 0002).
- Sin `generateMetadata`: los shims solo re-exportan la página, así que `/ayuda` no fija título ni
  descripción propios (la app puede hacerlo en su layout).
- Búsqueda con `ILIKE` sobre título, resumen y cuerpo (hasta 200 artículos por página): sin índice
  de texto completo, sin tildes insensibles ni tolerancia a errores.
- Un artículo tiene un solo idioma: las traducciones son artículos distintos con slugs distintos,
  sin vínculo entre sí.
- La categoría es texto libre (sin tabla propia, sin orden de categorías).
- Editor sin vista previa en vivo (se previsualiza abriendo el borrador en `/ayuda/<slug>`), sin
  historial de versiones ni imágenes. Cambiar el slug rompe los enlaces anteriores.
- Los nombres de categoría no se traducen: son contenido.
- Los enlaces con paréntesis dentro de la URL no se reconocen como enlace.

## Pruebas
`tests/help-center.test.ts` (`node:test`): markdown y casos de XSS, `safeHref`, slugs, esquemas,
búsqueda y orden, hash del visitante, paridad `es`/`en` (incluidos argumentos ICU), manifiesto,
permisos y, leyendo el código, que cada acción del editor comprueba sesión + `article:write` antes
de tocar datos, que la acción pública solo toca publicados y guarda hash, y que no hay HTML crudo.
Corrido: 21/21 transpilado con `tsc` + `node --test`. **Sin probar contra base ni en pantalla**: la
migración, las consultas (incluida la subconsulta de conteos y el `on conflict`), las acciones, la
cookie y las páginas no se ejecutaron ni se renderizaron; tampoco `hasPermission` real.

## Qué NO toca
Ningún ancla ni zona protegida; no importa ningún otro módulo (solo `@/modules/i18n/contracts*`).
Recuerda: `modules/_generated/**` y los shims los escribe `pnpm modules:sync`.
