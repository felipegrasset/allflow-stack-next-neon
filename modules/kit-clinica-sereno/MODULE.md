# kit-clinica-sereno — reserva médica, dental o de bienestar

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/clinica-sereno`.

## Qué hace

Reserva centrada en la persona que atiende: buscador de profesionales (texto y especialidad), ficha con su
presentación, horas libres y un formulario en tres pasos (profesional y hora, datos del paciente con
validación, confirmación con resumen), confirmación como estado de éxito, historial de horas y
recordatorios. Todo funciona en la vista previa (estado en el navegador); los datos son de muestra y
no son consejo médico. Incluye la hoja con los ocho estados.

## Qué expone

- **Ruta:** `/kits/clinica-sereno` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/booking.tsx` (buscador, ficha y pasos; cliente), `ui/clinica.css` (`.cs-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D5 «Salud serena» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K05 del catálogo): buscador de profesionales, ficha, horas y confirmación. Se tomó el criterio (primero la persona, luego la hora; mucho aire; tono verde azulado de baja intensidad) y se rehízo: la reserva es un asistente de tres pasos en un panel fijo junto a la lista, a diferencia del kit Reserva Simple, que es de servicio local; las fotos se sustituyen por iniciales; paleta propia (matiz 175, croma bajo). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Sin imágenes ni fuentes de terceros. Profesionales, RUT, sedes y mensajes son inventados; el kit no ofrece orientación clínica.

## Cómo se usa

1. Instalar: copiar `modules/kit-clinica-sereno/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar profesionales y textos en `ui/copy.ts`. El `onClick` de «Confirmar la hora» solo muestra el éxito: ahí va tu acción de servidor. Valida el RUT con tu propia regla (aquí solo se exige largo mínimo).
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={175} c={0.11}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
