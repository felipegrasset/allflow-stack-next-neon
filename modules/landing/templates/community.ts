import type { LandingDoc } from "../contracts"
import { b, type LandingTemplate } from "./types"

/** Comunidad: se entra por el correo (lead inline), no por un precio. Sin bloque de precios. */
export const community: LandingTemplate = {
  id: "community",
  archetype: "community",
  landing: {
    version: 1,
    locale: "es",
    blocks: [
      b("hero", "centered"),
      b("social", "stats"),
      b("features", "bento"),
      b("steps", "timeline"),
      b("faq", "columns"),
      b("lead", "inline"),
      b("cta", "split"),
      b("footer", "simple"),
    ],
  } as LandingDoc,
  copy: {
    hero: {
      eyebrow: "Comunidad",
      title: "{app}: un lugar para las personas que comparten lo tuyo",
      subtitle:
        "Conoce gente, comparte lo que sabes y participa en encuentros. Entra hoy, es gratis.",
      primary: { label: "Unirme a la comunidad", href: "#lead" },
      secondary: { label: "Cómo participar", href: "#steps" },
    },
    social: {
      heading: "Una comunidad que ya está en movimiento",
      stats: [
        { value: "500+", label: "personas activas" },
        { value: "12", label: "encuentros al año" },
        { value: "24/7", label: "conversación abierta" },
      ],
    },
    features: {
      heading: "Por qué unirte",
      intro: "Un espacio cuidado, con reglas claras y buena gente.",
      items: [
        {
          title: "Conversación",
          body: "Hilos por tema para encontrar lo que te interesa.",
          icon: "users",
        },
        {
          title: "Encuentros",
          body: "Actividades en línea y presenciales, con cupos.",
          icon: "clock",
        },
        {
          title: "Aprende de otros",
          body: "Comparte tu experiencia y recibe la de los demás.",
          icon: "sparkles",
        },
        {
          title: "Espacio cuidado",
          body: "Moderación y reglas simples para convivir bien.",
          icon: "shield",
        },
      ],
    },
    steps: {
      heading: "Cómo participar",
      items: [
        { title: "Únete", body: "Déjanos tu correo y entra a la comunidad." },
        {
          title: "Preséntate",
          body: "Cuéntanos quién eres y qué te interesa.",
        },
        {
          title: "Participa",
          body: "Responde, pregunta y apúntate a un encuentro.",
        },
      ],
    },
    faq: {
      heading: "Preguntas frecuentes",
      items: [
        { q: "¿Tiene costo?", a: "No. Unirse y participar es gratis." },
        {
          q: "¿Cómo se cuida la convivencia?",
          a: "Hay reglas simples y un equipo que modera.",
        },
        {
          q: "¿Puedo salirme cuando quiera?",
          a: "Sí, puedes darte de baja en cualquier momento.",
        },
      ],
    },
    lead: {
      heading: "Súmate a la comunidad",
      subtitle: "Déjanos tu correo y te damos la bienvenida.",
      labels: {
        name: "Nombre",
        email: "Tu correo",
        message: "Mensaje",
        consent: "Acepto recibir la bienvenida y novedades de la comunidad.",
        submit: "Unirme",
        sending: "Enviando…",
      },
      privacy: { label: "Política de privacidad", href: "/privacidad" },
      doneTitle: "¡Bienvenida, bienvenido!",
      doneBody: "Revisa tu correo para entrar.",
      errorGeneric: "No pudimos registrarte. Inténtalo de nuevo en un momento.",
      errorConsent: "Para unirte necesitamos tu consentimiento.",
      errorCaptcha: "Confirma que no eres un robot e inténtalo otra vez.",
    },
    cta: {
      title: "Hay un lugar para ti",
      subtitle: "Crea tu cuenta y empieza a participar.",
      primary: { label: "Crear mi cuenta", href: "/signup" },
    },
    footer: {
      tagline: "{app}",
      columns: [
        {
          title: "Comunidad",
          links: [
            { label: "Cómo participar", href: "#steps" },
            { label: "Preguntas", href: "#faq" },
          ],
        },
        { title: "Cuenta", links: [{ label: "Ingresar", href: "/login" }] },
      ],
      legal: "© {year} {app}. Todos los derechos reservados.",
    },
  },
}
