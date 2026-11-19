/**
 * Example flows the seed saves (and that a module or app may copy). Pure data,
 * validated by `defineFlow` when saved.
 */
import type { FlowDefinitionInput } from "./contracts/flow"

/** One decision: an admin (or owner) approves or rejects; the requester may cancel. */
export const SIMPLE_FLOW: FlowDefinitionInput = {
  key: "aprobacion-simple",
  name: { es: "Aprobación simple", en: "Simple approval" },
  initial: "pending",
  states: [
    { key: "pending", label: { es: "Pendiente", en: "Pending" } },
    { key: "approved", label: { es: "Aprobada", en: "Approved" }, final: true },
    { key: "rejected", label: { es: "Rechazada", en: "Rejected" }, final: true },
    { key: "cancelled", label: { es: "Cancelada", en: "Cancelled" }, final: true },
  ],
  transitions: [
    { action: "approve", from: "pending", to: "approved", label: { es: "Aprobar", en: "Approve" }, roles: ["admin", "owner"], comment: "optional" },
    { action: "reject", from: "pending", to: "rejected", label: { es: "Rechazar", en: "Reject" }, roles: ["admin", "owner"], comment: "required" },
    { action: "cancel", from: "pending", to: "cancelled", label: { es: "Cancelar solicitud", en: "Cancel request" }, roles: ["$requester"], comment: "none" },
  ],
}

/** Two levels: an admin reviews, the owner approves; either can send it back for changes. */
export const EXPENSE_FLOW: FlowDefinitionInput = {
  key: "gasto-dos-niveles",
  name: { es: "Gasto en dos niveles", en: "Two-level expense" },
  initial: "submitted",
  states: [
    { key: "submitted", label: { es: "Enviado", en: "Submitted" } },
    { key: "reviewed", label: { es: "Revisado", en: "Reviewed" } },
    { key: "changes", label: { es: "Con cambios pedidos", en: "Changes requested" } },
    { key: "approved", label: { es: "Aprobado", en: "Approved" }, final: true },
    { key: "rejected", label: { es: "Rechazado", en: "Rejected" }, final: true },
  ],
  transitions: [
    { action: "review", from: "submitted", to: "reviewed", label: { es: "Dar visto bueno", en: "Sign off" }, roles: ["admin"] },
    { action: "ask_changes", from: "submitted", to: "changes", label: { es: "Pedir cambios", en: "Request changes" }, roles: ["admin"], comment: "required" },
    { action: "resubmit", from: "changes", to: "submitted", label: { es: "Reenviar", en: "Resubmit" }, roles: ["$requester"] },
    { action: "approve", from: "reviewed", to: "approved", label: { es: "Aprobar", en: "Approve" }, roles: ["owner"] },
    { action: "reject", from: "reviewed", to: "rejected", label: { es: "Rechazar", en: "Reject" }, roles: ["owner"], comment: "required" },
  ],
}

export const EXAMPLE_FLOWS = [SIMPLE_FLOW, EXPENSE_FLOW]
