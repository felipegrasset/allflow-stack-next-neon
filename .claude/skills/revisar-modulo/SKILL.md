---
name: revisar-modulo
description: Revisa el PR o la rama de un módulo del template (modules/<id>/, kits de UI incluidos) contra el contrato de módulos antes de mergear, y lo deja integrable en main. Usar cuando haya que revisar, auditar o mergear un PR que agrega o cambia un módulo, un kit (kit-*) o la galería /kits.
---

# Revisar un módulo (contrato T1) y dejarlo mergeable

Lo que se verifica se **ejecuta**; lo demás se declara «razonado». Nunca afirmes
un resultado que no corriste. `pnpm`, nunca `npm`. Nada de migraciones contra una
base real: van como archivo. Mergear solo si el usuario lo pidió.

## 1 · Alcance del diff (¿toca lo que no debe?)

```
git fetch origin
git diff --name-only origin/main...HEAD
pnpm modules:guard --base origin/main
```
- Ningún archivo en `components/ui/**` ni `server/auth/**` (salvo PR con la etiqueta `zonas-protegidas-ok`).
- Un módulo **no** edita las anclas de la génesis: `server/db/migrate.ts`, `server/db/schema/index.ts`,
  `server/db/seed.ts`, `config/nav.ts`, `lib/permissions.ts`. Se registra con `manifest.json` + `pnpm modules:sync`.
- Un kit no toca `modules/kit-core/**` (si lo toca, es un PR de núcleo y va aparte).
- Si el brief no nombra un archivo que había que tocar, anótalo en el PR.

## 2 · Contrato

```
pnpm modules:sync && git status --short modules/_generated app   # debe quedar sin cambios nuevos
pnpm modules:check
pnpm test:modules
```
Reglas que el validador ya aplica: id kebab = carpeta; tablas con prefijo del id; migraciones `NNNN_<id>` con
NNNN ≥ 0100, archivo presente y números únicos; imports de otros módulos solo por `contracts/`; sin hex literales
en tsx/css; `MODULE.md` presente. Si el módulo trae migraciones: revisa que `down` revierta lo que `up` crea y que el
seed sea idempotente (esto es lectura, no ejecución).

## 3 · Calidad

```
rm -rf .next && pnpm tsc --noEmit      # un .next viejo de otra rama rompe tsc: borrarlo siempre
pnpm lint                              # en el template es `eslint`, no interactivo
pnpm test:i18n                         # literales visibles: declarar los pendientes con motivo
pnpm test:kits                         # kits y galería
```
- Una prueba nueva **tiene que poder fallar**: rompe la invariante una vez (quita una entrada, cambia un valor),
  confirma que da rojo, y restáurala.
- Tras `pnpm install` de una rama nueva, vuelve a instalar si `package.json` cambió (p. ej. `next-intl`).

## 4 · Kits de UI (`modules/kit-*`)

```
pnpm build && pnpm test:kits:e2e       # axe WCAG 2.2 AA, claro/oscuro, 1280 y 375 px, sin desborde
```
Revisa además: `rubrica.json` ≥ 13/16 sin ningún 0 (la parte humana la confirma una persona mirando
`test-results/kit-shots/`); `MODULE.md` con Referentes, Licencia y origen, Cómo se usa; solo `kit-core/contracts`;
re-tema solo con `--brand-h/--brand-c` (un hijo que cambia `--brand-h` necesita `KitTheme`).
Trampas conocidas:
- `display: grid` sin `grid-template-columns` crea una pista implícita que se ensancha con el contenido: en Linux/CI
  desborda unos píxeles aunque en macOS pase. Usa `grid-template-columns: minmax(0, 1fr)`.
- `{...p}` después de los defaults en los componentes de estado pisa los defaults.
- `font-family` solo como `var(--font-xxx)` sin dígitos.
- Un kit nuevo debe estar en `modules/kits-galeria/ui/catalogo.ts` (la prueba falla si no).

## 5 · Dejarlo integrable

- Un PR por tarea, descripción en español, con «Verificado» (corrido) separado de «Razonado» y la lista de pendientes.
- PR apilado sobre otra rama: al mergear la base, **reapunta a `main`** (`gh pr edit N --base main`).
- Conflictos entre módulos: casi siempre `package.json`, `ci.yml` o `modules/_generated/*`. Fusiona `main` en la rama,
  conserva las líneas de ambos lados, corre `pnpm modules:sync` y vuelve a probar. Nunca resuelvas `_generated` a mano.
- El CI corre dos veces (push y pull_request): si solo una falla con «Can't resolve … font/google», es la descarga de
  Google Fonts; reintenta (`gh run rerun <id> --failed`). Cualquier otro rojo es real: léelo (`gh run view --job <id> --log-failed`).
- Orden de merge: contrato → i18n → notificaciones → núcleo de kits → lotes de kits; un PR que depende de otro va después.
- Usa merge commit (`gh pr merge N --merge`): con squash los PR apilados vuelven a chocar.

## 6 · Lo que esta revisión NO cubre (decláralo siempre)

Migraciones y seeds contra una base real (CI corre `pnpm db:migrate`; local no hay Postgres), la génesis con módulos
instalados (`genesis:ci` en allflow.biz), la originalidad y licencias de un kit frente a sus referentes, y la parte humana
de la rúbrica.
