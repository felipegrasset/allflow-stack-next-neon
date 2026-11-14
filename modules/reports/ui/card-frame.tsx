import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** The frame of every dashboard card: title, optional subtitle and actions, content. */
export function CardFrame({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle>{title}</CardTitle>
            {subtitle ? (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
