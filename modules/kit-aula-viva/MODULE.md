# kit-aula-viva — academia de cursos en línea

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/aula-viva`.

## Qué hace

Una academia en línea: portada con «sigue donde quedaste» y anillo de progreso, lección con
reproductor de maqueta, notas por minuto y quiz con retroalimentación, ruta de módulos
(completado, en curso, bloqueado), catálogo filtrable por nivel, certificado y foro del curso.
Las notas, el quiz y el filtro funcionan en la vista previa (estado en el navegador). La hoja de
estados muestra los ocho.

## Qué expone

- **Ruta:** `/kits/aula-viva` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/lesson.tsx` (notas y quiz, cliente), `ui/catalog.tsx` (filtro, cliente), `ui/aula.css` (`.av-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D6 «Educación brillante» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K06 del catálogo): catálogo de tarjetas, ruta de módulos y progreso visible. Se tomó el criterio («una acción clara: continuar», progreso siempre visible) y se rehízo: la portada es una tarjeta de continuar con anillo de progreso (CSS `conic-gradient` con tokens), las portadas de curso se componen con tintes de la marca y un ícono, sin imágenes de terceros, y la paleta es propia (violeta, matiz 275). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes, video ni fuentes de terceros: el «reproductor» es una maqueta de CSS; las portadas son tintes con un ícono. Cursos, docentes y mensajes del foro son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-aula-viva/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar textos y datos en `ui/copy.ts`. Para video real, reemplaza `.av-screen` por tu reproductor (con subtítulos).
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={275} c={0.2}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS (no cabe junto a la marca y la acción). No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
