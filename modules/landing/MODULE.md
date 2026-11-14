# landing — una landing como datos

Contrato en `modules/README.md`. T9 del lote MVP; plantillas por arquetipo en T10.

## Qué hace
Pinta una landing pública a partir de `landing.json`: una lista ordenada de
**9 bloques** (hero, prueba social, funciones, cómo funciona, precios, FAQ,
captura de lead, CTA final, pie) con **2 variantes** cada uno. El agente edita
contenido y orden, no CSS.

| Bloque | Variantes | Patrón de las fichas |
|---|---|---|
| `hero` | `split` (texto + maqueta de la app), `centered` (CTA doble) | el hero muestra el resultado |
| `social` | `logos`, `stats` | pegado bajo el hero, aire reducido |
| `features` | `columns`, `bento` | altura constante, una frase por módulo |
| `steps` | `numbered`, `timeline` | |
| `pricing` | `cards`, `list` | |
| `faq` | `accordion`, `columns` | `<details>`, sin JS |
| `lead` | `card`, `inline` | consentimiento, Turnstile si hay clave, atribución |
| `cta` | `band`, `split` | franja contrastada con `bg-primary` |
| `footer` | `simple`, `columns` | |

## Archivos
- `landing.json` — estructura: `{ version, locale, blocks: [{ id, type, variant, copy }] }`. Esquema Zod en `schema.ts`.
- `copy.ts` — **todos** los textos, por clave (`"copy": "hero"`), en `es` y `en` (`copySets`, tipo `CopySets`). `{app}` y `{year}` se interpolan.
- `locale.ts` — `pickLandingLocale`: qué juego de copy ve cada visita (ver «Idioma»).
- `resolve.ts` — `parseLanding` + `resolveLanding`: junta todos los errores (clave de copy ausente, texto largo, variante sin su campo) con el id del bloque.
- `ui/blocks/*` — un componente por bloque, función pura de sus props; ninguno importa a otro (lo verifica una prueba).
- `server/lead.ts`, `server/actions.ts` — entrega del lead.

## Plantillas por arquetipo (T10)
`templates/` trae 5 combinaciones de bloques con su copy base en español e inglés:
`ecommerce`, `bookings-services`, `education`, `minimal-tech` y `community`
(`TEMPLATES` en `templates/index.ts`; cada una es `{ landing, copy: { es, en } }`).
Usarla = copiar su `landing` a `landing.json` y su `copy` como `copySets` de
`copy.ts`. Cada plantilla, en los dos idiomas, pasa por el mismo esquema y las
mismas pruebas que la landing por defecto, y una prueba exige que el `en` tenga
la misma forma que el `es` (claves, largo de listas, enlaces e íconos).
Limitación: la plantilla de tienda aún no tiene bloque de catálogo (viene con el
módulo de comercio, fase L3 del plan). Los precios del copy son texto de ejemplo
(no se formatean por idioma ni por moneda).

**Enlace con la génesis: pendiente (cambio en allflow.biz).** Que `landing.tsx`
de la génesis escoja la plantilla por el arquetipo de la spec, escriba
`landing.json` + `copy.ts` en la app y enlace `/` a este módulo (hoy `/` sigue
siendo `app/(marketing)/landing.tsx`; el módulo vive en `/landing`).

## Idioma
La página elige el juego de copy en cada visita, en el mismo orden que el módulo
`i18n` (`modules/i18n/request.ts`), para que la landing y `<html lang>` coincidan:
1. la cookie `NEXT_LOCALE` que escribe el selector de idioma;
2. el `Accept-Language` del navegador;
3. el `locale` de `landing.json` (el idioma fuente de la app), en vez del `es` global de i18n.

Solo importa `@/modules/i18n/contracts` (`LOCALE_COOKIE`, `isLocale`,
`negotiateLocale`). Leer cookie y cabeceras hace `/landing` dinámica, como el resto
del grupo marketing con i18n. El contenedor lleva `lang` con el idioma elegido.
El copy **no** vive en el catálogo de i18n a propósito: es contenido por app que la
génesis reescribe, no texto de interfaz. `/landing` no muestra un selector de idioma
propio (el `LanguageSwitcher` es de `modules/i18n/ui`, fuera de `contracts`); la
elección hecha en `/` o en el login se respeta porque vive en la cookie.

## Re-tematizar (LND-3)
Solo tokens (`bg-primary`, `text-muted-foreground`, `border`…). Cambiar `--brand-h` / `--brand-c` en `app/globals.css` re-tema la landing. Un color literal o una paleta de Tailwind (`bg-blue-500`) falla `pnpm test:modules`.

## Captura de lead (LND-5)
El lead **no se guarda en la app** (el módulo no tiene tablas): se entrega al CRM de
Fulvia por la llave de ingesta y, si esa entrega falla, el formulario muestra error.
`POST ${ALLFLOW_INGEST_URL}/contacts` con `Authorization: Bearer ${ALLFLOW_INGEST_KEY}` y el cuerpo que acepta la ingesta (`email`, `name`, `source: "landing"`, `utm_*`, `attributes`: consentimiento con fecha, mensaje y ruta de entrada). Sin llave devuelve error, no finge éxito. Honeypot siempre; Turnstile solo si hay `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (cliente) y `TURNSTILE_SECRET_KEY` (servidor). La atribución de primer toque queda en la cookie `fv_attr` (90 días, propia).
El template aún no trae `server/allflow/crm.ts`; este módulo hace su propio POST con las mismas variables. Cuando llegue ese cliente, `server/lead.ts` es el único sitio a cambiar.

## Animación
`ui/landing.css`: el contenido es visible por defecto; la animación solo parte de un estado inicial dentro de los `@keyframes` (`backwards`). Si falla o el usuario pide menos movimiento, el hero se ve igual.

## Tablas y migraciones
Ninguna.

## Variables de entorno
Ver `manifest.json`.

## Licencias
Código propio. Los patrones vienen de las fichas de `INV-DISENO-REFERENTES.md` (estudiados, no copiados). Íconos: `lucide-react` (ISC).

## Instalar / desinstalar
Copiar la carpeta y `pnpm modules:sync` (crea el shim `app/(marketing)/landing/page.tsx`). Quitar: borrar la carpeta y `pnpm modules:sync`. Sin tablas que revertir.

## Pruebas
`tests/landing.test.ts` (esquema, copy `es`/`en`, idioma, bloques, LND-3/5/6) y
`tests/landing-templates.test.ts` (las 5 plantillas en los dos idiomas), con
`pnpm test:landing`. Un `landing.json` o un copy inválido falla en esas pruebas;
en ejecución, la página tira al pedirla (ya no es estática, así que no falla en el build).

## Pendiente
- **Enlace con la génesis (allflow.biz):** escoger la plantilla por arquetipo, escribir
  `landing.json` + `copySets` en la app y servir `/` desde este módulo. Hoy `/` sigue
  siendo `app/(marketing)/landing.tsx` de la génesis y el módulo vive en `/landing`.
- **Lead:** se entrega al CRM de Fulvia, no se guarda en la app. Falta el cliente
  compartido `server/allflow/crm.ts` en el template; cuando llegue, `server/lead.ts`
  es el único sitio a cambiar.
- **Selector de idioma en `/landing`:** no tiene uno propio (ver «Idioma»).
- **e2e/axe de `/landing`:** sin correr (no hay navegador en este entorno).
