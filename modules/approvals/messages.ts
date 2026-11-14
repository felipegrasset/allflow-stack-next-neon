/**
 * Catalog of the approvals module (entrypoint `messages`). Data only. Flow,
 * state and action labels are NOT here: they are data of each flow
 * (`{ es, en }` in the definition).
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  approvals: {
    nav: "Aprobaciones",
    inbox: {
      title: "Aprobaciones",
      subtitle: "Lo que espera tu decisión y lo que pediste tú.",
      pendingTitle: "Por decidir",
      pendingEmpty: "No tienes solicitudes por decidir.",
      pendingEmptyHint: "Cuando alguien te pida una aprobación, aparecerá aquí.",
      mineTitle: "Mis solicitudes",
      mineEmpty: "Todavía no has pedido ninguna aprobación.",
    },
    request: {
      requestedBy: "Pedida por {name}",
      open: "Ver detalle",
      goToRecord: "Ir al registro",
      openTag: "Abierta",
      closedTag: "Cerrada",
      state: "Estado: {state}",
      unknownUser: "usuario eliminado",
    },
    detail: {
      back: "Volver a aprobaciones",
      history: "Historial",
      created: "{name} creó la solicitud",
      moved: "{name} ejecutó «{action}»: {from} → {to}",
      decideTitle: "Tu decisión",
      noActions: "No tienes acciones disponibles en este estado.",
      comment: "Comentario",
      commentHint: "Queda en el historial y lo ve quien pidió la aprobación.",
      commentRequired: "obligatorio en «{action}»",
      sending: "Enviando…",
      done: "Listo: la solicitud pasó a «{state}».",
    },
    errors: {
      unauthenticated: "Tu sesión expiró. Vuelve a entrar.",
      forbidden: "No tienes permiso para esta acción.",
      invalid_input: "Revisa los datos enviados.",
      invalid_flow: "El flujo de aprobación no es válido.",
      flow_not_found: "El flujo de aprobación no existe.",
      flow_inactive: "El flujo de aprobación está desactivado.",
      request_not_found: "La solicitud no existe.",
      already_open: "Ya hay una solicitud abierta para este registro.",
      invalid_transition: "Esa acción no es válida en el estado actual.",
      self_approval: "No puedes decidir sobre tu propia solicitud.",
      comment_required: "Esta acción pide un comentario.",
      conflict: "La solicitud cambió mientras la mirabas. Recarga la página.",
      unknown: "No se pudo completar la acción. Inténtalo de nuevo.",
    },
    notify: {
      pending: "Solicitud por decidir: {title}",
      changed: "«{title}» pasó a «{state}»",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  approvals: {
    nav: "Approvals",
    inbox: {
      title: "Approvals",
      subtitle: "What awaits your decision and what you asked for.",
      pendingTitle: "To decide",
      pendingEmpty: "You have no requests to decide.",
      pendingEmptyHint: "When someone asks you for an approval, it will show up here.",
      mineTitle: "My requests",
      mineEmpty: "You have not asked for any approval yet.",
    },
    request: {
      requestedBy: "Requested by {name}",
      open: "View details",
      goToRecord: "Go to record",
      openTag: "Open",
      closedTag: "Closed",
      state: "State: {state}",
      unknownUser: "deleted user",
    },
    detail: {
      back: "Back to approvals",
      history: "History",
      created: "{name} opened the request",
      moved: "{name} ran “{action}”: {from} → {to}",
      decideTitle: "Your decision",
      noActions: "You have no actions available in this state.",
      comment: "Comment",
      commentHint: "It stays in the history and the requester can read it.",
      commentRequired: "required for “{action}”",
      sending: "Sending…",
      done: "Done: the request moved to “{state}”.",
    },
    errors: {
      unauthenticated: "Your session expired. Sign in again.",
      forbidden: "You do not have permission for this action.",
      invalid_input: "Check the data you sent.",
      invalid_flow: "The approval flow is not valid.",
      flow_not_found: "The approval flow does not exist.",
      flow_inactive: "The approval flow is disabled.",
      request_not_found: "The request does not exist.",
      already_open: "There is already an open request for this record.",
      invalid_transition: "That action is not valid in the current state.",
      self_approval: "You cannot decide on your own request.",
      comment_required: "This action requires a comment.",
      conflict: "The request changed while you were looking at it. Reload the page.",
      unknown: "The action could not be completed. Try again.",
    },
    notify: {
      pending: "Request to decide: {title}",
      changed: "“{title}” moved to “{state}”",
    },
  },
}
