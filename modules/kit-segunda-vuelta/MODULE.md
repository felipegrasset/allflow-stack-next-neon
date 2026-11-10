# kit-segunda-vuelta — marketplace móvil de segunda mano

## Qué hace

Marketplace entre vecinos pensado desde el móvil: búsqueda, chips de categoría, grilla de 2 columnas (4 en escritorio), ficha, chat con el vendedor, publicar, favoritos, perfil, filtros en hoja inferior y estados (cargando, error con reintento, sin resultados). Solo vista previa; sin lógica de compra ni mensajería real.

## Qué expone

- **Ruta:** `/kits/segunda-vuelta` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Las miniaturas son un ícono sobre un patrón de puntos; se reemplazan por fotos reales. Color = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={250} c={0.16}>` (quitarlo en una app real).
3. Capa propia `ui/kit.css` (prefijo `.sv-`). Tipografía: Manrope (títulos) + Inter (texto).
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `LoadingState`, `ErrorState`, `NoResultsState`, escala `.kit-*`.

## Referentes

Estudiados (estructura, no copiados): los marketplaces móviles de segunda mano en general (grilla de 2 columnas, chat con vendedor). Se rehízo con botón de favorito de 44 px, hoja de filtros inferior y patrón de puntos en las miniaturas. La paleta azul y la estructura de página única no coinciden a la vez con un referente concreto.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuentes Inter y Manrope (OFL, lista abierta). Sin imágenes de terceros; avisos, nombres y precios son ficticios.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
