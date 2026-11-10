/**
 * Todos los textos de la landing, en UN archivo. Cada clave la usa un bloque de
 * `landing.json` (`"copy": "hero"`). `{app}` y `{year}` se reemplazan al
 * resolver. La génesis (o el agente) reescribe este archivo para cada app; las
 * plantillas por arquetipo (T10) traen el suyo.
 *
 * Sin i18n todavía: `copySets` es por idioma para que el módulo `i18n` (T4)
 * pueda levantarlo entero sin tocar los bloques.
 */
import type { CopySet } from "./schema"

const es: CopySet = {
  hero: {
    eyebrow: "Hecho con Fulvia",
    title: "{app}: lo que necesitas, listo en minutos",
    subtitle:
      "Una app clara, con tus datos en un solo lugar. Empieza hoy y mira el resultado desde el primer día.",
    primary: { label: "Crear mi cuenta", href: "/signup" },
    secondary: { label: "Ver cómo funciona", href: "#steps" },
    mock: {
      title: "Resumen de la semana",
      rows: [
        { label: "Tareas cerradas", value: "24" },
        { label: "Pendientes", value: "6" },
        { label: "Avance", value: "80 %" },
      ],
    },
  },
  social: {
    heading: "Ya lo usan equipos como el tuyo",
    stats: [
      { value: "12 min", label: "de la idea a la primera versión" },
      { value: "100 %", label: "de tus datos en un solo lugar" },
      { value: "24/7", label: "disponible desde cualquier equipo" },
    ],
    logos: ["Acme", "Globex", "Initech", "Umbrella"],
  },
  features: {
    heading: "Todo lo esencial, sin ruido",
    intro: "Cada función resuelve una cosa y la resuelve bien.",
    items: [
      {
        title: "Rápida",
        body: "Carga al instante y responde sin esperas.",
        icon: "zap",
      },
      {
        title: "Segura",
        body: "Tus datos protegidos con acceso por roles.",
        icon: "shield",
      },
      {
        title: "Ordenada",
        body: "Todo en su lugar, fácil de encontrar.",
        icon: "layers",
      },
      {
        title: "En equipo",
        body: "Invita a quien quieras y trabajen juntos.",
        icon: "users",
      },
      {
        title: "Con medidas",
        body: "Mira cómo avanzas con números claros.",
        icon: "chart",
      },
      {
        title: "Donde estés",
        body: "Funciona en el celular y en el computador.",
        icon: "globe",
      },
    ],
  },
  steps: {
    heading: "Cómo funciona",
    items: [
      { title: "Crea tu cuenta", body: "Un minuto y sin tarjeta." },
      {
        title: "Cuéntanos qué necesitas",
        body: "Configura lo básico a tu manera.",
      },
      { title: "Empieza a usarla", body: "Invita a tu equipo y listo." },
    ],
  },
  pricing: {
    heading: "Planes simples",
    intro: "Empieza gratis y crece cuando lo necesites.",
    plans: [
      {
        name: "Inicial",
        price: "Gratis",
        description: "Para probar y empezar.",
        features: ["1 persona", "Funciones esenciales"],
        cta: { label: "Empezar gratis", href: "/signup" },
      },
      {
        name: "Equipo",
        price: "$14,90",
        period: "al mes",
        description: "Para trabajar en equipo.",
        features: [
          "Hasta 10 personas",
          "Todas las funciones",
          "Soporte por correo",
        ],
        cta: { label: "Elegir Equipo", href: "/signup" },
        highlighted: true,
      },
    ],
  },
  faq: {
    heading: "Preguntas frecuentes",
    items: [
      {
        q: "¿Necesito tarjeta para empezar?",
        a: "No. Puedes crear tu cuenta y probar sin pagar nada.",
      },
      {
        q: "¿Puedo invitar a mi equipo?",
        a: "Sí. Invitas por correo y cada persona entra con su propio acceso.",
      },
      {
        q: "¿Mis datos están seguros?",
        a: "Sí. El acceso es por roles y los datos viven en una base privada.",
      },
    ],
  },
  lead: {
    heading: "¿Hablamos?",
    subtitle: "Déjanos tus datos y te escribimos.",
    labels: {
      name: "Nombre",
      email: "Correo",
      message: "¿En qué podemos ayudarte?",
      consent: "Acepto que usen mis datos para responderme.",
      submit: "Enviar",
      sending: "Enviando…",
    },
    privacy: { label: "Política de privacidad", href: "/privacidad" },
    doneTitle: "¡Recibido!",
    doneBody: "Te respondemos a la brevedad.",
    errorGeneric: "No pudimos enviarlo. Inténtalo de nuevo en un momento.",
    errorConsent: "Para enviar necesitamos tu consentimiento.",
    errorCaptcha: "Confirma que no eres un robot e inténtalo otra vez.",
  },
  cta: {
    title: "Empieza hoy, sin complicarte",
    subtitle: "Crea tu cuenta en un minuto.",
    primary: { label: "Crear mi cuenta", href: "/signup" },
    secondary: { label: "Ya tengo cuenta", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Producto",
        links: [
          { label: "Planes", href: "#pricing" },
          { label: "Preguntas", href: "#faq" },
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
    eyebrow: "Made with Fulvia",
    title: "{app}: what you need, ready in minutes",
    subtitle:
      "A clear app with your data in one place. Start today and see results from day one.",
    primary: { label: "Create my account", href: "/signup" },
    secondary: { label: "See how it works", href: "#steps" },
    mock: {
      title: "This week",
      rows: [
        { label: "Closed tasks", value: "24" },
        { label: "Pending", value: "6" },
        { label: "Progress", value: "80%" },
      ],
    },
  },
  social: {
    heading: "Teams like yours already use it",
    stats: [
      { value: "12 min", label: "from idea to first version" },
      { value: "100%", label: "of your data in one place" },
      { value: "24/7", label: "available from any device" },
    ],
    logos: ["Acme", "Globex", "Initech", "Umbrella"],
  },
  features: {
    heading: "Everything essential, no noise",
    intro: "Each feature does one thing and does it well.",
    items: [
      {
        title: "Fast",
        body: "Loads instantly and never makes you wait.",
        icon: "zap",
      },
      {
        title: "Secure",
        body: "Your data protected with role-based access.",
        icon: "shield",
      },
      {
        title: "Organized",
        body: "Everything in its place, easy to find.",
        icon: "layers",
      },
      {
        title: "Teamwork",
        body: "Invite anyone and work together.",
        icon: "users",
      },
      {
        title: "Measured",
        body: "See your progress in clear numbers.",
        icon: "chart",
      },
      {
        title: "Anywhere",
        body: "Works on your phone and your computer.",
        icon: "globe",
      },
    ],
  },
  steps: {
    heading: "How it works",
    items: [
      { title: "Create your account", body: "One minute, no card needed." },
      { title: "Tell us what you need", body: "Set up the basics your way." },
      { title: "Start using it", body: "Invite your team and go." },
    ],
  },
  pricing: {
    heading: "Simple plans",
    intro: "Start free and grow when you need to.",
    plans: [
      {
        name: "Starter",
        price: "Free",
        description: "To try it out.",
        features: ["1 person", "Essential features"],
        cta: { label: "Start free", href: "/signup" },
      },
      {
        name: "Team",
        price: "$14.90",
        period: "per month",
        description: "To work as a team.",
        features: ["Up to 10 people", "All features", "Email support"],
        cta: { label: "Choose Team", href: "/signup" },
        highlighted: true,
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        q: "Do I need a card to start?",
        a: "No. Create your account and try it without paying.",
      },
      {
        q: "Can I invite my team?",
        a: "Yes. Invite by email and everyone gets their own access.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. Access is role-based and data lives in a private database.",
      },
    ],
  },
  lead: {
    heading: "Let's talk",
    subtitle: "Leave your details and we will write back.",
    labels: {
      name: "Name",
      email: "Email",
      message: "How can we help?",
      consent: "I agree that my data is used to reply to me.",
      submit: "Send",
      sending: "Sending…",
    },
    privacy: { label: "Privacy policy", href: "/privacy" },
    doneTitle: "Received!",
    doneBody: "We will get back to you shortly.",
    errorGeneric: "We could not send it. Please try again in a moment.",
    errorConsent: "We need your consent to send this.",
    errorCaptcha: "Confirm you are not a robot and try again.",
  },
  cta: {
    title: "Start today, keep it simple",
    subtitle: "Create your account in a minute.",
    primary: { label: "Create my account", href: "/signup" },
    secondary: { label: "I already have an account", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Plans", href: "#pricing" },
          { label: "FAQ", href: "#faq" },
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

export const copySets: Record<"es" | "en", CopySet> = { es, en }
