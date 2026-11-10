# kit-estudio-contraste — landing de agencia o servicios

## Qué hace

Landing atrevida para una agencia o negocio de servicios: hero, servicios, casos, proceso de 4 pasos, equipo, precios, testimonios, formulario de lead y CTA final. Solo vista previa; el formulario no envía nada (conecta tu propia acción).

## Qué expone

- **Ruta:** `/kits/estudio-contraste` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Cambiar el acento = `--brand-h` / `--brand-c`; el papel cálido y la tinta son parte de la identidad y salen de un matiz fijo (`--kit-warning-h`). La vista previa usa `<KitTheme h={25} c={0.2}>` (quitarlo en una app real).
3. Capa propia `ui/kit.css` (prefijo `.ec-`): bordes gruesos y sombra dura. Tipografía: Outfit.
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, escala `.kit-*`, `.kit-container`, `.kit-section`.

## Referentes

Estudiados (estructura, no copiados): landings de agencias de diseño de tendencia neobrutalista y la familia neobrutalista de HyperUI (MIT; solo estudio de estructura, no se llevó código). Se rehízo con papel cálido, sombras duras de tinta y secuencia propia de secciones. La paleta crema + rojo no coincide con un referente concreto.

## Licencia y origen

Código propio de AllFlow. Fuente Outfit (OFL, de la lista abierta). Sin íconos ni imágenes de terceros. Nombres, casos, cifras y testimonios son ficticios.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
