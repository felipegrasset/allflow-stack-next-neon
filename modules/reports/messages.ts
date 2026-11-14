/**
 * Interface text of the module (entrypoint `messages`). Data only. Dashboard
 * and card titles are NOT here: they are data of each definition
 * (`title: "…"` or `{ es, en }`).
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  reports: {
    nav: "Reportes",
    list: {
      title: "Reportes",
      subtitle: "Paneles con los indicadores de tu app.",
      emptyTitle: "Todavía no hay paneles",
      emptyHint: "Los paneles se definen en el código con defineDashboard y se guardan con saveDashboard.",
      listLabel: "Paneles",
      invalid: "Definición inválida ({id})",
      cards: "{n, plural, =0 {Sin tarjetas} one {# tarjeta} other {# tarjetas}}",
    },
    dashboard: {
      back: "Todos los reportes",
      emptyTitle: "Este panel no tiene tarjetas",
      emptyHint: "Agrega tarjetas a su definición en el código.",
      invalidTitle: "No se puede mostrar este panel",
      invalidHint: "Su definición guardada no es válida. Revísala y vuelve a guardarla con saveDashboard.",
      rangeDays: "{n, plural, one {Último día} other {Últimos # días}}",
      allTime: "Desde el inicio",
      computedAt: "Calculado: {date}",
      utc: "Los períodos se agrupan en hora UTC.",
    },
    card: {
      noData: "Sin datos",
      error: "No se pudo calcular esta tarjeta.",
      emptyLabel: "(vacío)",
      yes: "Sí",
      no: "No",
      seriesAlt: "{title}: {count} períodos, de {from} a {to}",
      period: "Período",
      value: "Valor",
      byDay: "Por día",
      byWeek: "Por semana",
      byMonth: "Por mes",
    },
    edit: {
      group: "Ordenar «{title}»",
      up: "Subir",
      down: "Bajar",
      remove: "Quitar",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  reports: {
    nav: "Reports",
    list: {
      title: "Reports",
      subtitle: "Dashboards with your app's key numbers.",
      emptyTitle: "No dashboards yet",
      emptyHint: "Dashboards are defined in code with defineDashboard and stored with saveDashboard.",
      listLabel: "Dashboards",
      invalid: "Invalid definition ({id})",
      cards: "{n, plural, =0 {No cards} one {# card} other {# cards}}",
    },
    dashboard: {
      back: "All reports",
      emptyTitle: "This dashboard has no cards",
      emptyHint: "Add cards to its definition in code.",
      invalidTitle: "This dashboard can't be shown",
      invalidHint: "Its stored definition is not valid. Check it and save it again with saveDashboard.",
      rangeDays: "{n, plural, one {Last day} other {Last # days}}",
      allTime: "All time",
      computedAt: "Computed: {date}",
      utc: "Periods are grouped in UTC.",
    },
    card: {
      noData: "No data",
      error: "This card could not be computed.",
      emptyLabel: "(empty)",
      yes: "Yes",
      no: "No",
      seriesAlt: "{title}: {count} periods, from {from} to {to}",
      period: "Period",
      value: "Value",
      byDay: "Per day",
      byWeek: "Per week",
      byMonth: "Per month",
    },
    edit: {
      group: "Arrange “{title}”",
      up: "Move up",
      down: "Move down",
      remove: "Remove",
    },
  },
}
