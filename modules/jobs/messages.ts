/** Catalog of the jobs module (entrypoint `messages`). Data only. */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  jobs: {
    nav: "Tareas programadas",
    title: "Tareas programadas",
    subtitle: "Las tareas que corre esta app, cada una con su último resultado. Dos corridas de la misma tarea nunca se solapan.",
    jobs: {
      title: "Tareas",
      empty: "No hay tareas registradas todavía.",
      name: "Tarea",
      description: "Qué hace",
      schedule: "Horario",
      scheduleNone: "Solo a mano",
      last: "Última corrida",
      never: "Nunca corrió",
      run: "Correr ahora",
      running: "Corriendo…",
    },
    runs: {
      title: "Historial",
      count: "{n, plural, =0 {Sin corridas} one {# corrida} other {# corridas}}",
      empty: "Todavía no hay corridas registradas.",
      when: "Cuándo",
      job: "Tarea",
      kind: "Origen",
      status: "Estado",
      duration: "Duración",
      error: "Error",
    },
    kinds: { cron: "Programada", manual: "A mano" },
    statuses: { running: "En curso", succeeded: "Correcta", failed: "Falló" },
    result: {
      succeeded: "La tarea terminó bien.",
      skipped: "Ya hay una corrida en curso: no se lanzó otra.",
      failed: "La tarea falló. El detalle está en el historial.",
    },
    errors: {
      forbidden: "No tienes permiso para correr tareas.",
      notFound: "Esa tarea no existe.",
      generic: "No se pudo correr la tarea. Inténtalo de nuevo.",
    },
    builtin: {
      prune: "Borra del historial las corridas de más de 30 días.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  jobs: {
    nav: "Scheduled jobs",
    title: "Scheduled jobs",
    subtitle: "The jobs this app runs, each with its latest result. Two runs of the same job never overlap.",
    jobs: {
      title: "Jobs",
      empty: "No jobs registered yet.",
      name: "Job",
      description: "What it does",
      schedule: "Schedule",
      scheduleNone: "Manual only",
      last: "Last run",
      never: "Never ran",
      run: "Run now",
      running: "Running…",
    },
    runs: {
      title: "History",
      count: "{n, plural, =0 {No runs} one {# run} other {# runs}}",
      empty: "No runs recorded yet.",
      when: "When",
      job: "Job",
      kind: "Source",
      status: "Status",
      duration: "Duration",
      error: "Error",
    },
    kinds: { cron: "Scheduled", manual: "Manual" },
    statuses: { running: "Running", succeeded: "Succeeded", failed: "Failed" },
    result: {
      succeeded: "The job finished successfully.",
      skipped: "A run is already in progress: no other was started.",
      failed: "The job failed. See the history for details.",
    },
    errors: {
      forbidden: "You do not have permission to run jobs.",
      notFound: "That job does not exist.",
      generic: "The job could not be run. Try again.",
    },
    builtin: {
      prune: "Deletes job runs older than 30 days from the history.",
    },
  },
}
