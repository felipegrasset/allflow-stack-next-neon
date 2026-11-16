/**
 * The only thing another module may import from `courses`:
 *
 *   import { enrollUser, progressSummary } from "@/modules/courses/contracts"
 *   await enrollUser({ courseId, userId })   // e.g. after a purchase; the caller already checked who may do it
 *
 * `enrollUser` is server-only and does NOT check session or permission (the
 * caller did); it refuses unknown users and draft courses. The rest is pure.
 */
export { enrollUser, type EnrollResult } from "../server/api"
export {
  COURSE_STATUSES,
  applySeen,
  canEnroll,
  canViewCourse,
  isCourseStatus,
  nextLessonId,
  parseMeetingUrl,
  planMarkSeen,
  progressSummary,
  type CourseStatus,
  type MarkSeenPlan,
  type MeetingUrlResult,
  type ProgressSummary,
  type Viewer,
} from "./domain"
export { courseSchemas, type CourseInput, type LessonInput } from "./input"
