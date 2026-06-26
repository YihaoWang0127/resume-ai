import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Package, Download } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import ResumePreview from '@/components/ResumePreview'
import ResumeUploader from '@/components/ResumeUploader'
import {
  tailorResume,
  generateCoverLetter,
  scoreATS,
  exportResume,
  exportCoverLetter,
  validateJobDescription,
  validateRole,
  fromBackend,
} from '@/services/api'
import { saveResume, listResumes } from '@/services/resumes'
import { saveCoverLetter } from '@/services/coverLetters'
import type { SavedResume } from '@/services/resumes'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

// ── helpers ────────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text
}

// ── sub-components ────────────────────────────────────────────────────────────

function StepCard({
  num,
  title,
  active,
  done,
}: {
  num: number
  title: string
  active: boolean
  done: boolean
}) {
  return (
    <div
      className={`flex-1 border rounded-lg p-3 transition-colors ${
        active
          ? 'border-primary bg-primary/8'
          : done
          ? 'border-border bg-secondary/40'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            active
              ? 'bg-primary text-primary-foreground'
              : done
              ? 'bg-green-500 text-white'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {done ? '✓' : num}
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            active ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {title}
        </span>
      </div>
    </div>
  )
}

// ── circular stage card (used in generating step) ────────────────────────────
function StageCard({
  label,
  progress,
  color,
}: {
  label: string
  progress: number
  color: 'green' | 'blue'
}) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ
  const stroke = color === 'green' ? '#22c55e' : '#3b82f6'
  const borderGlow =
    color === 'green'
      ? 'border-green-500/30 shadow-[0_0_16px_rgba(34,197,94,0.15)]'
      : 'border-blue-500/30 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
  const done = progress === 100

  return (
    <div
      className={`flex-1 flex flex-col items-center gap-3 rounded-xl border bg-white/5 px-4 py-5 ${borderGlow}`}
    >
      {/* Ring */}
      <div className="relative">
        <svg viewBox="0 0 88 88" className="w-20 h-20 -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={stroke}
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {done ? (
            <CheckCircle2 className="size-7 rotate-90" style={{ color: stroke }} />
          ) : color === 'blue' ? (
            /* radar/target icon */
            <svg viewBox="0 0 24 24" className="size-6 rotate-90" fill="none" stroke={stroke} strokeWidth="1.5">
              <circle cx="12" cy="12" r="2" fill={stroke} />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          ) : (
            <Loader2 className="size-5 animate-spin rotate-90" style={{ color: stroke }} />
          )}
        </div>
      </div>

      {/* Percentage */}
      <p className="text-xl font-bold tabular-nums" style={{ color: stroke }}>
        {progress}%
      </p>

      {/* Label */}
      <p className="text-xs font-semibold text-white/60 text-center leading-tight">{label}</p>
    </div>
  )
}

// ── ATS panel for result view ─────────────────────────────────────────────────
function AtsPanel({ result }: { result: ATSScoreResult }) {
  const scoreColor =
    result.overallScore >= 85
      ? 'text-green-500'
      : result.overallScore >= 70
      ? 'text-primary'
      : result.overallScore >= 55
      ? 'text-yellow-500'
      : 'text-red-500'

  return (
    <div className="space-y-5">
      {/* Big score */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          ATS Score
        </p>
        <p className={`text-6xl font-extrabold leading-none ${scoreColor}`}>
          {result.overallScore}
          <span className="text-2xl font-bold text-muted-foreground">/100</span>
        </p>
      </div>

      {/* Summary */}
      {result.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
      )}

      {/* Matched */}
      {result.matchedKeywords.length > 0 && (
        <div>
          <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">
            Matched ({result.matchedKeywords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.matchedKeywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-semibold bg-green-500/10 text-green-600 border border-green-500/30 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing */}
      {result.missingKeywords.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">
            Missing ({result.missingKeywords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.missingKeywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/30 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
            Suggestions
          </p>
          <ul className="space-y-2">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary shrink-0">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'jd' | 'resume' | 'generating' | 'result'
type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'
type ResultTab = 'resume' | 'cv'

interface PackageWizardProps {
  open: boolean
  onClose: () => void
}

// ── main component ────────────────────────────────────────────────────────────

export default function PackageWizard({ open, onClose }: PackageWizardProps) {
  // ── step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('jd')

  // ── jd step ─────────────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('')
  const [position, setPosition] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [jdUrl, setJdUrl] = useState('')

  const [positionValidation, setPositionValidation] = useState<ValidationState>('idle')
  const [positionValidationMsg, setPositionValidationMsg] = useState('')
  const [jdValidation, setJdValidation] = useState<ValidationState>('idle')
  const [jdValidationMsg, setJdValidationMsg] = useState('')

  // ── resume step ─────────────────────────────────────────────────────────────
  const [localResumes, setLocalResumes] = useState<SavedResume[]>([])
  const [selectedResume, setSelectedResume] = useState<SavedResume | null>(null)
  const [showUploader, setShowUploader] = useState(false)

  // ── generating step ─────────────────────────────────────────────────────────
  const [tailorProgress, setTailorProgress] = useState(0)
  const [clProgress, setClProgress] = useState(0)
  const [atsProgress, setAtsProgress] = useState(0)
  const [tailoredResume, setTailoredResume] = useState<ResumeSchema | null>(null)
  const [coverLetterText, setCoverLetterText] = useState('')
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // ── result step ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ResultTab>('resume')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── debounce refs ────────────────────────────────────────────────────────────
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── fetch resumes when wizard opens ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    listResumes()
      .then(setLocalResumes)
      .catch(() => setLocalResumes([]))
  }, [open])

  // ── debounced position validation ─────────────────────────────────────────────
  useEffect(() => {
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current)
    if (!position.trim()) {
      setPositionValidation('idle')
      setPositionValidationMsg('')
      return
    }
    setPositionValidation('validating')
    positionTimerRef.current = setTimeout(async () => {
      try {
        const result = await validateRole(position)
        setPositionValidation(result.valid ? 'valid' : 'invalid')
        setPositionValidationMsg(result.reason)
      } catch {
        setPositionValidation('idle')
        setPositionValidationMsg('')
      }
    }, 400)
    return () => {
      if (positionTimerRef.current) clearTimeout(positionTimerRef.current)
    }
  }, [position])

  // ── debounced JD validation ───────────────────────────────────────────────────
  useEffect(() => {
    if (jdTimerRef.current) clearTimeout(jdTimerRef.current)
    if (!jobDesc.trim()) {
      setJdValidation('idle')
      setJdValidationMsg('')
      return
    }
    setJdValidation('validating')
    jdTimerRef.current = setTimeout(async () => {
      try {
        const result = await validateJobDescription(jobDesc)
        setJdValidation(result.valid ? 'valid' : 'invalid')
        setJdValidationMsg(result.reason)
      } catch {
        setJdValidation('idle')
        setJdValidationMsg('')
      }
    }, 600)
    return () => {
      if (jdTimerRef.current) clearTimeout(jdTimerRef.current)
    }
  }, [jobDesc])

  // ── reset ────────────────────────────────────────────────────────────────────
  const resetWizard = () => {
    setStep('jd')
    setCompanyName('')
    setPosition('')
    setJobDesc('')
    setJdUrl('')
    setPositionValidation('idle')
    setPositionValidationMsg('')
    setJdValidation('idle')
    setJdValidationMsg('')
    setSelectedResume(null)
    setShowUploader(false)
    setTailoredResume(null)
    setCoverLetterText('')
    setAtsResult(null)
    setAtsProgress(0)
    setTailorProgress(0)
    setClProgress(0)
    setGenerationError(null)
    setSaved(false)
    setActiveTab('resume')
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  // ── can advance from JD step ──────────────────────────────────────────────────
  const canProceedFromJd =
    companyName.trim() !== '' &&
    position.trim() !== '' &&
    jobDesc.trim() !== '' &&
    positionValidation === 'valid' &&
    jdValidation === 'valid'

  // ── upload handler inside wizard ──────────────────────────────────────────────
  const handleUploaderParsed = async (parsedResume: ResumeSchema) => {
    try {
      const title = `${parsedResume.metadata.fullName || 'My'} Resume`
      const saved = await saveResume(parsedResume, title)
      setLocalResumes((prev) => [saved, ...prev])
      setSelectedResume(saved)
      setShowUploader(false)
      toast.success('Resume uploaded and saved!')
    } catch {
      toast.error('Failed to save uploaded resume.')
    }
  }

  // ── generation ────────────────────────────────────────────────────────────────
  const startGeneration = async () => {
    if (!selectedResume) return
    setStep('generating')
    setTailorProgress(0)
    setClProgress(0)
    setAtsProgress(0)
    setGenerationError(null)

    try {
      // Start tailor + CL streams in parallel
      const [tailorStream, clStream] = await Promise.all([
        tailorResume(selectedResume.resume_data, jobDesc),
        generateCoverLetter(selectedResume.resume_data, jobDesc, companyName, 'professional'),
      ])

      // Simulated progress animations so percentages ramp visibly regardless of chunk size
      const tailorAnimInterval = setInterval(() => {
        setTailorProgress((p) => Math.min(p + 4, 88))
      }, 350)
      const clAnimInterval = setInterval(() => {
        setClProgress((p) => Math.min(p + 4, 88))
      }, 350)

      // Read both streams concurrently
      const clPromise = readStream(clStream)
      const tailorText = await readStream(tailorStream)

      clearInterval(tailorAnimInterval)
      setTailorProgress(100)

      let parsed: ResumeSchema = selectedResume.resume_data
      try {
        const jsonText = tailorText.split('\n[ERROR]')[0].trim()
        parsed = fromBackend(JSON.parse(jsonText))
      } catch {
        // fallback: use original resume
      }
      setTailoredResume(parsed)

      // Start ATS animation while it runs
      setAtsProgress(10)
      const atsAnimInterval = setInterval(() => {
        setAtsProgress((p) => Math.min(p + 8, 85))
      }, 800)

      const [clText, ats] = await Promise.all([clPromise, scoreATS(parsed, jobDesc)])
      clearInterval(clAnimInterval)
      setClProgress(100)
      clearInterval(atsAnimInterval)

      setCoverLetterText(clText)
      setAtsResult(ats)
      setAtsProgress(100)
    } catch (err) {
      setGenerationError('Generation failed. Please try again.')
      console.error(err)
    }
  }

  // ── save package ──────────────────────────────────────────────────────────────
  const handleSavePackage = async () => {
    if (!tailoredResume || !atsResult || saving || saved) return
    setSaving(true)
    try {
      const resumeTitle = `${companyName} – ${position} Resume`
      const savedR = await saveResume(tailoredResume, resumeTitle, {
        score: atsResult.overallScore,
        result: atsResult,
        jobDescription: jobDesc,
        companyName,
        jobTitle: position,
      })
      const clTitle = `${companyName} Cover Letter`
      await saveCoverLetter(
        coverLetterText,
        clTitle,
        companyName,
        jobDesc,
        'professional',
        savedR.id,
      )
      setSaved(true)
      toast.success('Application package saved!')
    } catch (err) {
      console.error('Save failed', err)
      toast.error('Failed to save package. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── export handlers ───────────────────────────────────────────────────────────
  const handleExportResume = async () => {
    if (!tailoredResume) return
    try {
      const blob = await exportResume(
        tailoredResume,
        'pdf',
        tailoredResume.detectedIndustry || 'general',
      )
      const name = (tailoredResume.metadata.fullName || 'resume').replace(/ /g, '_')
      triggerDownload(blob, `${name}_tailored.pdf`)
    } catch {
      toast.error('Export failed. Please try again.')
    }
  }

  const handleExportCoverLetter = async () => {
    try {
      const blob = await exportCoverLetter(coverLetterText, companyName, 'pdf')
      const slug = companyName.replace(/\W+/g, '_').toLowerCase()
      triggerDownload(blob, `cover_letter_${slug}.pdf`)
    } catch {
      toast.error('Export failed. Please try again.')
    }
  }

  // ── all done check ────────────────────────────────────────────────────────────
  const allDone = tailorProgress === 100 && clProgress === 100 && atsProgress === 100

  // ── result view (full-screen overlay) ────────────────────────────────────────
  if (step === 'result' && tailoredResume && atsResult) {
    const resumeLabel = selectedResume?.title ?? 'Resume'
    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col">
        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between relative">
          {/* Red dismiss button top-right */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 flex items-center justify-center size-7 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">Apply to this job</h1>
              <p className="text-xs text-muted-foreground truncate">
                Applying with: <span className="font-semibold text-foreground">{resumeLabel} · {dateLabel}</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 mt-3 sm:mt-0 pr-8 sm:pr-0">
            <button
              type="button"
              onClick={handleExportResume}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] border border-border text-sm font-medium rounded-lg hover:bg-secondary transition-colors whitespace-nowrap"
            >
              <Download className="size-4" />
              Export Resume
            </button>
            <button
              type="button"
              onClick={handleExportCoverLetter}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] border border-border text-sm font-medium rounded-lg hover:bg-secondary transition-colors whitespace-nowrap"
            >
              <Download className="size-4" />
              Export Cover Letter
            </button>
            <button
              type="button"
              onClick={handleSavePackage}
              disabled={saving || saved}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle2 className="size-4" /> : null}
              {saved ? 'Saved' : 'Save Package'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] border border-red-500/50 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500/10 transition-colors whitespace-nowrap"
            >
              <X className="size-4" />
              Dismiss Package
            </button>
          </div>
        </div>

        {/* ── Body: left content + right ATS ──────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: tab content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="shrink-0 flex items-center gap-1 px-6 pt-4 pb-0 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('resume')}
                className={`px-4 py-2 text-sm font-semibold rounded-t-md transition-colors min-h-[40px] border-b-2 -mb-px ${
                  activeTab === 'resume'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cv')}
                className={`px-4 py-2 text-sm font-semibold rounded-t-md transition-colors min-h-[40px] border-b-2 -mb-px ${
                  activeTab === 'cv'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Cover Letter
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'resume' ? (
                <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-border">
                  <div className="p-6">
                    <ResumePreview
                      resume={tailoredResume}
                      industry={tailoredResume.detectedIndustry || 'general'}
                    />
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto bg-card rounded-xl border border-border p-6">
                  <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
                    {coverLetterText}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right: ATS panel */}
          <div className="w-72 shrink-0 border-l border-border overflow-y-auto p-5 bg-card">
            <AtsPanel result={atsResult} />
          </div>
        </div>
      </div>
    )
  }

  // ── modal steps (jd, resume, generating) ──────────────────────────────────────
  if (!open) return null

  // ── generating step (always-dark card overlay) ──────────────────────────────
  if (step === 'generating') {
    const overallPct = Math.round((tailorProgress + clProgress + atsProgress) / 3)
    const statusMsg = allDone
      ? 'Your application package is ready!'
      : atsProgress > 0 && atsProgress < 100
      ? 'Analyzing keyword match and ATS compatibility...'
      : clProgress > 0 && clProgress < 100
      ? 'Crafting your personalized cover letter...'
      : tailorProgress > 0
      ? 'Tailoring your resume to the job description...'
      : 'Starting generation...'

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-[#0d0d1a] border border-white/10 rounded-2xl p-8 shadow-2xl">

          {generationError ? (
            /* Error state */
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="size-5 shrink-0" />
                <p className="text-sm">{generationError}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('resume'); setGenerationError(null) }}
                  className="flex-1 px-4 py-2.5 border border-white/20 text-sm font-semibold text-white/70 hover:bg-white/5 rounded-lg transition-colors min-h-[44px]"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={startGeneration}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white">Generate your application package</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Tailoring for{' '}
                    <span className="font-bold text-white">{position}</span>
                    {' '}at{' '}
                    <span className="font-bold text-white">{companyName}</span>
                  </p>
                </div>
                <p className="text-4xl font-extrabold text-blue-400 tabular-nums shrink-0 ml-4">
                  {overallPct}%
                </p>
              </div>

              {/* Three stage cards */}
              <div className="flex items-stretch gap-4 mb-8">
                <StageCard label="Tailoring Resume" progress={tailorProgress} color="green" />

                {/* Dashed arrow */}
                <div className="flex items-center text-white/20 text-sm font-mono shrink-0 select-none">
                  ----→
                </div>

                <StageCard label="Writing Cover Letter" progress={clProgress} color="green" />

                {/* Dashed arrow */}
                <div className="flex items-center text-white/20 text-sm font-mono shrink-0 select-none">
                  ----→
                </div>

                <StageCard label="Scoring ATS" progress={atsProgress} color={atsProgress === 100 ? 'green' : 'blue'} />
              </div>

              {/* Bottom overall progress bar + status */}
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 text-center">{statusMsg}</p>
              </div>

              {/* Done button */}
              {allDone && (
                <button
                  type="button"
                  onClick={() => setStep('result')}
                  className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <CheckCircle2 className="size-4" />
                  View Results
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── jd step ───────────────────────────────────────────────────────────────────
  if (step === 'jd') {
    return (
      <Modal
        open={open}
        overlayClassName="bg-black/80 backdrop-blur-sm px-4"
        className="max-w-2xl rounded-xl relative"
      >
        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Title */}
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide mb-4 pr-6">
          Create Application Package
        </h2>

        {/* Stepper */}
        <div className="flex gap-3 mb-6">
          <StepCard num={1} title="Job Description" active={true} done={false} />
          <StepCard num={2} title="Resume Selection" active={false} done={false} />
        </div>

        <div className="space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              placeholder="e.g. Google, Stripe, Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors rounded"
            />
          </div>

          {/* Position / Role */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Position / Role <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                placeholder="e.g. Software Engineer, Product Manager"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors rounded pr-8"
              />
              {positionValidation === 'validating' && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin" />
              )}
              {positionValidation === 'valid' && (
                <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-green-500" />
              )}
              {positionValidation === 'invalid' && (
                <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-red-500" />
              )}
            </div>
            {positionValidation === 'valid' && positionValidationMsg && (
              <p className="mt-1 text-green-600 text-xs">{positionValidationMsg}</p>
            )}
            {positionValidation === 'invalid' && positionValidationMsg && (
              <p className="mt-1 text-red-500 text-xs">{positionValidationMsg}</p>
            )}
          </div>

          {/* Job Description */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Job Description <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <textarea
                placeholder="Paste the job description here..."
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                className="w-full min-h-[120px] px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none transition-colors rounded"
              />
              {jdValidation === 'validating' && (
                <Loader2 className="absolute right-2.5 top-3 size-3.5 text-muted-foreground animate-spin" />
              )}
              {jdValidation === 'valid' && (
                <CheckCircle2 className="absolute right-2.5 top-3 size-3.5 text-green-500" />
              )}
              {jdValidation === 'invalid' && (
                <AlertCircle className="absolute right-2.5 top-3 size-3.5 text-red-500" />
              )}
            </div>
            {jdValidation === 'valid' && jdValidationMsg && (
              <p className="mt-1 text-green-600 text-xs">{jdValidationMsg}</p>
            )}
            {jdValidation === 'invalid' && jdValidationMsg && (
              <p className="mt-1 text-red-500 text-xs">{jdValidationMsg}</p>
            )}
          </div>

          {/* JD URL (optional) */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Job Posting URL <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </label>
            <input
              placeholder="https://..."
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors rounded"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canProceedFromJd}
            onClick={() => setStep('resume')}
            className={`flex items-center gap-2 px-5 py-2 min-h-[44px] bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors ${
              !canProceedFromJd ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
            }`}
          >
            Next
          </button>
        </div>
      </Modal>
    )
  }

  // ── resume step ───────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      overlayClassName="bg-black/80 backdrop-blur-sm px-4"
      className="max-w-2xl rounded-xl relative"
    >
      {/* Close */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>

      {/* Title */}
      <h2 className="text-lg font-bold text-foreground uppercase tracking-wide mb-4 pr-6">
        Create Application Package
      </h2>

      {/* Stepper */}
      <div className="flex gap-3 mb-6">
        <StepCard num={1} title="Job Description" active={false} done={true} />
        <StepCard num={2} title="Resume Selection" active={true} done={false} />
      </div>

      <h3 className="text-base font-bold text-foreground mb-3">Choose a Resume</h3>

      {localResumes.length === 0 && !showUploader ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">No saved resumes yet.</p>
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="text-xs font-bold uppercase tracking-wider text-primary border border-primary/50 px-4 py-2 hover:bg-primary/10 transition-colors"
          >
            Upload a Resume
          </button>
        </div>
      ) : (
        <>
          {localResumes.length > 0 && (
            <div className="max-h-[320px] overflow-y-auto flex flex-col gap-2 mb-3">
              {localResumes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedResume(r)}
                  className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${
                    selectedResume?.id === r.id
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                      {r.detected_industry}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Upload new */}
          {!showUploader ? (
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              className="w-full text-left px-4 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              + Upload New Resume
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Upload New Resume
                </p>
                <button
                  type="button"
                  onClick={() => setShowUploader(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
              <ResumeUploader onParsed={handleUploaderParsed} />
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={() => setStep('jd')}
          className="flex items-center gap-1.5 px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors min-h-[44px]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <button
          type="button"
          disabled={!selectedResume}
          onClick={startGeneration}
          className={`flex items-center gap-2 px-5 py-2 min-h-[44px] bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors ${
            !selectedResume ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
          }`}
        >
          <Package className="size-3.5" />
          Generate
        </button>
      </div>
    </Modal>
  )
}
