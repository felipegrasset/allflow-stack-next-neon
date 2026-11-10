# kit-directorio-claro — directorio de fichas con búsqueda

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/directorio-claro`.

## Qué hace

Un directorio de avisos (inmuebles de ejemplo; sirve igual para profesionales o empleos): buscador con filtros
por tipo, comuna y precio, lista y mapa de maqueta sincronizados con la ficha, favoritos, contacto al anunciante
con validación, comparador de dos avisos y panel del anunciante con visitas y contactos. Todo funciona en la
vista previa (estado en el navegador); los datos son de muestra. Incluye la hoja con los ocho estados.

## Qué expone

- **Ruta:** `/kits/directorio-claro` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/directory.tsx` (filtros, lista, mapa, ficha, favoritos, contacto y comparador; cliente), `ui/directorio.css` (`.dc-*`, raíz `.dcx`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D14 «Inmobiliaria/servicios con búsqueda» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K16 del catálogo): búsqueda con filtros, tarjeta repetible, lista más mapa y ficha. Se tomó el criterio (filtros arriba, una tarjeta que sirve para cualquier directorio) y se rehízo: el mapa es una cuadrícula de CSS con puntos accesibles (botones con precio), la ficha y el contacto viven en una columna fija junto a la lista, el comparador es una tabla de dos columnas y la paleta es propia (azul, matiz 240). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes, mapas ni fuentes de terceros: el mapa no representa ninguna ciudad real y las miniaturas son una inicial sobre un tinte. Avisos, precios y personas son inventados. Para un mapa real hay que elegir un proveedor y revisar su licencia.

## Cómo se usa

1. Instalar: copiar `modules/kit-directorio-claro/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar avisos, filtros y textos en `ui/copy.ts`. El envío del contacto solo muestra el éxito: ahí va tu acción de servidor.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={240} c={0.14}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
