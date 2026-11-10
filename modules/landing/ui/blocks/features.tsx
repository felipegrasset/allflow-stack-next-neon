import {
  BarChart3,
  Clock,
  Globe,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

import type { CopyOf, ICONS } from "../../schema"
import { Heading, Section } from "../shared"

type Props = {
  id: string
  variant: "columns" | "bento"
  copy: CopyOf<"features">
}

const ICON_MAP: Record<(typeof ICONS)[number], LucideIcon> = {
  zap: Zap,
  shield: ShieldCheck,
  layers: Layers,
  clock: Clock,
  chart: BarChart3,
  users: Users,
  sparkles: Sparkles,
  globe: Globe,
}

/**
 * Módulos de altura constante con una frase cada uno: la grilla estira todas
 * las tarjetas a la fila más alta (`auto-rows-fr`) y el esquema topa el largo.
 */
export function FeaturesBlock({ id, variant, copy }: Props) {
  const bento = variant === "bento"
  return (
    <Section id={id} type="features" variant={variant}>
      <div className="mb-10 flex max-w-2xl flex-col gap-3">
        <Heading id={id}>{copy.heading}</Heading>
        {copy.intro && (
          <p className="text-lg text-muted-foreground">{copy.intro}</p>
        )}
      </div>
      <ul
        className={cn(
          "grid auto-rows-fr gap-4",
          bento
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {copy.items.map((item, i) => {
          const Icon = ICON_MAP[item.icon ?? "sparkles"]
          return (
            <li
              key={item.title}
              className={cn(
                "flex min-h-40 flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground",
                bento && i % 4 === 0 && "lg:col-span-2",
                bento && i % 4 === 3 && "lg:col-span-2"
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
