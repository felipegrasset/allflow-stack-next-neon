export const usd = (n: number) => `US$${n.toFixed(2).replace(".", ",")}`

export const copy = {
  brand: "Cobro",
  links: [
    { label: "Precios", href: "#precios" },
    { label: "Comparar", href: "#comparar" },
    { label: "Pagar", href: "#pagar" },
  ],
  hero: {
    eyebrow: "Precios",
    title: "Un precio claro, sin letra chica",
    text: "Elige el plan que calza contigo. Cambias o cancelas cuando quieras, y los impuestos se calculan antes de pagar.",
  },
  plans: [
    {
      id: "basico",
      name: "Básico",
      monthly: 7,
      yearly: 70,
      blurb: "Para empezar",
      items: ["1 proyecto", "Soporte por correo"],
    },
    {
      id: "pro",
      name: "Pro",
      monthly: 19,
      yearly: 190,
      blurb: "Para trabajar a diario",
      items: ["10 proyectos", "Exportar datos", "Soporte en 24 h"],
      featured: true,
    },
    {
      id: "empresa",
      name: "Empresa",
      monthly: 49,
      yearly: 490,
      blurb: "Para equipos",
      items: ["Proyectos ilimitados", "Roles y permisos", "Soporte dedicado"],
    },
  ],
  features: [
    ["Proyectos", "1", "10", "Ilimitados"],
    ["Personas", "1", "5", "Ilimitadas"],
    ["Exportar datos", "—", "Sí", "Sí"],
    ["Roles y permisos", "—", "—", "Sí"],
    ["Soporte", "Correo", "24 horas", "Dedicado"],
  ] as [string, string, string, string][],
  checkout: {
    plan: "Pro",
    period: "anual",
    price: 190,
    taxRate: 0.19,
    coupon: { code: "BIENVENIDA", off: 0.15 },
    countries: ["Chile", "Argentina", "Colombia", "México", "Perú", "España"],
  },
}
