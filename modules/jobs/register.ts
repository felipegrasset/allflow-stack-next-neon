/**
 * The list of jobs this app runs. The route handler and /admin/jobs import this
 * file, so a job only exists once it is imported here. Edit it by hand: add one
 * line per file that calls `defineJob`, e.g.
 *
 *   import "@/lib/jobs/send-reminders"
 *
 * (keep your jobs outside `modules/`, and call `defineJob` from
 * "@/modules/jobs/contracts"; another module may also expose a file of jobs).
 */
import "./server/builtin"
