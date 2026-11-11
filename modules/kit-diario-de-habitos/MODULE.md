# kit-diario-de-habitos — seguimiento personal de hábitos

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/diario-de-habitos`.

## Qué hace

Un diario de hábitos (agua, movimiento, comidas con verdura): tres anillos de progreso, registro rápido
en un toque con «deshacer», historial del día, metas editables con pasos (los anillos se ajustan al
instante), gráfico semanal de barras, recordatorios con interruptores y el plan de cuatro semanas.
Todo funciona en la vista previa (estado en el navegador). Es seguimiento personal, no consejo médico.
Incluye la hoja con los ocho estados.

## Qué expone

- **Ruta:** `/kits/diario-de-habitos` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/today.tsx` (anillos, registro, metas y recordatorios; cliente), `ui/diario.css` (`.dh-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D17 «Salud y comida con cámara» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K17 del catálogo): anillos de progreso, registro diario en dos toques y progreso semanal. Se tomó el criterio (una acción central, el progreso siempre a la vista) y se rehízo sin cámara ni fotos de comida (el catálogo advierte que K17 depende de fotos): anillos de CSS (`conic-gradient`) con tokens, gráfico de barras sin biblioteca y paleta propia (verde cálido, matiz 140). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes ni fuentes de terceros. Nombres y cifras son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-diario-de-habitos/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar hábitos, metas y textos en `ui/copy.ts`. `Today` guarda los registros en el navegador: para persistir, llama a tu acción de servidor desde `add()` y `undo()`.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={140} c={0.14}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
