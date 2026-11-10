# kit-landing-ia-nocturna — landing de producto de IA

## Qué hace

Landing oscura para un producto de IA: hero con maqueta de conversación, banda de logos, bento de funciones, cómo funciona, precios de tres planes, prueba social, FAQ, CTA y pie. Solo vista previa; no hay lógica ni datos.

## Qué expone

- **Ruta:** `/kits/landing-ia-nocturna` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts`. Cambiar el color = `--brand-h` / `--brand-c`.
3. **Siempre oscura por diseño:** el contenedor lleva la clase `dark`, que activa los tokens oscuros en ese árbol aunque el sitio esté en claro. Para una versión clara, quitar esa clase. La vista previa usa `<KitTheme h={220} c={0.12}>` (quitarlo en una app real).
4. Capa propia `ui/kit.css` (prefijo `.ia-`). Tipografía: Geist (títulos, la del tema) + Inter.
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, escala `.kit-display/h1/h2/h3/lead`, `.kit-container`, `.kit-section`.

## Referentes

Estudiados (estructura, no copiados): landings de producto de IA tipo Linear y Vercel (orden hero, logos, bento). Se rehízo con maqueta de conversación en lugar de captura, resplandor radial de la marca y bento de 3 columnas con celdas anchas alternadas. Paleta azul-cian oscura propia; no coincide en estructura y paleta a la vez con ningún referente.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuentes Geist e Inter (OFL, de la lista abierta). «Lumen», los logos de la banda y el testimonio son texto de ejemplo, sin marcas reales. Sin imágenes de terceros.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
