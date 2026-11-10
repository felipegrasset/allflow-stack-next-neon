# <id> — <título>

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`; si falta algo acá, el módulo está mal escrito.

## Qué hace
Una o dos frases. Qué ve la persona y qué problema resuelve.

## Qué expone
- **Rutas:** `/ruta` (quién la ve).
- **Tablas:** `<id>_…` (columnas clave, una línea cada una).
- **Permisos:** recurso `<id>` con acciones `read`, `write`; qué rol recibe cuáles.
- **Navegación / cabecera:** el enlace y/o el contador que agrega.
- **`contracts/`:** tipos y funciones que OTRO módulo puede importar (lo único).

## Props y eventos
Componentes reutilizables que el módulo exporta para las apps (nombre, props, ejemplo de uso de una línea).

## Variables de entorno
Ninguna, o la lista (igual que `env` en el manifiesto).

## Datos de ejemplo
Qué siembra `seed.ts` (idempotente) y cómo se ve vacío.

## Instalar
1. Copiar la carpeta a `modules/<id>/`.
2. `pnpm modules:sync` (valida el manifiesto, escribe `modules/_generated/*` y el shim de cada ruta en `app/`).
3. `pnpm install` si el manifiesto trae `dependencies`; agregar las `env` a `.env`.
4. `pnpm db:migrate` (aplica las migraciones del módulo).

## Desinstalar
1. Revertir las migraciones del módulo **antes** de borrar la carpeta (Kysely falla si una migración ya aplicada desaparece de la lista): `down` de cada una, en orden inverso, y borrar su fila de `kysely_migration`. *(Pendiente: automatizarlo.)*
2. Borrar `modules/<id>/`.
3. `pnpm modules:sync` (quita el shim y el registro).

## Qué NO toca
Ningún archivo ancla ni zona protegida. Si necesitas tocar uno, el contrato está incompleto: avisa en vez de editarlo.
