export const clp = (n: number) => `$${n.toLocaleString("es-CL")}`

export const copy = {
  brand: "unlink",
  profile: {
    name: "Sofía Araya",
    handle: "@sofiaaraya",
    bio: "Diseñadora y mentora. Plantillas, clases y asesorías para quienes recién parten.",
  },
  products: [
    {
      kind: "Plantilla",
      name: "Kit de marca personal",
      desc: "40 plantillas editables para redes.",
      price: 14900,
    },
    {
      kind: "Curso",
      name: "Portafolio en una semana",
      desc: "5 clases en video y una guía.",
      price: 39900,
      badge: "Más vendido",
    },
    {
      kind: "Asesoría",
      name: "Revisión 1:1 de 45 min",
      desc: "Revisamos tu portafolio en vivo.",
      price: 29900,
    },
  ],
  booking: {
    title: "Reserva una asesoría",
    days: ["Lun 17", "Mar 18", "Mié 19"],
    slots: ["10:00", "11:30", "15:00", "16:30"],
  },
  coupon: {
    code: "BIENVENIDA",
    off: "15 % de descuento",
    note: "Válido hasta el 30 de noviembre",
  },
  checkout: {
    lines: [["Portafolio en una semana", 39900]] as [string, number][],
    discount: 5985,
  },
  downloads: [
    ["Kit de marca personal.zip", "48 MB"],
    ["Guía de portafolio.pdf", "3 MB"],
  ] as [string, string][],
  stats: [
    ["Ventas del mes", "$1.284.500"],
    ["Visitas al enlace", "8.420"],
    ["Conversión", "4,6 %"],
  ] as [string, string][],
  clients: [
    ["Camila Rojas", "Portafolio en una semana", "$39.900"],
    ["Diego Pérez", "Kit de marca personal", "$14.900"],
    ["Lucía Torres", "Revisión 1:1", "$29.900"],
  ] as [string, string, string][],
}
