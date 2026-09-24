import { SettingsNav } from "@/components/settings-nav"
import { profileCopy } from "@/lib/copy/profile"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium text-muted-foreground">{profileCopy.settings.title}</p>
      <SettingsNav />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
