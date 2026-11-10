export const clp = (n: number) => `$${n.toLocaleString("es-CL")}`

export const copy = {
  brand: "Atelier de Papel",
  links: [
    { label: "Colecciones", href: "#colecciones" },
    { label: "Tienda", href: "#tienda" },
    { label: "Lookbook", href: "#lookbook" },
    { label: "Boletín", href: "#boletin" },
  ],
  hero: {
    eyebrow: "Colección otoño · 2026",
    title: "Prendas lentas para días largos",
    text: "Lino, lana y algodón orgánico, cortados en Santiago en series cortas. Hechos para durar más que una temporada.",
    cta: "Ver la colección",
    ghost: "Leer el lookbook",
  },
  collections: [
    { name: "Lino de otoño", count: "12 piezas", variant: 0 },
    { name: "Lana ligera", count: "8 piezas", variant: 1 },
    { name: "Básicos de siempre", count: "15 piezas", variant: 2 },
  ],
  products: [
    { name: "Camisa Alba", mat: "Lino lavado", price: 69900, variant: 0 },
    {
      name: "Pantalón Sena",
      mat: "Algodón orgánico",
      price: 74900,
      variant: 1,
    },
    { name: "Chaleco Isla", mat: "Lana merino", price: 89900, variant: 2 },
    { name: "Vestido Brisa", mat: "Lino y viscosa", price: 94900, variant: 3 },
    { name: "Bufanda Nube", mat: "Lana de alpaca", price: 39900, variant: 4 },
    { name: "Bolso Arco", mat: "Lona encerada", price: 54900, variant: 5 },
  ],
  detail: {
    name: "Camisa Alba",
    price: 69900,
    desc: "Corte recto y cuello suave. El lino se lava antes de coser, así que no cambia de talla después de la primera lavada.",
    sizes: ["XS", "S", "M", "L", "XL"],
    notes: [
      "Lino 100 % europeo",
      "Cosida en Santiago",
      "Cambios gratis por 30 días",
    ],
  },
  cart: {
    title: "Tu bolsa",
    lines: [
      ["Camisa Alba · M", 69900],
      ["Bufanda Nube", 39900],
    ] as [string, number][],
  },
  lookbook: [
    "Mañanas frías en el puerto: capas finas y colores de piedra.",
    "Taller abierto: camisas con las mangas arremangadas y delantal de lona.",
    "Domingo de feria: lino, canasto y sombrero de ala ancha.",
  ],
  newsletter: {
    title: "Una carta al mes",
    text: "Colecciones nuevas, historias del taller y un 10 % para tu primera compra.",
    button: "Suscribirme",
  },
}
