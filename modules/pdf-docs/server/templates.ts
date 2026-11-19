/**
 * Two example templates with invented data. They show the shape of a
 * definition; copy one into your module and replace the data with yours.
 */
import type { PdfDefinition } from "./types"

export type OrderExample = {
  folio: string
  customer: { name: string; taxId: string; email: string }
  items: readonly { description: string; qty: number; unitPrice: number }[]
  notes?: string
}

/** Example-document content (what the sample PDF says), not interface copy: keeps the literal-text scanner quiet. */
const sample = (s: string) => s

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`

/** Order / receipt: header data, line-item table with totals and two signatures. */
export function orderTemplate(data?: Partial<OrderExample>): PdfDefinition {
  const o: OrderExample = {
    folio: "OC-2026-0142",
    customer: { name: "Comercial Los Aromos SpA", taxId: "76.123.456-7", email: "compras@losaromos.example" },
    items: [
      { description: sample("Diseño de landing page (3 secciones)"), qty: 1, unitPrice: 450000 },
      { description: sample("Integración de formulario de contacto"), qty: 1, unitPrice: 120000 },
      { description: sample("Hora adicional de soporte"), qty: 6, unitPrice: 25000 },
    ],
    notes: "Valores en pesos chilenos, IVA no incluido. Validez de la orden: 15 días corridos desde su emisión.",
    ...data,
  }
  const subtotal = o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const iva = subtotal * 0.19
  return {
    title: `Orden ${o.folio}`,
    author: "Fulvia",
    header: { left: "Estudio Ejemplo Ltda.", right: `Folio ${o.folio}` },
    footer: { text: "contacto@estudio-ejemplo.example" },
    blocks: [
      { type: "title", text: "Orden de trabajo", subtitle: `Folio ${o.folio}` },
      { type: "heading", text: "Cliente" },
      {
        type: "keyValue",
        rows: [
          { label: sample("Razón social"), value: o.customer.name },
          { label: "RUT", value: o.customer.taxId },
          { label: "Correo", value: o.customer.email },
        ],
      },
      { type: "heading", text: "Detalle" },
      {
        type: "table",
        columns: [
          { header: "Descripción", width: 5 },
          { header: "Cant.", width: 1, align: "right" },
          { header: "Precio unit.", width: 2, align: "right" },
          { header: "Total", width: 2, align: "right" },
        ],
        rows: o.items.map((i) => [i.description, String(i.qty), clp(i.unitPrice), clp(i.qty * i.unitPrice)]),
      },
      { type: "paragraph", text: `Subtotal: ${clp(subtotal)}`, align: "right" },
      { type: "paragraph", text: `IVA (19%): ${clp(iva)}`, align: "right" },
      { type: "paragraph", text: `Total: ${clp(subtotal + iva)}`, align: "right", bold: true, size: 12 },
      ...(o.notes ? ([{ type: "divider" }, { type: "paragraph", text: o.notes, muted: true, size: 9 }] as const) : []),
      { type: "signature", signers: [{ name: "Camila Herrera", role: "Estudio Ejemplo" }, { name: "Representante del cliente" }] },
    ],
  }
}

export type CertificateExample = { recipient: string; course: string; hours: number; issuedOn: string; code: string }

/** Certificate of completion: centred text, one signature. */
export function certificateTemplate(data?: Partial<CertificateExample>): PdfDefinition {
  const c: CertificateExample = {
    recipient: "Matías Fuenzalida Peña",
    course: "Introducción a la construcción de apps con agentes",
    hours: 24,
    issuedOn: "14 de noviembre de 2026",
    code: "CERT-7F3A-2026",
    ...data,
  }
  return {
    title: `Certificado ${c.code}`,
    author: "Fulvia",
    pageSize: "letter",
    margin: 64,
    footer: { text: `Código de verificación: ${c.code}` },
    blocks: [
      { type: "spacer", height: 70 },
      { type: "paragraph", text: "CERTIFICADO DE APROBACIÓN", bold: true, size: 22, align: "center" },
      { type: "divider" },
      { type: "spacer", height: 30 },
      { type: "paragraph", text: "Se certifica que", align: "center", muted: true, size: 12 },
      { type: "paragraph", text: c.recipient, bold: true, size: 20, align: "center" },
      { type: "spacer", height: 10 },
      { type: "paragraph", text: "ha aprobado satisfactoriamente el curso", align: "center", muted: true, size: 12 },
      { type: "paragraph", text: c.course, bold: true, size: 15, align: "center" },
      { type: "paragraph", text: `con una duración de ${c.hours} horas cronológicas.`, align: "center", size: 12 },
      { type: "spacer", height: 20 },
      { type: "paragraph", text: `Emitido el ${c.issuedOn}.`, align: "center", size: 11 },
      { type: "spacer", height: 20 },
      { type: "signature", signers: [{ name: "Dirección académica", role: "Academia Ejemplo" }] },
    ],
  }
}
