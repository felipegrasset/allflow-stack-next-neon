# kit-atelier-de-papel — tienda editorial de moda

## Qué hace

Tienda de moda u objetos con aire editorial: héroe asimétrico con serif, colecciones, grilla de producto, ficha con galería y tallas, cajón de bolsa, lookbook, boletín y una hoja de estados (cargando, error con reintento, sin resultados). Solo vista previa; no cobra ni guarda nada.

## Qué expone

- **Ruta:** `/kits/atelier-de-papel` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Las láminas (`ui/art.tsx`) son SVG con tokens: se reemplazan por fotos reales con `next/image` cuando las haya. Color = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={40} c={0.08}>` (quitarlo en una app real).
3. Capa propia `ui/kit.css` (prefijo `.ap-`). Tipografía: Fraunces (títulos) + Inter (texto).
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `LoadingState`, `ErrorState`, `NoResultsState`, escala `.kit-*`.

## Referentes

Estudiados (estructura, no copiados): revistas de moda en línea y los temas editoriales de Shopify (Dawn, Horizon; solo estudio de estructura, licencia propietaria de Shopify). Se rehízo con láminas geométricas propias, líneas finas en vez de tarjetas, botones planos en mayúsculas y un papel cálido derivado de la marca. No se parece a más de un referente en estructura y paleta a la vez.

## Licencia y origen

Código propio de AllFlow. Fuentes Fraunces e Inter (OFL, lista abierta). Sin íconos ni imágenes de terceros: las láminas son SVG propios. Nombres de prendas y textos son ficticios.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
