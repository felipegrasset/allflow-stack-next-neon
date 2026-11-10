# kit-centro-de-ayuda — base de conocimiento

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/centro-de-ayuda`.

## Qué hace

Un centro de ayuda: portada con buscador grande, temas como filtros, lista de artículos con resumen y
tiempo de lectura, artículo con pasos numerados y valoración («¿te sirvió?», con salida a contacto si no),
estado del servicio y formulario de contacto con validación. Todo funciona en la vista previa (estado en el
navegador); los artículos son de muestra. Incluye la hoja con los ocho estados.

## Qué expone

- **Ruta:** `/kits/centro-de-ayuda` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/help.tsx` (buscador, artículo y contacto; cliente), `ui/ayuda.css` (`.ay-*`), `ui/copy.ts`.

## Referentes

Sin referente visual específico: el catálogo `INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` no trae una dirección para este caso, así que no se estudió ninguna pieza de Envato, Dribbble ni Behance. Es un diseño propio sobre el patrón común de un centro de ayuda (buscador protagonista, temas, artículo con pasos, estado del servicio): portada tintada con un solo foco (la búsqueda), lista y lectura lado a lado, valoración con salida a contacto y paleta propia (magenta violáceo, matiz 330).

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes ni fuentes de terceros. Artículos, fechas y estados de servicio son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-centro-de-ayuda/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar artículos, temas y textos en `ui/copy.ts`; la búsqueda filtra por título y resumen. En una app real los artículos salen de tu base o de archivos MDX. El envío del formulario solo muestra el éxito: ahí va tu acción de servidor.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={330} c={0.14}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS. No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
