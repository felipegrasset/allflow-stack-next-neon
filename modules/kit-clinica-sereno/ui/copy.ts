/** Textos y datos de muestra del kit Clínica Sereno (literales hasta el módulo i18n, T4). */
export type Pro = {
  id: string
  name: string
  spec: string
  years: number
  place: string
  next: string
  about: string
  times: string[]
}

export const copy = {
  brand: "Clínica Sereno",
  links: [
    { label: "Profesionales", href: "#profesionales" },
    { label: "Reservar", href: "#reservar" },
    { label: "Mis horas", href: "#historial" },
  ],
  headerAction: "Mi cuenta",
  eyebrow: "Medicina general, dental y bienestar",
  title: "Cuida tu salud con calma",
  lead: "Encuentra a quien necesitas, mira sus horas libres y reserva en tres pasos. Te recordamos antes de la cita.",
  searchLabel: "Buscar profesional o especialidad",
  searchPlaceholder: "Nombre o especialidad",
  specs: ["Todas", "Medicina general", "Odontología", "Nutrición"],
  proTitle: "Profesionales",
  pros: [
    {
      id: "p1",
      name: "Dra. Valentina Pérez",
      spec: "Medicina general",
      years: 12,
      place: "Sede Providencia",
      next: "Hoy 16:30",
      about:
        "Controles, certificados y seguimiento de enfermedades crónicas. Atiende también por video.",
      times: ["16:30", "17:00", "17:30", "18:00"],
    },
    {
      id: "p2",
      name: "Dr. Matías Soto",
      spec: "Odontología",
      years: 9,
      place: "Sede Providencia",
      next: "Mañana 09:00",
      about:
        "Limpieza, tratamientos de caries y evaluación de ortodoncia para adultos.",
      times: ["09:00", "09:30", "11:00", "15:00"],
    },
    {
      id: "p3",
      name: "Nut. Camila Rojas",
      spec: "Nutrición",
      years: 7,
      place: "Sede Ñuñoa",
      next: "Mié 11 10:30",
      about:
        "Planes alimentarios simples, con foco en hábitos que se puedan sostener.",
      times: ["10:30", "12:00", "16:00"],
    },
    {
      id: "p4",
      name: "Dr. Tomás Araya",
      spec: "Medicina general",
      years: 15,
      place: "Sede Ñuñoa",
      next: "Jue 12 08:30",
      about:
        "Atención de adultos y adultos mayores, con visitas a domicilio en la comuna.",
      times: ["08:30", "09:00", "14:30"],
    },
  ] satisfies Pro[],
  profile: {
    years: (n: number) => `${n} años de experiencia`,
    next: "Próxima hora",
    pick: "Elige a alguien de la lista para ver su ficha.",
  },
  steps: ["Profesional y hora", "Tus datos", "Confirmar"],
  stepLabel: (i: number, n: number) => `Paso ${i} de ${n}`,
  slotsLabel: "Horas disponibles",
  dayLabel: "Martes 10 de noviembre",
  form: {
    name: "Nombre completo",
    rut: "RUT",
    mail: "Correo",
    reason: "Motivo de la consulta (opcional)",
    remind: "Enviar recordatorio por correo 24 horas antes",
    next: "Continuar",
    back: "Volver",
    confirm: "Confirmar la hora",
    missing: "Falta elegir una hora o completar tus datos.",
  },
  summary: { with: "Con", where: "Dónde", when: "Cuándo", who: "Paciente" },
  done: {
    title: "Hora confirmada",
    description: (w: string, t: string) =>
      `Te esperamos con ${w} el martes 10 a las ${t}.`,
    again: "Reservar otra hora",
  },
  history: {
    title: "Mis horas",
    lead: "Lo que viene y lo que ya pasó.",
    list: [
      { d: "Mar 17 nov · 10:00", w: "Nut. Camila Rojas", st: "next" },
      { d: "Lun 20 oct · 16:30", w: "Dra. Valentina Pérez", st: "done" },
      { d: "Jue 4 sep · 09:00", w: "Dr. Matías Soto", st: "done" },
      { d: "Mié 13 ago · 11:30", w: "Dr. Tomás Araya", st: "cancel" },
    ],
    st: { next: "Próxima", done: "Realizada", cancel: "Cancelada" },
  },
  reminder: {
    title: "Recordatorios",
    lead: "Elige cómo quieres que te avisemos.",
    items: ["Correo 24 horas antes", "Mensaje de texto 2 horas antes"],
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve una persona cuando algo no sale a la primera.",
    empty: {
      title: "Aún no tienes horas",
      description: "Cuando reserves, aparecerán aquí.",
      action: "Buscar profesional",
    },
    loading: "Buscando horas libres",
    error: {
      title: "No pudimos traer las horas",
      description: "Inténtalo de nuevo; tu elección se mantiene.",
    },
    success: {
      title: "Hora confirmada",
      description: "Te enviamos el detalle por correo.",
      action: "Ver mis horas",
    },
    forbidden: {
      title: "Esta ficha es solo para pacientes",
      description: "Ingresa con tu cuenta para ver tu historial.",
      action: "Ingresar",
    },
    noResults: {
      title: "Nadie coincide con tu búsqueda",
      description: "Prueba con otra especialidad o quita el filtro.",
      action: "Ver a todos",
    },
    offline: {
      title: "Sin conexión",
      description: "Podrás confirmar tu hora al volver a estar en línea.",
    },
    partial: {
      issues: [
        "No pudimos cargar las fotos del equipo",
        "Algunas horas pueden haberse ocupado",
      ],
    },
  },
  footer: {
    tagline: "Atención de salud clara, cercana y a tu hora.",
    columns: [
      {
        title: "Atención",
        links: [
          { label: "Profesionales", href: "#profesionales" },
          { label: "Reservar", href: "#reservar" },
        ],
      },
      {
        title: "Pacientes",
        links: [{ label: "Mis horas", href: "#historial" }],
      },
    ],
  },
}
