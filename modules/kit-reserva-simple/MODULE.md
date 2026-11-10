# kit-reserva-simple — agenda de servicios

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/reserva-simple`.

## Qué hace

Reserva de una hora para un servicio local (peluquería, taller, consulta): cuatro pasos
(servicio, profesional, día y hora, datos) con un resumen fijo que acompaña, recordatorio
opcional, confirmación y el panel de agenda del día que ve el local. La reserva funciona
en la vista previa (estado en el navegador); los datos son de muestra. Cubre los estados: día cerrado (vacío),
horas ocupadas, formulario incompleto, confirmación (éxito) y la hoja con los ocho.

## Qué expone

- **Ruta:** `/kits/reserva-simple` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/booking.tsx` (flujo, cliente), `ui/reserva.css` (`.rs-*`), `ui/copy.ts` (textos y datos).

## Referentes

Estudiados, no copiados: dirección D10 «Reservas y servicios» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K11 del catálogo): lista de servicios con duración y precio, selección de profesional, calendario y confirmación. Se tomó el criterio (pasos cortos, resumen siempre visible, horas ocupadas visibles pero no elegibles) y se rehízo con los tokens del núcleo, radios como tarjeta con `:has()` en lugar de componentes de terceros y paleta propia (ámbar rojizo, matiz 40). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes ni fuentes de terceros (se usan las variables del tema). Los nombres, precios y horarios son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-reserva-simple/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar servicios, profesionales y días en `ui/copy.ts`. La función `taken()` de `ui/booking.tsx` simula las horas ocupadas: en una app real se reemplaza por la consulta de disponibilidad.
3. `onSubmit` de `Booking` hoy solo muestra la confirmación; ahí se llama a tu acción de servidor.
4. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={40} c={0.16}>`; en tu app quita el envoltorio).
5. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS (no cabe junto a la marca y la acción). No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
