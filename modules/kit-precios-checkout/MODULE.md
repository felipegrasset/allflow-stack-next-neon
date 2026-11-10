# kit-precios-checkout — precios y checkout simple

## Qué hace

Página de precios con selector mensual/anual (funcional), tres planes y tabla comparativa accesible; y un checkout simple con correo, país, código de descuento funcional (prueba `BIENVENIDA`), resumen con impuestos y total que se recalcula, más los tres estados del pago: procesando, éxito y error con reintento. Es solo interfaz: no cobra ni llama a ningún proveedor.

## Qué expone

- **Ruta:** `/kits/precios-checkout` (pública, grupo `marketing`).
- **Tablas / permisos / navegación / `contracts/`:** ninguno.

## Cómo se usa

1. Copiar la carpeta y `pnpm modules:sync` (requiere `kit-core`).
2. Editar `ui/copy.ts` (planes, precios, impuesto, país). Los cálculos del resumen están en `ui/checkout.tsx` y son de demostración: el monto real lo debe fijar el servidor o el proveedor.
3. **Pago:** el botón «Continuar al pago seguro» debe abrir el checkout de tu proveedor (por ejemplo Paddle) con el plan, la periodicidad y el cupón. **No agregues campos de tarjeta al formulario** (la tarjeta nunca pasa por la app).
4. Mientras el proveedor responde usa `LoadingState`; si falla, `ErrorState` con reintento; al terminar, `SuccessState`. Color = `--brand-h` / `--brand-c`; la vista previa usa `<KitTheme h={330} c={0.17}>` (quitarlo en una app real).
5. Capa propia `ui/kit.css` (prefijo `.pc-`). Tipografía: Plus Jakarta Sans + IBM Plex Mono (cifras).
   Reutiliza del núcleo: `KitHeader`, `KitFooter`, `KitTheme`, `LoadingState`, `SuccessState`, `ErrorState`, escala `.kit-*`.

## Referentes

Estudiados (estructura, no copiados): páginas de precios de productos SaaS (tres planes con uno destacado) y checkouts de una sola columna con resumen. Se rehízo con cifras en monoespaciada, cupón con mensaje accesible (`role="alert"` si falla) y comparativa como tabla semántica. La paleta magenta propia no coincide con un referente concreto.

## Licencia y origen

Código propio de AllFlow. Íconos `lucide-react` (ISC). Fuentes Plus Jakarta Sans e IBM Plex Mono (OFL, lista abierta). «Cobro», los precios y los textos son ficticios; sin imágenes de terceros.

## Variables de entorno

Ninguna.

## Instalar / desinstalar

Copiar la carpeta y `pnpm modules:sync`; para quitarlo, borrar la carpeta y `pnpm modules:sync`. Sin migraciones.

## Qué NO toca

Ningún ancla ni zona protegida; no edita `app/globals.css`.
