# kit-mercadito-de-barrio — tienda local

## Qué hace

Kit de tienda para comercio de barrio (alimentos, mascotas): héroe de color con buscador, categorías, grilla densa de ofertas, ficha de producto, pedido con checkout simple, seguimiento, reseñas y un estado vacío. Solo vista previa y componentes de página; no tiene tablas ni lógica de compra.

## Qué expone

- **Ruta:** `/kits/mercadito-de-barrio` (pública, grupo `marketing`).
- **Tablas / permisos / navegación:** ninguno.
- **`contracts/`:** ninguno (el kit se copia a la app y se edita su `copy.ts`).

## Cómo se usa

1. Copiar `modules/kit-mercadito-de-barrio/` y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts` (marca, productos, textos). Cambiar el color de la app = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={145} c={0.14}>` para mostrar su identidad (quítalo en una app real).
3. Capa propia en `ui/kit.css` (prefijo `.mb-`), solo con tokens. Tipografía: Outfit (títulos y texto).
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `EmptyState`, `.kit-container`, `.kit-display/h1/h2`, `.kit-eyebrow`.

## Referentes

Estudiados (estructura, no copiados): Gumroad (tarjeta de producto simple) y las tiendas locales de despacho rápido. Se rehízo con héroe de color pleno, buscador al frente y grilla densa de 2 columnas en móvil. No se parece a más de un referente en estructura y paleta a la vez: la paleta verde cálida no coincide con ninguno.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuente Outfit (OFL, de la lista abierta). Sin imágenes de terceros: las miniaturas son bloques con ícono; productos y reseñas son texto de ejemplo.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
