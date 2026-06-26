import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, CheckCircle2, Circle, ChevronDown } from 'lucide-react'
import Navbar from '@/components/Navbar'
import ResumePreview from '@/components/ResumePreview'
import { getResume, type SavedResume } from '@/services/resumes'
import { applyToJob, fromBackend, exportResume, exportCoverLetter } from '@/services/api'
import { saveCoverLetter } from '@/services/coverLetters'
import { createApplication } from '@/services/applications'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

// ── types ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'form' | 'generating' | 'done' | 'error'
type Stage = 'tailoring' | 'cover_letter' | 'ats' | null
type Tab = 'resume' | 'cover_letter'

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

// ── sub-components ────────────────────────────────────────────────────────────

interface StageIndicatorProps {
  currentStage: Stage
  completedStages: Set<string>
}

function StageIndicator({ currentStage, completedStages }: StageIndicatorProps) {
  const stages: { key: Stage; label: string }[] = [
    { key: 'tailoring', label: 'Tailoring Resume' },
    { key: 'cover_letter', label: 'Writing Cover Letter' },
    { key: 'ats', label: 'Scoring ATS' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {stages.map(({ key, label }) => {
        const done = completedStages.has(key as string)
        const active = currentStage === key && !done
        return (
          <div key={key} className="flex items-center gap-3">
            {done ? (
              <CheckCircle2 className="size-5 text-green-500 shrink-0" />
            ) : active ? (
              <Loader2 className="size-5 text-primary shrink-0 animate-spin" />
            ) : (
              <Circle className="size-5 text-muted-foreground shrink-0" />
            )}
            <span
              className={
                done
                  ? 'text-sm font-medium text-foreground'
                  : active
                    ? 'text-sm font-semibold text-primary'
                    : 'text-sm text-muted-foreground'
              }
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface ExportDropdownProps {
  label: string
  formats: Array<{ value: string; label: string }>
  onExport: (format: string) => void
  disabled?: boolean
}

function ExportDropdown({ label, formats, onExport, disabled }: ExportDropdownProps) {
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
  const [currentStage, setCurrentStage] = useState<Stage>(null)
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set())
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

    // reset accumulator refs
    tailoringRef.current = ''
    coverLetterRef.current = ''
    setCoverLetterText('')
    setTailoredResume(null)
    setAtsResult(null)
    setStreamError(null)
    setTailorParseWarning(false)
    setCompletedStages(new Set())
    setCurrentStage(null)
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
              data?: ATSScoreResult
              message?: string
            }

            if (event.type === 'progress' && event.stage) {
              // Mark prior stage as completed when we move to next
              if (event.stage === 'cover_letter' && currentStage !== 'cover_letter') {
                setCompletedStages((prev) => new Set([...prev, 'tailoring']))
              } else if (event.stage === 'ats') {
                setCompletedStages((prev) => new Set([...prev, 'tailoring', 'cover_letter']))
              }
              setCurrentStage(event.stage as Stage)
            } else if (event.type === 'chunk' && event.stage === 'tailoring' && event.text) {
              tailoringRef.current += event.text
            } else if (event.type === 'chunk' && event.stage === 'cover_letter' && event.text) {
              coverLetterRef.current += event.text
              setCoverLetterText(coverLetterRef.current)
            } else if (event.type === 'result' && event.stage === 'ats' && event.data) {
              setAtsResult(event.data)
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

      // Parse the tailored resume JSON
      try {
        const parsed = JSON.parse(tailoringRef.current)
        setTailoredResume(fromBackend(parsed))
      } catch {
        setTailorParseWarning(true)
      }

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

  // ── render ─────────────────────────────────────────────────────────────────

  const canGenerate = company.trim() !== '' && role.trim() !== '' && jobDescription.trim() !== ''

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">

        {/* ── Page header ── */}
        {(phase === 'form' || phase === 'generating' || phase === 'done') && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Apply to this job</h1>
            {resume && (
              <p className="text-sm text-muted-foreground mt-1">
                Applying with:{' '}
                <span className="font-semibold text-foreground">{resume.title}</span>
              </p>
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
              <div className="h-10 w-32 bg-muted rounded" />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="size-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">!</span>
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
                Job URL <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 min-h-[44px] bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div className="mb-6">
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

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Application
            </button>
          </div>
        )}

        {/* ── Generating phase ── */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center justify-center py-16 gap-8">
            <div className="bg-card rounded-xl border border-border shadow-sm p-8 w-full max-w-sm">
              <h2 className="text-base font-semibold text-foreground mb-6">Generating your application...</h2>
              <StageIndicator currentStage={currentStage} completedStages={completedStages} />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Tailoring your resume and writing a cover letter for{' '}
              <span className="font-semibold text-foreground">{role}</span> at{' '}
              <span className="font-semibold text-foreground">{company}</span>
            </p>
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

            {/* Tailoring parse warning */}
            {tailorParseWarning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-sm text-yellow-700">
                  The tailored resume could not be parsed for preview — but your cover letter and ATS score are ready below.
                </p>
              </div>
            )}

            {/* Main layout: left panel + ATS sidebar */}
            <div className="flex flex-col md:flex-row gap-6 items-start">

              {/* ── Left: tabs + content ── */}
              <div className="flex-1 min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">

                {/* Tab bar */}
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

                {/* Tab content */}
                <div className="p-6">
                  {activeTab === 'resume' && (
                    tailoredResume ? (
                      <ResumePreview
                        resume={tailoredResume}
                        industry={resume?.detected_industry}
                      />
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

              {/* ── Right: ATS sidebar ── */}
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

            {/* ── Action bar ── */}
            <div className="flex flex-wrap items-center gap-3 pt-2">

              {/* Save to Applications */}
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

              {saveError && (
                <p className="text-sm text-red-500">{saveError}</p>
              )}

              {/* Export Resume */}
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

              {/* Export Cover Letter */}
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

              {/* Back to Dashboard */}
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
