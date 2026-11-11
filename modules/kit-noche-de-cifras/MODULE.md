# kit-noche-de-cifras — dashboard analítico oscuro

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/noche-de-cifras`.

## Qué hace

Un panel analítico denso y nocturno: cuatro KPIs con tendencia, selector de período que recalcula
todo, gráfico de línea y de barras (SVG con texto alternativo y tabla oculta para lectores de pantalla), tabla de canales
(cada fila pasa a tarjeta en 375 px), detalle lateral del canal elegido, alertas con severidad y la hoja con
los ocho estados. La superficie es **siempre oscura**: el kit se envuelve en la clase `.dark` del tema, así
que se ve igual con el tema claro del sistema. Los datos son de muestra.

## Qué expone

- **Ruta:** `/kits/noche-de-cifras` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/analytics.tsx` (período, gráficos, tabla y detalle; cliente), `ui/noche.css` (`.nc-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D2 «Oscuro de cifras» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K02 del catálogo): KPIs, gráficos, tabla y detalle lateral sobre fondo oscuro, cifras en monoespaciada. Se tomó el criterio (un acento, jerarquía por tamaño de cifra, mucho gris) y se rehízo: gráficos de SVG propios con tokens, tabla responsiva y paleta propia (verde lima, matiz 125). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Gráficos dibujados a mano en SVG (sin biblioteca de gráficos). Sin imágenes ni fuentes de terceros. Todas las cifras son inventadas.

## Cómo se usa

1. Instalar: copiar `modules/kit-noche-de-cifras/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar textos y datos en `ui/copy.ts`; `Analytics` recibe sus series de `copy.ranges`. Para datos reales, pásalas por props desde una consulta.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={125} c={0.17}>` dentro de un `div.dark`; en tu app quita el envoltorio de marca y deja `.dark` si quieres la superficie oscura).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
