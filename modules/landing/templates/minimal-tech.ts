import type { LandingDoc } from "../contracts"
import type { CopySet } from "../schema"
import { b, type LandingTemplate } from "./types"

const es: CopySet = {
  hero: {
    eyebrow: "Nuevo",
    title: "{app}: menos herramientas, más trabajo hecho",
    subtitle:
      "Un solo lugar para tus proyectos, tu equipo y tus números. Se configura en minutos.",
    primary: { label: "Empezar gratis", href: "/signup" },
    secondary: { label: "Ver planes", href: "#pricing" },
    mock: {
      title: "Panel",
      rows: [
        { label: "Proyectos activos", value: "12" },
        { label: "Tareas de hoy", value: "8" },
        { label: "Avance del mes", value: "86 %" },
      ],
    },
  },
  social: {
    heading: "Equipos que ya trabajan así",
    logos: ["Acme", "Globex", "Initech", "Umbrella", "Hooli"],
  },
  features: {
    heading: "Hecho para ir rápido",
    intro: "Cada función resuelve una cosa y la resuelve bien.",
    items: [
      {
        title: "Configuración al instante",
        body: "Listo para usar en menos de cinco minutos.",
        icon: "zap",
      },
      {
        title: "Permisos por rol",
        body: "Cada persona ve solo lo que le corresponde.",
        icon: "shield",
      },
      {
        title: "Todo conectado",
        body: "Proyectos, tareas y datos en el mismo lugar.",
        icon: "layers",
      },
      {
        title: "Métricas claras",
        body: "Números que se entienden de un vistazo.",
        icon: "chart",
      },
      {
        title: "Trabajo en equipo",
        body: "Invita a tu equipo y colaboren en vivo.",
        icon: "users",
      },
      {
        title: "Desde cualquier lugar",
        body: "Funciona en el navegador, sin instalar nada.",
        icon: "globe",
      },
    ],
  },
  steps: {
    heading: "Empieza en tres pasos",
    items: [
      { title: "Crea tu cuenta", body: "Sin tarjeta y en un minuto." },
      {
        title: "Importa o crea tus datos",
        body: "Parte de cero o trae lo que ya tienes.",
      },
      {
        title: "Invita a tu equipo",
        body: "Cada persona entra con su propio acceso.",
      },
    ],
  },
  pricing: {
    heading: "Precios simples",
    intro: "Empieza gratis y paga solo cuando crezcas.",
    plans: [
      {
        name: "Gratis",
        price: "$0",
        description: "Para probar.",
        features: ["1 proyecto", "Funciones esenciales"],
        cta: { label: "Empezar gratis", href: "/signup" },
      },
      {
        name: "Equipo",
        price: "$14,90",
        period: "al mes",
        description: "Para trabajar en equipo.",
        features: [
          "Proyectos ilimitados",
          "Hasta 10 personas",
          "Soporte por correo",
        ],
        cta: { label: "Elegir Equipo", href: "/signup" },
        highlighted: true,
      },
      {
        name: "Empresa",
        price: "A medida",
        description: "Para organizaciones grandes.",
        features: ["Personas ilimitadas", "Soporte prioritario"],
        cta: { label: "Hablar con ventas", href: "mailto:hola@example.com" },
      },
    ],
  },
  faq: {
    heading: "Preguntas frecuentes",
    items: [
      {
        q: "¿Necesito tarjeta para empezar?",
        a: "No. El plan gratis no pide tarjeta y no vence.",
      },
      {
        q: "¿Puedo cambiar de plan?",
        a: "Sí, cuando quieras y se ajusta al siguiente ciclo.",
      },
      {
        q: "¿Dónde viven mis datos?",
        a: "En una base de datos privada con acceso por roles.",
      },
    ],
  },
  cta: {
    title: "Pruébalo hoy, sin compromiso",
    subtitle: "Crea tu cuenta gratis en un minuto.",
    primary: { label: "Empezar gratis", href: "/signup" },
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
    eyebrow: "New",
    title: "{app}: fewer tools, more work done",
    subtitle:
      "One place for your projects, your team and your numbers. Set up in minutes.",
    primary: { label: "Start free", href: "/signup" },
    secondary: { label: "See plans", href: "#pricing" },
    mock: {
      title: "Dashboard",
      rows: [
        { label: "Active projects", value: "12" },
        { label: "Tasks today", value: "8" },
        { label: "Monthly progress", value: "86%" },
      ],
    },
  },
  social: {
    heading: "Teams that already work this way",
    logos: ["Acme", "Globex", "Initech", "Umbrella", "Hooli"],
  },
  features: {
    heading: "Built to move fast",
    intro: "Each feature does one thing and does it well.",
    items: [
      {
        title: "Instant setup",
        body: "Ready to use in under five minutes.",
        icon: "zap",
      },
      {
        title: "Role-based permissions",
        body: "Everyone sees only what they should.",
        icon: "shield",
      },
      {
        title: "All connected",
        body: "Projects, tasks and data in the same place.",
        icon: "layers",
      },
      {
        title: "Clear metrics",
        body: "Numbers you understand at a glance.",
        icon: "chart",
      },
      {
        title: "Teamwork",
        body: "Invite your team and collaborate live.",
        icon: "users",
      },
      {
        title: "From anywhere",
        body: "Runs in the browser, nothing to install.",
        icon: "globe",
      },
    ],
  },
  steps: {
    heading: "Get started in three steps",
    items: [
      { title: "Create your account", body: "No card, in a minute." },
      {
        title: "Import or create your data",
        body: "Start from scratch or bring what you already have.",
      },
      {
        title: "Invite your team",
        body: "Everyone signs in with their own access.",
      },
    ],
  },
  pricing: {
    heading: "Simple pricing",
    intro: "Start free and pay only when you grow.",
    plans: [
      {
        name: "Free",
        price: "$0",
        description: "To try it out.",
        features: ["1 project", "Essential features"],
        cta: { label: "Start free", href: "/signup" },
      },
      {
        name: "Team",
        price: "$14.90",
        period: "per month",
        description: "To work as a team.",
        features: ["Unlimited projects", "Up to 10 people", "Email support"],
        cta: { label: "Choose Team", href: "/signup" },
        highlighted: true,
      },
      {
        name: "Enterprise",
        price: "Custom",
        description: "For large organizations.",
        features: ["Unlimited people", "Priority support"],
        cta: { label: "Talk to sales", href: "mailto:hola@example.com" },
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        q: "Do I need a card to start?",
        a: "No. The free plan asks for no card and does not expire.",
      },
      {
        q: "Can I change plans?",
        a: "Yes, whenever you want; it applies from the next cycle.",
      },
      {
        q: "Where does my data live?",
        a: "In a private database with role-based access.",
      },
    ],
  },
  cta: {
    title: "Try it today, no strings attached",
    subtitle: "Create your free account in a minute.",
    primary: { label: "Start free", href: "/signup" },
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

/** SaaS: hero con maqueta, logos bajo el hero y funciones de altura constante. Sin formulario: el CTA es crear la cuenta. */
export const minimalTech: LandingTemplate = {
  id: "minimal-tech",
  archetype: "minimal-tech",
  landing: {
    version: 1,
    locale: "es",
    blocks: [
      b("hero", "split"),
      b("social", "logos"),
      b("features", "columns"),
      b("steps", "numbered"),
      b("pricing", "cards"),
      b("faq", "accordion"),
      b("cta", "band"),
      b("footer", "simple"),
    ],
  } as LandingDoc,
  copy: { es, en },
}
