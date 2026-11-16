import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"
import { en, es } from "./messages"

/** Titles come from the catalog: es articles read the es values, en articles the en ones. */
const es_ = es["help-center"].seed
const en_ = en["help-center"].seed

/**
 * Invented sample content. Idempotent: fixed ids and slugs + `on conflict do
 * nothing`, so re-running never duplicates nor overwrites what the team edited.
 */
const ARTICLES = [
  {
    id: "seed-hc-a1",
    slug: "primeros-pasos",
    title: es_.gettingStartedTitle,
    summary: "Qué hacer después de crear tu cuenta.",
    category: "Primeros pasos",
    locale: "es",
    sort_order: 0,
    published: true,
    body: "Bienvenida o bienvenido. Estos son los pasos para empezar:\n\n1. Completa tu perfil.\n2. Invita a tu equipo.\n3. Crea tu primer proyecto.\n\nSi te quedas con dudas, escríbenos desde [la página de contacto](/contacto).",
  },
  {
    id: "seed-hc-a2",
    slug: "como-cambiar-tu-contrasena",
    title: es_.changePasswordTitle,
    summary: "Actualiza tu contraseña en menos de un minuto.",
    category: "Cuenta",
    locale: "es",
    sort_order: 0,
    published: true,
    body: "## Desde tu perfil\n\n1. Entra a **Ajustes** y abre *Seguridad*.\n2. Escribe tu contraseña actual y la nueva.\n3. Guarda los cambios.\n\n## Si la olvidaste\n\nUsa «Olvidé mi contraseña» en la pantalla de ingreso: te enviamos un enlace por correo.",
  },
  {
    id: "seed-hc-a3",
    slug: "invitar-a-tu-equipo",
    title: es_.inviteTeamTitle,
    summary: "Agrega personas y elige qué pueden hacer.",
    category: "Cuenta",
    locale: "es",
    sort_order: 1,
    published: true,
    body: "Desde **Usuarios** puedes invitar por correo.\n\n- Administración: gestiona todo.\n- Miembro: trabaja con los datos, sin cambiar la configuración.\n\n> Las invitaciones vencen a los 7 días.",
  },
  {
    id: "seed-hc-a4",
    slug: "descargar-una-factura",
    title: es_.downloadInvoiceTitle,
    summary: "Dónde encontrar tus comprobantes de pago.",
    category: "Facturación",
    locale: "es",
    sort_order: 0,
    published: true,
    body: "Las facturas están en **Facturación**, bajo el historial de pagos. Pulsa el ícono de descarga junto a cada cobro.\n\nSi falta alguna, avísanos con el número de la operación.",
  },
  {
    id: "seed-hc-a5",
    slug: "nuevo-plan-en-borrador",
    title: es_.changePlanDraftTitle,
    summary: "Este artículo aún no se publica.",
    category: "Facturación",
    locale: "es",
    sort_order: 1,
    published: false,
    body: "Pendiente de redactar: pasos para subir o bajar de plan.",
  },
  {
    id: "seed-hc-a6",
    slug: "getting-started",
    title: en_.gettingStartedTitle,
    summary: "What to do after creating your account.",
    category: "Getting started",
    locale: "en",
    sort_order: 0,
    published: true,
    body: "Welcome! To get going:\n\n1. Complete your profile.\n2. Invite your team.\n3. Create your first project.",
  },
  {
    id: "seed-hc-a7",
    slug: "change-your-password",
    title: en_.changePasswordTitle,
    summary: "Update your password in under a minute.",
    category: "Account",
    locale: "en",
    sort_order: 0,
    published: true,
    body: "Open **Settings**, go to *Security*, enter your current and new password, then save.",
  },
]

const FEEDBACK = [
  { id: "seed-hc-f1", article_id: "seed-hc-a1", voter_hash: "seed-voter-0001", helpful: true, comment: null },
  { id: "seed-hc-f2", article_id: "seed-hc-a1", voter_hash: "seed-voter-0002", helpful: true, comment: "Claro y corto." },
  { id: "seed-hc-f3", article_id: "seed-hc-a2", voter_hash: "seed-voter-0003", helpful: false, comment: "No encuentro la opción Seguridad en el móvil." },
  { id: "seed-hc-f4", article_id: "seed-hc-a4", voter_hash: "seed-voter-0004", helpful: true, comment: null },
]

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto("help_center_articles")
    .values(ARTICLES.map((a) => ({ ...a, published_at: a.published ? new Date() : null })))
    .onConflict((oc) => oc.doNothing())
    .execute()
  // Ratings only for articles that exist (an editor may have deleted a seeded one).
  const ids = (
    await db
      .selectFrom("help_center_articles")
      .select("id")
      .where("id", "in", ARTICLES.map((a) => a.id))
      .execute()
  ).map((r) => r.id)
  const rows = FEEDBACK.filter((f) => ids.includes(f.article_id))
  if (rows.length)
    await db
      .insertInto("help_center_feedback")
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()
}
