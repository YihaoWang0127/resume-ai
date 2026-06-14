import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getPreferences, upsertPreferences } from '@/services/preferences'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { UserPreferencesInput } from '@/types/preferences'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

interface Props {
  onDirtyChange: (dirty: boolean) => void
}

export default function NotificationSettings({ onDirtyChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initial, setInitial] = useState<UserPreferencesInput>(DEFAULT_PREFERENCES)
  const [prefs, setPrefs] = useState<UserPreferencesInput>(DEFAULT_PREFERENCES)

  useEffect(() => {
    let active = true
    getPreferences()
      .then((data) => {
        if (!active) return
        const next: UserPreferencesInput = data
          ? {
              ...DEFAULT_PREFERENCES,
              tone: data.tone,
              writing_style: data.writing_style,
              industry: data.industry,
              job_level: data.job_level,
              ats_mode: data.ats_mode,
              notify_export_complete: data.notify_export_complete,
              notify_product_updates: data.notify_product_updates,
            }
          : DEFAULT_PREFERENCES
        setInitial(next)
        setPrefs(next)
      })
      .catch((err) => {
        if (!active) return
        toast.error(err instanceof Error ? err.message : 'Failed to load preferences')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const update = <K extends keyof UserPreferencesInput>(key: K, value: UserPreferencesInput[K]) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    onDirtyChange(JSON.stringify(next) !== JSON.stringify(initial))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await upsertPreferences(prefs)
      const next: UserPreferencesInput = {
        tone: saved.tone,
        writing_style: saved.writing_style,
        industry: saved.industry,
        job_level: saved.job_level,
        ats_mode: saved.ats_mode,
        notify_export_complete: saved.notify_export_complete,
        notify_product_updates: saved.notify_product_updates,
      }
      setInitial(next)
      setPrefs(next)
      onDirtyChange(false)
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which emails ResumeAI sends you.</CardDescription>
        </CardHeader>
        <CardContent>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(initial)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose which emails ResumeAI sends you.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-export">Export Complete Emails</Label>
            <p className="text-xs text-muted-foreground">
              Email me when a resume or cover letter export finishes.
            </p>
          </div>
          <Switch
            id="notify-export"
            checked={prefs.notify_export_complete}
            onCheckedChange={(checked) => update('notify_export_complete', checked)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="notify-product">Product Updates</Label>
            <p className="text-xs text-muted-foreground">
              Email me about new features and tips.
            </p>
          </div>
          <Switch
            id="notify-product"
            checked={prefs.notify_product_updates}
            onCheckedChange={(checked) => update('notify_product_updates', checked)}
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} disabled={saving || !isDirty} className="min-h-[44px]">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  )
}
