import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { getPreferences, upsertPreferences } from '@/services/preferences'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { JobLevel, Tone, UserPreferencesInput, WritingStyle } from '@/types/preferences'
import { getAiUsageStats } from '@/services/aiUsage'
import type { AiUsageAction, AiUsageStats } from '@/types/aiUsage'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

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

const MODEL_OPTIONS: { value: string; label: string; registeredOnly?: boolean }[] = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Default)' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'claude-fable-5', label: 'Claude Fable 5', registeredOnly: true },
]

const MODEL_INFO: { feature: string; model: string; description: string }[] = [
  {
    feature: 'Resume Parsing',
    model: 'Claude Haiku 4.5',
    description: 'fast, validates & parses uploads',
  },
  {
    feature: 'Enrichment & Tailoring',
    model: 'Your Default AI Model',
    description: 'quality rewriting',
  },
  {
    feature: 'Cover Letters',
    model: 'Your Default AI Model',
    description: 'quality writing',
  },
  {
    feature: 'ATS Scoring',
    model: 'Your Default AI Model',
    description: 'keyword & compatibility analysis',
  },
]

const ACTION_LABELS: Record<AiUsageAction, string> = {
  parse: 'Parse Resume',
  enrich: 'Enrich Resume',
  tailor: 'Tailor Resume',
  cover_letter: 'Cover Letter',
  cover_letter_improve: 'Improve Cover Letter',
  ats_score: 'ATS Score',
}

export default function AI() {
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const availableModelOptions = MODEL_OPTIONS.filter((opt) => !opt.registeredOnly || !isGuest)

  // --- AI Preferences state ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initial, setInitial] = useState<UserPreferencesInput>(DEFAULT_PREFERENCES)
  const [prefs, setPrefs] = useState<UserPreferencesInput>(DEFAULT_PREFERENCES)
  const [techDetailsOpen, setTechDetailsOpen] = useState(false)

  // --- AI Usage state ---
  const [usageLoading, setUsageLoading] = useState(true)
  const [usage, setUsage] = useState<AiUsageStats | null>(null)

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial)

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    let active = true
    getPreferences()
      .then((data) => {
        if (!active) return
        const loadedModel = data?.default_model ?? DEFAULT_PREFERENCES.default_model
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
              // Guests can't use Fable — fall back to the baseline default rather than erroring.
              default_model: loadedModel === 'claude-fable-5' && isGuest
                ? DEFAULT_PREFERENCES.default_model
                : loadedModel,
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

  useEffect(() => {
    let active = true
    getAiUsageStats()
      .then((stats) => {
        if (!active) return
        setUsage(stats)
      })
      .catch((err) => {
        if (!active) return
        toast.error(err instanceof Error ? err.message : 'Failed to load AI usage')
      })
      .finally(() => {
        if (active) setUsageLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  const update = <K extends keyof UserPreferencesInput>(key: K, value: UserPreferencesInput[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
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
        default_model: saved.default_model ?? DEFAULT_PREFERENCES.default_model,
      }
      setInitial(next)
      setPrefs(next)
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={handleBack} />
      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        <AccountSidebar />
        <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Preferences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set how Resume AI tailors your resume, cover letters, and ATS suggestions.
          </p>
        </div>

        {/* AI Preferences card */}
        {loading ? (
          <Card>
            <CardHeader>
              <CardTitle>AI Preferences</CardTitle>
              <CardDescription>Set your tone, style, and industry for tailored AI output.</CardDescription>
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>AI Preferences</CardTitle>
              <CardDescription>Set your tone, style, and industry for tailored AI output.</CardDescription>
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

              <div className="space-y-1.5">
                <Label htmlFor="default-model">Default AI Model</Label>
                <p className="text-xs text-muted-foreground">
                  Used for AI Enhancement, tailoring, cover letters, and ATS scoring unless overridden per task.
                </p>
                <Select
                  value={prefs.default_model ?? DEFAULT_PREFERENCES.default_model}
                  onValueChange={(value) => update('default_model', value)}
                >
                  <SelectTrigger id="default-model" className="w-full min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModelOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isGuest && (
                  <p className="text-xs text-muted-foreground">Sign in to unlock Claude Fable 5.</p>
                )}
              </div>
            </CardContent>

            <CardFooter>
              <Button onClick={handleSave} disabled={saving || !dirty} className="min-h-[44px]">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* AI Usage card */}
        <Card>
          <CardHeader>
            <CardTitle>AI Usage</CardTitle>
            <CardDescription>Your activity across all AI-powered features.</CardDescription>
          </CardHeader>

          {usageLoading ? (
            <CardContent>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted" />
              ))}
            </CardContent>
          ) : (
            <CardContent>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{usage?.totalCalls ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total AI Calls</p>
                </div>
                <div className="rounded-lg border border-border px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{usage?.callsThisMonth ?? 0}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">By Action</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(ACTION_LABELS).map(([action, label]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{label}</span>
                      <span className="text-sm font-bold text-foreground">
                        {usage?.callsByAction[action as AiUsageAction] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Activity</p>
                {usage && usage.recent.length > 0 ? (
                  <div className="space-y-1.5">
                    {usage.recent.slice(0, 10).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="size-3.5 shrink-0 text-primary" />
                          <span className="text-sm text-foreground truncate">
                            {ACTION_LABELS[entry.action]}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{entry.model}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(entry.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No AI activity yet — generate or tailor a resume to see usage here.
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        {/* Technical Details collapsible card */}
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setTechDetailsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary/40 transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground">Technical details</span>
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform ${techDetailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {techDetailsOpen && (
            <div className="px-5 pb-4 border-t border-border bg-secondary/20">
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                Resume AI uses Claude Haiku for fast parsing and validation of uploaded resumes. For enrichment,
                tailoring, cover letter generation, and ATS scoring, Resume AI uses your Default AI Model above
                (or the model you pick on the AI Enhancement stage) — Claude Sonnet 4.6 by default.
              </p>
              <div className="mt-3 space-y-1.5">
                {MODEL_INFO.map((item) => (
                  <div
                    key={item.feature}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5"
                  >
                    <span className="text-xs text-muted-foreground">{item.feature}</span>
                    <span className="text-xs text-muted-foreground/70">
                      {item.model} — {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
