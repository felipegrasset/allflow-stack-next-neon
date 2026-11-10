# ping — módulo de ejemplo

Modelo mínimo del contrato (modules/README.md). No se instala en las apps: vive
en `modules/_examples/` y las pruebas lo copian a `modules/ping/` en una copia
temporal para demostrar que se instala sin tocar archivos ancla.

## Qué hace
Una tabla `ping_pings`, la página `/ping`, un enlace «Ping» y un contador en la cabecera.

## Qué expone
- Tabla `ping_pings` (migración `9000_ping_init`).
- Permiso `ping` (`read`, `write`); el miembro solo lee.
- `contracts/index.ts`: tipo `Ping`. Es lo único que otro módulo puede importar.

## Variables de entorno
Ninguna.

## Instalar / desinstalar
Ver «Instalar» y «Desinstalar» en modules/README.md.
