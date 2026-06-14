import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import ChangePasswordSettings from '@/components/settings/ChangePasswordSettings'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import NotificationSettings from '@/components/settings/NotificationSettings'
import DangerZoneSettings from '@/components/settings/DangerZoneSettings'

export default function Settings() {
  const navigate = useNavigate()
  const [notificationsDirty, setNotificationsDirty] = useState(false)
  const dirty = notificationsDirty

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
        <AccountSidebar />
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your appearance, security, and notification preferences.
            </p>
          </div>
          <ChangePasswordSettings />
          <AppearanceSettings />
          <NotificationSettings onDirtyChange={setNotificationsDirty} />
          <DangerZoneSettings />
        </div>
      </main>
    </div>
  )
}
