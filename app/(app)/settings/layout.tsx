import { SettingsNav } from "@/components/settings-nav"
import { getCopy } from "@/modules/i18n/server/copy"
import { visibleModuleNav } from "@/server/module-access"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [profileCopy, moduleLinks] = await Promise.all([
    getCopy("profile"),
    // Links of installed modules with `area: "settings"` this person may see.
    visibleModuleNav("settings"),
  ])
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium text-muted-foreground">{profileCopy.settings.title}</p>
      <SettingsNav moduleLinks={moduleLinks} />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
