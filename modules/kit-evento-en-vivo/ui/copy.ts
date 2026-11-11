/** Textos y datos de muestra del kit Evento en Vivo (literales hasta el módulo i18n, T4). */
export const copy = {
  brand: "Encuentro Fulvia",
  links: [
    { label: "Agenda", href: "#agenda" },
    { label: "Ponentes", href: "#ponentes" },
    { label: "Registro", href: "#registro" },
    { label: "Comunidad", href: "#comunidad" },
  ],
  headerAction: "Registrarme",
  eyebrow: "Evento en línea y gratuito · 24 y 25 de noviembre",
  title: "Dos días para aprender a trabajar con agentes",
  lead: "Charlas cortas, talleres y una comunidad que responde. Transmisión en vivo con subtítulos y grabación para quienes se registren.",
  countdown: {
    label: "Comienza en",
    parts: [
      { n: "14", u: "días" },
      { n: "05", u: "horas" },
      { n: "32", u: "min" },
    ],
    aria: "Faltan 14 días, 5 horas y 32 minutos",
  },
  agendaTitle: "Agenda",
  days: [
    {
      id: "d1",
      label: "Martes 24",
      items: [
        {
          t: "10:00",
          n: "Bienvenida y mapa del evento",
          who: "Equipo organizador",
          kind: "Apertura",
        },
        {
          t: "10:30",
          n: "Qué puede hacer hoy un agente",
          who: "Paula Mena",
          kind: "Charla",
        },
        {
          t: "12:00",
          n: "Taller: tu primera automatización",
          who: "Rodrigo Pizarro",
          kind: "Taller",
        },
        {
          t: "15:00",
          n: "Panel: errores que no repetiría",
          who: "Cuatro invitadas",
          kind: "Panel",
        },
      ],
    },
    {
      id: "d2",
      label: "Miércoles 25",
      items: [
        {
          t: "10:00",
          n: "Datos propios, respuestas propias",
          who: "Isidora Vega",
          kind: "Charla",
        },
        {
          t: "11:30",
          n: "Taller: medir lo que importa",
          who: "Andrés Torres",
          kind: "Taller",
        },
        {
          t: "14:00",
          n: "Preguntas abiertas y cierre",
          who: "Todo el equipo",
          kind: "Cierre",
        },
      ],
    },
  ],
  speakersTitle: "Ponentes",
  speakers: [
    {
      name: "Paula Mena",
      role: "Diseño de producto",
      topic: "Agentes en el día a día",
    },
    {
      name: "Rodrigo Pizarro",
      role: "Ingeniería de datos",
      topic: "Automatizar sin romper nada",
    },
    { name: "Isidora Vega", role: "Investigación", topic: "Datos propios" },
    {
      name: "Andrés Torres",
      role: "Operaciones",
      topic: "Medir lo que importa",
    },
  ],
  register: {
    title: "Reserva tu lugar",
    lead: "Te enviamos el enlace y un recordatorio el día antes.",
    name: "Nombre y apellido",
    mail: "Correo",
    role: "¿Cómo participas?",
    roles: ["En vivo", "Veré la grabación"],
    cta: "Registrarme gratis",
    missing: "Escribe tu nombre y un correo válido.",
    done: {
      title: "Quedaste registrada",
      description: (m: string) =>
        `Te escribiremos a ${m} con el enlace de acceso.`,
      again: "Registrar a otra persona",
    },
  },
  waiting: {
    title: "Sala de espera",
    lead: "Conversa con otras personas antes de que empiece. Es un chat de ejemplo.",
    messages: [
      {
        who: "Camilo R.",
        t: "¡Hola! Conectando desde Valparaíso",
        ago: "hace 4 min",
      },
      {
        who: "Josefa M.",
        t: "¿Quedará grabado el taller de la tarde?",
        ago: "hace 3 min",
      },
      {
        who: "Equipo",
        t: "Sí, todas las sesiones quedan grabadas.",
        ago: "hace 2 min",
      },
    ],
    label: "Escribe un mensaje",
    send: "Enviar",
    empty: "Todavía no hay mensajes en la sala.",
  },
  materials: {
    title: "Material",
    lead: "Se libera al terminar cada sesión.",
    list: [
      { n: "Guía de automatización (PDF)", s: "2,4 MB", ready: true },
      { n: "Plantillas del taller", s: "850 KB", ready: true },
      { n: "Grabación del día 1", s: "Disponible el 25", ready: false },
    ],
    get: "Descargar",
    soon: "Pronto",
  },
  poll: {
    title: "Encuesta",
    question: "¿Qué tema te interesa más para el taller del miércoles?",
    options: [
      { id: "o1", t: "Medir resultados", v: 41 },
      { id: "o2", t: "Conectar datos propios", v: 33 },
      { id: "o3", t: "Seguridad y permisos", v: 26 },
    ],
    cta: "Votar",
    thanks: "Gracias por votar. Así va la encuesta:",
    pick: "Elige una opción para votar.",
  },
  directory: {
    title: "Comunidad",
    lead: "Quienes ya se registraron y quieren que otras personas las encuentren.",
    label: "Buscar en la comunidad",
    placeholder: "Nombre, ciudad o interés",
    people: [
      { n: "Camilo Reyes", c: "Valparaíso", i: "Datos" },
      { n: "Josefa Molina", c: "Santiago", i: "Producto" },
      { n: "Tomás Araya", c: "Concepción", i: "Automatización" },
      { n: "Francisca Mena", c: "La Serena", i: "Diseño" },
      { n: "Pablo Núñez", c: "Santiago", i: "Operaciones" },
      { n: "Ignacia Bravo", c: "Temuco", i: "Investigación" },
    ],
    none: {
      title: "Nadie coincide con esa búsqueda",
      description: "Prueba con otra palabra o muestra a toda la comunidad.",
      action: "Ver a todas",
    },
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve una persona cuando el evento aún no comienza o algo falla.",
    empty: {
      title: "Aún no hay sesiones publicadas",
      description: "La agenda se publica el 10 de noviembre.",
      action: "Avisarme",
    },
    loading: "Cargando la transmisión",
    error: {
      title: "No pudimos cargar la transmisión",
      description: "Reintenta; seguirás en la sala.",
    },
    success: {
      title: "Quedaste registrada",
      description: "Te enviamos el enlace por correo.",
      action: "Ver la agenda",
    },
    forbidden: {
      title: "Esta sala es para personas registradas",
      description: "Regístrate para entrar a la sesión.",
      action: "Registrarme",
    },
    noResults: {
      title: "Sin coincidencias",
      description: "Ninguna sesión responde a esa búsqueda.",
    },
    offline: {
      title: "Sin conexión",
      description: "Te reconectamos a la transmisión cuando vuelva la red.",
    },
    partial: {
      issues: [
        "Los subtítulos aún no están disponibles",
        "El chat está en modo lectura",
      ],
    },
  },
  footer: {
    tagline: "Un evento en vivo con una comunidad que sigue después.",
    columns: [
      {
        title: "Evento",
        links: [
          { label: "Agenda", href: "#agenda" },
          { label: "Ponentes", href: "#ponentes" },
        ],
      },
      {
        title: "Participar",
        links: [
          { label: "Registro", href: "#registro" },
          { label: "Comunidad", href: "#comunidad" },
        ],
      },
    ],
  },
}
