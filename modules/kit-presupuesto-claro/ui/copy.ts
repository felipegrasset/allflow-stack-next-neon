/** Textos y datos de ejemplo (todo ficticio). Se reemplazan al usar el kit. */

/** Pesos chilenos con punto de miles, sin depender del ICU del servidor. */
export const clp = (n: number) =>
  `$${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`

export type Line = { id: number; desc: string; qty: number; price: number }
export type Status = "borrador" | "enviado" | "aceptado" | "vencido"

export const statusLabel: Record<Status, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  vencido: "Vencido",
}

export const copy = {
  brand: "Cotiza Claro",
  links: [
    { label: "Armar", href: "#armar" },
    { label: "Documento", href: "#documento" },
    { label: "Mis presupuestos", href: "#lista" },
    { label: "Estados", href: "#estados" },
  ],
  hero: {
    eyebrow: "Presupuestos",
    title: "Un presupuesto que se entiende a la primera",
    text: "Arma las líneas, ve el total con descuento e IVA mientras escribes y envía una hoja limpia que tu cliente puede aceptar o discutir sin llamarte.",
    steps: ["Borrador", "Enviado", "Visto", "Aceptado"],
  },
  taxRate: 0.19,
  startLines: [
    { id: 1, desc: "Diseño de identidad (logo y paleta)", qty: 1, price: 450000 },
    { id: 2, desc: "Sitio web de cinco secciones", qty: 1, price: 1200000 },
    { id: 3, desc: "Fotografía de producto", qty: 12, price: 18000 },
    { id: 4, desc: "Mantención mensual", qty: 3, price: 85000 },
  ] as Line[],
  doc: {
    number: "P-0042",
    issuer: "Estudio Ejemplo SpA",
    client: "Panadería La Espiga (cliente de ejemplo)",
    date: "27 de noviembre de 2026",
    valid: "Válido hasta el 11 de diciembre de 2026",
    note: "Los plazos cuentan desde el pago del anticipo del 40 %. Datos de ejemplo: no es una oferta real.",
  },
  list: [
    { id: "P-0042", client: "Panadería La Espiga", total: 2455000, status: "enviado", when: "Enviado hace 2 días" },
    { id: "P-0041", client: "Taller Los Aromos", total: 890000, status: "aceptado", when: "Aceptado el 20 de nov." },
    { id: "P-0040", client: "Ferretería Don Ejemplo", total: 640000, status: "borrador", when: "Editado ayer" },
    { id: "P-0039", client: "Café del Muelle", total: 1320000, status: "vencido", when: "Venció el 15 de nov." },
    { id: "P-0038", client: "Vivero Tres Pinos", total: 410000, status: "aceptado", when: "Aceptado el 9 de nov." },
  ] as { id: string; client: string; total: number; status: Status; when: string }[],
}
