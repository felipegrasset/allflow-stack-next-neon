import type { LandingDoc } from "../contracts"
import type { CopySet } from "../schema"
import { b, type LandingTemplate } from "./types"

const es: CopySet = {
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
}

const en: CopySet = {
  hero: {
    eyebrow: "Online booking",
    title: "{app}: book your appointment in 30 seconds",
    subtitle:
      "Pick the service, the day and the time. We confirm instantly and remind you before your appointment.",
    primary: { label: "Book now", href: "#lead" },
    secondary: { label: "See services", href: "#pricing" },
    mock: {
      title: "Your booking",
      rows: [
        { label: "Service", value: "Consultation" },
        { label: "Day", value: "Tue 12" },
        { label: "Time", value: "10:30" },
      ],
    },
  },
  social: {
    heading: "People and companies who trust us",
    logos: ["Acme", "Globex", "Initech", "Umbrella"],
  },
  features: {
    heading: "Everything so you just show up",
    intro: "Fewer back-and-forth messages, more time for what matters.",
    items: [
      {
        title: "Up-to-date schedule",
        body: "You only see the slots that are really free.",
        icon: "clock",
      },
      {
        title: "Reminders",
        body: "We remind you ahead of time so you do not miss it.",
        icon: "sparkles",
      },
      {
        title: "Easy changes",
        body: "Reschedule or cancel in one click, no phone calls.",
        icon: "zap",
      },
    ],
  },
  steps: {
    heading: "As simple as this",
    items: [
      {
        title: "Pick the service",
        body: "See what it includes and how long it takes.",
      },
      { title: "Choose day and time", body: "Only open slots are shown." },
      {
        title: "Get your confirmation",
        body: "It lands in your inbox and we remind you before.",
      },
    ],
  },
  pricing: {
    heading: "Services and prices",
    intro: "Clear prices, no fine print.",
    plans: [
      {
        name: "Session",
        price: "$25,000",
        period: "per session",
        description: "One individual appointment.",
        features: ["45 minutes", "Free rescheduling"],
        cta: { label: "Book", href: "#lead" },
      },
      {
        name: "4-session pack",
        price: "$90,000",
        period: "4 sessions",
        description: "Ongoing follow-up.",
        features: [
          "4 sessions of 45 minutes",
          "Priority scheduling",
          "Save 10%",
        ],
        cta: { label: "Book the pack", href: "#lead" },
        highlighted: true,
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        q: "Can I change my appointment?",
        a: "Yes, up to 24 hours before and at no cost, from the link in your confirmation.",
      },
      {
        q: "How do I pay?",
        a: "At the appointment or by bank transfer beforehand; your choice.",
      },
      {
        q: "Do you offer online sessions?",
        a: "Yes, you can choose an in-person or a video call appointment.",
      },
    ],
  },
  lead: {
    heading: "Request your appointment",
    subtitle: "Tell us what you need and we will confirm the time.",
    labels: {
      name: "Name",
      email: "Email",
      message: "Which service do you need?",
      consent: "I agree that my data is used to arrange my appointment.",
      submit: "Request appointment",
      sending: "Sending…",
    },
    privacy: { label: "Privacy policy", href: "/privacidad" },
    doneTitle: "We got your request!",
    doneBody: "We will confirm the time by email.",
    errorGeneric: "We could not send it. Please try again in a moment.",
    errorConsent: "We need your consent to send this.",
    errorCaptcha: "Confirm you are not a robot and try again.",
  },
  cta: {
    title: "Your next appointment, one tap away",
    subtitle: "Book today and get instant confirmation.",
    primary: { label: "Book now", href: "#lead" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Services",
        links: [
          { label: "Prices", href: "#pricing" },
          { label: "FAQ", href: "#faq" },
        ],
      },
      { title: "Account", links: [{ label: "Sign in", href: "/login" }] },
    ],
    legal: "© {year} {app}. All rights reserved.",
  },
}

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
  copy: { es, en },
}
