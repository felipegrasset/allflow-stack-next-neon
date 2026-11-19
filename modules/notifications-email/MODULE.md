# notifications-email — Notificaciones por correo

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Agrega el canal de correo a las notificaciones. `notifications/contracts` **no ofrece un punto para
enganchar un canal**, así que este módulo expone `notifyWithEmail()`, que envuelve a `notify()`:
crea el aviso interno (siempre) y además envía un correo a la persona, salvo que lo haya
desactivado. Cada persona decide en `/settings/notifications`, y cada correo trae un enlace firmado
para darse de baja con un clic, sin iniciar sesión. Usa el envío del piso (`server/email/send.ts`,
Resend). **Sin `RESEND_API_KEY` no envía nada** (el aviso interno sí se crea).

## Qué expone
- **Rutas:** `/settings/notifications` (sesión + permiso `notificationEmail:manage`; tu propia
  preferencia) y `/notifications/unsubscribe?token=…` (route handler **público**: la autenticación
  es el token firmado; GET y POST).
- **Tabla** (migración `0108_notifications_email_init`): `notifications_email_prefs` — `user_id`
  (pk, sin llave foránea), `enabled`, `updated_at`. Solo hay fila para quien cambió el valor por
  defecto; sin fila, los correos están activados.
- **Permisos:** recurso `notificationEmail`, acción `manage` (tu propia preferencia). owner, admin y
  member lo reciben. No es `adminAccess`.
- **Navegación:** «Correo» → `/settings/notifications` (`area: "settings"`).
- **Textos:** `messages.ts`, espacio `notifications-email` en `es` y `en`. El correo y la página de baja
  se escriben en el idioma de la persona (`user.locale`) o, en la baja, según `Accept-Language`.
- **Entidades que cubre:** preferencia de correo, baja de correo.
- **Variables de entorno:** `RESEND_API_KEY`, `EMAIL_FROM` (las usa el envío del piso) y
  `BETTER_AUTH_SECRET` (firma los enlaces de baja; sin ella no se envía ningún correo, porque no
  podría haber baja).

## Cómo se usa desde otro módulo
```ts
import { notifyWithEmail } from "@/modules/notifications-email/contracts"

const r = await notifyWithEmail({ userId, title: "Tu informe está listo", href: "/reports/42", id: `report-${id}` })
// r = { id, created, email }   email: "sent" | "disabled" | "no_provider" | "no_secret"
//                                    | "no_user" | "failed" | "skipped_duplicate"
```
Misma entrada que `notify()` (se valida igual y lanza igual si es inválida). El correo es de
mejor esfuerzo: si falla, `email` vale `"failed"` y el aviso interno queda creado. Con `id`
repetido no se envía un segundo correo (`"skipped_duplicate"`). Donde no quieras correo, sigue
usando `notify()`. También exporta `buildMail`, `signUnsubscribeToken`, `verifyUnsubscribeToken` y
`unsubscribeUrl` (puros).

**Módulos ya instalados** (tickets, etc.) siguen usando `notify()`: cambiarlos a `notifyWithEmail`
es decisión de cada uno y queda fuera de este módulo.

## Garantías (y dónde viven)
- Enlace de baja: HMAC-SHA256 con `BETTER_AUTH_SECRET`, comparación en tiempo constante; solo
  puede desactivar los correos de la persona que nombra (`contracts/token.ts`, `server/unsubscribe/route.ts`).
- La acción de servidor comprueba sesión y permiso antes de validar y escribir, y el id de usuario
  sale de la sesión, nunca del cliente (`server/actions.ts`).
- Cuerpo del correo con HTML escapado y asunto sin saltos de línea (`contracts/mail.ts`).
- Kysely sin SQL concatenado. Pruebas leen el código para comprobar el orden de las guardas.

## Instalar
1. Copiar la carpeta a `modules/notifications-email/` (requiere `notifications` instalado).
2. `pnpm modules:sync` (registros, shim de `/settings/notifications` y de `/notifications/unsubscribe`).
3. `pnpm db:migrate`.
4. Configurar `RESEND_API_KEY`, `EMAIL_FROM` (dominio verificado) y `BETTER_AUTH_SECRET`.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `can-remove notifications-email`, revertir
`0108_notifications_email_init` (se pierden las preferencias; los correos vuelven a «activados»
si se reinstala) y `pnpm modules:sync`. Si otro módulo llama a `notifyWithEmail`, se quita antes.

## Límites conocidos (v0.1)
- Los correos no son transaccionales por lote: uno por aviso, sin resumen diario ni agrupación.
- El envío del piso no admite cabeceras, así que no se agrega `List-Unsubscribe` (solo el enlace en
  el cuerpo). El `POST` del route handler queda listo para cuando exista.
- La baja es por GET con un clic, como pide el encargo: un escáner de enlaces del correo podría
  activarla sin querer. Se vuelve a activar en `/settings/notifications`.
- No se comprueba `emailVerified`: se escribe a la dirección registrada.
- Un solo canal por aviso: no hay preferencias por tipo de aviso, solo activado o no.
- El enlace de baja no caduca y no se puede revocar sin cambiar `BETTER_AUTH_SECRET`.
- El texto del correo es el título, cuerpo y enlace del aviso, en el idioma de quien lo escribió
  (notifications guarda texto literal); solo el pie va traducido.

## Pruebas
`tests/notifications-email.test.ts` (`node:test`, lógica pura, ejecutada transpilada): firma y
verificación del token, cuerpo del correo, decisión de envío con dependencias falsas (activado,
desactivado, sin proveedor, sin secreto, sin usuario, fallo), paridad `es`/`en`, permisos,
manifiesto y guardas leyendo el código. **Sin probar contra base ni con Resend real**: la
migración, `server/store.ts`, `server/api.ts` (el cableado real), la página, el formulario y
el route handler no se ejecutaron.

## Qué NO toca
Ningún archivo ancla, zona protegida ni otro módulo. Importa solo `@/modules/notifications/contracts`
y `@/modules/i18n/contracts*`, más el piso (`@/server/email/send`, `@/lib/site`).
