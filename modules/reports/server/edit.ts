import type { Dashboard } from "../contracts/definition"

/**
 * Pure edits of a definition's card list. They never touch `sources`: what a
 * dashboard may read is set by code, not by the edit screen.
 */
export function moveCardIn(d: Dashboard, cardId: string, direction: "up" | "down"): Dashboard | null {
  const i = d.cards.findIndex((c) => c.id === cardId)
  const j = direction === "up" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= d.cards.length) return null
  const cards = [...d.cards]
  ;[cards[i], cards[j]] = [cards[j], cards[i]]
  return { ...d, cards }
}

export function removeCardIn(d: Dashboard, cardId: string): Dashboard | null {
  const cards = d.cards.filter((c) => c.id !== cardId)
  return cards.length === d.cards.length ? null : { ...d, cards }
}
