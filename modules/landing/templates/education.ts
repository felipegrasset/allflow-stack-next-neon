import type { LandingDoc } from "../contracts"
import type { CopySet } from "../schema"
import { b, type LandingTemplate } from "./types"

const es: CopySet = {
  hero: {
    eyebrow: "Aprende a tu ritmo",
    title: "{app}: aprende lo que necesitas, paso a paso",
    subtitle:
      "Clases breves, ejercicios prácticos y seguimiento de tu avance. Empieza hoy y avanza a tu ritmo.",
    primary: { label: "Empezar el curso", href: "/signup" },
    secondary: { label: "Ver el programa", href: "#steps" },
  },
  social: {
    heading: "Una experiencia pensada para terminar lo que empiezas",
    stats: [
      { value: "6 sem", label: "de principio a fin" },
      { value: "40", label: "lecciones prácticas" },
      { value: "1:1", label: "resolución de dudas" },
    ],
  },
  steps: {
    heading: "Tu ruta de aprendizaje",
    items: [
      {
        title: "Parte por lo básico",
        body: "Nivelamos conceptos en las primeras clases.",
      },
      {
        title: "Practica con casos reales",
        body: "Cada módulo termina en un ejercicio aplicado.",
      },
      {
        title: "Muestra lo aprendido",
        body: "Cierra con un proyecto y recibe tu certificado.",
      },
    ],
  },
  features: {
    heading: "Lo que incluye",
    intro: "Todo lo que necesitas para aprender sin perderte.",
    items: [
      {
        title: "Clases breves",
        body: "Lecciones de 10 minutos, fáciles de retomar.",
        icon: "clock",
      },
      {
        title: "Práctica guiada",
        body: "Ejercicios con corrección y comentarios.",
        icon: "sparkles",
      },
      {
        title: "Comunidad",
        body: "Resuelve dudas con otras personas del curso.",
        icon: "users",
      },
      {
        title: "Tu avance",
        body: "Mira cuánto llevas y qué sigue.",
        icon: "chart",
      },
    ],
  },
  pricing: {
    heading: "Elige cómo cursar",
    intro: "Un solo pago o en cuotas, con acceso de por vida.",
    plans: [
      {
        name: "Curso",
        price: "$59.000",
        description: "Todo el programa.",
        features: [
          "40 lecciones",
          "Ejercicios con corrección",
          "Certificado",
        ],
        cta: { label: "Inscribirme", href: "/signup" },
        highlighted: true,
      },
      {
        name: "Curso + mentoría",
        price: "$129.000",
        description: "Con acompañamiento personal.",
        features: [
          "Todo el curso",
          "4 sesiones 1:1",
          "Revisión de tu proyecto",
        ],
        cta: { label: "Inscribirme con mentoría", href: "/signup" },
      },
    ],
  },
  faq: {
    heading: "Preguntas frecuentes",
    items: [
      {
        q: "¿Necesito experiencia previa?",
        a: "No. Partimos desde cero y avanzamos de a poco.",
      },
      {
        q: "¿Cuánto tiempo necesito por semana?",
        a: "Entre 3 y 4 horas bastan para terminar en 6 semanas.",
      },
      {
        q: "¿Recibo certificado?",
        a: "Sí, al completar las lecciones y entregar el proyecto final.",
      },
    ],
  },
  lead: {
    heading: "¿Dudas antes de inscribirte?",
    subtitle: "Déjanos tu correo y te enviamos el programa completo.",
    labels: {
      name: "Nombre",
      email: "Tu correo",
      message: "Mensaje",
      consent: "Acepto que me envíen el programa y novedades del curso.",
      submit: "Recibir el programa",
      sending: "Enviando…",
    },
    privacy: { label: "Política de privacidad", href: "/privacidad" },
    doneTitle: "¡Revisa tu correo!",
    doneBody: "Te enviamos el programa.",
    errorGeneric: "No pudimos enviarlo. Inténtalo de nuevo en un momento.",
    errorConsent: "Para enviarte el programa necesitamos tu consentimiento.",
    errorCaptcha: "Confirma que no eres un robot e inténtalo otra vez.",
  },
  cta: {
    title: "El mejor momento para empezar es hoy",
    subtitle: "Inscríbete y accede a la primera clase ahora.",
    primary: { label: "Inscribirme", href: "/signup" },
    secondary: { label: "Ya soy alumno", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Curso",
        links: [
          { label: "Programa", href: "#steps" },
          { label: "Precios", href: "#pricing" },
        ],
      },
      {
        title: "Cuenta",
        links: [
          { label: "Ingresar", href: "/login" },
          { label: "Crear cuenta", href: "/signup" },
        ],
      },
    ],
    legal: "© {year} {app}. Todos los derechos reservados.",
  },
}

const en: CopySet = {
  hero: {
    eyebrow: "Learn at your own pace",
    title: "{app}: learn what you need, step by step",
    subtitle:
      "Short lessons, hands-on exercises and progress tracking. Start today and move forward at your own pace.",
    primary: { label: "Start the course", href: "/signup" },
    secondary: { label: "See the syllabus", href: "#steps" },
  },
  social: {
    heading: "An experience designed so you finish what you start",
    stats: [
      { value: "6 wks", label: "from start to finish" },
      { value: "40", label: "hands-on lessons" },
      { value: "1:1", label: "help with your questions" },
    ],
  },
  steps: {
    heading: "Your learning path",
    items: [
      {
        title: "Start with the basics",
        body: "The first lessons get everyone on the same page.",
      },
      {
        title: "Practice with real cases",
        body: "Every module ends with an applied exercise.",
      },
      {
        title: "Show what you learned",
        body: "Finish with a project and get your certificate.",
      },
    ],
  },
  features: {
    heading: "What is included",
    intro: "Everything you need to learn without getting lost.",
    items: [
      {
        title: "Short lessons",
        body: "10-minute lessons, easy to pick up again.",
        icon: "clock",
      },
      {
        title: "Guided practice",
        body: "Exercises with corrections and feedback.",
        icon: "sparkles",
      },
      {
        title: "Community",
        body: "Solve questions with other people in the course.",
        icon: "users",
      },
      {
        title: "Your progress",
        body: "See how far you have come and what is next.",
        icon: "chart",
      },
    ],
  },
  pricing: {
    heading: "Choose how to take it",
    intro: "One payment or installments, with lifetime access.",
    plans: [
      {
        name: "Course",
        price: "$59,000",
        description: "The whole program.",
        features: ["40 lessons", "Exercises with corrections", "Certificate"],
        cta: { label: "Enroll", href: "/signup" },
        highlighted: true,
      },
      {
        name: "Course + mentoring",
        price: "$129,000",
        description: "With personal guidance.",
        features: ["The whole course", "4 1:1 sessions", "Project review"],
        cta: { label: "Enroll with mentoring", href: "/signup" },
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        q: "Do I need previous experience?",
        a: "No. We start from scratch and move forward little by little.",
      },
      {
        q: "How much time do I need per week?",
        a: "3 to 4 hours are enough to finish in 6 weeks.",
      },
      {
        q: "Do I get a certificate?",
        a: "Yes, once you complete the lessons and hand in the final project.",
      },
    ],
  },
  lead: {
    heading: "Questions before enrolling?",
    subtitle: "Leave your email and we will send you the full syllabus.",
    labels: {
      name: "Name",
      email: "Your email",
      message: "Message",
      consent: "I agree to receive the syllabus and course news.",
      submit: "Get the syllabus",
      sending: "Sending…",
    },
    privacy: { label: "Privacy policy", href: "/privacidad" },
    doneTitle: "Check your inbox!",
    doneBody: "We sent you the syllabus.",
    errorGeneric: "We could not send it. Please try again in a moment.",
    errorConsent: "We need your consent to send you the syllabus.",
    errorCaptcha: "Confirm you are not a robot and try again.",
  },
  cta: {
    title: "The best time to start is today",
    subtitle: "Enroll and get the first lesson right now.",
    primary: { label: "Enroll", href: "/signup" },
    secondary: { label: "I am already a student", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Course",
        links: [
          { label: "Syllabus", href: "#steps" },
          { label: "Prices", href: "#pricing" },
        ],
      },
      {
        title: "Account",
        links: [
          { label: "Sign in", href: "/login" },
          { label: "Create account", href: "/signup" },
        ],
      },
    ],
    legal: "© {year} {app}. All rights reserved.",
  },
}

/** Curso o escuela: el hero es centrado y directo, la ruta de aprendizaje va como pasos numerados. */
export const education: LandingTemplate = {
  id: "education",
  archetype: "education",
  landing: {
    version: 1,
    locale: "es",
    blocks: [
      b("hero", "centered"),
      b("social", "stats"),
      b("steps", "numbered"),
      b("features", "bento"),
      b("pricing", "list"),
      b("faq", "accordion"),
      b("lead", "inline"),
      b("cta", "band"),
      b("footer", "columns"),
    ],
  } as LandingDoc,
  copy: { es, en },
}
