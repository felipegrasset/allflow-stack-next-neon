# kit-ruta-viva — operación y reparto

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/ruta-viva`.

## Qué hace

La central de un reparto: cuatro cifras del día, rutas con sus pedidos y la línea de tiempo del
pedido elegido, mapa de zonas de maqueta (cuadrantes cuyo tono y número muestran la carga), repartidores con su
estado, escaneo de un código (un código conocido se registra, uno desconocido da error con salida),
incidencias con severidad y la hoja con los ocho estados. Elegir ruta y pedido y el escaneo
funcionan en la vista previa (estado en el navegador); los datos son de muestra.

## Qué expone

- **Ruta:** `/kits/ruta-viva` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/board.tsx` (rutas, línea de tiempo y escaneo; cliente), `ui/ruta.css` (`.rv-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D4 «Mapa y logística» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K04 del catálogo): lista de rutas, tarjeta de pedido, estado del repartidor, línea de tiempo e incidencias. Se tomó el criterio (la carga por zona se lee de un vistazo; el pedido tiene un seguimiento lineal) y se rehízo sin mapa real: cuadrantes de CSS con tonos de la marca y texto que repite el dato (no depende solo del color); paleta propia (turquesa, matiz 200). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Sin imágenes, mapas ni fuentes de terceros; los cuadrantes no representan ninguna ciudad real. Direcciones, nombres y códigos son inventados. Para un mapa real hay que elegir un proveedor y revisar su licencia: no viene incluido.

## Cómo se usa

1. Instalar: copiar `modules/kit-ruta-viva/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar textos y datos en `ui/copy.ts`; `Scan` valida contra `copy.scan.known`: en una app real llama a tu acción de servidor.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={200} c={0.15}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
