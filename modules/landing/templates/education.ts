import type { LandingDoc } from "../contracts"
import { b, type LandingTemplate } from "./types"

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
  copy: {
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
  },
}
