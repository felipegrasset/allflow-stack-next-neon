# kit-presupuesto-claro — cotizaciones de servicios

## Qué hace

Pantalla completa para armar y responder presupuestos: un **armador** con líneas editables (descripción, cantidad, precio), descuento y IVA que recalculan el total en vivo; el **documento del cliente** con tabla de líneas, totales, vigencia y dos salidas (aceptar, con sello al aceptar, o pedir cambios con mensaje); una **lista** con búsqueda y filtro por estado (borrador, enviado, aceptado, vencido); y la galería de estados. Es solo interfaz: no guarda ni envía nada.

## Qué expone

- **Ruta:** `/kits/presupuesto-claro` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts` (marca, líneas de ejemplo, IVA, lista). Los cálculos de `ui/builder.tsx` y `ui/documento.tsx` son de demostración: el monto real lo debe fijar el servidor al guardar.
3. «Aceptar presupuesto» debe llamar a tu acción de servidor (que registra la aceptación y valida que no esté vencido). El botón «Simular un fallo» es solo de la demo: quítalo.
4. Color = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={65} c={0.1}>` (quitarlo en una app real).
5. Capa propia `ui/presupuesto.css` (prefijo `.pz-`). Tipografía: Fraunces (títulos), Inter (texto) e IBM Plex Mono (cifras).
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, los ocho estados, `StateBlock`, escala `.kit-*`.
6. **Propuesta para kit-core:** un estado «Vencido» (`StateBlock` tono `warning`, acción «Duplicar con fecha nueva»). Aquí está armado dentro del kit; no se tocó el núcleo.

## Referentes

Estudiados (estructura, no copiados): las hojas de cotización de herramientas de facturación para independientes (documento con tabla y totales a la derecha) y el papel membretado impreso. Se rehízo con una hoja con filete superior y separadores punteados, sello doble al aceptar, cifras en monoespaciada y la lista como fichas con borde lateral. La paleta ocre propia (matiz 65) no coincide con un referente concreto.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuentes Fraunces, Inter e IBM Plex Mono (OFL, lista abierta). Clientes, montos y textos son ficticios; sin imágenes de terceros.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css` ni `modules/kit-core/**`.
