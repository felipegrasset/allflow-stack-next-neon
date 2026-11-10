# i18n — Idiomas (es/en)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
Todo texto de las pantallas sale de un catálogo por clave, en español (`es`,
idioma fuente) e inglés (`en`). La persona elige el idioma en un selector de la
cabecera; la elección queda en una cookie y también se guarda al cambiar el
idioma en el perfil o en el onboarding. `<html lang>` sigue al idioma activo.

## Qué expone
- **Rutas:** ninguna. El idioma NO va en la URL (ver «Decisiones»).
- **Tablas / permisos:** ninguno. (`user.locale` ya existe en el piso.)
- **Cabecera:** `LanguageSelector` antes del selector de tema.
- **`contracts/index.ts`** (lo único que otro módulo importa): `LOCALES`, `Locale`,
  `DEFAULT_LOCALE`, `LOCALE_COOKIE`, `isLocale`, `negotiateLocale`, y los
  formateadores `formatDate`, `formatDateTime`, `formatNumber`, `formatCurrency`,
  `formatRelative` (todos sobre `Intl`, con la etiqueta de `INTL_TAG`).

## Cómo se usa
Catálogo: `modules/i18n/messages/es.ts` y `en.ts`; un espacio de nombres por
módulo o kit (`auth`, `profile`, `i18n`…). Un argumento dinámico es ICU
(`"Hola, {name}"`, plurales con `{n, plural, one {…} other {…}}`).

```ts
// servidor (página, layout, Server Action)
const copy = await getCopy("auth")            // @/modules/i18n/server/copy
copy.login.title        // "Iniciar sesión" | "Sign in"
copy.shell.welcome(name) // un argumento ICU = un parámetro posicional

// cliente
const copy = useCopy("profile")               // @/modules/i18n/ui/use-copy

// mensajes de Zod: dependen del idioma, así que los esquemas son fábricas
const { loginSchema } = authSchemas(copy.validation)   // lib/schemas/auth.ts
```

- **Metadatos:** `generateMetadata()` con `getCopy`, no `export const metadata` con texto.
- **Etiquetas de navegación:** un módulo escribe la clave en `label` (`"ping.nav"`);
  `AppShell` la traduce. Lo que no es clave se muestra tal cual.
- **Un idioma nuevo:** agregar `fr.ts`, sumarlo a `LOCALES`, a `INTL_TAG` y a `messages`
  (el tipo falla si falta alguno). La prueba exige las mismas claves y los mismos argumentos.

## Decisiones (y por qué)
- **Sin prefijo de idioma en la URL** (`/es/login`). Poner `[locale]` obliga a
  mover todas las pantallas bajo un segmento, y la génesis y `modules:sync` escriben
  rutas en `app/(app)` y `app/(marketing)`: rompería ambas. El idioma sale de
  cookie → `Accept-Language` → `es`. **Costo:** el idioma no es indexable por
  separado (hreflang) y las páginas de marketing pasan a ser dinámicas. Si el
  SEO por idioma llega a importar, se agrega `[locale]` solo al grupo `(marketing)`.
- **`pt` queda fuera del MVP.** El piso trae `es` y `en`; la génesis todavía puede
  generar `pt` en el texto del dominio, pero ningún kit ni catálogo lo traduce.
  Recomendación: quitarlo de la génesis (`AppSpec["language"]`) hasta que haya
  un catálogo `pt`.
- **Catálogos en TypeScript, no JSON:** los tipos (claves y número de argumentos)
  salen del catálogo `es`; un JSON se ensancha a `string` y los pierde.
- **`authCopy`** (`lib/copy/auth.ts`) sigue existiendo solo como texto fuente
  para lo que la génesis escribe como constante (`config/nav.ts`, la landing).

## Pendiente declarado
- Correos (`server/email/templates.ts`): en español; falta el idioma del destinatario.
- Texto que la génesis escribe como literal: `app/(marketing)/landing.tsx`,
  `app/(app)/home.tsx` (versión generada), `lib/copy/domain.ts`, `config/nav.ts`.
- `app/dev/home-gallery/**` (galería de desarrollo, no llega al usuario).
- `user.locale` no se lee al iniciar sesión en otro dispositivo (manda `Accept-Language`).
- Que un módulo aporte su propio catálogo: hoy se suma a mano a `messages/`; falta
  un punto de extensión `messages` en el contrato (T1).

## Instalar
1. Copiar la carpeta a `modules/i18n/`.
2. `pnpm modules:sync`; `pnpm install` (trae `next-intl`).
3. Envolver `app/layout.tsx` en `NextIntlClientProvider` con `lang={locale}` y registrar
   el plugin en `next.config.ts` (`createNextIntlPlugin("./modules/i18n/request.ts")`).
   **Estos dos cambios no caben en el contrato**: el módulo ya viene instalado en el template.

## Desinstalar
No aplica al template: todas las pantallas leen de aquí. Quitarlo es revertir los cambios de T4.

## Qué NO toca
Ningún archivo ancla ni zona protegida.
