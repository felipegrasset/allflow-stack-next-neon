export const copy = {
  brand: "Contraste",
  links: [
    { label: "Servicios", href: "#servicios" },
    { label: "Casos", href: "#casos" },
    { label: "Proceso", href: "#proceso" },
    { label: "Precios", href: "#precios" },
  ],
  hero: {
    eyebrow: "Estudio de marca y web · Valparaíso",
    title: "Diseñamos lo que se nota.",
    text: "Marcas y sitios con carácter para negocios que no quieren parecerse a nadie. Un equipo chico, directo y con fecha de entrega.",
    cta: "Cotizar mi proyecto",
    ghost: "Ver casos",
  },
  services: [
    [
      "Identidad de marca",
      "Nombre, logo, color y tono. Un sistema que puedes usar solo.",
    ],
    [
      "Sitio web",
      "Rápido, accesible y fácil de editar. Con textos que venden.",
    ],
    ["Campañas", "Piezas para redes y avisos que se leen en un vistazo."],
    [
      "Packaging",
      "Etiquetas y cajas que se ven bien en la góndola y en la foto.",
    ],
  ] as [string, string][],
  cases: [
    {
      name: "Café Marea",
      result: "+38 % de ventas en el primer trimestre",
      kind: "Identidad y web",
    },
    {
      name: "Taller Ñire",
      result: "De cero a 1.200 seguidores en tres meses",
      kind: "Campaña",
    },
    {
      name: "Ferretería Sur",
      result: "Sitio con catálogo y 5 veces más cotizaciones",
      kind: "Sitio web",
    },
  ],
  steps: [
    ["Conversamos", "Una hora para entender tu negocio y tu meta."],
    ["Proponemos", "Dirección creativa y presupuesto cerrado en una semana."],
    ["Construimos", "Avances cada viernes. Tú opinas, nosotros ajustamos."],
    ["Entregamos", "Archivos, guía de uso y una charla para tu equipo."],
  ] as [string, string][],
  team: [
    ["Valentina Mora", "Dirección creativa"],
    ["Tomás Ibáñez", "Diseño web"],
    ["Fernanda Lagos", "Estrategia y textos"],
  ] as [string, string][],
  plans: [
    {
      name: "Esencial",
      price: "$690.000",
      items: ["Logo y paleta", "Guía de una página", "2 rondas de ajustes"],
    },
    {
      name: "Completo",
      price: "$1.890.000",
      items: [
        "Identidad completa",
        "Sitio de 5 secciones",
        "Piezas para redes",
        "4 rondas de ajustes",
      ],
      featured: true,
    },
    {
      name: "A medida",
      price: "Cotiza",
      items: ["Para proyectos grandes", "Equipo dedicado", "Plan mensual"],
    },
  ],
  quotes: [
    [
      "Nos entendieron en la primera reunión. El resultado fue exactamente lo que no sabíamos explicar.",
      "Pablo, Café Marea",
    ],
    [
      "Cumplieron las fechas, algo raro en este rubro. Y el sitio se ve increíble en el celular.",
      "Isidora, Taller Ñire",
    ],
  ] as [string, string][],
  form: {
    title: "Cuéntanos tu proyecto",
    button: "Enviar y recibir propuesta",
    note: "Respondemos en un día hábil.",
  },
  cta: "¿Hablamos esta semana?",
}
