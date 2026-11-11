/** Textos y datos de muestra del kit Taller Claro (literales hasta el módulo i18n, T4). */
export type Deal = {
  id: string
  name: string
  company: string
  value: number
  stage: string
  contact: string
}
export type Contact = {
  id: string
  name: string
  company: string
  role: string
  mail: string
  phone: string
  last: string
}

export const copy = {
  brand: "Taller",
  links: [
    { label: "Pipeline", href: "#pipeline" },
    { label: "Contactos", href: "#contactos" },
    { label: "Tareas", href: "#tareas" },
    { label: "Importar", href: "#importar" },
  ],
  newDeal: "Nuevo trato",
  eyebrow: "Noviembre · semana 46",
  title: "Pipeline de ventas",
  lead: "Seis tratos abiertos suman $ 18,4 M. Dos necesitan seguimiento hoy.",
  stages: [
    { id: "new", name: "Nuevo" },
    { id: "talk", name: "En conversación" },
    { id: "offer", name: "Propuesta enviada" },
    { id: "won", name: "Ganado" },
  ],
  moveLabel: (n: string) => `Mover «${n}» a otra etapa`,
  emptyStage: "Sin tratos en esta etapa",
  deals: [
    {
      id: "t1",
      name: "Rediseño de bodega",
      company: "Frutas del Sur",
      value: 4200000,
      stage: "new",
      contact: "k1",
    },
    {
      id: "t2",
      name: "Mantención anual",
      company: "Taller Norte",
      value: 2800000,
      stage: "talk",
      contact: "k2",
    },
    {
      id: "t3",
      name: "Software de reservas",
      company: "Clínica Sereno",
      value: 6500000,
      stage: "offer",
      contact: "k3",
    },
    {
      id: "t4",
      name: "Capacitación de equipo",
      company: "Librería Austral",
      value: 1500000,
      stage: "talk",
      contact: "k4",
    },
    {
      id: "t5",
      name: "Sitio y catálogo",
      company: "Vivero El Canelo",
      value: 3400000,
      stage: "won",
      contact: "k5",
    },
    {
      id: "t6",
      name: "Auditoría de procesos",
      company: "Panadería Los Aromos",
      value: 2900000,
      stage: "offer",
      contact: "k1",
    },
  ] satisfies Deal[],
  contacts: [
    {
      id: "k1",
      name: "Camila Rojas",
      company: "Panadería Los Aromos",
      role: "Dueña",
      mail: "camila@aromos.example",
      phone: "+56 9 5555 0101",
      last: "hace 2 días",
    },
    {
      id: "k2",
      name: "Diego Salinas",
      company: "Taller Norte",
      role: "Gerente",
      mail: "diego@tallernorte.example",
      phone: "+56 9 5555 0102",
      last: "ayer",
    },
    {
      id: "k3",
      name: "Valentina Pérez",
      company: "Clínica Sereno",
      role: "Administradora",
      mail: "valentina@sereno.example",
      phone: "+56 9 5555 0103",
      last: "hoy",
    },
    {
      id: "k4",
      name: "Matías Soto",
      company: "Librería Austral",
      role: "Encargado de compras",
      mail: "matias@austral.example",
      phone: "+56 9 5555 0104",
      last: "hace 5 días",
    },
    {
      id: "k5",
      name: "Tomás Araya",
      company: "Vivero El Canelo",
      role: "Dueño",
      mail: "tomas@canelo.example",
      phone: "+56 9 5555 0105",
      last: "hace 1 semana",
    },
  ] satisfies Contact[],
  contactsTitle: "Contactos",
  contactLabel: "Contacto",
  detail: {
    mail: "Correo",
    phone: "Teléfono",
    last: "Último contacto",
    deals: "Tratos abiertos",
    none: "Sin tratos abiertos",
  },
  tasks: {
    title: "Tareas de hoy",
    items: [
      { id: "s1", text: "Llamar a Valentina por la propuesta", done: false },
      { id: "s2", text: "Enviar contrato a Tomás", done: true },
      { id: "s3", text: "Agendar visita al taller de Diego", done: false },
    ],
    add: "Agregar tarea",
    placeholder: "Nueva tarea",
    left: (n: number) => (n === 1 ? "Queda 1 tarea" : `Quedan ${n} tareas`),
    clear: "¡Todo al día!",
  },
  activity: {
    title: "Actividad reciente",
    items: [
      {
        who: "Ignacia",
        what: "movió «Sitio y catálogo» a Ganado",
        when: "hace 1 h",
      },
      {
        who: "Pablo",
        what: "agregó una nota a Taller Norte",
        when: "hace 3 h",
      },
      {
        who: "Ignacia",
        what: "envió la propuesta a Clínica Sereno",
        when: "ayer",
      },
    ],
  },
  week: {
    title: "Esta semana",
    days: [
      { d: "Lun", n: 9, e: 1 },
      { d: "Mar", n: 10, e: 3, today: true },
      { d: "Mié", n: 11, e: 0 },
      { d: "Jue", n: 12, e: 2 },
      { d: "Vie", n: 13, e: 1 },
    ],
    events: (n: number) =>
      n === 0 ? "libre" : n === 1 ? "1 cita" : `${n} citas`,
  },
  import: {
    title: "Importar contactos",
    lead: "Sube un archivo CSV con nombre, empresa y correo. Revisamos antes de guardar.",
    label: "Elegir un archivo CSV",
    help: "Hasta 5.000 filas. Descarga la plantilla para ver las columnas.",
    template: "Descargar la plantilla",
    chosen: (n: string) => `Archivo elegido: ${n}`,
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve el equipo cuando el CRM aún está vacío o algo falla.",
    empty: {
      title: "Aún no hay contactos",
      description: "Importa un CSV o crea el primero.",
      action: "Importar contactos",
    },
    loading: "Cargando el pipeline",
    error: {
      title: "No pudimos cargar los tratos",
      description: "Reintenta; tus cambios no se perdieron.",
    },
    success: {
      title: "42 contactos importados",
      description: "2 filas tenían el correo repetido y se omitieron.",
      action: "Ver los contactos",
    },
    forbidden: {
      title: "Solo el equipo comercial",
      description: "Pide acceso a la administradora del taller.",
      action: "Volver al pipeline",
    },
    noResults: {
      title: "Sin tratos con ese filtro",
      description: "Prueba con otra etapa o quita el filtro.",
    },
    offline: {
      title: "Sin conexión",
      description: "Los cambios se enviarán al volver la red.",
    },
    partial: {
      issues: [
        "El calendario no respondió",
        "Las notas de voz están en proceso",
      ],
    },
  },
  footer: {
    tagline: "Un CRM liviano para quien vende a mano.",
    columns: [
      {
        title: "Ventas",
        links: [
          { label: "Pipeline", href: "#pipeline" },
          { label: "Tareas", href: "#tareas" },
        ],
      },
      {
        title: "Datos",
        links: [
          { label: "Contactos", href: "#contactos" },
          { label: "Importar", href: "#importar" },
        ],
      },
    ],
  },
}
