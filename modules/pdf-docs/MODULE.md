# pdf-docs — Documentos PDF (v0.1)

> Contrato en texto plano. Un agente que usa este módulo lee SOLO este archivo y `manifest.json`.

## Qué hace
Genera PDFs desde una definición declarativa: una lista de bloques (título, encabezado de sección, párrafo, tabla clave-valor, tabla con columnas, separador, espacio, firmas). El motor es propio y **no usa ninguna dependencia**: escribe PDF 1.4 a mano (objetos, tabla xref, páginas A4 o carta), texto con Helvetica y Helvetica-Bold en codificación WinAnsi (tildes, ñ, ¿ ¡, €, comillas y guiones tipográficos), salto de línea por ancho con las métricas reales de Helvetica, paginación automática, y encabezado y pie con «Página N de M».

## Qué expone
- **Sin** tablas, rutas, navegación, permisos, seed, `covers` ni textos de interfaz. `dependsOn: ["storage"]`; `dependencies: {}`.
- **`contracts/pdf.ts`** (puro, sirve en servidor y pruebas): `renderPdf(definition): Uint8Array`, `pdfResponse(bytes, { filename?, download?, status? })`, `safePdfName`, `wrapText`, `orderTemplate(data?)`, `certificateTemplate(data?)` y los tipos `PdfDefinition`, `PdfBlock`, `PageSize`, `Align`, `Rgb`.
- **`contracts/index.ts`** (servidor): lo anterior más `savePdf(input)`, que genera (o recibe) el PDF y lo guarda con `saveFile` de `storage/contracts`, solo tipo `application/pdf`, y devuelve el `StorageFile` (`file.url` abre el archivo con control de permisos).
- Ninguna función comprueba sesión ni permiso: lo hace quien la llama.

## Cómo se usa desde otro módulo
```ts
import { renderPdf, pdfResponse, savePdf, type PdfDefinition } from "@/modules/pdf-docs/contracts"

const definition = {
  title: "Orden 42",
  header: { left: "Mi empresa", right: "Folio 42" },
  footer: { text: "contacto@mi-empresa.cl" },          // pageLabel: "Page {page} of {total}" para inglés
  blocks: [
    { type: "title", text: "Orden de trabajo", subtitle: "Folio 42" },
    { type: "keyValue", rows: [{ label: "Cliente", value: "Ana Pérez" }] },
    { type: "table",
      columns: [{ header: "Detalle", width: 4 }, { header: "Total", width: 1, align: "right" }],
      rows: [["Instalación", "$50.000"]] },
    { type: "signature", signers: [{ name: "Ana Pérez", role: "Cliente" }] },
  ],
} satisfies PdfDefinition

// 1) Responder directo desde un route handler (después de comprobar TU permiso)
return pdfResponse(renderPdf(definition), { filename: "orden-42", download: true })

// 2) Guardarlo ligado a un registro
const file = await savePdf({ definition, name: "orden-42", ownerId: session.user.id,
  visibility: "members", entity: "order", entityId: "42" })
```
- Los textos son de quien llama (el motor no trae ninguno salvo el pie por defecto «Página {page} de {total}»): pásalos ya traducidos.
- Opciones del documento: `pageSize` (`"A4"` por defecto, `"letter"`), `margin` (36–120 pt, 50), `accent` (`[r,g,b]` de 0 a 1), `header`, `footer` (o `false`), `title`/`author`/`subject`, `createdAt` (solo se escribe si lo pasas: la salida es determinista).
- Plantillas de ejemplo con datos inventados: `orderTemplate()` (orden con tabla, totales y firmas) y `certificateTemplate()` (carta, texto centrado). Pasa un `Partial` de sus datos para reemplazarlos, o cópialas a tu módulo.
- Tablas: `width` es un peso relativo; el encabezado se repite en cada página; una fila muy alta se reparte entre páginas por líneas.

## Variables de entorno
Ninguna.

## Instalar
Copiar la carpeta a `modules/pdf-docs/` (con `storage` instalado) y `pnpm modules:sync`. Sin `pnpm install`, sin migraciones.

## Desinstalar
Sin tablas: `pnpm tsx scripts/modules.ts can-remove pdf-docs`, borrar la carpeta y `pnpm modules:sync`. Los PDFs ya guardados siguen en `storage`.

## Límites conocidos (v0.1)
- **Sin imágenes ni logos** y **sin fuentes incrustadas**: solo Helvetica y Helvetica-Bold (fuentes estándar que todo lector trae). Sin cursiva.
- Caracteres fuera de WinAnsi (por ejemplo CJK, emoji, cirílico) salen como `?`.
- Sin compresión de streams (los archivos pesan más de lo necesario) y sin PDF/A, firma digital, enlaces ni marcadores.
- Una celda de tabla no mezcla negrita y normal; sin colores por celda ni celdas combinadas.
- Sin justificado; el salto de línea es por palabras (una palabra más ancha que la línea se corta por caracteres).
- Tope de 500 páginas (lanza error). Todo se arma en memoria.
- Encabezado y pie ocupan márgenes fijos; el contenido nunca los invade, pero no hay control fino.

## Pruebas
`tests/pdf-docs.test.ts` (`node:test`, sin base ni Next): empieza con `%PDF-` y termina con `%%EOF`; la xref apunta al desplazamiento real de cada objeto; `/Length` exacto; tildes y ñ en WinAnsi; `( ) \` escapados; métricas conocidas de Helvetica; salto de línea y corte de palabras; paginación (N páginas, «Página i de N», `/Count`); tabla larga con encabezado repetido; fila gigante; todos los bloques; plantillas; respuesta HTTP y nombre de archivo; manifiesto. Las dos plantillas se validaron además a mano con `qpdf --check`, `pdftotext` y Ghostscript. Sin probar: `savePdf` (requiere base y proveedor de `storage`) y la apertura en Acrobat, Preview o navegadores.

## Qué NO toca
Ningún archivo ancla ni zona protegida.
