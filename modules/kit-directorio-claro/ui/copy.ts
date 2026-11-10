/** Textos y datos de muestra del kit Directorio Claro (literales hasta el módulo i18n, T4). */
export type Listing = {
  id: string
  title: string
  kind: string
  zone: string
  price: number
  rooms: number
  m2: number
  x: number
  y: number
  about: string
  agent: string
}

export const copy = {
  brand: "Directorio",
  links: [
    { label: "Buscar", href: "#buscar" },
    { label: "Comparar", href: "#comparar" },
    { label: "Anunciantes", href: "#panel" },
  ],
  headerAction: "Publicar",
  eyebrow: "Arriendos en la región metropolitana",
  title: "Encuentra tu próximo lugar sin dar vueltas",
  lead: "Filtra, mira el mapa, guarda tus favoritos y compara dos opciones lado a lado.",
  searchLabel: "Buscar por nombre o barrio",
  searchPlaceholder: "Nombre o barrio",
  kinds: ["Todos", "Departamento", "Casa", "Oficina"],
  zoneLabel: "Comuna",
  zones: ["Todas", "Providencia", "Ñuñoa", "Santiago Centro"],
  maxLabel: "Precio máximo",
  maxes: [
    { v: 0, l: "Sin tope" },
    { v: 500000, l: "Hasta $ 500.000" },
    { v: 800000, l: "Hasta $ 800.000" },
  ],
  count: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
  listings: [
    {
      id: "l1",
      title: "Departamento luminoso junto al metro",
      kind: "Departamento",
      zone: "Providencia",
      price: 620000,
      rooms: 2,
      m2: 58,
      x: 62,
      y: 28,
      about:
        "Segundo piso, orientación norte, cocina equipada y estacionamiento opcional.",
      agent: "Inmobiliaria Austral",
    },
    {
      id: "l2",
      title: "Casa con patio y quincho",
      kind: "Casa",
      zone: "Ñuñoa",
      price: 890000,
      rooms: 4,
      m2: 130,
      x: 74,
      y: 58,
      about:
        "Cuatro dormitorios, patio cerrado y calefacción central. Acepta mascotas.",
      agent: "Camila Rojas",
    },
    {
      id: "l3",
      title: "Oficina de dos puestos",
      kind: "Oficina",
      zone: "Santiago Centro",
      price: 380000,
      rooms: 1,
      m2: 24,
      x: 28,
      y: 42,
      about: "Piso 6 con recepción compartida y sala de reuniones por horas.",
      agent: "Espacios del Centro",
    },
    {
      id: "l4",
      title: "Departamento estudio amoblado",
      kind: "Departamento",
      zone: "Santiago Centro",
      price: 420000,
      rooms: 1,
      m2: 32,
      x: 22,
      y: 66,
      about:
        "Amoblado, con gastos comunes incluidos. Contrato desde seis meses.",
      agent: "Inmobiliaria Austral",
    },
    {
      id: "l5",
      title: "Departamento de tres dormitorios",
      kind: "Departamento",
      zone: "Ñuñoa",
      price: 760000,
      rooms: 3,
      m2: 85,
      x: 58,
      y: 72,
      about: "Cerca de plazas y colegios, con bodega y dos estacionamientos.",
      agent: "Tomás Araya",
    },
    {
      id: "l6",
      title: "Casa esquina para oficina o consulta",
      kind: "Casa",
      zone: "Providencia",
      price: 980000,
      rooms: 5,
      m2: 160,
      x: 44,
      y: 18,
      about:
        "Primer piso comercial, segundo piso residencial. Entrada independiente.",
      agent: "Isidora Vega",
    },
  ] satisfies Listing[],
  money: (n: number) => "$ " + n.toLocaleString("es-CL"),
  unitMonth: "al mes",
  mapTitle: "Mapa (maqueta)",
  mapHelp: "Cada punto es un aviso; elige uno para ver su ficha.",
  pin: (t: string) => `Ver ${t} en el mapa`,
  fav: {
    on: "Quitar de favoritos",
    off: "Guardar en favoritos",
    count: (n: number) => (n === 1 ? "1 favorito" : `${n} favoritos`),
  },
  compare: {
    add: "Comparar",
    remove: "Quitar de la comparación",
    max: "Elige hasta dos avisos para compararlos.",
    title: "Comparador",
    pick: "Marca «Comparar» en dos avisos para verlos lado a lado.",
    rows: ["Precio", "Dormitorios", "Superficie", "Comuna", "Precio por m²"],
  },
  detail: {
    title: "Ficha del aviso",
    rooms: (n: number) => `${n} ${n === 1 ? "dormitorio" : "dormitorios"}`,
    pick: "Elige un aviso de la lista o del mapa para ver su ficha.",
  },
  contact: {
    title: "Contactar al anunciante",
    name: "Tu nombre",
    mail: "Tu correo",
    msg: "Mensaje",
    msgDefault: "Hola, me interesa este aviso. ¿Sigue disponible?",
    send: "Enviar mensaje",
    missing: "Escribe tu nombre y un correo válido.",
    done: {
      title: "Mensaje enviado",
      description: (a: string) => `${a} te responderá por correo.`,
      again: "Escribir otro mensaje",
    },
  },
  panel: {
    title: "Panel del anunciante",
    lead: "Lo que ve quien publica: cómo van sus avisos esta semana.",
    stats: [
      { l: "Visitas", v: "1.284", d: "+12 %" },
      { l: "Contactos", v: "37", d: "+4" },
      { l: "Favoritos", v: "96", d: "+9" },
    ],
    cols: ["Aviso", "Visitas", "Contactos", "Estado"],
    rows: [
      { t: "Departamento luminoso junto al metro", v: 412, c: 14, s: "Activo" },
      { t: "Oficina de dos puestos", v: 233, c: 6, s: "Activo" },
      {
        t: "Casa esquina para oficina o consulta",
        v: 98,
        c: 1,
        s: "En revisión",
      },
    ],
  },
  states: {
    title: "Hoja de estados",
    lead: "Lo que ve quien busca cuando algo no sale a la primera.",
    empty: {
      title: "Aún no tienes favoritos",
      description: "Guarda un aviso con el corazón y aparecerá aquí.",
      action: "Seguir buscando",
    },
    loading: "Buscando avisos",
    error: {
      title: "No pudimos cargar los avisos",
      description: "Inténtalo de nuevo en unos segundos.",
    },
    success: {
      title: "Aviso publicado",
      description: "Ya aparece en las búsquedas.",
      action: "Ver el aviso",
    },
    forbidden: {
      title: "Solo para anunciantes",
      description: "Crea una cuenta de anunciante para publicar.",
      action: "Crear cuenta",
    },
    noResults: {
      title: "Ningún aviso coincide",
      description: "Prueba con otra comuna o sube el precio máximo.",
      action: "Quitar filtros",
    },
    offline: {
      title: "Sin conexión",
      description: "Mostramos la última búsqueda guardada.",
    },
    partial: {
      issues: [
        "El mapa no cargó: la lista sigue disponible",
        "Dos avisos no tienen fotos todavía",
      ],
    },
  },
  footer: {
    tagline: "Un directorio claro para encontrar y comparar.",
    columns: [
      {
        title: "Buscar",
        links: [
          { label: "Avisos", href: "#buscar" },
          { label: "Comparar", href: "#comparar" },
        ],
      },
      { title: "Anunciantes", links: [{ label: "Panel", href: "#panel" }] },
    ],
  },
}
