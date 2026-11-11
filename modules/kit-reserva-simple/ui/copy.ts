/** Textos y datos de muestra del kit Reserva Simple (literales hasta el módulo i18n, T4). */
export type Service = {
  id: string
  name: string
  mins: number
  price: number
  note: string
}
export type Pro = { id: string; name: string; role: string }
export type Day = { id: string; dow: string; num: number; open: boolean }

export const copy = {
  brand: "Tijera y Peine",
  links: [
    { label: "Reservar", href: "#reservar" },
    { label: "Servicios", href: "#reservar" },
    { label: "Agenda del día", href: "#agenda" },
  ],
  callLabel: "Llamar al local",
  eyebrow: "Peluquería en Providencia",
  title: "Reserva tu hora en menos de un minuto",
  lead: "Elige el servicio, quién te atiende y el horario. Te avisamos por WhatsApp una hora antes.",
  steps: {
    service: "1 · Servicio",
    pro: "2 · Quién te atiende",
    when: "3 · Día y hora",
    you: "4 · Tus datos",
  },
  services: [
    {
      id: "corte",
      name: "Corte de pelo",
      mins: 30,
      price: 14000,
      note: "Lavado y secado incluidos",
    },
    {
      id: "color",
      name: "Color completo",
      mins: 90,
      price: 48000,
      note: "Incluye tratamiento",
    },
    {
      id: "barba",
      name: "Barba y perfilado",
      mins: 20,
      price: 9000,
      note: "Con toalla caliente",
    },
    {
      id: "peinado",
      name: "Peinado para evento",
      mins: 45,
      price: 22000,
      note: "Reserva con 48 h",
    },
  ] satisfies Service[],
  pros: [
    { id: "any", name: "Cualquiera", role: "La primera disponible" },
    { id: "ana", name: "Ana Fuentes", role: "Color y corte" },
    { id: "luis", name: "Luis Cárdenas", role: "Barba y corte" },
  ] satisfies Pro[],
  days: [
    { id: "d10", dow: "Mar", num: 10, open: true },
    { id: "d11", dow: "Mié", num: 11, open: true },
    { id: "d12", dow: "Jue", num: 12, open: true },
    { id: "d13", dow: "Vie", num: 13, open: true },
    { id: "d14", dow: "Sáb", num: 14, open: true },
    { id: "d15", dow: "Dom", num: 15, open: false },
    { id: "d16", dow: "Lun", num: 16, open: true },
  ] satisfies Day[],
  slots: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "12:00",
    "15:00",
    "15:30",
    "16:00",
    "17:00",
    "17:30",
    "18:00",
  ],
  closed: {
    title: "El domingo estamos cerrados",
    description: "Elige otro día para ver los horarios disponibles.",
    action: "Ver el lunes",
  },
  slotsLegend: "Horas ocupadas aparecen deshabilitadas.",
  form: {
    name: "Nombre y apellido",
    phone: "Teléfono o WhatsApp",
    note: "¿Algo que debamos saber? (opcional)",
    remind: "Avísame por WhatsApp una hora antes",
    submit: "Confirmar mi hora",
    missing: "Falta elegir una hora y completar tu nombre y teléfono.",
  },
  summary: {
    title: "Tu reserva",
    empty: "Aún no eliges nada",
    total: "Total",
    when: "Cuándo",
    who: "Con",
  },
  done: {
    title: "Hora confirmada",
    description: (when: string, name: string) =>
      `Te esperamos el ${when}, ${name}. Te enviamos el detalle por WhatsApp.`,
    again: "Reservar otra hora",
  },
  agenda: {
    title: "Agenda de hoy",
    lead: "El panel que ve el local: quién viene y cuándo. Las horas libres se ofrecen en la reserva.",
    rows: [
      {
        t: "09:00",
        n: "Camila Díaz",
        s: "Corte de pelo",
        p: "Ana",
        st: "done",
      },
      {
        t: "10:00",
        n: "Rodrigo Silva",
        s: "Barba y perfilado",
        p: "Luis",
        st: "done",
      },
      { t: "11:00", n: "Hora libre", s: "", p: "Ana", st: "free" },
      {
        t: "12:00",
        n: "Paula Ibáñez",
        s: "Color completo",
        p: "Ana",
        st: "next",
      },
      {
        t: "15:30",
        n: "Mateo Fuentes",
        s: "Corte de pelo",
        p: "Luis",
        st: "later",
      },
      {
        t: "17:00",
        n: "Sofía Araya",
        s: "Peinado para evento",
        p: "Ana",
        st: "later",
      },
    ],
    state: {
      done: "Atendido",
      free: "Libre",
      next: "Siguiente",
      later: "Confirmado",
    },
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve quien reserva cuando algo no sale a la primera.",
    empty: {
      title: "No hay horas este día",
      description: "Todas las horas de la semana están ocupadas.",
      action: "Avisarme si se libera",
    },
    loading: "Buscando horas disponibles",
    error: {
      title: "No pudimos traer los horarios",
      description: "Intenta de nuevo; tu selección se mantiene.",
    },
    success: {
      title: "Hora reservada",
      description: "Te avisaremos una hora antes.",
      action: "Ver mi reserva",
    },
    forbidden: {
      title: "Esta hora ya no está disponible",
      description: "Alguien la tomó mientras elegías.",
      action: "Elegir otra hora",
    },
    noResults: {
      title: "Ese profesional no atiende ese servicio",
      description: "Cambia el profesional o el servicio.",
    },
    offline: {
      title: "Sin conexión",
      description: "Cuando vuelvas a estar en línea podrás confirmar tu hora.",
    },
    partial: {
      issues: [
        "No pudimos mostrar la foto del equipo",
        "Los precios pueden haber cambiado desde ayer",
      ],
    },
  },
  footer: {
    tagline: "Hora para cortarte el pelo, sin llamar por teléfono.",
    columns: [
      {
        title: "Local",
        links: [
          { label: "Reservar", href: "#reservar" },
          { label: "Agenda", href: "#agenda" },
        ],
      },
      {
        title: "Horario",
        links: [{ label: "Lun a sáb, 9 a 19 h", href: "#reservar" }],
      },
    ],
  },
}
