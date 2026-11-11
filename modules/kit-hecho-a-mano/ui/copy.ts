export const clp = (n: number) => `$${n.toLocaleString("es-CL")}`

export const copy = {
  brand: "hecho a mano",
  links: [
    { label: "Proyectos", href: "#proyectos" },
    { label: "Tienda", href: "#tienda" },
    { label: "Tarifas", href: "#tarifas" },
    { label: "Contacto", href: "#contacto" },
  ],
  hero: {
    tag: "ilustradora · ceramista · Chile",
    title: "Cosas lindas, hechas despacio y con las manos sucias.",
    text: "Soy Ema. Ilustro libros, pinto murales y torneo tazas. Aquí encuentras mi trabajo, mi tienda y cómo encargarme algo.",
    cta: "Ver proyectos",
    ghost: "Escríbeme",
  },
  projects: [
    {
      name: "Libro «El bosque que no dormía»",
      kind: "Ilustración",
      year: "2026",
      variant: 0,
    },
    { name: "Mural café Maleza", kind: "Mural", year: "2025", variant: 1 },
    {
      name: "Serie de tazas Marea",
      kind: "Cerámica",
      year: "2025",
      variant: 2,
    },
    {
      name: "Afiches del festival Brote",
      kind: "Gráfica",
      year: "2024",
      variant: 3,
    },
  ],
  shop: [
    { name: "Taza torneada", price: 18900, variant: 2 },
    { name: "Lámina A4 «Bosque»", price: 9900, variant: 0 },
    { name: "Set de 3 stickers", price: 4500, variant: 3 },
  ],
  about: {
    title: "Sobre mí",
    text: "Estudié diseño y terminé en un taller con barro hasta los codos. Trabajo con tintas, acuarela y arcilla de la zona. Cada pieza sale única, con sus marcas.",
    facts: [
      "Valdivia, desde 2019",
      "Tiradas de máximo 30 piezas",
      "Taller abierto los sábados",
    ],
  },
  rates: [
    {
      name: "Ilustración",
      price: "desde $120.000",
      note: "1 pieza, 2 revisiones",
    },
    { name: "Mural", price: "desde $350.000", note: "por m², con materiales" },
    {
      name: "Encargo de cerámica",
      price: "desde $45.000",
      note: "por pieza, 3 semanas",
    },
  ],
  gallery: [0, 1, 2, 3, 0, 2],
  newsletter: {
    title: "Boletín de taller",
    text: "Un correo al mes con lo que estoy haciendo. Sin spam, lo prometo.",
    button: "Quiero recibirlo",
  },
}
