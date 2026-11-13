/**
 * Catálogo de la galería: un kit por entrada, agrupado como se muestra.
 * `tests/kits-galeria.test.ts` lo compara con los `modules/kit-*` instalados:
 * un kit nuevo sin entrada aquí (o una entrada sin kit) hace fallar la prueba.
 */
export type KitEntry = { slug: string; title: string; description: string }

export const kitGroups: { id: string; title: string; lead: string; kits: KitEntry[] }[] = [
  {
    id: "tienda",
    title: "Tienda y landing",
    lead: "Para vender: tiendas, landings, portafolios, precios y checkout.",
    kits: [
  { slug: "atelier-de-papel", title: "Atelier de Papel", description: "Tienda editorial de moda y objetos: héroe con serif, colecciones, grilla, ficha con galería, cajón de carrito, lookbook, newsletter y estados." },
  { slug: "estudio-contraste", title: "Estudio Contraste", description: "Landing de agencia o servicios: hero, servicios, casos, proceso de 4 pasos, equipo, precios, testimonios, formulario de lead y CTA final." },
  { slug: "hecho-a-mano", title: "Hecho a Mano", description: "Portafolio y tienda de creadores, juguetón y plano: héroe con borde grueso, proyectos, tienda simple, sobre mí, tarifas, contacto, boletín, galería y estados." },
  { slug: "landing-ia-nocturna", title: "Landing de IA Nocturna", description: "Landing oscura de producto de IA: hero con maqueta, banda de logos, bento de funciones, cómo funciona, precios, FAQ, prueba social y CTA." },
  { slug: "mercadito-de-barrio", title: "Mercadito de Barrio", description: "Tienda local de alimentos y mascotas: héroe de color, categorías, ofertas, ficha, carrito, checkout simple, seguimiento y reseñas." },
  { slug: "precios-checkout", title: "Precios y Checkout", description: "Página de precios con comparativa y checkout simple: resumen del pedido, correo, país, cupón funcional, pago delegado al proveedor y estados de procesando, éxito y error." },
  { slug: "producto-suscripcion", title: "Producto Digital y Suscripción", description: "Ficha de un producto digital con planes mensual y anual: héroe, qué incluye, selector de facturación, planes, garantía, FAQ y estados. Pensado para apps que cobran con un proveedor de pagos como Paddle." },
  { slug: "segunda-vuelta", title: "Segunda Vuelta", description: "Marketplace móvil de segunda mano: búsqueda, chips, grilla de 2 columnas, ficha, chat con el vendedor, publicar, favoritos, perfil, filtros en hoja y estados." },
  { slug: "tienda-un-enlace", title: "Tienda de un Enlace", description: "Tienda móvil para creadores y servicios: perfil, productos digitales, reserva, cupón, pago, descargas, estadísticas, clientes y editor del enlace." },
    ],
  },
  {
    id: "operacion",
    title: "Operación, educación y comunidad",
    lead: "Para trabajar y aprender: paneles, reservas, cursos, eventos, ayuda y directorios.",
    kits: [
  { slug: "aula-viva", title: "Aula Viva", description: "Academia de cursos en línea: catálogo, ruta de módulos, lección con notas, quiz, progreso, certificado y foro." },
  { slug: "centro-de-ayuda", title: "Centro de Ayuda", description: "Base de conocimiento: buscador, categorías, artículos con pasos y valoración, estado del servicio y formulario de contacto." },
  { slug: "clinica-sereno", title: "Clínica Sereno", description: "Reserva médica, dental o de bienestar: buscador de profesionales, ficha, horas, formulario en pasos, confirmación, recordatorio e historial." },
  { slug: "diario-de-habitos", title: "Diario de Hábitos", description: "Seguimiento personal de salud, comida y ejercicio: anillos de progreso, registro rápido, historial, gráfico semanal, metas, recordatorios y plan." },
  { slug: "directorio-claro", title: "Directorio Claro", description: "Directorio de fichas (inmuebles, profesionales, empleos): buscador con filtros, lista y mapa de maqueta, ficha, contacto, favoritos, comparador y panel del anunciante." },
  { slug: "evento-en-vivo", title: "Evento en Vivo", description: "Webinar, evento o comunidad: cuenta regresiva, agenda por día, ponentes, registro, sala de espera con chat, material, encuesta y directorio de miembros." },
  { slug: "noche-de-cifras", title: "Noche de Cifras", description: "Dashboard analítico oscuro: KPIs con tendencia, gráfico de línea y de barras, tabla con filtro de fecha, detalle lateral, alertas y estados." },
  { slug: "panel-de-ciclos", title: "Panel de Ciclos", description: "SaaS con panel de administración: resumen del ciclo, cuentas, equipo y roles, facturación, notificaciones y la hoja de estados." },
  { slug: "reserva-simple", title: "Reserva Simple", description: "Agenda de servicios (peluquería, taller): servicio, profesional, día y hora, datos, confirmación, recordatorio y panel de agenda." },
  { slug: "ruta-viva", title: "Ruta Viva", description: "Operación y reparto: rutas, pedidos, mapa de zonas de maqueta, repartidores, línea de tiempo, escaneo e incidencias." },
  { slug: "taller-claro", title: "Taller Claro", description: "CRM liviano para pymes: pipeline kanban, contactos, ficha, tareas, actividad, semana y carga de CSV." },
    ],
  },
]

export const coreEntry: KitEntry = {
  slug: "core",
  title: "Núcleo",
  description:
    "Tokens OKLCH con escala, ocho componentes de estado, encabezado y pie. Todo kit se construye encima.",
}
