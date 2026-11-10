# kit-taller-claro — CRM liviano para pymes

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/taller-claro`.

## Qué hace

Un CRM claro para quien vende a mano: tablero de tratos por etapa (cada tarjeta se mueve con un
selector, así funciona también con teclado y en móvil), lista de contactos con su ficha, tareas
del día (marcar y agregar), actividad reciente, semana con citas, carga de CSV y la hoja de
estados. El movimiento de tratos, las tareas y la elección de contacto funcionan en la vista
previa (estado en el navegador); los datos son de muestra.

## Qué expone

- **Ruta:** `/kits/taller-claro` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx`, `ui/pipeline.tsx` (tablero, cliente), `ui/workbench.tsx` (contactos, tareas, importar; cliente), `ui/taller.css` (`.tc-*`), `ui/copy.ts`.

## Referentes

Estudiados, no copiados: dirección D3 «Panel claro de operaciones» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K03 del catálogo): pipeline por columnas, ficha de contacto, tareas y actividad. Se tomó el criterio (columnas con total por etapa, una ficha al lado de la lista) y se rehízo: el movimiento de tarjetas es un selector accesible en lugar de arrastrar y soltar, las columnas se apilan en móvil, y la paleta es propia (azul, matiz 255). No se parece a más de un referente a la vez.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes ni fuentes de terceros. Empresas, personas y montos son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-taller-claro/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar textos, etapas y datos en `ui/copy.ts`. `Pipeline` guarda los tratos en el estado del navegador: para persistir, llama a tu acción de servidor desde `move()`.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={255} c={0.15}>`; en tu app quita el envoltorio).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Encabezado en móvil

A menos de 48 rem el kit oculta la navegación del `KitHeader` con su propio CSS (no cabe junto a la marca y la acción). No depende de ningún cambio del núcleo.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
