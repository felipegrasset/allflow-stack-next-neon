export const money = (n: number) => `$${n.toLocaleString("es-CL")}`

export const copy = {
  brand: "Mercadito",
  links: [
    { label: "Categorías", href: "#categorias" },
    { label: "Ofertas", href: "#ofertas" },
    { label: "Reseñas", href: "#resenas" },
  ],
  hero: {
    eyebrow: "Despacho en 40 minutos",
    title: "Lo fresco del barrio, en tu puerta",
    text: "Verduras de la feria, pan del día y comida para tu mascota. Pides en un minuto y llega hoy.",
    placeholder: "Busca palta, pan, arena…",
    search: "Buscar",
    cta: "Ver ofertas de hoy",
  },
  categories: [
    "Frutas y verduras",
    "Carnes y pescado",
    "Lácteos",
    "Panadería",
    "Despensa",
    "Mascotas",
  ],
  products: [
    { name: "Paltas Hass", unit: "1 kg", price: 3490, was: 4290, tag: "−19%" },
    { name: "Pan amasado del día", unit: "6 unidades", price: 2200 },
    { name: "Leche entera", unit: "1 L", price: 1190, tag: "Local" },
    {
      name: "Tomates de feria",
      unit: "1 kg",
      price: 1890,
      was: 2390,
      tag: "−21%",
    },
    { name: "Queso gauda", unit: "250 g", price: 3290 },
    {
      name: "Alimento perro adulto",
      unit: "3 kg",
      price: 11990,
      was: 13490,
      tag: "−11%",
    },
    { name: "Arena sanitaria gato", unit: "5 kg", price: 5490 },
    { name: "Huevos de campo", unit: "12 unidades", price: 3890, tag: "Nuevo" },
  ],
  detail: {
    name: "Paltas Hass",
    unit: "1 kg · 4 a 5 unidades",
    price: 3490,
    was: 4290,
    desc: "Maduras para hoy o para el fin de semana. De huertos de Quillota; las elegimos a mano cada mañana.",
    points: [
      "Sin cámara de frío: llegan del campo",
      "Si una viene mala, te la devolvemos",
      "Retiro en tienda sin costo",
    ],
  },
  cart: {
    title: "Tu pedido",
    lines: [
      ["Paltas Hass · 1 kg", 3490],
      ["Pan amasado · 6 un.", 2200],
      ["Leche entera · 1 L", 1190],
    ] as [string, number][],
    shipping: 990,
  },
  tracking: [
    { label: "Pedido recibido", note: "14:02", done: true },
    { label: "Lo estamos armando", note: "14:10", done: true },
    { label: "En camino con Camila", note: "Llega a las 14:45", done: false },
    { label: "Entregado", note: "", done: false },
  ],
  reviews: [
    {
      who: "Marta, Ñuñoa",
      text: "El pan llegó calentito y la fruta, de verdad fresca. Ya no voy al súper.",
      stars: 5,
    },
    {
      who: "Joaquín, Providencia",
      text: "Pedí a las 13:00 y a las 13:40 tenía todo. El repartidor, muy amable.",
      stars: 5,
    },
    {
      who: "Ana, La Reina",
      text: "Buen precio en comida de perro. Me gustaría más variedad de marcas.",
      stars: 4,
    },
  ],
}
