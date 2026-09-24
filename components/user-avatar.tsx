import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/** "Ana María Pérez" → "AP"; "ana@x.com" → "A". The fallback when there is no photo. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return (first + last).toUpperCase()
}

export function UserAvatar({
  name,
  image,
  alt,
  size = "default",
  className,
}: {
  name: string
  image?: string | null
  alt?: string
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      {image && <AvatarImage src={image} alt={alt ?? ""} />}
      {/* The initials are decorative when the name is already on screen next to it. */}
      <AvatarFallback aria-hidden={alt ? undefined : true}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
