import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Navbar from '@/components/Navbar'
import SettingsSidebar, { type SettingsTab } from '@/components/settings/SettingsSidebar'
import ProfileSettings from '@/components/settings/ProfileSettings'
import AIPreferencesSettings from '@/components/settings/AIPreferencesSettings'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import SecuritySettings from '@/components/settings/SecuritySettings'

export default function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [dirtyTabs, setDirtyTabs] = useState<Record<SettingsTab, boolean>>({
    profile: false,
    ai: false,
    appearance: false,
    security: false,
  })
  const dirty = Object.values(dirtyTabs).some(Boolean)

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={handleBack} />
      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        <SettingsSidebar activeTab={activeTab} onChange={setActiveTab} />
        <div className="flex-1 min-w-0">
          {/* All tabs stay mounted so their data loads ahead of time and edits persist across tab switches */}
          <div className={cn(activeTab !== 'profile' && 'hidden')}>
            <ProfileSettings onDirtyChange={(d) => setDirtyTabs((p) => ({ ...p, profile: d }))} />
          </div>
          <div className={cn(activeTab !== 'ai' && 'hidden')}>
            <AIPreferencesSettings onDirtyChange={(d) => setDirtyTabs((p) => ({ ...p, ai: d }))} />
          </div>
          <div className={cn(activeTab !== 'appearance' && 'hidden')}>
            <AppearanceSettings />
          </div>
          <div className={cn(activeTab !== 'security' && 'hidden')}>
            <SecuritySettings />
          </div>
        </div>
      </main>
    </div>
  )
}
