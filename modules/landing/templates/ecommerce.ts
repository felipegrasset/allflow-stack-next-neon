import type { LandingDoc } from "../contracts"
import { b, type LandingTemplate } from "./types"

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
  copy: {
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
  },
}
