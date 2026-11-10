# kit-tienda-un-enlace — tienda para creadores y servicios

## Qué hace

Tienda móvil de una columna (tipo «link en la bio») para creadores y servicios: perfil, productos digitales, reserva de horas, cupón, pago, descargas; y un panel con estadísticas, clientes y editor del enlace. En escritorio, la columna se ve como un teléfono junto al panel. Solo vista previa; los botones no cobran ni reservan (conecta tus acciones).

## Qué expone

- **Ruta:** `/kits/tienda-un-enlace` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Cambiar el color = `--brand-h` / `--brand-c`. La vista previa usa `<KitTheme h={300} c={0.2}>` (quitarlo en una app real).
3. Capa propia `ui/kit.css` (prefijo `.ue-`). Tipografía: Plus Jakarta Sans.
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `NoResultsState`, escala `.kit-*`, `.kit-container`.

## Referentes

Estudiados (estructura, no copiados): constructores de link-in-bio para creadores (Stan Store, Beacons; propietarios, solo estudio visual) y Gumroad (MIT, solo estudio de la tarjeta de producto). Se rehízo con una columna tipo teléfono que se vuelve panel en escritorio, tarjetas con tipo de producto y reserva en la misma página. La paleta violeta propia no coincide con esos referentes.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuente Plus Jakarta Sans (OFL, de la lista abierta). Nombres, cifras y productos son ficticios; sin imágenes de terceros (el avatar son iniciales).

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
