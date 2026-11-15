/** Locale-neutral duration: "850 ms", "12.3 s", "4 min 5 s". */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—"
  if (ms < 1_000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`
  const min = Math.floor(ms / 60_000)
  return `${min} min ${Math.round((ms % 60_000) / 1_000)} s`
}
