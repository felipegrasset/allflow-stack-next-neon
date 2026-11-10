# kit-core — núcleo de los kits de UI

> Contrato en texto plano. Un kit (`modules/kit-<nombre>/`) se construye encima
> de este módulo y lo lee solo a él y a `RUBRICA.md`.

## Qué hace

Entrega lo que todo kit comparte: tokens OKLCH con escala (tipografía, espacio,
radio, sombras, tonos de estado), los ocho componentes de estado, encabezado y
pie, y la rúbrica de calidad con sus comprobaciones automáticas. Sin tablas ni
permisos: es solo UI.

## Qué expone

- **Ruta:** `/kits/core` (pública, grupo `marketing`): vista previa de tokens, estados y la misma pieza con tres marcas.
- **Tablas / permisos / navegación:** ninguno.
- **`contracts/index.ts`:** lo único que un kit importa (API abajo). Importarlo carga también los tokens (`--kit-*`) y las clases `.kit-*`.
- **`RUBRICA.md`:** los 8 puntos, cómo se miden y el formato de `rubrica.json`.
- **`testing/checks.ts`** y **`testing/axe.ts`:** el helper de pruebas (abajo).

## Cómo se usa

Un kit es la carpeta `modules/kit-<nombre>/` con su `manifest.json` (`id`,
`feature` = `kit-<nombre>`, `routes: [{ "path": "/kits/<nombre>", "entry": "ui/page.tsx", "group": "marketing" }]`,
`dependsOn: ["kit-core"]`), su `MODULE.md` (con `## Referentes`, `## Licencia y origen`
y `## Cómo se usa`), su `rubrica.json` y su `ui/`. Reglas:

1. **Importa solo `@/modules/kit-core/contracts`.** Nunca `kit-core/ui/*` (el validador lo rechaza).
2. **Sin colores propios.** Ni hex, ni `rgb()`, ni `bg-red-500`. Usa los pares del tema
   (`bg-primary text-primary-foreground`, `bg-muted text-muted-foreground`, `border-border`) o los tokens del núcleo.
   Si necesitas un tono nuevo, derívalo en el CSS de tu kit: `oklch(0.96 calc(var(--brand-c) * 0.2) var(--brand-h))`
   (el matiz siempre `var(--brand-h)` o un `--kit-*-h`; en un `.tsx` no va `oklch`).
3. **Re-temático solo con `--brand-h` / `--brand-c`.** No toques `app/globals.css`. Para mostrar el kit con otra
   marca en la vista previa, envuélvelo en `<KitTheme h={30} c={0.14}>`.
4. **Fuentes:** `var(--font-heading)`, `var(--font-sans)`, `var(--font-mono)` o una de las 9 abiertas
   (Geist, Geist Mono, Inter, Manrope, Fraunces, Plus Jakarta Sans, Lexend, IBM Plex Sans/Mono, Outfit).
5. **Los 8 estados** vienen del núcleo; úsalos donde la pantalla pueda estar vacía, cargando, fallar, etc.
6. La vista previa lleva `<main id="contenido">` (el enlace «saltar al contenido» del layout apunta ahí) y un solo `<h1>`.
7. Textos: hasta que exista i18n (T4) van literales en el kit, en un archivo `ui/copy.ts` propio.

### Tokens (`--kit-*`, en `ui/kit-core.css`)

| Grupo                        | Variables                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipografía                   | `--kit-text-xs … --kit-text-4xl` (fluida 375→1280), `--kit-leading-{tight,snug,normal}`, `--kit-tracking-{tight,wide}`, `--kit-weight-*`, `--kit-measure` |
| Espacio                      | `--kit-space-1 … 9` (escala de 4 px × `--density`), `--kit-container`, `--kit-gutter`                                                                     |
| Radio                        | `--kit-radius-{sm,md,lg,xl,full}` (derivados de `--radius`)                                                                                               |
| Sombra / mov.                | `--kit-shadow-{sm,md,lg}`, `--kit-ease`, `--kit-dur`                                                                                                      |
| Color (derivado de la marca) | `--kit-tint`, `--kit-tint-strong`, `--kit-tint-fg`; por tono `--kit-{info,success,warning,danger}-{bg,fg,border}`                                         |

Clases listas: `.kit-container`, `.kit-section`, `.kit-card`, `.kit-tint`, `.kit-eyebrow`,
`.kit-display`, `.kit-h1`, `.kit-h2`, `.kit-h3`, `.kit-lead`, `.kit-body`, `.kit-small`.

### Componentes (todos desde `@/modules/kit-core/contracts`)

Los de estado aceptan `title`, `description`, `compact`, `className`; cada uno trae su texto por defecto (`kitCopy`).
Una acción es `{ label, onClick }` (cliente) o `{ label, href }` (servidor).

| Componente       | Cuándo                                          | Props propias                                                                           |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `EmptyState`     | la lista existe y está vacía                    | `action`                                                                                |
| `LoadingState`   | cargando; esqueleto, `role=status`, `aria-busy` | `lines`, `title` (texto para lectores)                                                  |
| `ErrorState`     | falló algo; `role=alert`                        | `onRetry` o `retryHref`, `retryLabel`                                                   |
| `SuccessState`   | se completó una acción                          | `action`                                                                                |
| `ForbiddenState` | sin permiso                                     | `action`                                                                                |
| `NoResultsState` | filtro o búsqueda sin coincidencias             | `action` (quitar filtros)                                                               |
| `OfflineState`   | sin red                                         | `onRetry` o `retryHref`                                                                 |
| `PartialState`   | se muestra lo que hay y se dice qué falta       | `issues: string[]`, `action`                                                            |
| `StateBlock`     | base de los ocho; solo si ninguno encaja        | `tone`, `icon`, `title`, `description`, `children`, `action`, `secondaryAction`, `role` |
| `KitHeader`      | encabezado                                      | `brand`, `brandHref`, `links[]`, `current`, `actions`, `navLabel`                       |
| `KitFooter`      | pie                                             | `brand`, `tagline`, `columns[]` (máx. 4), `legal`                                       |
| `KitTheme`       | sección con otra marca (galerías)               | `h`, `c`                                                                                |

`states.tsx` es componente de cliente (los botones llevan `onClick`); `chrome.tsx` es de servidor.

### Cómo se prueba un kit

- `pnpm test:kits`: corre sobre todo `modules/kit-*`: colores literales, clases de paleta, `oklch` derivado de la marca, fuentes, que importe el núcleo, secciones de `MODULE.md` y `rubrica.json` aprobada (≥13/16, ningún 0, a 1280 y 375 px).
- `pnpm test:kits:e2e` (requiere `pnpm build`): abre `/kits/<nombre>` de cada kit a 1280 y 375 px en claro y oscuro, corre axe WCAG 2.2 AA, exige que no haya desborde horizontal y guarda capturas en `test-results/kit-shots/`.
- En un spec propio: `expectKitAccessible(page, "/kits/<nombre>", "<nombre>")` de `testing/axe.ts`.
- La parte humana de la rúbrica está en `RUBRICA.md`.

## Referentes

Núcleo, no pantalla: sin referente visual. La escala de 4 px y los tonos de estado siguen el criterio general de los sistemas de diseño abiertos (estudiado, no copiado). Los referentes de cada kit van en el suyo.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC, ya dependencia de la app). Sin material de terceros ni fuentes fuera de la lista abierta.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

1. Copiar `modules/kit-core/` y correr `pnpm modules:sync` (genera el shim de `/kits/core`).
2. Desinstalar: borrar la carpeta y `pnpm modules:sync`. Sin migraciones. Antes, quitar los kits que dependen de él.

## Qué NO toca

Ningún ancla ni zona protegida. **No edita `app/globals.css`**: los tokens viven en `ui/kit-core.css`, que se carga al importar el módulo, y leen `--brand-h`, `--brand-c`, `--density` y `--radius` de ahí. Los centinelas de `allflow.sentinels.json` quedan intactos.
