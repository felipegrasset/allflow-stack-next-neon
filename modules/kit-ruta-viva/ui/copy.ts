/** Textos y datos de muestra del kit Ruta Viva (literales hasta el módulo i18n, T4). */
export type Order = {
  code: string
  client: string
  address: string
  step: number
  late?: boolean
}
export type Route = {
  id: string
  name: string
  driver: string
  orders: Order[]
}

export const copy = {
  brand: "Ruta Viva",
  links: [
    { label: "Rutas", href: "#rutas" },
    { label: "Zonas", href: "#zonas" },
    { label: "Escaneo", href: "#escaneo" },
    { label: "Incidencias", href: "#incidencias" },
  ],
  headerAction: "Nueva ruta",
  eyebrow: "Martes 10 de noviembre · turno de mañana",
  title: "Operación del día",
  lead: "Veintiséis pedidos en calle. Dos van atrasados y una zona está al límite.",
  kpis: [
    { label: "Entregas hoy", value: "142", note: "de 168 programadas" },
    { label: "A tiempo", value: "91 %", note: "meta 90 %" },
    { label: "En calle ahora", value: "26", note: "pedidos" },
    { label: "Incidencias", value: "3", note: "1 sin resolver" },
  ],
  routesTitle: "Rutas en curso",
  routeLabel: "Elegir ruta",
  steps: ["Recibido", "Preparado", "En camino", "Entregado"],
  timelineTitle: "Seguimiento del pedido",
  late: "Atrasado",
  routes: [
    {
      id: "r1",
      name: "Ruta 1 · Providencia",
      driver: "Marco Valdés",
      orders: [
        {
          code: "RV-1042",
          client: "Café Lonquén",
          address: "Av. Holanda 1280",
          step: 2,
        },
        {
          code: "RV-1043",
          client: "Librería Austral",
          address: "Seminario 94",
          step: 2,
          late: true,
        },
        {
          code: "RV-1047",
          client: "Clínica Sereno",
          address: "Los Leones 410",
          step: 1,
        },
      ],
    },
    {
      id: "r2",
      name: "Ruta 2 · Ñuñoa",
      driver: "Daniela Soto",
      orders: [
        {
          code: "RV-1051",
          client: "Vivero El Canelo",
          address: "Irarrázaval 3320",
          step: 3,
        },
        {
          code: "RV-1052",
          client: "Panadería Los Aromos",
          address: "Pedro de Valdivia 2210",
          step: 2,
        },
      ],
    },
    {
      id: "r3",
      name: "Ruta 3 · Maipú",
      driver: "Iván Rojas",
      orders: [
        {
          code: "RV-1060",
          client: "Taller Norte",
          address: "Pajaritos 1850",
          step: 2,
          late: true,
        },
        {
          code: "RV-1061",
          client: "Ferretería Central",
          address: "Camino a Rinconada 640",
          step: 0,
        },
      ],
    },
  ] satisfies Route[],
  zonesTitle: "Mapa de zonas",
  zonesLead:
    "Maqueta de la ciudad por cuadrantes: el tono y el número muestran la carga de cada zona.",
  zones: [
    { id: "A", name: "Norte", n: 5, load: "low" },
    { id: "B", name: "Centro", n: 14, load: "high" },
    { id: "C", name: "Oriente", n: 9, load: "mid" },
    { id: "D", name: "Poniente", n: 4, load: "low" },
    { id: "E", name: "Sur", n: 11, load: "mid" },
    { id: "F", name: "Sur oriente", n: 3, load: "low" },
  ],
  loadLabel: { low: "Carga baja", mid: "Carga media", high: "Carga alta" },
  zoneUnit: (n: number) => (n === 1 ? "1 pedido" : `${n} pedidos`),
  drivers: {
    title: "Repartidores",
    list: [
      { name: "Marco Valdés", st: "route", detail: "Ruta 1 · 3 pedidos" },
      { name: "Daniela Soto", st: "route", detail: "Ruta 2 · 2 pedidos" },
      { name: "Iván Rojas", st: "route", detail: "Ruta 3 · 2 pedidos" },
      { name: "Paula Cea", st: "free", detail: "Disponible en bodega" },
      {
        name: "Nicolás Fuentes",
        st: "break",
        detail: "Colación hasta las 14:00",
      },
    ],
    label: { route: "En ruta", free: "Disponible", break: "En pausa" },
  },
  scan: {
    title: "Escanear un pedido",
    lead: "Escribe o pega el código de la etiqueta. Prueba con RV-1042.",
    label: "Código del pedido",
    cta: "Registrar entrega",
    okTitle: "Entrega registrada",
    okText: (c: string) => `El pedido ${c} quedó como entregado.`,
    badTitle: "No encontramos ese código",
    badText: "Revisa la etiqueta e inténtalo de nuevo.",
    retry: "Escribir otro código",
    known: [
      "RV-1042",
      "RV-1043",
      "RV-1047",
      "RV-1051",
      "RV-1052",
      "RV-1060",
      "RV-1061",
    ],
  },
  incidents: {
    title: "Incidencias",
    list: [
      {
        t: "Cliente ausente en Seminario 94",
        who: "Marco Valdés",
        sev: "warn",
        when: "hace 12 min",
      },
      {
        t: "Camión de Maipú con falla de frío",
        who: "Iván Rojas",
        sev: "danger",
        when: "hace 40 min",
      },
      {
        t: "Dirección corregida en Irarrázaval",
        who: "Daniela Soto",
        sev: "ok",
        when: "hace 1 h",
      },
    ],
    sev: { warn: "Atención", danger: "Urgente", ok: "Resuelta" },
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve la central cuando el día aún no parte o algo se cae.",
    empty: {
      title: "No hay rutas programadas",
      description: "Crea la primera ruta del turno.",
      action: "Nueva ruta",
    },
    loading: "Cargando las rutas",
    error: {
      title: "No pudimos cargar las rutas",
      description: "Se perdió la señal con el servidor.",
    },
    success: {
      title: "Ruta despachada",
      description: "Marco ya la tiene en su teléfono.",
      action: "Ver la ruta",
    },
    forbidden: {
      title: "Solo la central puede reasignar",
      description: "Pide el cambio a quien coordina el turno.",
      action: "Volver a las rutas",
    },
    noResults: {
      title: "Ese código no está en el turno",
      description: "Revisa el código o cambia de ruta.",
    },
    offline: {
      title: "Sin conexión en la ruta",
      description: "Las entregas se guardan y se envían al recuperar señal.",
    },
    partial: {
      issues: [
        "El mapa de tráfico no respondió",
        "Dos posiciones de GPS tienen 10 minutos de atraso",
      ],
    },
  },
  footer: {
    tagline: "La central de reparto, en una pantalla.",
    columns: [
      {
        title: "Operación",
        links: [
          { label: "Rutas", href: "#rutas" },
          { label: "Zonas", href: "#zonas" },
        ],
      },
      {
        title: "Control",
        links: [
          { label: "Escaneo", href: "#escaneo" },
          { label: "Incidencias", href: "#incidencias" },
        ],
      },
    ],
  },
}
