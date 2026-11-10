export const copy = {
  brand: "Trazo",
  links: [
    { label: "Qué incluye", href: "#incluye" },
    { label: "Planes", href: "#planes" },
    { label: "Preguntas", href: "#faq" },
  ],
  hero: {
    eyebrow: "App de notas y tareas",
    title: "Tus ideas, ordenadas sin esfuerzo",
    text: "Trazo junta notas, tareas y archivos en un solo lugar y te recuerda lo que importa. Funciona sin conexión y se sincroniza solo.",
    cta: "Empezar prueba de 14 días",
    ghost: "Ver planes",
    note: "Sin tarjeta para empezar. Cancela cuando quieras.",
  },
  mock: {
    title: "Hoy",
    tasks: [
      ["Enviar propuesta a Aconcagua", true],
      ["Revisar notas de la reunión", false],
      ["Comprar tinta para la impresora", false],
    ] as [string, boolean][],
    note: "Idea: tablero semanal con recordatorios por voz.",
  },
  includes: [
    [
      "Notas con carpetas y etiquetas",
      "Organiza como prefieras y encuentra todo con una búsqueda.",
    ],
    [
      "Tareas con recordatorios",
      "Fechas, repeticiones y avisos en el celular y el computador.",
    ],
    [
      "Sincronización en todos tus equipos",
      "Escribe sin conexión; Trazo sube los cambios al volver la red.",
    ],
    [
      "Exporta cuando quieras",
      "Tus datos son tuyos: descárgalos en Markdown o PDF.",
    ],
  ] as [string, string][],
  plans: [
    {
      name: "Personal",
      monthly: 5,
      yearly: 48,
      items: [
        "Notas y tareas ilimitadas",
        "3 dispositivos",
        "Historial de 30 días",
      ],
      cta: "Elegir Personal",
      featured: false,
    },
    {
      name: "Pro",
      monthly: 9,
      yearly: 86,
      items: [
        "Todo lo de Personal",
        "Dispositivos ilimitados",
        "Historial de 1 año",
        "Adjuntos de hasta 2 GB",
      ],
      cta: "Elegir Pro",
      featured: true,
    },
    {
      name: "Equipo",
      monthly: 14,
      yearly: 134,
      items: [
        "Todo lo de Pro",
        "Espacios compartidos",
        "Roles y permisos",
        "Soporte prioritario",
      ],
      cta: "Elegir Equipo",
      featured: false,
      per: "por persona",
    },
  ],
  guarantee: {
    title: "30 días de garantía",
    text: "Si no te sirve, te devolvemos el pago completo. Sin preguntas ni formularios largos.",
  },
  faq: [
    [
      "¿Puedo cambiar de plan después?",
      "Sí. Subes o bajas de plan cuando quieras y ajustamos el cobro de forma proporcional.",
    ],
    [
      "¿Cómo se paga?",
      "Con tarjeta o con los medios que ofrece nuestro proveedor de pagos. Recibes la factura por correo.",
    ],
    [
      "¿Qué pasa si cancelo?",
      "Mantienes el acceso hasta el final del período pagado y puedes exportar todo.",
    ],
  ] as [string, string][],
}
