import type { LandingDoc } from "../contracts"
import { b, type LandingTemplate } from "./types"

/** Servicios y agenda: el hero muestra una reserva y el lead es el formulario para pedir hora. */
export const bookingsServices: LandingTemplate = {
  id: "bookings-services",
  archetype: "bookings-services",
  landing: {
    version: 1,
    locale: "es",
    blocks: [
      b("hero", "split"),
      b("social", "logos"),
      b("features", "columns"),
      b("steps", "timeline"),
      b("pricing", "cards"),
      b("faq", "accordion"),
      b("lead", "card"),
      b("cta", "split"),
      b("footer", "simple"),
    ],
  } as LandingDoc,
  copy: {
    hero: {
      eyebrow: "Reservas online",
      title: "{app}: reserva tu hora en 30 segundos",
      subtitle:
        "Elige el servicio, el día y la hora. Te confirmamos al instante y te recordamos antes de tu cita.",
      primary: { label: "Reservar ahora", href: "#lead" },
      secondary: { label: "Ver servicios", href: "#pricing" },
      mock: {
        title: "Tu reserva",
        rows: [
          { label: "Servicio", value: "Consulta" },
          { label: "Día", value: "Mar 12" },
          { label: "Hora", value: "10:30" },
        ],
      },
    },
    social: {
      heading: "Personas y empresas que confían en nosotros",
      logos: ["Acme", "Globex", "Initech", "Umbrella"],
    },
    features: {
      heading: "Todo para que llegues sin pensar",
      intro: "Menos mensajes de ida y vuelta, más tiempo para lo importante.",
      items: [
        {
          title: "Agenda al día",
          body: "Ves solo los horarios realmente disponibles.",
          icon: "clock",
        },
        {
          title: "Recordatorios",
          body: "Te avisamos antes para que no se te pase.",
          icon: "sparkles",
        },
        {
          title: "Cambios fáciles",
          body: "Reagenda o cancela en un clic, sin llamar.",
          icon: "zap",
        },
      ],
    },
    steps: {
      heading: "Así de simple",
      items: [
        { title: "Elige el servicio", body: "Mira qué incluye y cuánto dura." },
        { title: "Escoge día y hora", body: "Solo aparecen los cupos libres." },
        {
          title: "Recibe tu confirmación",
          body: "Te llega al correo y te recordamos antes.",
        },
      ],
    },
    pricing: {
      heading: "Servicios y valores",
      intro: "Precios claros, sin letra chica.",
      plans: [
        {
          name: "Sesión",
          price: "$25.000",
          period: "por sesión",
          description: "Una atención individual.",
          features: ["45 minutos", "Reagenda sin costo"],
          cta: { label: "Reservar", href: "#lead" },
        },
        {
          name: "Pack de 4",
          price: "$90.000",
          period: "4 sesiones",
          description: "Seguimiento continuo.",
          features: [
            "4 sesiones de 45 minutos",
            "Prioridad en agenda",
            "Ahorro del 10 %",
          ],
          cta: { label: "Reservar el pack", href: "#lead" },
          highlighted: true,
        },
      ],
    },
    faq: {
      heading: "Preguntas frecuentes",
      items: [
        {
          q: "¿Puedo cambiar mi hora?",
          a: "Sí, hasta 24 horas antes y sin costo, desde el enlace de tu confirmación.",
        },
        {
          q: "¿Cómo pago?",
          a: "En la atención o con transferencia previa; tú eliges.",
        },
        {
          q: "¿Atienden en línea?",
          a: "Sí, puedes elegir atención presencial o por videollamada.",
        },
      ],
    },
    lead: {
      heading: "Pide tu hora",
      subtitle: "Cuéntanos qué necesitas y te confirmamos el horario.",
      labels: {
        name: "Nombre",
        email: "Correo",
        message: "¿Qué servicio necesitas?",
        consent: "Acepto que usen mis datos para coordinar mi atención.",
        submit: "Pedir hora",
        sending: "Enviando…",
      },
      privacy: { label: "Política de privacidad", href: "/privacidad" },
      doneTitle: "¡Recibimos tu solicitud!",
      doneBody: "Te confirmamos el horario a tu correo.",
      errorGeneric: "No pudimos enviarlo. Inténtalo de nuevo en un momento.",
      errorConsent: "Para enviar necesitamos tu consentimiento.",
      errorCaptcha: "Confirma que no eres un robot e inténtalo otra vez.",
    },
    cta: {
      title: "Tu próxima hora, a un toque",
      subtitle: "Reserva hoy y recibe confirmación al instante.",
      primary: { label: "Reservar ahora", href: "#lead" },
    },
    footer: {
      tagline: "{app}",
      columns: [
        {
          title: "Servicios",
          links: [
            { label: "Valores", href: "#pricing" },
            { label: "Preguntas", href: "#faq" },
          ],
        },
        { title: "Cuenta", links: [{ label: "Ingresar", href: "/login" }] },
      ],
      legal: "© {year} {app}. Todos los derechos reservados.",
    },
  },
}
