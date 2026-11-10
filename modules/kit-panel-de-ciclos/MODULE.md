# kit-panel-de-ciclos — panel de un SaaS con administración

> Kit de UI (T17), construido sobre `kit-core`. Vista previa en `/kits/panel-de-ciclos`.

## Qué hace

Un panel de administración para un SaaS: resumen del ciclo con cuatro cifras,
tabla de cuentas con búsqueda y filtro (en 375 px cada fila pasa a tarjeta),
puesta en marcha, facturación, equipo con roles, notificaciones y una hoja con
los estados (vacío, cargando, error, éxito, sin permiso, parcial, sin red; el
«sin resultados» vive dentro de la tabla). Sin tablas de base de datos ni permisos: es solo UI.

## Qué expone

- **Ruta:** `/kits/panel-de-ciclos` (pública, grupo `marketing`).
- **Piezas:** `ui/page.tsx` (composición), `ui/accounts.tsx` (tabla filtrable, cliente), `ui/panel.css` (clases `.pc-*`), `ui/copy.ts` (textos y datos de muestra).

## Referentes

Estudiados, no copiados: la dirección D3 «Panel claro de operaciones» y D15 «Sistema en tarjetas» de `docs/investigaciones/INV-DISENO-ENVATO-DRIBBBLE-BEHANCE.md` (K12 del catálogo), y el patrón de panel con barra lateral de los sistemas abiertos (shadcn/ui, MIT, solo como criterio). De ahí se tomó la idea de «una cifra grande por tarjeta, tabla densa, barra lateral que desaparece en móvil». Se rehízo con los tokens del núcleo, tabla que se vuelve tarjetas, y paleta propia (azul violeta, matiz 265). No se parece a más de un referente a la vez: la estructura es de panel genérico, pero la paleta y la tabla responsiva son propias.

## Licencia y origen

Código propio de AllFlow. Íconos de `lucide-react` (ISC). Sin imágenes ni fuentes de terceros: la tipografía son las variables del tema (`--font-heading`, `--font-sans`, `--font-mono`). Los datos (cuentas, personas, facturas) son inventados.

## Cómo se usa

1. Instalar: copiar `modules/kit-panel-de-ciclos/` (requiere `kit-core`) y `pnpm modules:sync`.
2. Cambiar los textos y datos en `ui/copy.ts`; la tabla recibe `accounts` por props.
3. Re-temático: solo `--brand-h` y `--brand-c` (la vista previa los fija con `<KitTheme h={265} c={0.2}>`; en tu app quita el envoltorio y usa los de `app/globals.css`).
4. Desinstalar: borrar la carpeta y `pnpm modules:sync`.

## Variables de entorno

Ninguna.

## Qué NO toca

Ningún ancla ni zona protegida. Sin migraciones.
