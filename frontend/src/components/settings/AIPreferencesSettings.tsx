import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getPreferences, upsertPreferences } from '@/services/preferences'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { JobLevel, Tone, UserPreferencesInput, WritingStyle } from '@/types/preferences'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface Props {
  onDirtyChange: (dirty: boolean) => void
}

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'executive', label: 'Executive' },
]

const WRITING_STYLE_OPTIONS: { value: WritingStyle; label: string }[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'keyword-optimized', label: 'Keyword-Optimized' },
]

const JOB_LEVEL_OPTIONS: { value: JobLevel; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
]

export default function AIPreferencesSettings({ onDirtyChange }: Props) {
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
              tone: data.tone,
              writing_style: data.writing_style,
              industry: data.industry,
              job_level: data.job_level,
              ats_mode: data.ats_mode,
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
          <CardTitle>AI Preferences</CardTitle>
          <CardDescription>Tune how Claude writes and tailors your content.</CardDescription>
        </CardHeader>
        <CardContent>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(initial)

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Preferences</CardTitle>
        <CardDescription>Tune how Claude writes and tailors your content.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5">
          <Label htmlFor="tone">Tone</Label>
          <Select value={prefs.tone} onValueChange={(value) => update('tone', value as Tone)}>
            <SelectTrigger id="tone" className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="writing-style">Writing Style</Label>
          <Select
            value={prefs.writing_style}
            onValueChange={(value) => update('writing_style', value as WritingStyle)}
          >
            <SelectTrigger id="writing-style" className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WRITING_STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="industry">Target Industry</Label>
          <Input
            id="industry"
            value={prefs.industry}
            onChange={(e) => update('industry', e.target.value)}
            placeholder="e.g. Software Engineering, Healthcare, Finance"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job-level">Job Level</Label>
          <Select value={prefs.job_level} onValueChange={(value) => update('job_level', value as JobLevel)}>
            <SelectTrigger id="job-level" className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="ats-mode">ATS Mode</Label>
            <p className="text-xs text-muted-foreground">Strip rich formatting for ATS parsers.</p>
          </div>
          <Switch
            id="ats-mode"
            checked={prefs.ats_mode}
            onCheckedChange={(checked) => update('ats_mode', checked)}
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
