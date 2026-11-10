/** Textos y datos de muestra del kit Noche de Cifras (literales hasta el módulo i18n, T4). */
export type Range = {
  id: string
  label: string
  axis: string[]
  revenue: number[]
  orders: number[]
  factor: number
}

export const copy = {
  brand: "Noche de Cifras",
  links: [
    { label: "Resumen", href: "#resumen" },
    { label: "Ingresos", href: "#ingresos" },
    { label: "Canales", href: "#canales" },
    { label: "Alertas", href: "#alertas" },
  ],
  headerAction: "Exportar",
  eyebrow: "Panel analítico · datos de muestra",
  title: "Rendimiento comercial",
  lead: "Los ingresos suben 8,4 % y un canal necesita atención. Elige el período para recalcular todo.",
  rangeLabel: "Período",
  ranges: [
    {
      id: "7",
      label: "7 días",
      axis: ["L", "M", "X", "J", "V", "S", "D"],
      revenue: [42, 48, 45, 53, 61, 58, 66],
      orders: [31, 35, 33, 39, 44, 41, 47],
      factor: 1,
    },
    {
      id: "30",
      label: "30 días",
      axis: ["S1", "S2", "S3", "S4"],
      revenue: [290, 318, 341, 372],
      orders: [210, 224, 243, 262],
      factor: 3.5,
    },
    {
      id: "90",
      label: "90 días",
      axis: ["Ago", "Sep", "Oct"],
      revenue: [1090, 1240, 1410],
      orders: [790, 880, 1010],
      factor: 10.8,
    },
  ] satisfies Range[],
  kpis: [
    {
      id: "rev",
      label: "Ingresos",
      unit: "M",
      base: 373,
      trend: [30, 34, 33, 38, 42, 41, 47],
      delta: "+8,4 %",
      up: true,
    },
    {
      id: "ord",
      label: "Pedidos",
      unit: "",
      base: 270,
      trend: [22, 25, 24, 28, 31, 29, 33],
      delta: "+5,1 %",
      up: true,
    },
    {
      id: "tkt",
      label: "Ticket medio",
      unit: "mil",
      base: 138,
      trend: [40, 39, 41, 40, 42, 41, 43],
      delta: "+2,9 %",
      up: true,
    },
    {
      id: "ret",
      label: "Devoluciones",
      unit: "%",
      base: 3.2,
      trend: [20, 22, 21, 26, 28, 30, 34],
      delta: "+0,6 pp",
      up: false,
    },
  ],
  lineTitle: "Ingresos por período",
  lineDesc: (a: string, b: string, n: number) =>
    `Gráfico de línea con ${n} puntos, de ${a} a ${b}.`,
  barsTitle: "Pedidos por período",
  tableTitle: "Canales",
  columns: ["Canal", "Sesiones", "Conversión", "Ingresos", "Cambio"],
  channels: [
    {
      id: "ch1",
      name: "Búsqueda orgánica",
      sessions: 4820,
      conv: 3.8,
      rev: 150,
      change: 6.2,
      note: "El tráfico crece por tres palabras nuevas. La conversión se mantiene.",
    },
    {
      id: "ch2",
      name: "Correo",
      sessions: 2130,
      conv: 6.1,
      rev: 110,
      change: 11.4,
      note: "La campaña del lunes explica casi todo el aumento.",
    },
    {
      id: "ch3",
      name: "Anuncios",
      sessions: 3590,
      conv: 2.2,
      rev: 70,
      change: -7.9,
      note: "Mayor costo por clic desde el jueves. Conviene revisar las audiencias.",
    },
    {
      id: "ch4",
      name: "Referidos",
      sessions: 980,
      conv: 5.4,
      rev: 43,
      change: 2.1,
      note: "Estable. Dos socios aportan el 70 % del canal.",
    },
  ],
  detailTitle: "Detalle del canal",
  detailEmpty: "Elige un canal de la tabla para ver su detalle.",
  stat: { sessions: "Sesiones", conv: "Conversión", rev: "Ingresos" },
  clear: "Quitar la selección",
  alertsTitle: "Alertas",
  alerts: [
    {
      t: "Los anuncios bajaron 7,9 % frente al período anterior",
      sev: "danger",
      when: "hace 2 h",
    },
    {
      t: "La conversión del correo superó la meta de 6 %",
      sev: "ok",
      when: "hoy",
    },
    {
      t: "Faltan datos de tres tiendas de ayer",
      sev: "warn",
      when: "hace 5 h",
    },
  ],
  sev: { danger: "Atención", ok: "Bien", warn: "Datos" },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve quien abre el panel cuando faltan datos o algo falla.",
    empty: {
      title: "Aún no hay datos para este período",
      description: "Cuando lleguen las primeras ventas, aparecerán aquí.",
      action: "Conectar una fuente",
    },
    loading: "Calculando el período",
    error: {
      title: "No pudimos calcular el período",
      description: "La fuente de datos tardó demasiado.",
    },
    success: {
      title: "Informe exportado",
      description: "El archivo quedó en tus descargas.",
      action: "Abrir el informe",
    },
    forbidden: {
      title: "Necesitas acceso a finanzas",
      description: "Pide el permiso a quien administra el panel.",
      action: "Volver al resumen",
    },
    noResults: {
      title: "Ningún canal coincide",
      description: "Cambia el período o el filtro.",
    },
    offline: {
      title: "Sin conexión",
      description: "Mostramos el último cálculo guardado.",
    },
    partial: {
      issues: [
        "Faltan las devoluciones de ayer",
        "El tipo de cambio es de las 09:00",
      ],
    },
  },
  footer: {
    tagline: "Un panel de cifras para leer de noche.",
    columns: [
      {
        title: "Panel",
        links: [
          { label: "Resumen", href: "#resumen" },
          { label: "Ingresos", href: "#ingresos" },
        ],
      },
      {
        title: "Datos",
        links: [
          { label: "Canales", href: "#canales" },
          { label: "Alertas", href: "#alertas" },
        ],
      },
    ],
  },
}
