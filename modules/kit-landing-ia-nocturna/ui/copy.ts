export const copy = {
  brand: "Lumen",
  links: [
    { label: "Funciones", href: "#funciones" },
    { label: "Cómo funciona", href: "#como" },
    { label: "Precios", href: "#precios" },
    { label: "Preguntas", href: "#faq" },
  ],
  hero: {
    eyebrow: "Nuevo · Agentes con memoria",
    title: "Tu equipo pregunta. Lumen responde con tus propios datos.",
    text: "Conecta tus documentos y herramientas, y obtén respuestas con fuente en segundos, sin exponer nada fuera de tu espacio.",
    primary: "Probar gratis",
    secondary: "Ver una demo",
  },
  mock: {
    question: "¿Cuánto vendimos en octubre por región?",
    answer:
      "Octubre cerró en $48,2 M, un 12 % sobre septiembre. La región Metropolitana aportó el 61 %.",
    source: "Fuente: ventas_octubre.xlsx, hoja Resumen",
  },
  logos: ["Aconcagua", "Pulso", "Nodo", "Vértice", "Cumbre"],
  features: [
    {
      title: "Respuestas con fuente",
      text: "Cada respuesta cita el documento y la página de donde sale. Si no hay fuente, lo dice.",
      wide: true,
    },
    {
      title: "Memoria de equipo",
      text: "Lumen recuerda el contexto entre conversaciones.",
      wide: false,
    },
    {
      title: "Permisos de verdad",
      text: "Cada persona ve solo lo que ya podía ver.",
      wide: false,
    },
    {
      title: "Conecta lo que usas",
      text: "Drive, Notion, correo, tu base de datos. Sin copiar archivos a mano.",
      wide: true,
    },
    {
      title: "Hecho para auditar",
      text: "Registro de cada consulta y de quién la hizo.",
      wide: false,
    },
    {
      title: "Rápido",
      text: "Primera respuesta en menos de dos segundos.",
      wide: true,
    },
  ],
  steps: [
    {
      title: "Conecta",
      text: "Elige tus fuentes. Lumen las indexa en minutos y respeta sus permisos.",
    },
    {
      title: "Pregunta",
      text: "Escribe como hablas. Lumen busca, cruza datos y responde con citas.",
    },
    {
      title: "Decide",
      text: "Guarda la respuesta como informe o envíala a tu equipo con un clic.",
    },
  ],
  plans: [
    {
      name: "Inicio",
      price: "$0",
      note: "Para probar",
      items: ["1 persona", "3 fuentes", "100 consultas al mes"],
      cta: "Empezar gratis",
      featured: false,
    },
    {
      name: "Equipo",
      price: "$19",
      note: "por persona al mes",
      items: [
        "Personas ilimitadas",
        "Fuentes ilimitadas",
        "Memoria de equipo",
        "Registro de auditoría",
      ],
      cta: "Elegir Equipo",
      featured: true,
    },
    {
      name: "Empresa",
      price: "A medida",
      note: "Con contrato",
      items: ["SSO y SCIM", "Datos en tu región", "Soporte dedicado"],
      cta: "Hablar con ventas",
      featured: false,
    },
  ],
  faq: [
    [
      "¿Mis datos entrenan el modelo?",
      "No. Tus documentos nunca se usan para entrenar modelos y se guardan cifrados.",
    ],
    [
      "¿Qué pasa si Lumen no sabe la respuesta?",
      "Lo dice. Preferimos un «no encontré fuente» antes que una respuesta inventada.",
    ],
    [
      "¿Puedo cancelar cuando quiera?",
      "Sí. Cancelas desde ajustes y exportas tu historial en un archivo.",
    ],
    [
      "¿Funciona en español?",
      "Sí, y en inglés y portugués, con los mismos documentos.",
    ],
  ] as [string, string][],
  quote: {
    text: "Pasamos de buscar en tres carpetas a preguntar y tener la respuesta con su página. Ahorramos horas cada semana.",
    who: "Daniela Soto",
    role: "Jefa de operaciones, Aconcagua",
  },
  cta: {
    title: "Empieza esta tarde",
    text: "Sin tarjeta. Conecta tu primera fuente en cinco minutos.",
    button: "Crear mi espacio",
  },
}
