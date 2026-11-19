/** The function behind `contracts/enrollUser`. Server-only; does not check session or permission. */
import { getKysely } from "@/server/db/pool"

import { enrollUserWith, type EnrollFailure } from "./store"

export type EnrollResult = { ok: true; created: boolean } | { ok: false; reason: EnrollFailure }

/**
 * Enrolls `userId` in a published course (idempotent). The caller is
 * responsible for deciding WHO may enroll (a purchase webhook, an admin
 * action): this function only refuses unknown courses, drafts and unknown users.
 */
export async function enrollUser(input: { courseId: string; userId: string }): Promise<EnrollResult> {
  return enrollUserWith(getKysely(), input.courseId, input.userId)
}
