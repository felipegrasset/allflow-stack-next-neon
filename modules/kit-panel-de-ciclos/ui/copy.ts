/** Textos del kit Panel de Ciclos (literales hasta que exista el módulo i18n, T4). */
export type Account = {
  id: string
  name: string
  owner: string
  plan: string
  mrr: number
  status: "active" | "risk" | "paused"
  updated: string
}

export const copy = {
  brand: "Ciclos",
  links: [
    { label: "Resumen", href: "#resumen" },
    { label: "Cuentas", href: "#cuentas" },
    { label: "Equipo", href: "#equipo" },
    { label: "Facturación", href: "#facturacion" },
  ],
  invite: "Invitar a alguien",
  cycle: "Ciclo 14 · 3 al 16 de noviembre",
  title: "Resumen del ciclo",
  lead: "Quedan cinco días. Tres cuentas necesitan atención antes del cierre.",
  kpis: [
    {
      label: "Ingreso recurrente",
      value: "$ 4,82 M",
      delta: "+6,2 %",
      up: true,
    },
    { label: "Cuentas activas", value: "128", delta: "+9", up: true },
    { label: "Bajas del ciclo", value: "3", delta: "-2", up: true },
    { label: "Tickets abiertos", value: "17", delta: "+4", up: false },
  ],
  accountsTitle: "Cuentas del ciclo",
  searchLabel: "Buscar una cuenta",
  searchPlaceholder: "Nombre o responsable",
  filters: [
    { id: "all", label: "Todas" },
    { id: "active", label: "Activas" },
    { id: "risk", label: "En riesgo" },
    { id: "paused", label: "Pausadas" },
  ],
  status: { active: "Activa", risk: "En riesgo", paused: "Pausada" },
  columns: ["Cuenta", "Responsable", "Plan", "Ingreso", "Estado"],
  results: (n: number) => (n === 1 ? "1 cuenta" : `${n} cuentas`),
  clearFilters: "Quitar filtros",
  accounts: [
    {
      id: "a1",
      name: "Panadería Los Aromos",
      owner: "Camila Rojas",
      plan: "Equipo",
      mrr: 89000,
      status: "active",
      updated: "hoy",
    },
    {
      id: "a2",
      name: "Taller Norte",
      owner: "Diego Salinas",
      plan: "Pro",
      mrr: 149000,
      status: "risk",
      updated: "ayer",
    },
    {
      id: "a3",
      name: "Clínica Sereno",
      owner: "Valentina Pérez",
      plan: "Pro",
      mrr: 149000,
      status: "active",
      updated: "hoy",
    },
    {
      id: "a4",
      name: "Librería Austral",
      owner: "Matías Soto",
      plan: "Inicio",
      mrr: 29000,
      status: "paused",
      updated: "hace 3 días",
    },
    {
      id: "a5",
      name: "Estudio Contraste",
      owner: "Francisca Mena",
      plan: "Equipo",
      mrr: 89000,
      status: "risk",
      updated: "hace 2 días",
    },
    {
      id: "a6",
      name: "Vivero El Canelo",
      owner: "Tomás Araya",
      plan: "Inicio",
      mrr: 29000,
      status: "active",
      updated: "hoy",
    },
  ] satisfies Account[],
  onboarding: {
    title: "Puesta en marcha",
    done: 3,
    steps: [
      { label: "Crear la cuenta de la empresa", done: true },
      { label: "Invitar al equipo", done: true },
      { label: "Conectar la facturación", done: true },
      { label: "Importar las cuentas desde CSV", done: false },
      { label: "Activar las notificaciones", done: false },
    ],
    cta: "Importar cuentas",
  },
  teamTitle: "Equipo y roles",
  roles: ["Propietaria", "Administrador", "Lector"],
  team: [
    { name: "Marta Vidal", mail: "marta@ciclos.example", role: "Propietaria" },
    {
      name: "Joaquín Reyes",
      mail: "joaquin@ciclos.example",
      role: "Administrador",
    },
    {
      name: "Ignacia Bravo",
      mail: "ignacia@ciclos.example",
      role: "Administrador",
    },
    { name: "Pablo Núñez", mail: "pablo@ciclos.example", role: "Lector" },
  ],
  billing: {
    title: "Facturación",
    plan: "Plan Equipo",
    price: "$ 89.000 al mes",
    next: "Próximo cobro: 16 de noviembre",
    seats: "9 de 15 puestos",
    seatsPct: 60,
    manage: "Administrar plan",
    invoices: [
      { n: "F-0412", d: "16 oct", v: "$ 89.000" },
      { n: "F-0398", d: "16 sep", v: "$ 89.000" },
      { n: "F-0377", d: "16 ago", v: "$ 89.000" },
    ],
  },
  notifications: {
    title: "Notificaciones",
    items: [
      { t: "Taller Norte no ha iniciado sesión en 12 días", when: "hace 1 h" },
      { t: "Importación terminada: 42 cuentas nuevas", when: "ayer" },
      { t: "Joaquín cambió el plan de Estudio Contraste", when: "ayer" },
    ],
    markAll: "Marcar todo como leído",
  },
  states: {
    title: "Hoja de estados",
    lead: "Cada pantalla del panel puede estar vacía, cargando, fallar o quedar a medias. Así se ven.",
    empty: {
      title: "Aún no hay cuentas",
      description: "Importa un CSV o crea la primera a mano.",
      action: "Crear una cuenta",
    },
    loading: "Cargando las cuentas",
    error: {
      title: "No pudimos traer las cuentas",
      description: "El servicio no respondió. Tus datos están a salvo.",
    },
    success: {
      title: "Cuentas importadas",
      description: "42 cuentas nuevas ya están en el ciclo.",
      action: "Ver las cuentas",
    },
    forbidden: {
      title: "Solo propietarias y administradores",
      description: "Pide el rol a Marta Vidal para ver la facturación.",
      action: "Volver al resumen",
    },
    noResults: {
      title: "Ninguna cuenta coincide",
      description: "Prueba con otro nombre o quita el filtro de estado.",
    },
    offline: {
      title: "Sin conexión",
      description: "Guardamos tus cambios y los enviaremos al volver la red.",
    },
    partial: {
      issues: [
        "Los tickets no respondieron: el número puede estar atrasado",
        "El tipo de cambio es del 12 de noviembre",
      ],
    },
  },
  footer: {
    tagline: "El panel de un SaaS, listo para poner tus datos.",
    columns: [
      {
        title: "Panel",
        links: [
          { label: "Resumen", href: "#resumen" },
          { label: "Cuentas", href: "#cuentas" },
        ],
      },
      {
        title: "Administración",
        links: [
          { label: "Equipo", href: "#equipo" },
          { label: "Facturación", href: "#facturacion" },
        ],
      },
    ],
  },
}
