/**
 * comments catalog (entrypoint `messages`). Data only. The only top-level key
 * is the module id: every key is `comments.…`.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  comments: {
    title: "Comentarios",
    count: "{n, plural, =0 {Sin comentarios} one {# comentario} other {# comentarios}}",
    empty: "Todavía no hay comentarios.",
    unknownUser: "usuario eliminado",
    bodyLabel: "Escribe un comentario",
    bodyHint: "Texto plano. Escribe @ y el nombre de alguien para avisarle.",
    mentionLabel: "Mencionar a alguien",
    mentionPlaceholder: "Elegir persona…",
    submit: "Comentar",
    submitting: "Enviando…",
    added: "Comentario publicado.",
    delete: "Borrar",
    deleting: "Borrando…",
    deleteLabel: "Borrar el comentario de {name}",
    validation: {
      required: "Escribe algo antes de enviar.",
      tooLong: "El comentario es demasiado largo.",
    },
    errors: {
      forbidden: "No tienes permiso para esta acción.",
      invalid: "Revisa el comentario.",
      notFound: "El comentario ya no existe.",
      generic: "No se pudo completar la acción. Inténtalo de nuevo.",
    },
    notify: {
      mention: "{name} te mencionó en un comentario",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  comments: {
    title: "Comments",
    count: "{n, plural, =0 {No comments} one {# comment} other {# comments}}",
    empty: "There are no comments yet.",
    unknownUser: "deleted user",
    bodyLabel: "Write a comment",
    bodyHint: "Plain text. Type @ and someone's name to notify them.",
    mentionLabel: "Mention someone",
    mentionPlaceholder: "Choose a person…",
    submit: "Comment",
    submitting: "Sending…",
    added: "Comment posted.",
    delete: "Delete",
    deleting: "Deleting…",
    deleteLabel: "Delete the comment by {name}",
    validation: {
      required: "Write something before sending.",
      tooLong: "The comment is too long.",
    },
    errors: {
      forbidden: "You do not have permission for this action.",
      invalid: "Check the comment.",
      notFound: "The comment no longer exists.",
      generic: "The action could not be completed. Try again.",
    },
    notify: {
      mention: "{name} mentioned you in a comment",
    },
  },
}
