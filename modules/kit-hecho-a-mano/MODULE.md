# kit-hecho-a-mano — portafolio y tienda de creadores

## Qué hace

Portafolio con tienda simple para ilustradores, ceramistas y artistas: héroe con borde grueso, proyectos, tienda, sobre mí, tarifas, galería, contacto, boletín y estados (cargando, error con reintento, vacío). Estilo plano y juguetón. Solo vista previa; el formulario no envía nada.

## Qué expone

- **Ruta:** `/kits/hecho-a-mano` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Las láminas (`ui/art.tsx`) son SVG con tokens; se reemplazan por fotos del trabajo. Color = `--brand-h` / `--brand-c`; el papel punteado sale de un matiz fijo (`--kit-warning-h`). La vista previa usa `<KitTheme h={40} c={0.18}>` (quitarlo en una app real).
3. Capa propia `ui/kit.css` (prefijo `.hm-`). Tipografía: Outfit + IBM Plex Mono. Los movimientos respetan `prefers-reduced-motion`.
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `LoadingState`, `ErrorState`, `EmptyState`, escala `.kit-*`.

## Referentes

Estudiados (estructura, no copiados): portafolios de creadores independientes y la corriente neobrutalista (HyperUI, MIT, solo estudio de estructura; no se llevó código). Se rehízo con papel punteado, stickers rotados, sombra dura del color de la marca y piezas SVG propias; es más lúdico y redondeado que el kit Estudio Contraste. No se parece a más de un referente en estructura y paleta a la vez.

## Licencia y origen

Código propio de AllFlow. Fuentes Outfit e IBM Plex Mono (OFL, lista abierta). Sin íconos ni imágenes de terceros; proyectos, precios y textos son ficticios.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
