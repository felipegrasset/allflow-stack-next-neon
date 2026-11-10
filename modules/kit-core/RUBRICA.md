# Rúbrica de un kit de UI

Fuente: `docs/PLAN-TEMPLATES-FULVIA.md` §5.5 (allflow.biz). Ocho puntos, **0, 1 o 2**
cada uno. **Entra a la galería con 13 de 16 o más y ningún 0**, medido por
separado a **1280 px** y a **375 px**. Además: original, sin material de terceros
y re-tematizable cambiando solo `--brand-h` / `--brand-c`.

## Los ocho puntos

| #   | Clave en `rubrica.json` | 0                                                      | 1                                           | 2                                                                          | Cómo se mide                                                                           |
| --- | ----------------------- | ------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `jerarquia`             | Todo pesa igual; no se sabe qué leer primero           | Hay un foco, pero compite con otro          | Un foco claro por pantalla, el resto lo acompaña                           | Revisión humana sobre la captura                                                       |
| 2   | `espacio`               | Apretado o con huecos sin criterio                     | Ritmo irregular en alguna sección           | Ritmo constante con la escala `--kit-space-*`, aire donde se respira       | Revisión; auto: sin `px` sueltos en los márgenes del kit                               |
| 3   | `escala_tipografica`    | Tamaños arbitrarios o más de 3 familias                | Escala, pero con saltos sueltos             | Solo `--kit-text-*` y `.kit-h1..h3/.kit-lead`; fuentes de las 9 abiertas   | **Auto** (`checkKitFiles`: fuentes) + revisión                                         |
| 4   | `imagen`                | Imagen genérica, deformada o ausente donde hacía falta | Correcta pero sin relación con el contenido | Con propósito, recortada con criterio, con `alt`, sin material de terceros | Revisión; el origen va en `## Licencia y origen`                                       |
| 5   | `estados`               | Falta cualquiera de vacío, cargando, error             | Están, pero sin reintento ni salida         | Los 8 estados del núcleo donde corresponden, con su acción                 | Revisión; el núcleo ya los trae                                                        |
| 6   | `movil_primero`         | Se desborda o no se puede usar a 375 px                | Se usa, con ajustes feos                    | Pensado desde 375 px, sin desborde ni toques menores a 44 px               | **Auto** (desborde horizontal, `testing/axe.ts`) + revisión                            |
| 7   | `contraste_aa`          | Falla axe en claro u oscuro                            | Pasa axe, pero sobre fondos al límite       | Pasa axe WCAG 2.2 AA en claro y oscuro en 1280 y 375                       | **Auto** (axe). Un solo fallo de axe = 0                                               |
| 8   | `coherencia_tema`       | Colores o radios propios que no siguen el tema         | Casi todo por tokens                        | Todo por tokens; cambiar `--brand-h/c` re-temática sin tocar nada más      | **Auto** (`checkKitFiles`: colores literales, `oklch` derivado) + prueba de dos marcas |

Los puntos 3, 6, 7 y 8 tienen una parte automática que **puede bajar la nota a 0**
(no puede subirla): si la prueba automática falla, el punto vale 0 aunque la
revisión humana opine otra cosa.

## Cómo se usa

1. Construye el kit como módulo `modules/kit-<nombre>/` (ver `MODULE.md` de `kit-core`).
2. `pnpm test:kits` corre lo automático sobre **todos** los `modules/kit-*`
   (colores literales, paleta de Tailwind, `oklch` derivado de la marca, fuentes,
   uso del núcleo, secciones de `MODULE.md`, `rubrica.json` aprobada).
3. `pnpm test:kits:e2e` (build primero) abre la vista previa de cada kit a 1280 y
   375 px, en claro y oscuro: axe WCAG 2.2 AA, sin desborde horizontal, y guarda
   capturas en `test-results/kit-shots/`.
4. Mira las capturas y puntúa los puntos de revisión humana. Escribe
   `modules/kit-<nombre>/rubrica.json`:

```json
{
  "1280": {
    "jerarquia": 2,
    "espacio": 2,
    "escala_tipografica": 2,
    "imagen": 1,
    "estados": 2,
    "movil_primero": 2,
    "contraste_aa": 2,
    "coherencia_tema": 2
  },
  "375": {
    "jerarquia": 2,
    "espacio": 1,
    "escala_tipografica": 2,
    "imagen": 1,
    "estados": 2,
    "movil_primero": 2,
    "contraste_aa": 2,
    "coherencia_tema": 2
  },
  "revisado": "2026-11-12",
  "notas": "Qué se midió y quién lo revisó."
}
```

5. `scoreKitRubric` (en `testing/checks.ts`) exige 13/16 y ningún 0 en cada ancho;
   `pnpm test:kits` falla si el `rubrica.json` no lo cumple.

## Originalidad (revisión humana, antes del PR)

- No se parece a **más de un** referente de `docs/investigaciones/INV-DISENO-REFERENTES.md`
  en estructura **y** paleta a la vez. Anótalo en `## Referentes` de `MODULE.md`:
  qué se estudió y qué se rehízo.
- Código propio, o MIT / BSD / Apache con su fila en `docs/referentes/LICENCIAS.md`
  y aviso en `## Licencia y origen`. Nada de Envato, Figma gratuito, Dribbble ni Behance.
- Fuentes: solo Geist, Geist Mono, Inter, Manrope, Fraunces, Plus Jakarta Sans,
  Lexend, IBM Plex Sans / Mono, Outfit.
