import type { es } from "./es"

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }

/** The shape every locale must have: es.ts's keys, with plain `string` leaves. */
export type Messages = Widen<typeof es>
