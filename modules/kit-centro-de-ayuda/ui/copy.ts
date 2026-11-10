/** Textos y datos de muestra del kit Centro de Ayuda (literales hasta el módulo i18n, T4). */
export type Article = {
  id: string
  cat: string
  title: string
  summary: string
  mins: number
  steps: string[]
  updated: string
}

export const copy = {
  brand: "Ayuda",
  links: [
    { label: "Buscar", href: "#buscar" },
    { label: "Estado", href: "#estado" },
    { label: "Contacto", href: "#contacto" },
  ],
  headerAction: "Escribirnos",
  eyebrow: "Centro de ayuda",
  title: "¿En qué te podemos ayudar?",
  lead: "Busca por palabra o elige un tema. Si no encuentras la respuesta, escríbenos y te contestamos en el día.",
  searchLabel: "Buscar en el centro de ayuda",
  searchPlaceholder: "Por ejemplo: cambiar mi contraseña",
  categories: [
    { id: "todas", name: "Todos los temas" },
    { id: "cuenta", name: "Mi cuenta" },
    { id: "pagos", name: "Pagos y facturas" },
    { id: "equipo", name: "Equipo y permisos" },
  ],
  count: (n: number) => (n === 1 ? "1 artículo" : `${n} artículos`),
  articles: [
    {
      id: "a1",
      cat: "cuenta",
      title: "Cómo cambiar tu contraseña",
      summary: "Actualiza tu clave desde la configuración de la cuenta.",
      mins: 2,
      updated: "5 nov",
      steps: [
        "Abre Configuración desde tu foto de perfil.",
        "Entra a Seguridad y elige «Cambiar contraseña».",
        "Escribe la clave actual y la nueva, de al menos 10 caracteres.",
        "Guarda. Cerraremos tus otras sesiones por seguridad.",
      ],
    },
    {
      id: "a2",
      cat: "cuenta",
      title: "Recuperar el acceso si olvidaste tu correo",
      summary: "Qué hacer cuando ya no tienes acceso al correo de la cuenta.",
      mins: 4,
      updated: "28 oct",
      steps: [
        "Entra a la página de ingreso y elige «No puedo entrar».",
        "Indica el último correo que recuerdes haber usado.",
        "Responde las dos preguntas de verificación.",
        "Nuestro equipo revisa la solicitud en menos de un día hábil.",
      ],
    },
    {
      id: "a3",
      cat: "pagos",
      title: "Descargar una factura",
      summary: "Cada cobro tiene su factura en PDF, con tus datos fiscales.",
      mins: 2,
      updated: "2 nov",
      steps: [
        "Ve a Facturación y abre el historial de cobros.",
        "Busca el mes que necesitas.",
        "Pulsa «Descargar» junto al cobro.",
      ],
    },
    {
      id: "a4",
      cat: "pagos",
      title: "Cambiar el medio de pago",
      summary: "Reemplaza la tarjeta asociada al plan.",
      mins: 3,
      updated: "30 oct",
      steps: [
        "Abre Facturación y elige «Medio de pago».",
        "Agrega la tarjeta nueva y confirma con el código del banco.",
        "Márcala como principal; la anterior se puede eliminar.",
      ],
    },
    {
      id: "a5",
      cat: "equipo",
      title: "Invitar a una persona a tu equipo",
      summary: "Elige su rol antes de enviar la invitación.",
      mins: 3,
      updated: "6 nov",
      steps: [
        "Entra a Equipo y pulsa «Invitar».",
        "Escribe su correo y elige el rol.",
        "Envía. La invitación vence a los 7 días.",
      ],
    },
    {
      id: "a6",
      cat: "equipo",
      title: "Qué puede hacer cada rol",
      summary: "Diferencias entre propietaria, administrador y lector.",
      mins: 5,
      updated: "1 nov",
      steps: [
        "La propietaria gestiona el plan y los pagos.",
        "El administrador invita personas y cambia roles.",
        "El lector solo ve la información, sin editar.",
      ],
    },
  ] satisfies Article[],
  article: {
    pick: "Elige un artículo para leerlo aquí.",
    time: (n: number) => `${n} min de lectura`,
    updated: (d: string) => `Actualizado el ${d}`,
    stepsTitle: "Paso a paso",
    helpful: "¿Te sirvió este artículo?",
    yes: "Sí, me sirvió",
    no: "No del todo",
    thanks: {
      title: "Gracias por avisarnos",
      description: "Con tu respuesta mejoramos el centro de ayuda.",
    },
    more: {
      title: "Lamentamos que no alcanzara",
      description:
        "Cuéntanos qué faltó y lo corregimos; o escríbenos y te ayudamos directamente.",
      action: "Escribir al equipo",
    },
  },
  status: {
    title: "Estado del servicio",
    lead: "Lo que funciona ahora mismo. Actualizado hace 3 minutos.",
    items: [
      { n: "Aplicación web", s: "ok" },
      {
        n: "Envío de correos",
        s: "warn",
        d: "Con retrasos de hasta 10 minutos",
      },
      { n: "Pagos", s: "ok" },
      { n: "Exportaciones", s: "ok" },
    ],
    label: { ok: "Operativo", warn: "Degradado", down: "Caído" },
  },
  contact: {
    title: "Escríbenos",
    lead: "Respondemos de lunes a viernes, de 9 a 18 h.",
    mail: "Tu correo",
    topic: "Tema",
    topics: ["Mi cuenta", "Pagos y facturas", "Equipo y permisos", "Otro"],
    msg: "Cuéntanos qué pasa",
    send: "Enviar consulta",
    missing:
      "Escribe un correo válido y cuéntanos qué pasa (al menos 10 letras).",
    done: {
      title: "Consulta enviada",
      description: (m: string) =>
        `Te responderemos a ${m} en menos de un día hábil.`,
      again: "Enviar otra consulta",
    },
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve quien busca ayuda cuando algo no sale a la primera.",
    empty: {
      title: "Aún no hay artículos en este tema",
      description: "Estamos escribiéndolos. Escríbenos y te ayudamos.",
      action: "Escribirnos",
    },
    loading: "Buscando artículos",
    error: {
      title: "No pudimos cargar el artículo",
      description: "Inténtalo de nuevo; el resto del centro sigue disponible.",
    },
    success: {
      title: "Consulta enviada",
      description: "Te responderemos por correo.",
      action: "Volver al inicio",
    },
    forbidden: {
      title: "Este artículo es solo para administradores",
      description: "Pide a quien administra tu cuenta que lo abra.",
      action: "Ver otros artículos",
    },
    noResults: {
      title: "No encontramos nada para esa búsqueda",
      description: "Prueba con otras palabras o elige un tema.",
      action: "Quitar la búsqueda",
    },
    offline: {
      title: "Sin conexión",
      description: "Puedes leer los artículos que abriste hace poco.",
    },
    partial: {
      issues: [
        "Las imágenes de este artículo no cargaron",
        "El estado del servicio tiene datos de hace 10 minutos",
      ],
    },
  },
  footer: {
    tagline: "Respuestas claras, a cualquier hora.",
    columns: [
      {
        title: "Ayuda",
        links: [
          { label: "Buscar", href: "#buscar" },
          { label: "Estado", href: "#estado" },
        ],
      },
      {
        title: "Contacto",
        links: [{ label: "Escribirnos", href: "#contacto" }],
      },
    ],
  },
}
