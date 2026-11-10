import { SettingsNav } from "@/components/settings-nav"
import { getCopy } from "@/modules/i18n/server/copy"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profileCopy = await getCopy("profile")
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium text-muted-foreground">{profileCopy.settings.title}</p>
      <SettingsNav />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
