import { notFound } from "next/navigation"

import { CalendarHome } from "@/components/home/calendar"
import { CatalogHome } from "@/components/home/catalog"
import { FeedHome } from "@/components/home/feed"
import { HomeLoading } from "@/components/home/loading"
import { KanbanHome } from "@/components/home/kanban"
import { KpisListHome } from "@/components/home/kpis-list"
import { TableHome } from "@/components/home/table"
import type { HomeColumn, HomeRow } from "@/components/home/types"
import { noopMove } from "./actions"

/**
 * Development-only gallery of the six home layouts with sample data, each in
 * light, dark and a 375 px frame. 404 in production.
 */
export default function HomeGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const columns: HomeColumn[] = [
    { key: "room", label: "Sala" },
    { key: "member", label: "Socio" },
    { key: "when", label: "Fecha" },
    { key: "status", label: "Estado" },
  ]
  const rows: HomeRow[] = [
    ["Sala Azul", "Ana Pérez", "2026-10-05 10:00", "Aprobada"],
    ["Sala Verde", "Luis Soto", "2026-10-05 12:00", "Pendiente"],
    ["Sala Azul", "Marta Díaz", "2026-10-06 09:00", "Aprobada"],
    ["Sala Roja", "Pedro Rojas", "2026-10-07 15:30", "Cancelada"],
  ].map(([room, member, when, status], i) => ({
    id: String(i),
    href: "#",
    cells: { room, member, when, status },
  }))
  const empty = {
    title: "Todavía no hay reservas",
    description: "Crea la primera.",
    action: { href: "#", label: "Nueva reserva" },
  }
  const statuses = [
    { value: "pendiente", label: "Pendiente" },
    { value: "aprobada", label: "Aprobada" },
    { value: "cancelada", label: "Cancelada" },
  ]

  const layouts: { name: string; node: React.ReactNode }[] = [
    {
      name: "kpis+list",
      node: (
        <KpisListHome
          title="Reservas"
          kpis={[
            { label: "Hoy", value: "6" },
            { label: "Pendientes", value: "2", hint: "por aprobar" },
            { label: "Ocupación", value: "74%" },
          ]}
          listTitle="Últimas reservas"
          columns={columns}
          rows={rows}
          empty={empty}
        />
      ),
    },
    {
      name: "calendar",
      node: (
        <CalendarHome
          title="Agenda"
          locale="es"
          weekStart="2026-10-05"
          upcomingTitle="Próximas"
          events={[
            { id: "1", title: "Sala Azul", subtitle: "Ana Pérez", start: "2026-10-05T10:00:00Z", href: "#" },
            { id: "2", title: "Sala Verde", subtitle: "Luis Soto", start: "2026-10-07T12:00:00Z" },
            { id: "3", title: "Sala Roja", subtitle: "Marta Díaz", start: "2026-10-14T09:00:00Z" },
          ]}
          empty={empty}
        />
      ),
    },
    {
      name: "kanban",
      node: (
        <KanbanHome
          title="Pipeline"
          columns={statuses}
          cards={[
            { id: "a", title: "Sala Azul · Ana", subtitle: "5 oct", status: "pendiente" },
            { id: "b", title: "Sala Verde · Luis", subtitle: "5 oct", status: "aprobada" },
            { id: "c", title: "Sala Roja · Pedro", subtitle: "7 oct", status: "cancelada" },
          ]}
          onMove={noopMove}
          empty={empty}
        />
      ),
    },
    {
      name: "catalog",
      node: (
        <CatalogHome
          title="Catálogo"
          items={[
            { id: "1", name: "Sala Azul", price: "$12.000 / h", href: "#" },
            { id: "2", name: "Sala Verde", price: "$9.000 / h" },
            { id: "3", name: "Sala Roja", price: "$15.000 / h" },
          ]}
          empty={empty}
        />
      ),
    },
    {
      name: "feed",
      node: (
        <FeedHome
          title="Novedades"
          items={[
            {
              id: "1",
              title: "Nueva sala disponible",
              body: "Ya puedes reservar la Sala Violeta.",
              author: "Admin",
              date: "2026-10-02",
            },
            { id: "2", title: "Mantención programada", author: "Admin", date: "2026-09-28" },
          ]}
          empty={empty}
        />
      ),
    },
    {
      name: "table",
      node: <TableHome title="Reservas" columns={columns} rows={rows} filterKeys={["status"]} empty={empty} />,
    },
  ]

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 p-6">
      <h1 className="text-3xl font-semibold">Home gallery (dev)</h1>
      {layouts.map(({ name, node }) => (
        <section key={name} className="flex flex-col gap-3">
          <h2 className="font-mono text-sm text-muted-foreground">{name}</h2>
          <div className="grid gap-4 lg:grid-cols-[1fr_375px]">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border bg-background p-4 text-foreground">{node}</div>
              <div className="dark rounded-xl border bg-background p-4 text-foreground">{node}</div>
            </div>
            <div className="w-[375px] max-w-full rounded-xl border bg-background p-3 text-foreground">{node}</div>
          </div>
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-sm text-muted-foreground">loading / empty</h2>
        <HomeLoading />
        <div className="grid gap-4 md:grid-cols-2">
          <KpisListHome title="Vacío" kpis={[]} listTitle="Últimas" columns={columns} rows={[]} empty={empty} />
          <CatalogHome title="Vacío" items={[]} empty={empty} />
        </div>
      </section>
    </main>
  )
}
