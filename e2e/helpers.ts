import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import pg from "pg"

import { OUTBOX } from "../playwright.config"

export const AUTH_DIR = join(import.meta.dirname, ".auth")
export const STATE = {
  admin: join(AUTH_DIR, "admin.json"),
  member: join(AUTH_DIR, "member.json"),
  pending: join(AUTH_DIR, "pending.json"),
}
export const USERS_FILE = join(AUTH_DIR, "users.json")
export type E2EUsers = Record<"admin" | "member" | "target" | "pending", { name: string; email: string; password: string }>

export function users(): E2EUsers {
  return JSON.parse(readFileSync(USERS_FILE, "utf8")) as E2EUsers
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

type Mail = { to: string; subject: string; text: string }

function mails(): Mail[] {
  if (!existsSync(OUTBOX)) return []
  return readFileSync(OUTBOX, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Mail)
}

export function mailCount(to: string, subject: RegExp): number {
  return mails().filter((m) => m.to === to && subject.test(m.subject)).length
}

/** Polls the dev outbox for the latest email to `to` (after `skip` older ones) and returns its first link. */
export async function linkFor(to: string, subject: RegExp, skip = 0): Promise<string> {
  for (let i = 0; i < 75; i++) {
    const matching = mails().filter((m) => m.to === to && subject.test(m.subject))
    const url = matching.length > skip ? matching.at(-1)?.text.match(/https?:\/\/\S+/)?.[0] : undefined
    if (url) return url
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No llegó ningún correo "${subject}" a ${to}`)
}

/** Direct DB access for setup fix-ups only (the app never trusts tests). */
export async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function signUp(page: Page, u: { name: string; email: string; password: string }) {
  await page.goto("/signup")
  await page.getByLabel("Nombre").fill(u.name)
  await page.getByLabel("Correo electrónico").fill(u.email)
  await page.getByLabel("Contraseña").fill(u.password)
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  await expect(page).toHaveURL(/\/verify-email\?email=/)
}

/** Opens the verification link; lands signed in on the "verified" screen. */
export async function verify(page: Page, email: string) {
  await page.goto(await linkFor(email, /Confirma tu correo/))
  await expect(page.getByRole("heading", { name: "¡Cuenta verificada!" })).toBeVisible()
}

export async function skipOnboarding(page: Page) {
  await page.goto("/onboarding")
  await page.getByRole("button", { name: "Saltar por ahora" }).click()
  await expect(page.getByTestId("session-email")).toBeVisible()
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByTestId("toast").filter({ hasText: text }).first()).toBeVisible()
}
