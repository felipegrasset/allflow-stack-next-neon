# kit-evento-en-vivo — webinar, evento o comunidad

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/evento-en-vivo`.

## Qué hace

Página de un evento en línea: cabecera con cuenta regresiva, agenda con pestañas por día (flechas
del teclado), ponentes, registro con validación y confirmación, sala de espera con chat de ejemplo,
material descargable, encuesta con resultados y directorio de la comunidad con búsqueda. Todo lo
interactivo funciona en la vista previa (estado en el navegador). La cuenta regresiva es un valor
fijo de muestra: en una app real se calcula contra la fecha del evento. Incluye la hoja de los ocho estados.

## Qué expone

- **Ruta:** `/kits/evento-en-vivo` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/live.tsx` (agenda, registro, chat, encuesta, directorio, material; cliente), `ui/evento.css` (`.ev-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D13 «Comunidad y eventos» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K15 del catálogo): cabecera con cuenta regresiva, agenda, ponentes y registro. Se tomó el criterio (la cuenta regresiva es el foco y el registro está siempre a un toque) y se rehízo: la cuenta regresiva es un bloque de color pleno de la marca, las pestañas siguen el patrón WAI-ARIA, los retratos son iniciales sobre tintes (sin fotos) y la paleta es propia (ámbar, matiz 60). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes, video ni fuentes de terceros. Personas, charlas y mensajes son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-evento-en-vivo/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar textos y datos en `ui/copy.ts`. `Register` y `Waiting` solo guardan estado local: conecta tus acciones de servidor en los `onSubmit`.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={60} c={0.19}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
