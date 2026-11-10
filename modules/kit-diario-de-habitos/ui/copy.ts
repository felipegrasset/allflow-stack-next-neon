/** Textos y datos de muestra del kit Diario de Hábitos (literales hasta el módulo i18n, T4). */
export type Habit = {
  id: string
  label: string
  unit: string
  goal: number
  start: number
  step: number
  add: string
}

export const copy = {
  brand: "Diario",
  links: [
    { label: "Hoy", href: "#hoy" },
    { label: "Semana", href: "#semana" },
    { label: "Metas", href: "#metas" },
    { label: "Recordatorios", href: "#recordatorios" },
  ],
  headerAction: "Mi plan",
  eyebrow: "Martes 10 de noviembre",
  title: "Buen día, Valentina",
  lead: "Hoy llevas dos de tres metas casi listas. Registrar tarda dos toques.",
  habits: [
    {
      id: "agua",
      label: "Agua",
      unit: "vasos",
      goal: 8,
      start: 5,
      step: 1,
      add: "Un vaso de agua",
    },
    {
      id: "mov",
      label: "Movimiento",
      unit: "min",
      goal: 30,
      start: 20,
      step: 10,
      add: "10 minutos de movimiento",
    },
    {
      id: "com",
      label: "Comidas con verdura",
      unit: "comidas",
      goal: 3,
      start: 1,
      step: 1,
      add: "Una comida con verdura",
    },
  ] satisfies Habit[],
  ringAria: (l: string, v: number, g: number, u: string) =>
    `${l}: ${v} de ${g} ${u}`,
  quickTitle: "Registro rápido",
  logTitle: "Lo de hoy",
  logEmpty: {
    title: "Todavía no registras nada hoy",
    description: "Toca un botón de arriba para empezar.",
    action: "Registrar agua",
  },
  seed: [
    { t: "08:10", what: "Un vaso de agua" },
    { t: "09:30", what: "Una comida con verdura" },
    { t: "12:45", what: "10 minutos de movimiento" },
  ],
  undo: "Deshacer el último registro",
  done: "Meta cumplida",
  weekTitle: "Esta semana",
  weekLead: "Cuántas metas cumpliste cada día, de tres posibles.",
  week: [
    { d: "Lun", v: 3 },
    { d: "Mar", v: 2 },
    { d: "Mié", v: 1 },
    { d: "Jue", v: 3 },
    { d: "Vie", v: 2 },
    { d: "Sáb", v: 3 },
    { d: "Hoy", v: 2 },
  ],
  weekUnit: (n: number) => (n === 1 ? "1 meta" : `${n} metas`),
  streak: "Racha de 4 días con al menos 2 metas",
  goalsTitle: "Tus metas",
  goalsLead: "Cámbialas cuando quieras: los anillos se ajustan al instante.",
  goalLabel: (l: string) => `Meta diaria de ${l}`,
  remindersTitle: "Recordatorios",
  reminders: [
    { id: "r1", t: "Agua cada dos horas", when: "09:00 a 19:00", on: true },
    { id: "r2", t: "Moverme después de almuerzo", when: "14:00", on: true },
    {
      id: "r3",
      t: "Revisar el diario antes de dormir",
      when: "22:00",
      on: false,
    },
  ],
  plan: {
    title: "Plan de cuatro semanas",
    week: "Semana 2 de 4",
    pct: 48,
    next: "Esta semana: agregar una comida con verdura al día.",
    cta: "Ver el plan",
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ves cuando no hay registros o algo no carga.",
    empty: {
      title: "Aún no hay registros",
      description: "Tu primer registro aparecerá aquí.",
      action: "Registrar agua",
    },
    loading: "Cargando tu día",
    error: {
      title: "No pudimos guardar el registro",
      description: "No lo perdiste: lo reintentamos cuando haya señal.",
    },
    success: {
      title: "Meta de agua cumplida",
      description: "Llegaste a 8 vasos. ¡Bien!",
      action: "Ver la semana",
    },
    forbidden: {
      title: "Esta sección es de tu plan",
      description: "Activa el plan para ver el detalle por semana.",
      action: "Ver el plan",
    },
    noResults: {
      title: "Sin registros ese día",
      description: "Elige otro día de la semana.",
    },
    offline: {
      title: "Sin conexión",
      description: "Puedes seguir registrando: se sincroniza después.",
    },
    partial: {
      issues: [
        "Los pasos no se sincronizaron hoy",
        "El gráfico usa los datos de ayer",
      ],
    },
  },
  footer: {
    tagline: "Un diario simple para hábitos que sí se sostienen.",
    columns: [
      {
        title: "Diario",
        links: [
          { label: "Hoy", href: "#hoy" },
          { label: "Semana", href: "#semana" },
        ],
      },
      {
        title: "Ajustes",
        links: [
          { label: "Metas", href: "#metas" },
          { label: "Recordatorios", href: "#recordatorios" },
        ],
      },
    ],
  },
}
