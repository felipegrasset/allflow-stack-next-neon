"use server"

/** Gallery stand-in for a real status-change action: accepts and ignores. */
export async function noopMove(id: string, status: string) {
  void id
  void status
}
