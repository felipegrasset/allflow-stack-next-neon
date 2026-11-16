import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * One published course with three lessons (one is a live class) and one draft,
 * with fixed ids so running it again does nothing. The first user is enrolled in
 * the published course with the first lesson seen. No users yet → nothing to seed.
 * Invented data.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const user = await db.selectFrom("user").select("id").orderBy("createdAt", "asc").limit(1).executeTakeFirst()
  if (!user) return
  const day = 24 * 3600 * 1000
  const t0 = Date.now()

  await db
    .insertInto("courses_courses")
    .values([
      {
        id: "courses-seed-1",
        title: "Introducción al diseño de menús",
        summary: "Cómo armar una carta clara y rentable para un café de barrio.",
        description:
          "Un curso corto para quien abre su primer local.\n\n- Aprenderás a ordenar una carta.\n- Calcularás costos por plato.\n- Practicarás con ejemplos reales.",
        status: "published",
        created_by: user.id,
      },
      {
        id: "courses-seed-2",
        title: "Fotografía de producto con el celular",
        summary: "Borrador: aún sin publicar.",
        description: "Material en preparación.",
        status: "draft",
        created_by: user.id,
      },
    ])
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()

  await db
    .insertInto("courses_lessons")
    .values([
      {
        id: "courses-seed-1-l1",
        course_id: "courses-seed-1",
        title: "Qué es una buena carta",
        body: "## Lo esencial\n\nUna carta **clara** vende más. Tres ideas:\n\n1. Menos platos, mejor elegidos.\n2. Agrupa por momento del día.\n3. Cuida los nombres: *simples y honestos*.",
        position: 1,
      },
      {
        id: "courses-seed-1-l2",
        course_id: "courses-seed-1",
        title: "Costos por plato",
        body: "Anota cada ingrediente con su precio y su rendimiento.\n\n> Un plato sin costo calculado es una apuesta.",
        position: 2,
      },
      {
        id: "courses-seed-1-l3",
        course_id: "courses-seed-1",
        title: "Clase en vivo: revisemos tu carta",
        body: "Trae tu carta actual y la revisamos juntos.",
        position: 3,
        meeting_url: "https://meet.example.com/menus-en-vivo",
        starts_at: new Date(t0 + 7 * day),
      },
    ])
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()

  await db
    .insertInto("courses_enrollments")
    .values({ course_id: "courses-seed-1", user_id: user.id })
    .onConflict((oc) => oc.columns(["course_id", "user_id"]).doNothing())
    .execute()
  await db
    .insertInto("courses_progress")
    .values({ lesson_id: "courses-seed-1-l1", user_id: user.id, course_id: "courses-seed-1" })
    .onConflict((oc) => oc.columns(["lesson_id", "user_id"]).doNothing())
    .execute()
}
