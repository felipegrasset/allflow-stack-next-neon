import { EmptyState } from "./empty-state"

/**
 * Lista accesible (`<ul aria-label>`) con estado vacío. Genérica: no sabe qué
 * lista. `renderItem` devuelve el contenido de cada `<li>`.
 */
export function ItemList<T>({
  items,
  getKey,
  renderItem,
  label,
  empty,
}: {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  /** Nombre accesible de la lista. */
  label: string
  empty: { title: string; description?: string }
}) {
  if (items.length === 0) {
    return <EmptyState title={empty.title} description={empty.description} />
  }
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-border rounded-xl border border-border"
    >
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}
