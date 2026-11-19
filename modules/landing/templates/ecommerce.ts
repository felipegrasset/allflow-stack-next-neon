import type { LandingDoc } from "../contracts"
import type { CopySet } from "../schema"
import { b, type LandingTemplate } from "./types"

const es: CopySet = {
  hero: {
    eyebrow: "Tienda online",
    title: "{app}: lo que buscas, a un clic de tu puerta",
    subtitle:
      "Compra en minutos, paga seguro y sigue tu pedido desde que sale hasta que llega.",
    primary: { label: "Ver productos", href: "#pricing" },
    secondary: { label: "Cómo comprar", href: "#faq" },
    mock: {
      title: "Tu pedido",
      rows: [
        { label: "Productos", value: "3" },
        { label: "Envío", value: "Gratis" },
        { label: "Estado", value: "En camino" },
      ],
    },
  },
  social: {
    heading: "Compra con tranquilidad",
    stats: [
      { value: "48 h", label: "tiempo de entrega habitual" },
      { value: "30 días", label: "para cambios y devoluciones" },
      { value: "100 %", label: "pago protegido" },
    ],
  },
  features: {
    heading: "Una compra sin vueltas",
    intro: "Lo esencial de una buena tienda, bien hecho.",
    items: [
      {
        title: "Envío rápido",
        body: "Despachamos el mismo día en pedidos antes de las 15:00.",
        icon: "zap",
      },
      {
        title: "Pago seguro",
        body: "Tarjeta o transferencia, con confirmación al instante.",
        icon: "shield",
      },
      {
        title: "Catálogo claro",
        body: "Fotos, medidas y stock a la vista, sin sorpresas.",
        icon: "layers",
      },
      {
        title: "Seguimiento",
        body: "Sabes dónde está tu pedido en todo momento.",
        icon: "globe",
      },
    ],
  },
  pricing: {
    heading: "Elige cómo comprar",
    intro: "Compra suelta o ahorra con un pack.",
    plans: [
      {
        name: "Unidad",
        price: "$9.990",
        description: "Para probar un producto.",
        features: ["Envío estándar", "Cambio en 30 días"],
        cta: { label: "Comprar", href: "/signup" },
      },
      {
        name: "Pack",
        price: "$24.990",
        description: "Tres productos con descuento.",
        features: ["Envío gratis", "Cambio en 30 días", "Regalo incluido"],
        cta: { label: "Comprar el pack", href: "/signup" },
        highlighted: true,
      },
    ],
  },
  faq: {
    heading: "Antes de comprar",
    items: [
      {
        q: "¿Cuánto demora el envío?",
        a: "Entre 24 y 72 horas hábiles según tu comuna.",
      },
      {
        q: "¿Puedo devolver un producto?",
        a: "Sí, dentro de 30 días y sin preguntas, con el producto sin uso.",
      },
      {
        q: "¿Qué medios de pago aceptan?",
        a: "Tarjetas de crédito y débito, y transferencia.",
      },
      {
        q: "¿Cómo sigo mi pedido?",
        a: "Te enviamos un enlace de seguimiento por correo al despacharlo.",
      },
    ],
  },
  lead: {
    heading: "Entérate primero",
    subtitle: "Novedades y ofertas en tu correo. Sin spam.",
    labels: {
      name: "Nombre",
      email: "Tu correo",
      message: "Mensaje",
      consent: "Acepto recibir novedades y ofertas.",
      submit: "Suscribirme",
      sending: "Enviando…",
    },
    privacy: { label: "Política de privacidad", href: "/privacidad" },
    doneTitle: "¡Listo!",
    doneBody: "Ya estás en la lista.",
    errorGeneric: "No pudimos suscribirte. Inténtalo de nuevo en un momento.",
    errorConsent: "Para suscribirte necesitamos tu consentimiento.",
    errorCaptcha: "Confirma que no eres un robot e inténtalo otra vez.",
  },
  cta: {
    title: "Tu próximo favorito está aquí",
    subtitle: "Crea tu cuenta y compra más rápido.",
    primary: { label: "Crear mi cuenta", href: "/signup" },
    secondary: { label: "Ya tengo cuenta", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Tienda",
        links: [
          { label: "Productos", href: "#pricing" },
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
    eyebrow: "Online store",
    title: "{app}: what you are looking for, one click from your door",
    subtitle:
      "Shop in minutes, pay securely and track your order from the moment it ships until it arrives.",
    primary: { label: "See products", href: "#pricing" },
    secondary: { label: "How to buy", href: "#faq" },
    mock: {
      title: "Your order",
      rows: [
        { label: "Items", value: "3" },
        { label: "Shipping", value: "Free" },
        { label: "Status", value: "On its way" },
      ],
    },
  },
  social: {
    heading: "Shop with peace of mind",
    stats: [
      { value: "48 h", label: "usual delivery time" },
      { value: "30 days", label: "for exchanges and returns" },
      { value: "100%", label: "protected payment" },
    ],
  },
  features: {
    heading: "Shopping without the hassle",
    intro: "The essentials of a good store, done right.",
    items: [
      {
        title: "Fast shipping",
        body: "Same-day dispatch on orders placed before 3 p.m.",
        icon: "zap",
      },
      {
        title: "Secure payment",
        body: "Card or bank transfer, confirmed instantly.",
        icon: "shield",
      },
      {
        title: "Clear catalog",
        body: "Photos, sizes and stock in plain sight, no surprises.",
        icon: "layers",
      },
      {
        title: "Tracking",
        body: "You know where your order is at all times.",
        icon: "globe",
      },
    ],
  },
  pricing: {
    heading: "Choose how to buy",
    intro: "Buy a single item or save with a bundle.",
    plans: [
      {
        name: "Single item",
        price: "$9,990",
        description: "To try a product.",
        features: ["Standard shipping", "30-day exchange"],
        cta: { label: "Buy", href: "/signup" },
      },
      {
        name: "Bundle",
        price: "$24,990",
        description: "Three products at a discount.",
        features: ["Free shipping", "30-day exchange", "Gift included"],
        cta: { label: "Buy the bundle", href: "/signup" },
        highlighted: true,
      },
    ],
  },
  faq: {
    heading: "Before you buy",
    items: [
      {
        q: "How long does shipping take?",
        a: "Between 24 and 72 business hours depending on your area.",
      },
      {
        q: "Can I return a product?",
        a: "Yes, within 30 days and no questions asked, as long as it is unused.",
      },
      {
        q: "Which payment methods do you accept?",
        a: "Credit and debit cards, and bank transfer.",
      },
      {
        q: "How do I track my order?",
        a: "We email you a tracking link as soon as it ships.",
      },
    ],
  },
  lead: {
    heading: "Be the first to know",
    subtitle: "News and deals in your inbox. No spam.",
    labels: {
      name: "Name",
      email: "Your email",
      message: "Message",
      consent: "I agree to receive news and deals.",
      submit: "Subscribe",
      sending: "Sending…",
    },
    privacy: { label: "Privacy policy", href: "/privacidad" },
    doneTitle: "All set!",
    doneBody: "You are on the list.",
    errorGeneric: "We could not subscribe you. Please try again in a moment.",
    errorConsent: "We need your consent to subscribe you.",
    errorCaptcha: "Confirm you are not a robot and try again.",
  },
  cta: {
    title: "Your next favorite is here",
    subtitle: "Create your account and check out faster.",
    primary: { label: "Create my account", href: "/signup" },
    secondary: { label: "I already have an account", href: "/login" },
  },
  footer: {
    tagline: "{app}",
    columns: [
      {
        title: "Store",
        links: [
          { label: "Products", href: "#pricing" },
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

/** Tienda: el hero promete el pedido, la prueba social son cifras de confianza, y el lead es un newsletter corto. */
export const ecommerce: LandingTemplate = {
  id: "ecommerce",
  archetype: "ecommerce",
  landing: {
    version: 1,
    locale: "es",
    blocks: [
      b("hero", "split"),
      b("social", "stats"),
      b("features", "bento"),
      b("pricing", "list"),
      b("faq", "columns"),
      b("lead", "inline"),
      b("cta", "band"),
      b("footer", "columns"),
    ],
  } as LandingDoc,
  copy: { es, en },
}
