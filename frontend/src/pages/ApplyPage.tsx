import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, CheckCircle2, ChevronDown, ChevronRight, FileText, Mail, Target } from 'lucide-react'
import Navbar from '@/components/Navbar'
import ResumePreview from '@/components/ResumePreview'
import { getResume, type SavedResume } from '@/services/resumes'
import { applyToJob, fromBackend, exportResume, exportCoverLetter } from '@/services/api'
import { saveCoverLetter } from '@/services/coverLetters'
import { createApplication } from '@/services/applications'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

// ── types ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'form' | 'generating' | 'done' | 'error'
type StageKey = 'tailoring' | 'cover_letter' | 'ats'
type StageStatus = 'pending' | 'active' | 'done'
type Tab = 'resume' | 'cover_letter'

const STAGES: { key: StageKey; label: string; icon: typeof FileText }[] = [
  { key: 'tailoring',    label: 'Tailoring Resume',       icon: FileText },
  { key: 'cover_letter', label: 'Writing Cover Letter',   icon: Mail },
  { key: 'ats',          label: 'Scoring ATS',            icon: Target },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function atsScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 70) return 'text-primary'
  if (score >= 55) return 'text-yellow-600'
  return 'text-red-500'
}

// ── StageCard ─────────────────────────────────────────────────────────────────

function StageCard({
  stage,
  status,
  pct,
}: {
  stage: (typeof STAGES)[number]
  status: StageStatus
  pct: number
}) {
  const Icon = stage.icon
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div
      className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
        status === 'done'
          ? 'bg-green-500/5 border-green-500/30'
          : status === 'active'
            ? 'bg-primary/5 border-primary/30'
            : 'bg-muted/20 border-border'
      }`}
    >
      {/* Circular ring */}
      <div className="relative w-16 h-16">
        <svg width="64" height="64" className="absolute inset-0 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
          <circle
            cx="32" cy="32" r={r}
            fill="none"
            strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={
              status === 'done'
                ? 'stroke-green-500'
                : status === 'active'
                  ? 'stroke-primary'
                  : 'stroke-muted'
            }
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {status === 'done' ? (
            <CheckCircle2 className="size-6 text-green-500" />
          ) : (
            <Icon
              className={`size-5 ${
                status === 'active' ? 'text-primary animate-pulse' : 'text-muted-foreground'
              }`}
            />
          )}
        </div>
      </div>

      {/* Percentage */}
      <span
        className={`text-base font-bold tabular-nums ${
          status === 'done'
            ? 'text-green-600'
            : status === 'active'
              ? 'text-primary'
              : 'text-muted-foreground'
        }`}
      >
        {Math.round(pct)}%
      </span>

      {/* Label */}
      <span
        className={`text-xs font-semibold text-center leading-tight ${
          status === 'done'
            ? 'text-green-700'
            : status === 'active'
              ? 'text-foreground'
              : 'text-muted-foreground'
        }`}
      >
        {stage.label}
      </span>
    </div>
  )
}

// ── ConnectorLine ─────────────────────────────────────────────────────────────

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div className={`flex items-center shrink-0 ${done ? 'text-green-500' : 'text-muted-foreground/40'}`}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-px w-2 mx-px ${done ? 'bg-green-500' : 'bg-border'}`}
        />
      ))}
      <ChevronRight className="size-3.5 -ml-0.5" />
    </div>
  )
}

// ── ExportDropdown ────────────────────────────────────────────────────────────

function ExportDropdown({
  label,
  formats,
  onExport,
  disabled,
}: {
  label: string
  formats: Array<{ value: string; label: string }>
  onExport: (format: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
          {formats.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setOpen(false); onExport(f.value) }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary/60 transition-colors"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const { resumeId } = useParams<{ resumeId: string }>()
  const navigate = useNavigate()

  // ── state ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading')
  const [resume, setResume] = useState<SavedResume | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // form fields
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  // streaming state
  const [currentStage, setCurrentStage] = useState<StageKey | null>(null)
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set())
  const [stageProgress, setStageProgress] = useState<Record<StageKey, number>>({
    tailoring: 0,
    cover_letter: 0,
    ats: 0,
  })
  const [coverLetterText, setCoverLetterText] = useState('')
  const [tailoredResume, setTailoredResume] = useState<ResumeSchema | null>(null)
  const [tailorParseWarning, setTailorParseWarning] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)

  // results state
  const [activeTab, setActiveTab] = useState<Tab>('resume')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // refs to accumulate streaming text without stale closures
  const tailoringRef = useRef('')
  const coverLetterRef = useRef('')

  // ── progress animation ─────────────────────────────────────────────────────

  // Increment active stage progress
  useEffect(() => {
    if (!currentStage || completedStages.has(currentStage)) return
    const id = setInterval(() => {
      setStageProgress((prev) => ({
        ...prev,
        [currentStage]: Math.min(prev[currentStage] + Math.random() * 4 + 1, 93),
      }))
    }, 350)
    return () => clearInterval(id)
  }, [currentStage, completedStages])

  // Snap completed stages to 100%
  useEffect(() => {
    if (completedStages.size === 0) return
    setStageProgress((prev) => {
      const next = { ...prev }
      completedStages.forEach((s) => { next[s as StageKey] = 100 })
      return next
    })
  }, [completedStages])

  // ── load resume ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resumeId) {
      setPhase('error')
      setErrorMessage('No resume ID provided.')
      return
    }
    getResume(resumeId)
      .then((r) => {
        setResume(r)
        setPhase('form')
      })
      .catch((err: unknown) => {
        console.error('Failed to load resume:', err)
        setPhase('error')
        setErrorMessage('Could not load resume. It may have been deleted or you may not have access.')
      })
  }, [resumeId])

  // ── generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!resume) return

    tailoringRef.current = ''
    coverLetterRef.current = ''
    setCoverLetterText('')
    setTailoredResume(null)
    setAtsResult(null)
    setStreamError(null)
    setTailorParseWarning(false)
    setCompletedStages(new Set())
    setCurrentStage(null)
    setStageProgress({ tailoring: 0, cover_letter: 0, ats: 0 })
    setPhase('generating')

    try {
      const stream = await applyToJob(
        resume.resume_data,
        jobDescription,
        company,
        role,
        resume.career_stage as 'student' | 'early' | 'experienced' | null,
      )

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as {
              type: string
              stage?: string
              text?: string
              data?: Record<string, unknown>
              message?: string
            }

            if (event.type === 'progress' && event.stage) {
              if (event.stage === 'cover_letter') {
                setCompletedStages((prev) => new Set([...prev, 'tailoring']))
              } else if (event.stage === 'ats') {
                setCompletedStages((prev) => new Set([...prev, 'tailoring', 'cover_letter']))
              }
              setCurrentStage(event.stage as StageKey)
            } else if (event.type === 'chunk' && event.stage === 'tailoring' && event.text) {
              tailoringRef.current += event.text
            } else if (event.type === 'chunk' && event.stage === 'cover_letter' && event.text) {
              coverLetterRef.current += event.text
              setCoverLetterText(coverLetterRef.current)
            } else if (event.type === 'result' && event.stage === 'ats' && event.data) {
              // Backend sends snake_case — map to camelCase ATSScoreResult
              const d = event.data
              setAtsResult({
                overallScore: typeof d.overall_score === 'number' ? d.overall_score : 0,
                matchedKeywords: Array.isArray(d.matched_keywords) ? (d.matched_keywords as string[]) : [],
                missingKeywords: Array.isArray(d.missing_keywords) ? (d.missing_keywords as string[]) : [],
                suggestions: Array.isArray(d.suggestions) ? (d.suggestions as string[]) : [],
                summary: typeof d.summary === 'string' ? d.summary : '',
              })
            } else if (event.type === 'done') {
              setCompletedStages(new Set(['tailoring', 'cover_letter', 'ats']))
            } else if (event.type === 'error' && event.message) {
              setStreamError(event.message)
            }
          } catch {
            // malformed JSON line — skip
          }
        }
      }

      // Parse tailored resume JSON
      try {
        const parsed = JSON.parse(tailoringRef.current)
        setTailoredResume(fromBackend(parsed))
      } catch {
        setTailorParseWarning(true)
      }

      setCoverLetterText(coverLetterRef.current)
      setPhase('done')
    } catch (err: unknown) {
      console.error('Apply stream error:', err)
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setStreamError(message)
      setPhase('done')
    }
  }

  // ── save to applications ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!resume || !resumeId || saving || saved) return
    setSaving(true)
    setSaveError(null)
    try {
      const savedCl = await saveCoverLetter(
        coverLetterText,
        `${company} Cover Letter`,
        company,
        jobDescription,
        'professional',
        resumeId,
      )
      await createApplication({
        resume_id: resumeId,
        cover_letter_id: savedCl.id,
        company,
        role,
        job_url: jobUrl || undefined,
        job_description: jobDescription,
        ats_score: atsResult?.overallScore,
      })
      setSaved(true)
    } catch (err: unknown) {
      console.error('Save failed:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── export handlers ────────────────────────────────────────────────────────
  const handleExportResume = async (format: string) => {
    if (!tailoredResume || !resume) return
    try {
      const blob = await exportResume(tailoredResume, format as 'pdf' | 'docx', resume.detected_industry)
      const baseName = (tailoredResume.metadata.fullName || 'resume').replace(/ /g, '_')
      triggerDownload(blob, `${baseName}_${company.replace(/\W+/g, '_')}.${format}`)
    } catch (err) {
      console.error('Resume export failed:', err)
    }
  }

  const handleExportCoverLetter = async (format: string) => {
    try {
      const blob = await exportCoverLetter(coverLetterText, company, format as 'pdf' | 'docx' | 'txt')
      const slug = (company || 'company').replace(/\W+/g, '_').toLowerCase()
      triggerDownload(blob, `cover_letter_${slug}.${format}`)
    } catch (err) {
      console.error('Cover letter export failed:', err)
    }
  }

  // ── derived ─────────────────────────────────────────────────────────────────
  const canGenerate = company.trim() !== '' && role.trim() !== '' && jobDescription.trim() !== ''

  const getStageStatus = (key: StageKey): StageStatus => {
    if (completedStages.has(key)) return 'done'
    if (currentStage === key) return 'active'
    return 'pending'
  }

  const overallPct = Math.round(
    (stageProgress.tailoring + stageProgress.cover_letter + stageProgress.ats) / 3,
  )

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">

        {/* ── Page header ── */}
        {(phase === 'form' || phase === 'generating' || phase === 'done') && (
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Apply to this job</h1>
              {resume && (
                <p className="text-sm text-muted-foreground mt-1">
                  Applying with:{' '}
                  <span className="font-semibold text-foreground">{resume.title}</span>
                </p>
              )}
            </div>
            {phase === 'form' && (
              <button
                type="button"
                disabled={!canGenerate}
                onClick={handleGenerate}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Application
              </button>
            )}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {phase === 'loading' && (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-10 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
              <div className="h-40 bg-muted rounded" />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="size-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl text-red-500">!</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-muted-foreground max-w-sm">
              {errorMessage ?? 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-2 px-6 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* ── Form phase ── */}
        {phase === 'form' && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 max-w-2xl">
            <h2 className="text-base font-semibold text-foreground mb-5">Job details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Stripe"
                  className="w-full px-3 py-2.5 min-h-[44px] bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full px-3 py-2.5 min-h-[44px] bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Job URL{' '}
                <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 min-h-[44px] bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Job Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={8}
                className="w-full px-3 py-2.5 min-h-40 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-y"
              />
            </div>
          </div>
        )}

        {/* ── Generating phase ── */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-lg p-8">

              {/* Header row */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Generating your application...</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tailoring for{' '}
                    <span className="font-semibold text-foreground">{role}</span>{' '}
                    at{' '}
                    <span className="font-semibold text-foreground">{company}</span>
                  </p>
                </div>
                <span className="text-3xl font-bold text-primary tabular-nums">{overallPct}%</span>
              </div>

              {/* 3 stage cards */}
              <div className="flex items-center gap-2 mb-8">
                {STAGES.map((stage, i) => (
                  <div key={stage.key} className="flex items-center flex-1 min-w-0">
                    {i > 0 && (
                      <ConnectorLine done={completedStages.has(STAGES[i - 1].key)} />
                    )}
                    <div className="flex-1">
                      <StageCard
                        stage={stage}
                        status={getStageStatus(stage.key)}
                        pct={stageProgress[stage.key]}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall progress bar */}
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {currentStage === 'tailoring' && 'Tailoring your resume to match the job requirements...'}
                  {currentStage === 'cover_letter' && 'Writing a personalized cover letter...'}
                  {currentStage === 'ats' && 'Analyzing keyword match and ATS compatibility...'}
                  {!currentStage && 'Starting...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Done phase ── */}
        {phase === 'done' && (
          <div className="flex flex-col gap-6">

            {/* Stream error banner */}
            {streamError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-600">Generation error</p>
                <p className="text-sm text-red-500 mt-1">{streamError}</p>
              </div>
            )}

            {tailorParseWarning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-sm text-yellow-700">
                  The tailored resume could not be parsed for preview — your cover letter and ATS score are ready below.
                </p>
              </div>
            )}

            {/* Main layout: left panel + ATS sidebar */}
            <div className="flex flex-col md:flex-row gap-6 items-start">

              {/* Left: tabs + content */}
              <div className="flex-1 min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="flex border-b border-border px-4 pt-4 gap-2">
                  {(['resume', 'cover_letter'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 min-h-[44px] text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                        activeTab === tab
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {tab === 'resume' ? 'Resume' : 'Cover Letter'}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {activeTab === 'resume' && (
                    tailoredResume ? (
                      <ResumePreview resume={tailoredResume} industry={resume?.detected_industry} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <p className="text-muted-foreground text-sm">
                          {tailorParseWarning
                            ? 'Resume preview unavailable — the tailored output could not be parsed.'
                            : 'Tailored resume will appear here.'}
                        </p>
                      </div>
                    )
                  )}
                  {activeTab === 'cover_letter' && (
                    coverLetterText ? (
                      <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
                        {coverLetterText}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center py-16">
                        <p className="text-muted-foreground text-sm">No cover letter was generated.</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Right: ATS sidebar */}
              {atsResult && (
                <div className="w-full md:w-72 shrink-0 bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">ATS Score</p>
                    <span className={`text-4xl font-bold ${atsScoreColor(atsResult.overallScore)}`}>
                      {atsResult.overallScore}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground">/100</span>
                  </div>

                  {atsResult.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{atsResult.summary}</p>
                  )}

                  {atsResult.matchedKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">
                        Matched ({atsResult.matchedKeywords.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.matchedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/30 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {atsResult.missingKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                        Missing ({atsResult.missingKeywords.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.missingKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/30 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {atsResult.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggestions</p>
                      <ul className="space-y-1.5">
                        {atsResult.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={saving || saved}
                onClick={handleSave}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                  saved
                    ? 'bg-green-500/10 text-green-700 border border-green-500/30 cursor-default'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <><Loader2 className="size-4 animate-spin" /> Saving...</>
                ) : saved ? (
                  <><CheckCircle2 className="size-4" /> Saved to Applications</>
                ) : (
                  'Save to Applications'
                )}
              </button>

              {saved && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  View in Dashboard
                </button>
              )}

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              {tailoredResume && (
                <ExportDropdown
                  label="Export Resume"
                  formats={[
                    { value: 'pdf', label: 'PDF' },
                    { value: 'docx', label: 'Word (.docx)' },
                  ]}
                  onExport={handleExportResume}
                />
              )}

              {coverLetterText && (
                <ExportDropdown
                  label="Export Cover Letter"
                  formats={[
                    { value: 'pdf', label: 'PDF' },
                    { value: 'docx', label: 'Word (.docx)' },
                    { value: 'txt', label: 'Plain Text (.txt)' },
                  ]}
                  onExport={handleExportCoverLetter}
                />
              )}

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
