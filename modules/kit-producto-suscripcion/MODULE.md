# kit-producto-suscripcion — producto digital y suscripción

## Qué hace

Página de un producto digital que se cobra por suscripción: héroe con maqueta de la app, qué incluye, selector mensual/anual con tres planes (funcional, en un componente de cliente), garantía, preguntas frecuentes y estados de cobro (cargando y error con reintento). Pensado para apps que cobran con un proveedor de pagos como Paddle. Es solo interfaz: no cobra ni llama a ningún proveedor.

## Qué expone

- **Ruta:** `/kits/producto-suscripcion` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts` (producto, planes, precios en dólares de ejemplo). Los botones de plan en `ui/billing.tsx` no hacen nada todavía: conecta cada uno a tu checkout (por ejemplo, abrir el pago del proveedor con el identificador de precio del plan elegido y la periodicidad `period`).
3. Mientras cargas precios del proveedor usa `LoadingState`; si falla, `ErrorState` (ya están en la página). Color = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={175} c={0.12}>` (quitarlo en una app real).
4. Capa propia `ui/kit.css` (prefijo `.ps-`). Tipografía: Lexend (títulos) + Inter.
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `LoadingState`, `ErrorState`, escala `.kit-*`.

## Referentes

Estudiados (estructura, no copiados): páginas de producto de apps de productividad con precios por suscripción. Se rehízo con banda de color derivada de la marca, selector de facturación en píldora y maqueta de la app hecha con HTML. La paleta verde azulada y la estructura no coinciden a la vez con un referente concreto.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuentes Lexend e Inter (OFL, lista abierta). «Trazo», los precios y los textos son ficticios; sin imágenes de terceros.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
