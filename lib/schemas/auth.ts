import { z } from "zod"

/**
 * Shared by the client form (RHF + zodResolver) and the Server Action
 * (safeParse again: Server Actions are reachable by direct POST).
 */

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  email: z.string().trim().min(1, "El correo es obligatorio").email("Correo no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const loginSchema = z.object({
  email: z.string().trim().min(1, "El correo es obligatorio").email("Correo no válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})
export type LoginInput = z.infer<typeof loginSchema>

export type FormResult<K extends string> =
  | { ok: true; redirectTo: string }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<K, string>> }
