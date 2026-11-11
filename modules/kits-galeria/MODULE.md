# kits-galeria — galería de kits de UI

> Contrato en texto plano. Una sola página; sin tablas, permisos ni navegación.

## Qué hace

Lista en `/kits` una tarjeta por kit de UI (`modules/kit-*`) y enlaza a su vista
previa `/kits/<nombre>`, agrupados en «Tienda y landing» y «Operación, educación
y comunidad», más el núcleo.

## Qué expone

- **Ruta:** `/kits` (pública, grupo `marketing`).
- **Tablas / permisos / navegación:** ninguno.
- **`ui/catalogo.ts`:** el catálogo (slug, título, descripción por kit).

## Cómo se usa

Al agregar un kit nuevo, agrega su entrada en `ui/catalogo.ts`.
`tests/kits-galeria.test.ts` falla si el catálogo y los `modules/kit-*`
instalados no coinciden (en ambos sentidos).

## Depende de

`kit-core` (encabezado, pie y tokens), solo por `contracts/`.
