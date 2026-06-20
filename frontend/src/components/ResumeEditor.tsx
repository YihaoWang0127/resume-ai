import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Briefcase,
  Download,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wand2,
  FileText,
  Save,
  Mail,
  User,
  GraduationCap,
  Zap,
  Target,
  CheckCircle2,
  Minus,
  Settings,
  ArrowRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { cn, getInitials } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import type { ATSScoreResult, EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'
import { enrichResume, exportResume, fromBackend, generateCoverLetter, scoreATS, tailorResume, validateJobDescription } from '@/services/api'
import { saveResume, updateResume, type AtsMetadata } from '@/services/resumes'
import { saveCoverLetter } from '@/services/coverLetters'
import { useAuth } from '@/contexts/AuthContext'
import ComparisonView from './ComparisonView'
import ResumePreview from './ResumePreview'
import StreamingOutput from './StreamingOutput'
import { resumeToLines, computeLineDiff } from '@/lib/resumeDiff'

interface Props {
  initialResume: ResumeSchema
  initialResumeId?: string | null
  onBack: () => void
  onSignUp?: () => void
}

type Tab = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'ats'

interface StreamState {
  text: string
  done: boolean
  error: string | null
}

const field =
  'w-full px-3 py-2 border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-shadow placeholder:text-muted-foreground rounded-lg'
const fieldSm = cn(field, 'text-xs')

// ── Edit Zone helpers (resumeToLines, computeLineDiff) live in @/lib/resumeDiff ──

// ─────────────────────────────────────────────────────────────────────────────

function newExp(): ExperienceItem {
  return { company: '', title: '', startDate: '', current: true, bullets: [''] }
}
function newEdu(): EducationItem {
  return { institution: '', degree: '', field: '', graduationYear: '' }
}
function newSkill(): SkillCategory {
  return { category: '', items: [''] }
}

type JdValState = 'idle' | 'validating' | 'valid' | 'invalid'

const STREAMING_MESSAGES = [
  'Analyzing your resume...',
  'Identifying weak bullet points...',
  'Rewriting with stronger action verbs...',
  'Quantifying your achievements...',
  'Polishing the final output...',
]

const ENRICHMENT_LOADING_MESSAGES = [
  'Analyzing your resume...',
  'Enhancing bullet points...',
  'Quantifying achievements...',
  'Optimizing for ATS keywords...',
  'Finalizing improvements...',
]

type EnrichmentState = 'idle' | 'loading' | 'comparing'

type AiTool = 'polish' | 'tailor' | 'coverletter' | 'ats'

const AI_TOOL_DEFS: Array<{ id: AiTool; label: string; description: string; Icon: LucideIcon }> = [
  { id: 'polish',      label: 'Resume Polish',  description: 'Improve wording, clarity, and bullet strength',  Icon: Sparkles },
  { id: 'tailor',      label: 'Target Role Tailoring',  description: 'Optimize your resume for the job you want to apply for.',          Icon: Wand2 },
  { id: 'coverletter', label: 'Cover Letter',   description: 'Generate a personalized cover letter',           Icon: Mail },
  { id: 'ats',         label: 'ATS Score',      description: 'Check resume match against a job description',   Icon: Target },
]

type CoverLetterTone = 'professional' | 'enthusiastic' | 'concise'

const ZOOM_LEVELS = [75, 90, 100, 110, 125]

const RESUME_SECTION_DEFS: Array<{ id: Tab; label: string; description: string; Icon: LucideIcon }> = [
  { id: 'contact',    label: 'Contact',    description: 'Add your contact details and professional links.',    Icon: User },
  { id: 'summary',    label: 'Summary',    description: 'Write a brief professional summary.',                 Icon: FileText },
  { id: 'experience', label: 'Experience', description: 'Add your work experience and achievements.',          Icon: Briefcase },
  { id: 'education',  label: 'Education',  description: 'Add your educational background.',                    Icon: GraduationCap },
  { id: 'skills',     label: 'Skills',     description: 'List your technical and soft skills.',                Icon: Zap },
]

const REVIEW_TOOL_DEFS: Array<{ id: Tab; label: string; Icon: LucideIcon }> = [
  { id: 'ats', label: 'ATS Score', Icon: Target },
]

export default function ResumeEditor({ initialResume, initialResumeId, onBack, onSignUp }: Props) {
  const { user, isGuest, signOut } = useAuth()
  const navigate = useNavigate()
  const [resume, setResume] = useState<ResumeSchema>(initialResume)
  const [tab, setTab] = useState<Tab>('contact')
  const [stream, setStream] = useState<StreamState | null>(null)
  const [tailorOpen, setTailorOpen] = useState(false)
  const [jobDesc, setJobDesc] = useState('')
  const [tailorSections, setTailorSections] = useState({
    summary: true, experience: true, education: true, skills: true,
  })
  const [atsJobDesc, setAtsJobDesc] = useState('')
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null)
  const [atsError, setAtsError] = useState<string | null>(null)
  const [atsResumeSnapshot, setAtsResumeSnapshot] = useState<string | null>(null)
  const [atsResultSaved, setAtsResultSaved] = useState<boolean | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [streamLoading, setStreamLoading] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(200)
  const [flashSections, setFlashSections] = useState<Set<string>>(new Set())
  const [msgIndex, setMsgIndex] = useState(0)
  const [streamProgress, setStreamProgress] = useState(0)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [mobileViewTab, setMobileViewTab] = useState<'edit' | 'preview'>('edit')
  const [selectedIndustry, setSelectedIndustry] = useState<string>(initialResume.detectedIndustry ?? 'general')
  const [saveToast, setSaveToast] = useState<{ text: string; ok: boolean } | null>(null)
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(initialResumeId ?? null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [clCompany, setClCompany] = useState('')
  const [clJobDesc, setClJobDesc] = useState('')
  const [clTone, setClTone] = useState<CoverLetterTone>('professional')
  const [clStreamContent, setClStreamContent] = useState('')
  const [clIsStreaming, setClIsStreaming] = useState(false)
  const [clStreamError, setClStreamError] = useState<string | null>(null)
  const [clCompanyError, setClCompanyError] = useState<string | null>(null)
  const [clSaving, setClSaving] = useState(false)
  const [clSaved, setClSaved] = useState(false)
  const [enrichTone, setEnrichTone] = useState<'professional' | 'concise' | 'assertive'>('professional')
  // Job tailoring validation
  const [jobDescValState, setJobDescValState] = useState<JdValState>('idle')
  const [jobDescValError, setJobDescValError] = useState<string | null>(null)
  const jobDescValTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ATS validation
  const [atsJobDescValState, setAtsJobDescValState] = useState<JdValState>('idle')
  const [atsJobDescValError, setAtsJobDescValError] = useState<string | null>(null)
  const atsJobDescValTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cover letter JD validation
  const [clJobDescValState, setClJobDescValState] = useState<JdValState>('idle')
  const [clJobDescValError, setClJobDescValError] = useState<string | null>(null)
  const clJobDescValTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clStreamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const [saveTitle, setSaveTitle] = useState(
    () => `Resume - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  )
  const [isSaving, setIsSaving] = useState(false)
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>('idle')
  const [aiTool, setAiTool] = useState<AiTool>('polish')
  const [originalResume, setOriginalResume] = useState<ResumeSchema | null>(null)
  const [enrichedResume, setEnrichedResume] = useState<ResumeSchema | null>(null)
  const [enrichMsgIndex, setEnrichMsgIndex] = useState(0)
  const [confirmReEnrichOpen, setConfirmReEnrichOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [centerCollapsed, setCenterCollapsed] = useState(false)
  const [centerWidth, setCenterWidth] = useState(380)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [diffBaseline, setDiffBaseline] = useState<ResumeSchema>(initialResume)
  const [autosaveOn] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState(0)
  // Review & Export step state
  const [reviewDocTab, setReviewDocTab] = useState<'resume' | 'coverletter' | 'ats'>('resume')
  const [reviewResumeMode, setReviewResumeMode] = useState<'final' | 'split' | 'unified'>('final')
  const [reviewClMode, setReviewClMode] = useState<'final' | 'compare'>('final')
  const [reviewAtsView, setReviewAtsView] = useState<'overview' | 'keywords' | 'suggestions'>('overview')
  const [reviewFont, setReviewFont] = useState('Inter')
  const [reviewFontSize, setReviewFontSize] = useState('11pt')
  const [reviewBold, setReviewBold] = useState(false)
  const [reviewItalic, setReviewItalic] = useState(false)
  const [reviewUnderline, setReviewUnderline] = useState(false)
  const [reviewColor, setReviewColor] = useState('#000000')
  const [primaryExportOpen, setPrimaryExportOpen] = useState(false)
  const primaryExportRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const autosaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const accumRef = useRef('')
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const centerDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const sectionRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    contact: null, summary: null, experience: null, education: null, skills: null, ats: null,
  })

  // ── Edit Zone diff ───────────────────────────────────────────────────────
  const diffLines = useMemo(() => {
    const originalLines = resumeToLines(diffBaseline)
    const currentLines = resumeToLines(resume)
    return computeLineDiff(originalLines, currentLines)
  }, [diffBaseline, resume])

  const hasDiff = useMemo(() => diffLines.some(l => l.type !== 'same'), [diffLines])
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!exportMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenuOpen])

  useEffect(() => {
    if (!primaryExportOpen) return
    const handler = (e: MouseEvent) => {
      if (primaryExportRef.current && !primaryExportRef.current.contains(e.target as Node)) {
        setPrimaryExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [primaryExportOpen])

  useEffect(() => {
    if (!accountMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountMenuOpen])

  // Autosave interval: when autosaveOn and currentResumeId exists, auto-update every 30s
  useEffect(() => {
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current)
      autosaveIntervalRef.current = null
    }
    if (autosaveOn && currentResumeId) {
      autosaveIntervalRef.current = setInterval(() => {
        updateResume(currentResumeId, { ...resume, detectedIndustry: selectedIndustry }).catch(console.error)
      }, 30000)
    }
    return () => {
      if (autosaveIntervalRef.current) clearInterval(autosaveIntervalRef.current)
    }
  }, [autosaveOn, currentResumeId])

  useEffect(() => {
    if (!stream || stream.done) {
      setMsgIndex(0)
      return
    }
    setMsgIndex(0)
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % STREAMING_MESSAGES.length), 3000)
    return () => clearInterval(id)
  }, [stream?.done])

  useEffect(() => {
    if (!stream) { setStreamProgress(0); return }
    if (stream.done) { setStreamProgress(100); return }
    setStreamProgress(0)
    const id = requestAnimationFrame(() => setStreamProgress(90))
    return () => cancelAnimationFrame(id)
  }, [stream?.done])

  // Cycling status messages for the enrichment loading overlay
  useEffect(() => {
    if (enrichmentState !== 'loading') {
      setEnrichMsgIndex(0)
      return
    }
    setEnrichMsgIndex(0)
    const id = setInterval(
      () => setEnrichMsgIndex((i) => (i + 1) % ENRICHMENT_LOADING_MESSAGES.length),
      1500,
    )
    return () => clearInterval(id)
  }, [enrichmentState])

  // Simulate enrichment progress bar
  useEffect(() => {
    if (enrichmentState !== 'loading') {
      setEnrichProgress(enrichmentState === 'comparing' ? 100 : 0)
      return
    }
    setEnrichProgress(0)
    const id = setInterval(() => setEnrichProgress((p) => p + (82 - p) * 0.12), 300)
    return () => clearInterval(id)
  }, [enrichmentState])

  // Watch for streaming completion while an enrichment is in flight
  useEffect(() => {
    if (enrichmentState !== 'loading' || !stream?.done) return

    if (stream.error) {
      setEnrichmentState('idle')
      setEnrichedResume(null)
      setOriginalResume(null)
      setStream(null)
      setSaveToast({ text: stream.error || 'Enrichment failed. Please try again.', ok: false })
      setTimeout(() => setSaveToast(null), 3000)
      return
    }

    try {
      let text = accumRef.current.trim()
      if (text.startsWith('```')) {
        text = text.split('\n').slice(1).join('\n').replace(/```\s*$/, '').trim()
      }
      const parsed: unknown = JSON.parse(text)
      const newResume = fromBackend(parsed)
      setEnrichedResume(newResume)
      setEnrichmentState('comparing')
      setStream(null)
    } catch (err) {
      console.error('[enrichment] failed to parse AI response:', err)
      setEnrichmentState('idle')
      setEnrichedResume(null)
      setOriginalResume(null)
      setStream(null)
      setSaveToast({ text: 'Enrichment failed. Please try again.', ok: false })
      setTimeout(() => setSaveToast(null), 3000)
    }
  }, [enrichmentState, stream?.done, stream?.error])

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startHeight: panelHeight }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const next = Math.min(
        Math.max(dragRef.current.startHeight + delta, 80),
        window.innerHeight * 0.6,
      )
      setPanelHeight(next)
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── stream runner ──────────────────────────────────────────────────────────
  const runStream = async (getStream: () => Promise<ReadableStream<Uint8Array>>) => {
    accumRef.current = ''
    setStream({ text: '', done: false, error: null })
    setPanelCollapsed(false)
    setMobileViewTab('edit')
    setStreamLoading(true)
    try {
      const readable = await getStream()
      const reader = readable.getReader()
      streamReaderRef.current = reader
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumRef.current += chunk
          setStream((s: StreamState | null) => (s ? { ...s, text: s.text + chunk } : null))
        }
        setStream((s: StreamState | null) => (s ? { ...s, done: true } : null))
      } catch (readErr) {
        // cancelled via reader.cancel() — swallow silently so cancelEnrich handles state
        if (readErr instanceof Error && readErr.name === 'AbortError') return
        const msg = readErr instanceof Error ? readErr.message : String(readErr)
        setStream((s: StreamState | null) => (s ? { ...s, error: msg, done: true } : null))
      } finally {
        streamReaderRef.current = null
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStream((s: StreamState | null) => (s ? { ...s, error: msg, done: true } : null))
    } finally {
      setStreamLoading(false)
    }
  }

  const applyStreamed = () => {
    try {
      let text = accumRef.current.trim()
      console.log('[applyStreamed] raw streamed text:', text)
      if (text.startsWith('```')) {
        text = text.split('\n').slice(1).join('\n').replace(/```\s*$/, '').trim()
      }
      const parsed: unknown = JSON.parse(text)
      console.log('[applyStreamed] parsed JSON:', parsed)
      const newResume = fromBackend(parsed)
      console.log('[applyStreamed] mapped ResumeSchema:', newResume)

      const changes = new Set<string>()
      if (JSON.stringify(resume.metadata) !== JSON.stringify(newResume.metadata)) changes.add('metadata')
      if (JSON.stringify(resume.summary) !== JSON.stringify(newResume.summary)) changes.add('summary')
      if (JSON.stringify(resume.experience) !== JSON.stringify(newResume.experience)) changes.add('experience')
      if (JSON.stringify(resume.education) !== JSON.stringify(newResume.education)) changes.add('education')
      if (JSON.stringify(resume.skills) !== JSON.stringify(newResume.skills)) changes.add('skills')

      setResume(newResume)
      setStream(null)

      if (changes.size > 0) {
        setFlashSections(changes)
        setTimeout(() => setFlashSections(new Set()), 1800)
      }
    } catch (err) {
      console.error('[applyStreamed] failed to parse AI response:', err)
      setStream((s: StreamState | null) =>
        s ? { ...s, error: 'Could not parse AI response as JSON. Check the console for details.' } : null,
      )
    }
  }

  // ── actions ────────────────────────────────────────────────────────────────
  const startEnrich = () => {
    setOriginalResume(resume)
    setEnrichmentState('loading')
    runStream(() => enrichResume(resume, enrichTone))
    // Enrich's loading/comparison UI lives in the right (preview) panel —
    // switch mobile view there so the user sees it (overrides runStream's
    // setMobileViewTab('edit') for the Tailor flow).
    setMobileViewTab('preview')
  }

  const cancelEnrich = () => {
    streamReaderRef.current?.cancel()
    streamReaderRef.current = null
    setEnrichmentState('idle')
    setEnrichedResume(null)
    setOriginalResume(null)
    setStream(null)
    setEnrichProgress(0)
    setStreamLoading(false)
  }

  const handleEnrich = () => {
    if (enrichmentState === 'comparing') {
      setConfirmReEnrichOpen(true)
      return
    }
    startEnrich()
  }

  const handleConfirmReEnrich = () => {
    setConfirmReEnrichOpen(false)
    setEnrichedResume(null)
    setOriginalResume(null)
    startEnrich()
  }

  const handleAcceptEnrichment = () => {
    if (!originalResume || !enrichedResume) return
    const changes = new Set<string>()
    if (JSON.stringify(originalResume.metadata) !== JSON.stringify(enrichedResume.metadata)) changes.add('metadata')
    if (JSON.stringify(originalResume.summary) !== JSON.stringify(enrichedResume.summary)) changes.add('summary')
    if (JSON.stringify(originalResume.experience) !== JSON.stringify(enrichedResume.experience)) changes.add('experience')
    if (JSON.stringify(originalResume.education) !== JSON.stringify(enrichedResume.education)) changes.add('education')
    if (JSON.stringify(originalResume.skills) !== JSON.stringify(enrichedResume.skills)) changes.add('skills')

    setResume(enrichedResume)
    if (changes.size > 0) {
      setFlashSections(changes)
      setTimeout(() => setFlashSections(new Set()), 1800)
    }
    setEnrichmentState('idle')
    setEnrichedResume(null)
    setOriginalResume(null)
    setSaveToast({ text: 'Resume enriched successfully', ok: true })
    setTimeout(() => setSaveToast(null), 3000)
  }

  const handleDiscardEnrichment = () => {
    setEnrichmentState('idle')
    setEnrichedResume(null)
    setOriginalResume(null)
  }

  const handleTailor = () => {
    setTailorOpen(false)
    runStream(() => tailorResume(resume, jobDesc))
  }

  const handleGenerateCoverLetterInline = async () => {
    const companyErr = clCompany.trim() ? null : 'Company name is required.'
    setClCompanyError(companyErr)
    if (companyErr) return

    setClStreamContent('')
    setClStreamError(null)
    setClIsStreaming(true)
    try {
      const stream = await generateCoverLetter(resume, clJobDesc, clCompany, clTone)
      const reader = stream.getReader()
      clStreamReaderRef.current = reader
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setClStreamContent(accumulated)
      }
    } catch (err) {
      setClStreamError(err instanceof Error ? err.message : String(err))
    } finally {
      setClIsStreaming(false)
      clStreamReaderRef.current = null
    }
  }

  const handleSaveCoverLetter = async () => {
    if (!clStreamContent.trim() || clSaving) return
    setClSaving(true)
    try {
      const title = `Cover Letter — ${clCompany || 'Company'} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      await saveCoverLetter(clStreamContent, title, clCompany || undefined, clJobDesc || undefined, clTone, currentResumeId ?? undefined)
      setClSaved(true)
      setTimeout(() => setClSaved(false), 2500)
    } catch (err) {
      console.error('[ResumeEditor] save cover letter failed:', err)
    } finally {
      setClSaving(false)
    }
  }

  const handleAnalyzeATS = async () => {
    setAtsLoading(true)
    setAtsError(null)
    try {
      const result = await scoreATS(resume, atsJobDesc)
      setAtsResult(result)
      setAtsResumeSnapshot(JSON.stringify(resume))
      setAtsResultSaved(false)
    } catch (err) {
      setAtsError(err instanceof Error ? err.message : String(err))
    } finally {
      setAtsLoading(false)
    }
  }

  const triggerJdValidation = (
    text: string,
    setValState: (s: JdValState) => void,
    setValError: (e: string | null) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = text.trim()
    if (!trimmed) {
      setValState('idle')
      setValError(null)
      return
    }

    // Quick pre-check before calling AI
    const words = trimmed.split(/\s+/).filter(Boolean)
    if (words.length < 10 || !/[a-zA-Z]/.test(trimmed)) {
      setValState('invalid')
      setValError('Please paste a complete job description.')
      return
    }

    // Debounced AI validation
    setValState('validating')
    timerRef.current = setTimeout(async () => {
      try {
        const result = await validateJobDescription(trimmed)
        setValState(result.valid ? 'valid' : 'invalid')
        setValError(result.valid ? null : (result.reason || "This doesn't look like a job description. Please paste a real job posting."))
      } catch {
        setValState('idle') // fail open — don't block user if API fails
        setValError(null)
      }
    }, 800)
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExportMenuOpen(false)
    setIsExporting(true)
    const showToast = (text: string, ok: boolean) => {
      setSaveToast({ text, ok })
      setTimeout(() => setSaveToast(null), 3000)
    }
    try {
      const blob = await exportResume(resume, format, selectedIndustry)
      const baseName = (resume.metadata.fullName || 'resume').replace(/ /g, '_')
      const filename = `${baseName}.${format}`
      const picker = (window as any).showSaveFilePicker as ((o: object) => Promise<any>) | undefined
      if (picker) {
        const mimeType =
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        const handle = await picker({
          suggestedName: filename,
          types: [{ description: format === 'pdf' ? 'PDF Document' : 'Word Document', accept: { [mimeType]: [`.${format}`] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
      showToast('File saved successfully!', true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error(err)
      showToast('Export failed. Please try again.', false)
    } finally {
      setIsExporting(false)
    }
  }

  // ── save / update ──────────────────────────────────────────────────────────
  const handleSaveClick = () => {
    if (isGuest || !user) { onSignUp?.(); return }
    setSaveDialogOpen(true)
  }

  const handleSaveConfirm = async () => {
    if (!saveTitle.trim()) return
    setIsSaving(true)
    const showToast = (text: string, ok: boolean) => {
      setSaveToast({ text, ok })
      setTimeout(() => setSaveToast(null), 3000)
    }
    const atsPayload: AtsMetadata | undefined =
      atsResult && atsResumeSnapshot
        ? { score: atsResult.overallScore, result: atsResult, jobDescription: atsJobDesc }
        : undefined
    try {
      const saved = await saveResume({ ...resume, detectedIndustry: selectedIndustry }, saveTitle.trim(), atsPayload)
      setCurrentResumeId(saved.id)
      setSaveDialogOpen(false)
      if (atsPayload) setAtsResultSaved(true)
      const tabLabel = reviewDocTab === 'coverletter' ? 'CV' : reviewDocTab === 'ats' ? 'ATS report' : 'Resume'
      showToast(`${tabLabel} saved!`, true)
    } catch (err) {
      console.error(err)
      showToast('Save failed. Please try again.', false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!currentResumeId) return
    setIsSaving(true)
    const showToast = (text: string, ok: boolean) => {
      setSaveToast({ text, ok })
      setTimeout(() => setSaveToast(null), 3000)
    }
    const atsPayload: AtsMetadata | undefined =
      atsResult && atsResumeSnapshot
        ? { score: atsResult.overallScore, result: atsResult, jobDescription: atsJobDesc }
        : undefined
    try {
      await updateResume(currentResumeId, { ...resume, detectedIndustry: selectedIndustry }, undefined, atsPayload)
      if (atsPayload) setAtsResultSaved(true)
      const tabLabel = reviewDocTab === 'coverletter' ? 'CV' : reviewDocTab === 'ats' ? 'ATS report' : 'Resume'
      showToast(`${tabLabel} updated!`, true)
    } catch (err) {
      console.error(err)
      showToast('Update failed. Please try again.', false)
    } finally {
      setIsSaving(false)
    }
  }

  // ── metadata ───────────────────────────────────────────────────────────────
  const setMeta = (k: keyof ResumeSchema['metadata'], v: string) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      metadata: { ...r.metadata, [k]: v || undefined },
    }))

  // ── experience ─────────────────────────────────────────────────────────────
  const setExp = <K extends keyof ExperienceItem>(i: number, k: K, v: ExperienceItem[K]) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: r.experience.map((e: ExperienceItem, idx: number) =>
        idx === i ? { ...e, [k]: v } : e,
      ),
    }))

  const addBullet = (i: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: r.experience.map((e: ExperienceItem, idx: number) =>
        idx === i ? { ...e, bullets: [...e.bullets, ''] } : e,
      ),
    }))

  const setBullet = (expI: number, bI: number, v: string) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: r.experience.map((e: ExperienceItem, idx: number) => {
        if (idx !== expI) return e
        return { ...e, bullets: e.bullets.map((b: string, bi: number) => (bi === bI ? v : b)) }
      }),
    }))

  const removeBullet = (expI: number, bI: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: r.experience.map((e: ExperienceItem, idx: number) => {
        if (idx !== expI) return e
        const bullets = e.bullets.filter((_: string, bi: number) => bi !== bI)
        return { ...e, bullets: bullets.length ? bullets : [''] }
      }),
    }))

  const removeExp = (i: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: r.experience.filter((_: ExperienceItem, idx: number) => idx !== i),
    }))

  const addExp = () =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      experience: [...r.experience, newExp()],
    }))

  // ── education ──────────────────────────────────────────────────────────────
  const setEdu = <K extends keyof EducationItem>(i: number, k: K, v: EducationItem[K]) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      education: r.education.map((e: EducationItem, idx: number) =>
        idx === i ? { ...e, [k]: v } : e,
      ),
    }))

  const removeEdu = (i: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      education: r.education.filter((_: EducationItem, idx: number) => idx !== i),
    }))

  const addEdu = () =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      education: [...r.education, newEdu()],
    }))

  // ── skills ─────────────────────────────────────────────────────────────────
  const setSkillCat = (i: number, v: string) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: r.skills.map((s: SkillCategory, idx: number) =>
        idx === i ? { ...s, category: v } : s,
      ),
    }))

  const setSkillItem = (gi: number, ii: number, v: string) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: r.skills.map((s: SkillCategory, idx: number) => {
        if (idx !== gi) return s
        return { ...s, items: s.items.map((it: string, i: number) => (i === ii ? v : it)) }
      }),
    }))

  const addSkillItem = (gi: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: r.skills.map((s: SkillCategory, idx: number) =>
        idx === gi ? { ...s, items: [...s.items, ''] } : s,
      ),
    }))

  const removeSkillItem = (gi: number, ii: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: r.skills.map((s: SkillCategory, idx: number) => {
        if (idx !== gi) return s
        const items = s.items.filter((_: string, i: number) => i !== ii)
        return { ...s, items: items.length ? items : [''] }
      }),
    }))

  const removeSkillGroup = (i: number) =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: r.skills.filter((_: SkillCategory, idx: number) => idx !== i),
    }))

  const addSkillGroup = () =>
    setResume((r: ResumeSchema): ResumeSchema => ({
      ...r,
      skills: [...r.skills, newSkill()],
    }))

  // ── center panel resize ────────────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (centerDragRef.current) {
        const delta = e.clientX - centerDragRef.current.startX
        const newW = Math.max(380, Math.min(600, centerDragRef.current.startW + delta))
        setCenterWidth(newW)
      }
      if (sidebarDragRef.current) {
        const delta = e.clientX - sidebarDragRef.current.startX
        const newW = Math.max(180, Math.min(400, sidebarDragRef.current.startW + delta))
        setSidebarWidth(newW)
      }
    }
    const onMouseUp = () => {
      centerDragRef.current = null
      sidebarDragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const scrollToSection = (id: Tab) => {
    setTab(id)
    if (centerCollapsed) {
      setCenterCollapsed(false)
      setTimeout(() => sectionRefs.current[id]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50)
    } else {
      sectionRefs.current[id]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }

  // ── completion helpers ─────────────────────────────────────────────────────
  const isContactComplete = !!(resume.metadata.fullName && resume.metadata.email)
  const isSummaryComplete = !!(resume.summary?.trim())
  const isExpComplete = resume.experience.length > 0
  const isEduComplete = resume.education.length > 0
  const isSkillsComplete = resume.skills.length > 0
  const getSectionComplete = (id: Tab): boolean => {
    if (id === 'contact') return isContactComplete
    if (id === 'summary') return isSummaryComplete
    if (id === 'experience') return isExpComplete
    if (id === 'education') return isEduComplete
    if (id === 'skills') return isSkillsComplete
    return false
  }
  const isAtsStale = atsResult !== null && atsResumeSnapshot !== null && JSON.stringify(resume) !== atsResumeSnapshot
  const wordCount = resume.summary?.split(/\s+/).filter(Boolean).length ?? 0
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const displayName = fullName.trim() || user?.email || ''

  return (
    <div className="flex flex-col h-screen bg-muted">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 lg:px-6 bg-background border-b border-border shadow-sm z-10">
        {/* Left: logo + back */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <div className="size-7 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">R</span>
            </div>
            <span className="hidden sm:block font-bold text-sm tracking-widest uppercase text-foreground">
              Resume AI
            </span>
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:block">Back to Dashboard</span>
          </button>
        </div>

        {/* Center: step indicator */}
        <div className="hidden md:flex items-center gap-1.5">
          {[
            { num: 1, label: 'Edit' },
            { num: 2, label: 'AI Enhance' },
            { num: 3, label: 'Review & Export' },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'size-6 rounded-full flex items-center justify-center text-xs font-bold',
                    currentStep === step.num
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.num
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'border border-border text-muted-foreground',
                  )}
                >
                  {step.num}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium hidden lg:block whitespace-nowrap',
                    currentStep === step.num ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < 2 && <span className="text-muted-foreground/60 text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Right: actions + avatar */}
        <div className="flex items-center gap-1.5">
          {atsResult && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full">
              <div className="size-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs font-semibold text-green-700 whitespace-nowrap">
                ATS {atsResult.overallScore}%
              </span>
            </div>
          )}
          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-primary/50 rounded transition-colors"
            >
              <Avatar size="sm" className="border border-primary/40">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary uppercase">
                  {getInitials(fullName, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">
                {displayName}
              </span>
              <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', accountMenuOpen && 'rotate-180')} />
            </button>
            {accountMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-primary/30 rounded-lg py-1 min-w-[180px] shadow-lg">
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); navigate('/profile') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <User className="size-3.5" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onBack() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <LayoutDashboard className="size-3.5" />
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); navigate('/ai') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <Sparkles className="size-3.5" />
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); navigate('/settings') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <Settings className="size-3.5" />
                  Settings
                </button>
                <div className="h-px bg-border mx-2 my-1" />
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); signOut() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left"
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Guest banner */}
      {isGuest && (
        <div className="shrink-0 border-b border-yellow-900/40 bg-yellow-950/20 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-yellow-400/90">You're browsing as guest. Sign up to save your resumes.</p>
          <button
            type="button"
            onClick={() => onSignUp?.()}
            className="shrink-0 text-xs font-bold uppercase tracking-wider text-primary border border-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Mobile Edit / Preview toggle */}
      <div className="lg:hidden shrink-0 border-b border-border flex bg-background">
        <button
          type="button"
          onClick={() => setMobileViewTab('edit')}
          className={cn(
            'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
            mobileViewTab === 'edit'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMobileViewTab('preview')}
          className={cn(
            'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
            mobileViewTab === 'preview'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Preview
        </button>
      </div>

      {/* ── MAIN ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col shrink-0 border-r border-border bg-background overflow-y-auto" style={{ width: currentStep === 3 ? 224 : sidebarWidth }}>
          {currentStep === 2 ? (
            /* ── AI TOOL SELECTOR (Step 2 only) ─────────────────────────────── */
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-4 pb-2">
                AI Enhance Tools
              </p>
              <nav className="flex flex-col">
                {AI_TOOL_DEFS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setAiTool(tool.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-2',
                      aiTool === tool.id
                        ? 'bg-primary/[0.08] border-primary'
                        : 'border-transparent hover:bg-secondary/40',
                    )}
                  >
                    <tool.Icon className={cn('size-4 shrink-0 mt-0.5', aiTool === tool.id ? 'text-primary' : 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium leading-tight', aiTool === tool.id ? 'text-primary' : 'text-foreground')}>
                        {tool.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </button>
                ))}
              </nav>
            </>
          ) : currentStep === 3 ? (
            /* ── DOCUMENT SELECTOR (Step 3 only) ────────────────────────────── */
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-4 pb-2">
                Documents
              </p>
              <nav className="flex flex-col">
                {(
                  [
                    { id: 'resume', label: 'Resume', Icon: FileText },
                    { id: 'coverletter', label: 'Cover Letter', Icon: Mail },
                    { id: 'ats', label: 'ATS Report', Icon: Target },
                  ] as const
                ).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setReviewDocTab(doc.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2',
                      reviewDocTab === doc.id
                        ? 'bg-primary/[0.08] border-primary'
                        : 'border-transparent hover:bg-secondary/40',
                    )}
                  >
                    <doc.Icon className={cn('size-4 shrink-0', reviewDocTab === doc.id ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-medium', reviewDocTab === doc.id ? 'text-primary' : 'text-foreground')}>
                      {doc.label}
                    </span>
                    {doc.id === 'coverletter' && clStreamContent && (
                      <CheckCircle2 className="size-3.5 text-green-500 shrink-0 ml-auto" />
                    )}
                    {doc.id === 'ats' && atsResult && (
                      <span className={cn('ml-auto text-xs font-bold', atsResult.overallScore >= 75 ? 'text-primary' : atsResult.overallScore >= 50 ? 'text-amber-500' : 'text-destructive')}>
                        {atsResult.overallScore}%
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            /* ── NORMAL SIDEBAR (Step 1) ─────────────────────────────────────── */
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-4 pb-2">
                Resume Sections
              </p>
              <nav>
                {RESUME_SECTION_DEFS.map((s) => {
                  const complete = getSectionComplete(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-l-2',
                        tab === s.id
                          ? 'bg-primary/[0.08] text-primary border-primary'
                          : 'text-foreground hover:bg-secondary/40 border-transparent',
                      )}
                    >
                      <s.Icon className="size-4 shrink-0" />
                      <span className="flex-1 font-medium">{s.label}</span>
                      {complete ? (
                        <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                      ) : (
                        <div className="size-2 rounded-full bg-border shrink-0" />
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="size-4" />
                  Add Section
                </button>
              </nav>

            </>
          )}
        </aside>

        {/* SIDEBAR / CENTER RESIZE HANDLE — hidden in step 3 */}
        {currentStep !== 3 && (
          <div
            className="hidden lg:flex shrink-0 w-1.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors z-10"
            onMouseDown={(e) => {
              sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth }
              e.preventDefault()
            }}
          />
        )}

        {/* CENTER EDITOR — hidden in step 3 */}
        <div
          className={cn(
            'relative flex-col overflow-hidden bg-background border-r border-border transition-all duration-200',
            currentStep === 3 ? 'hidden' : (mobileViewTab === 'edit' ? 'flex' : 'hidden'),
            currentStep !== 3 && (centerCollapsed ? 'lg:hidden' : 'lg:flex lg:shrink-0'),
          )}
          style={centerCollapsed || currentStep === 3 ? {} : { width: centerWidth }}
        >
          {!centerCollapsed && (
          <>

          {currentStep === 2 ? (
            /* ── AI TOOL WORKSPACE (Step 2 only) ────────────────────────────── */
            <div className="flex-1 overflow-y-auto p-5 lg:p-6">
              {/* Tool: Resume Polish */}
              {aiTool === 'polish' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Resume Polish</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      AI will review your entire resume and suggest improvements to wording, clarity, impact, grammar, action verbs, and bullet strength — no job description required.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Writing Tone</p>
                    <div className="flex gap-3">
                      {(['professional', 'concise', 'assertive'] as const).map((t) => (
                        <label key={t} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                          <input
                            type="radio"
                            name="enrich-tone"
                            value={t}
                            checked={enrichTone === t}
                            onChange={() => setEnrichTone(t)}
                            className="accent-primary"
                          />
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  {enrichmentState === 'comparing' ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground">Improvements ready to review</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        The AI has suggested improvements to your resume. Review them in the preview on the right, then accept or discard.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAcceptEnrichment}
                          className="flex-1 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm"
                        >
                          <CheckCircle2 className="size-4 mr-2" />
                          Accept Changes
                        </Button>
                        <Button
                          onClick={handleDiscardEnrichment}
                          className="flex-1 min-h-[44px] rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <X className="size-4 mr-2" />
                          Discard
                        </Button>
                      </div>
                    </div>
                  ) : enrichmentState === 'loading' ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-5 flex flex-col items-center gap-3 text-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">{ENRICHMENT_LOADING_MESSAGES[enrichMsgIndex]}</p>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${enrichProgress}%` }} />
                      </div>
                      <Button
                        variant="outline"
                        onClick={cancelEnrich}
                        className="min-h-[44px] rounded-lg border-destructive/50 text-destructive hover:bg-destructive/10 px-6"
                      >
                        <X className="size-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleEnrich}
                      disabled={streamLoading}
                      className="w-full min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold"
                    >
                      <Sparkles className="size-4 mr-2" />
                      Generate Improvements
                    </Button>
                  )}
                </div>
              )}

              {/* Tool: Target Role Tailoring */}
              {aiTool === 'tailor' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Target Role Tailoring</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Optimize your resume for the job you want to apply for.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">Target Job Description</label>
                    <textarea
                      rows={10}
                      className={cn(field, 'resize-none', jobDescValState === 'invalid' ? 'border-destructive focus:border-destructive' : '')}
                      placeholder="Paste the job description for the role you want to apply to."
                      value={jobDesc}
                      onChange={(e) => {
                        setJobDesc(e.target.value)
                        triggerJdValidation(e.target.value, setJobDescValState, setJobDescValError, jobDescValTimerRef)
                      }}
                    />
                    {jobDescValState === 'validating' && (
                      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" /> Checking job description…
                      </p>
                    )}
                    {jobDescValState === 'invalid' && jobDescValError && (
                      <p className="text-xs text-destructive px-1">{jobDescValError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Sections to tailor</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {(['summary', 'experience', 'education', 'skills'] as const).map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={tailorSections[s]}
                            onChange={(e) => setTailorSections((prev) => ({ ...prev, [s]: e.target.checked }))}
                            className="accent-primary"
                          />
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleTailor}
                    disabled={!jobDesc.trim() || jobDescValState === 'invalid' || jobDescValState === 'validating' || streamLoading}
                    className="w-full min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold"
                  >
                    <Wand2 className="size-4 mr-2" />
                    Tailor Resume to Target Role
                  </Button>
                </div>
              )}

              {/* Tool: Cover Letter */}
              {aiTool === 'coverletter' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Cover Letter</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Generate a personalized cover letter using your resume. Optionally paste a job description for a tailored result.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Company Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      className={cn(field, clCompanyError ? 'border-destructive focus:border-destructive' : '')}
                      placeholder="e.g. Google, Stripe, Acme Corp"
                      value={clCompany}
                      onChange={(e) => { setClCompany(e.target.value); if (e.target.value.trim()) setClCompanyError(null) }}
                    />
                    {clCompanyError && (
                      <p className="text-xs text-destructive px-1">{clCompanyError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Job Description <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                      rows={7}
                      className={cn(field, 'resize-none', clJobDescValState === 'invalid' ? 'border-destructive' : '')}
                      placeholder="Paste the job description for a more targeted cover letter…"
                      value={clJobDesc}
                      onChange={(e) => {
                        setClJobDesc(e.target.value)
                        if (e.target.value.trim()) {
                          triggerJdValidation(e.target.value, setClJobDescValState, setClJobDescValError, clJobDescValTimerRef)
                        } else {
                          setClJobDescValState('idle')
                          setClJobDescValError(null)
                        }
                      }}
                    />
                    {clJobDescValState === 'validating' && (
                      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" /> Checking job description…
                      </p>
                    )}
                    {clJobDescValState === 'invalid' && clJobDescValError && (
                      <p className="text-xs text-destructive px-1">{clJobDescValError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Tone</p>
                    <div className="flex gap-4">
                      {(['professional', 'enthusiastic', 'concise'] as CoverLetterTone[]).map((t) => (
                        <label key={t} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                          <input
                            type="radio"
                            name="cl-tone-workspace"
                            value={t}
                            checked={clTone === t}
                            onChange={() => setClTone(t)}
                            className="accent-primary"
                          />
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateCoverLetterInline}
                    disabled={clIsStreaming || !clCompany.trim() || (clJobDesc.trim() !== '' && (clJobDescValState === 'invalid' || clJobDescValState === 'validating'))}
                    className="w-full min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold"
                  >
                    {clIsStreaming
                      ? <Loader2 className="size-4 mr-2 animate-spin" />
                      : clStreamContent
                        ? <RefreshCw className="size-4 mr-2" />
                        : <Mail className="size-4 mr-2" />}
                    {clIsStreaming ? 'Generating…' : clStreamContent ? 'Regenerate Cover Letter' : 'Generate Cover Letter'}
                  </Button>
                  {(clStreamContent || clIsStreaming) && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveCoverLetter}
                        disabled={clIsStreaming || clSaving || !clStreamContent.trim()}
                        className="flex-1 min-h-[44px] rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {clSaving ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="size-4 mr-2" />
                        )}
                        {clSaved ? 'Saved!' : 'Save Cover Letter'}
                      </Button>
                      <Button
                        onClick={() => { setClStreamContent(''); setClStreamError(null); setClSaved(false) }}
                        disabled={clIsStreaming}
                        className="flex-1 min-h-[44px] rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <X className="size-4 mr-2" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                  {clStreamError && <p className="text-xs text-destructive px-1">{clStreamError}</p>}
                </div>
              )}

              {/* Tool: ATS Score */}
              {aiTool === 'ats' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">ATS Score</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Analyze how well your resume matches a job description's keywords and requirements.
                    </p>
                  </div>
                  <div className="space-y-3 bg-background rounded-xl border border-border p-4 shadow-sm">
                    <label className="block text-xs font-medium text-muted-foreground">Job Description</label>
                    <textarea
                      className={cn(field, 'min-h-32 resize-none', atsJobDescValState === 'invalid' ? 'border-destructive focus:border-destructive' : '')}
                      placeholder="Paste the job description here…"
                      value={atsJobDesc}
                      onChange={(e) => {
                        setAtsJobDesc(e.target.value)
                        triggerJdValidation(e.target.value, setAtsJobDescValState, setAtsJobDescValError, atsJobDescValTimerRef)
                      }}
                    />
                    {atsJobDescValState === 'validating' && (
                      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" /> Checking job description…
                      </p>
                    )}
                    {atsJobDescValState === 'invalid' && atsJobDescValError && <p className="text-xs text-destructive px-1">{atsJobDescValError}</p>}
                    <Button size="sm" onClick={handleAnalyzeATS} disabled={!atsJobDesc.trim() || atsJobDescValState === 'invalid' || atsJobDescValState === 'validating' || atsLoading} className="w-full min-h-[44px] bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">
                      {atsLoading ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Target className="size-3.5 mr-2" />}
                      Analyze ATS Score
                    </Button>
                  </div>
                  {atsError && <p className="text-xs text-destructive px-1">{atsError}</p>}
                  {atsResult && (
                    <div className="bg-background rounded-xl border border-border p-4 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn('text-4xl font-bold', atsResult.overallScore >= 75 ? 'text-primary' : atsResult.overallScore >= 50 ? 'text-amber-500' : 'text-destructive')}>{atsResult.overallScore}</span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAtsResult(null); setAtsJobDesc(''); setAtsError(null); setAtsJobDescValState('idle'); setAtsJobDescValError(null) }}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          title="Dismiss results"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      {atsResult.summary && <p className="text-sm text-muted-foreground">{atsResult.summary}</p>}
                      {atsResult.matchedKeywords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matched Keywords</p>
                          <div className="flex flex-wrap gap-1.5">
                            {atsResult.matchedKeywords.map((kw, i) => <span key={i} className="px-2 py-0.5 text-xs rounded-md border border-primary/40 text-primary bg-primary/10">{kw}</span>)}
                          </div>
                        </div>
                      )}
                      {atsResult.missingKeywords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missing Keywords</p>
                          <div className="flex flex-wrap gap-1.5">
                            {atsResult.missingKeywords.map((kw, i) => <span key={i} className="px-2 py-0.5 text-xs rounded-md border border-destructive/40 text-destructive bg-destructive/10">{kw}</span>)}
                          </div>
                        </div>
                      )}
                      {atsResult.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggestions</p>
                          <ul className="space-y-1.5">
                            {atsResult.suggestions.map((s, i) => (
                              <li key={i} className="flex gap-2 items-start">
                                <span className="text-primary text-xs mt-0.5 shrink-0">•</span>
                                <span className="text-sm text-foreground">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {atsResult && (
                    <div className="space-y-2">
                      {isAtsStale && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <span className="text-xs text-amber-700 dark:text-amber-400">Outdated — resume changed since last check.</span>
                          <button type="button" onClick={handleAnalyzeATS} disabled={!atsJobDesc.trim() || atsLoading} className="shrink-0 text-xs font-bold text-primary hover:underline disabled:opacity-50">Run again</button>
                        </div>
                      )}
                      {!isAtsStale && atsResultSaved === false && (
                        <p className="text-xs text-muted-foreground px-1">ATS result not saved yet. Save your resume to persist it.</p>
                      )}
                      {!isAtsStale && atsResultSaved === true && (
                        <p className="text-xs text-green-600 px-1">&#10003; ATS result saved with this resume.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Mobile: horizontal section tab strip */}
          <div className="lg:hidden shrink-0 flex overflow-x-auto scrollbar-none bg-background border-b border-border">
            {[...RESUME_SECTION_DEFS, ...REVIEW_TOOL_DEFS].map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 min-h-[44px] shrink-0',
                  tab === s.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground',
                )}
              >
                <s.Icon className="size-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Scrollable form area — ALL sections visible, scroll-to on tab click */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-10">

            {/* ── CONTACT ── */}
            <div ref={(el) => { sectionRefs.current.contact = el }} className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Contact Information</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Add your contact details and professional links.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      className={cn(field, 'pl-9')}
                      placeholder="Your full name"
                      value={resume.metadata.fullName}
                      onChange={(e) => setMeta('fullName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      className={cn(field, 'pl-9')}
                      placeholder="you@example.com"
                      type="email"
                      value={resume.metadata.email}
                      onChange={(e) => setMeta('email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Phone</label>
                  <input
                    className={field}
                    placeholder="+1 (555) 000-0000"
                    value={resume.metadata.phone ?? ''}
                    onChange={(e) => setMeta('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Location</label>
                  <input
                    className={field}
                    placeholder="City, State"
                    value={resume.metadata.location ?? ''}
                    onChange={(e) => setMeta('location', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">LinkedIn</label>
                  <input
                    className={field}
                    placeholder="linkedin.com/in/username"
                    value={resume.metadata.linkedIn ?? ''}
                    onChange={(e) => setMeta('linkedIn', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">GitHub URL</label>
                  <input
                    className={field}
                    placeholder="github.com/username"
                    value={resume.metadata.github ?? ''}
                    onChange={(e) => setMeta('github', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── SUMMARY ── */}
            <div ref={(el) => { sectionRefs.current.summary = el }} className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Summary</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Write a brief professional summary.</p>
              </div>
              <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-secondary/20">
                  <select className="text-xs text-foreground bg-background border border-border rounded-md px-2 py-1 mr-1 outline-none focus:ring-1 focus:ring-primary/40">
                    <option>Paragraph</option>
                  </select>
                  <button type="button" className="p-1.5 rounded-md hover:bg-secondary transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <Bold className="size-3.5 text-foreground" />
                  </button>
                  <button type="button" className="p-1.5 rounded-md hover:bg-secondary transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <Italic className="size-3.5 text-foreground" />
                  </button>
                  <button type="button" className="p-1.5 rounded-md hover:bg-secondary transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <Underline className="size-3.5 text-foreground" />
                  </button>
                  <div className="w-px h-4 bg-border mx-0.5" />
                  <button type="button" className="p-1.5 rounded-md hover:bg-secondary transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <List className="size-3.5 text-foreground" />
                  </button>
                  <button type="button" className="p-1.5 rounded-md hover:bg-secondary transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                    <ListOrdered className="size-3.5 text-foreground" />
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    rows={8}
                    className="w-full px-4 py-3 text-sm text-foreground bg-background outline-none resize-none placeholder:text-muted-foreground"
                    placeholder="A brief professional summary…"
                    value={resume.summary ?? ''}
                    onChange={(e) =>
                      setResume((r: ResumeSchema): ResumeSchema => ({
                        ...r,
                        summary: e.target.value || undefined,
                      }))
                    }
                  />
                  {isSummaryComplete && (
                    <div className="absolute bottom-2.5 right-2.5 size-2 rounded-full bg-green-500" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {wordCount} words{atsResult ? ` • ${atsResult.suggestions.length} suggestions available` : ''}
              </p>
            </div>

            {/* ── EXPERIENCE ── */}
            <div ref={(el) => { sectionRefs.current.experience = el }} className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Experience</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Add your work experience and achievements.</p>
              </div>
              {resume.experience.map((exp, i) => (
                <div key={i} className="bg-background rounded-xl border border-border p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{exp.title || 'Job Title'}</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.company || 'Company'}{exp.startDate ? ` · ${exp.startDate}${exp.current ? ' – Present' : exp.endDate ? ` – ${exp.endDate}` : ''}` : ''}
                      </p>
                    </div>
                    <button onClick={() => removeExp(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">Job Title</label>
                      <input className={field} placeholder="Software Engineer" value={exp.title} onChange={(e) => setExp(i, 'title', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">Company</label>
                      <input className={field} placeholder="Company Name" value={exp.company} onChange={(e) => setExp(i, 'company', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">Start Date</label>
                      <input className={field} placeholder="Jan 2022" value={exp.startDate} onChange={(e) => setExp(i, 'startDate', e.target.value)} />
                    </div>
                    {!exp.current && (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-muted-foreground">End Date</label>
                        <input className={field} placeholder="Dec 2023" value={exp.endDate ?? ''} onChange={(e) => setExp(i, 'endDate', e.target.value)} />
                      </div>
                    )}
                    <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input type="checkbox" className="accent-primary" checked={exp.current} onChange={(e) => { setExp(i, 'current', e.target.checked); if (e.target.checked) setExp(i, 'endDate', undefined) }} />
                      Currently working here
                    </label>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Achievements / Bullets</p>
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="flex gap-2 items-start">
                        <span className="mt-2 text-primary text-xs shrink-0">•</span>
                        <input className={cn(fieldSm, 'flex-1')} placeholder="Achievement or responsibility…" value={b} onChange={(e) => setBullet(i, bi, e.target.value)} />
                        {exp.bullets.length > 1 && (
                          <button onClick={() => removeBullet(i, bi)} className="mt-1.5 text-muted-foreground hover:text-destructive rounded p-0.5">
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addBullet(i)} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                      <Plus className="size-3" /> Add bullet
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addExp} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                <Plus className="size-4" /> Add Experience
              </button>
            </div>

            {/* ── EDUCATION ── */}
            <div ref={(el) => { sectionRefs.current.education = el }} className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Education</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Add your educational background.</p>
              </div>
              {resume.education.map((edu, i) => (
                <div key={i} className="bg-background rounded-xl border border-border p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{edu.institution || 'Institution'}</span>
                    <button onClick={() => removeEdu(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <input className={field} placeholder="Institution name" value={edu.institution} onChange={(e) => setEdu(i, 'institution', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={field} placeholder="Degree (B.S.)" value={edu.degree} onChange={(e) => setEdu(i, 'degree', e.target.value)} />
                    <input className={field} placeholder="Field of study" value={edu.field} onChange={(e) => setEdu(i, 'field', e.target.value)} />
                    <input className={cn(field, 'col-span-2')} placeholder="Graduation year (2024)" value={edu.graduationYear} onChange={(e) => setEdu(i, 'graduationYear', e.target.value)} />
                  </div>
                </div>
              ))}
              <button onClick={addEdu} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                <Plus className="size-4" /> Add Education
              </button>
            </div>

            {/* ── SKILLS ── */}
            <div ref={(el) => { sectionRefs.current.skills = el }} className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Skills</h3>
                <p className="text-sm text-muted-foreground mt-0.5">List your technical and soft skills.</p>
              </div>
              {resume.skills.map((group, gi) => (
                <div key={gi} className="bg-background rounded-xl border border-border p-4 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input className={cn(field, 'flex-1 font-medium')} placeholder="Category (Languages, Frameworks…)" value={group.category} onChange={(e) => setSkillCat(gi, e.target.value)} />
                    <button onClick={() => removeSkillGroup(gi)} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item, ii) => (
                      <div key={ii} className="flex items-center gap-1 bg-secondary/60 border border-border rounded-lg px-2.5 py-1">
                        <input className="bg-transparent text-xs outline-none w-20 text-foreground placeholder:text-muted-foreground" placeholder="Skill" value={item} onChange={(e) => setSkillItem(gi, ii, e.target.value)} />
                        {group.items.length > 1 && (
                          <button onClick={() => removeSkillItem(gi, ii)} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addSkillItem(gi)} className="flex items-center gap-0.5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors">
                      <Plus className="size-3" /> Add
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addSkillGroup} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                <Plus className="size-4" /> Add Skills
              </button>
            </div>


          </div>
          </>
          )}
          </>
          )}
        </div>

        {/* CENTER / RIGHT RESIZE HANDLE — hidden in step 3 */}
        {!centerCollapsed && currentStep !== 3 && (
          <div
            onMouseDown={(e) => {
              centerDragRef.current = { startX: e.clientX, startW: centerWidth }
              e.preventDefault()
            }}
            className="hidden lg:flex shrink-0 w-1.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors z-10"
          />
        )}

        {/* RIGHT PREVIEW — hidden in step 3 (step 3 has its own layout) */}
        <div className={cn(
          'flex flex-col overflow-hidden flex-1',
          currentStep === 3 ? 'hidden' : (mobileViewTab === 'preview' ? 'flex' : 'hidden'),
          currentStep !== 3 && 'lg:flex',
        )}>
          {enrichmentState === 'comparing' && enrichedResume && originalResume ? (
            <div className="flex-1 overflow-hidden p-4">
              <ComparisonView
                originalResume={originalResume}
                enrichedResume={enrichedResume}
                onAccept={handleAcceptEnrichment}
                onDiscard={handleDiscardEnrichment}
                hideActions
              />
            </div>
          ) : aiTool === 'coverletter' && (clStreamContent || clIsStreaming) ? (
            /* Cover Letter Editor — occupies the entire right panel, no Live Preview header */
            <div className="flex flex-col h-full">
              {/* Header: chevron toggle + Mail icon + label + streaming spinner */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-background border-b border-border">
                <button
                  onClick={() => setCenterCollapsed(prev => !prev)}
                  title={centerCollapsed ? "Show editor" : "Minimize editor"}
                  className="shrink-0 hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  {centerCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>
                <Mail className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-foreground">Cover Letter Editor</span>
                {clIsStreaming && <Loader2 className="size-3.5 animate-spin text-primary ml-auto" />}
              </div>
              {/* Editable textarea */}
              <div className="flex-1 overflow-hidden flex flex-col p-4 gap-2 bg-muted/30">
                <textarea
                  value={clStreamContent}
                  onChange={(e) => setClStreamContent(e.target.value)}
                  disabled={clIsStreaming}
                  placeholder={clIsStreaming ? 'Generating your cover letter…' : 'Your cover letter will appear here. You can edit it directly.'}
                  className="flex-1 w-full bg-card border border-border rounded-lg p-4 text-sm text-foreground leading-relaxed resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground disabled:opacity-60"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                  <span>
                    {clStreamContent.trim() ? clStreamContent.trim().split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                  {clIsStreaming ? (
                    <span className="text-primary uppercase tracking-widest">Generating…</span>
                  ) : (
                    <span className="uppercase tracking-widest">Edit directly</span>
                  )}
                </div>
              </div>
            </div>
          ) : currentStep === 1 ? (
            /* ── STEP 1 EDIT ZONE — diff view ─────────────────────────────── */
            <>
              {/* Edit Zone header */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-background border-b border-border">
                <button
                  onClick={() => setCenterCollapsed(prev => !prev)}
                  title={centerCollapsed ? "Show editor" : "Minimize editor"}
                  className="shrink-0 hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  {centerCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>
                <FileText className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-foreground hidden sm:block">Edit Zone</span>
                {hasDiff && (
                  <button
                    onClick={() => setDiffBaseline({ ...resume })}
                    className="ml-auto text-[11px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-1.5 rounded-md min-h-[28px]"
                  >
                    Accept all
                  </button>
                )}
                {/* Zoom controls */}
                <div className={cn('flex items-center gap-1 shrink-0 text-muted-foreground', hasDiff ? '' : 'ml-auto')}>
                  <button
                    data-testid="zoom-out-btn"
                    onClick={() => setZoomLevel(z => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z) - 1)] ?? z)}
                    className="p-1 hover:bg-secondary/70 rounded transition-colors"
                    disabled={zoomLevel === ZOOM_LEVELS[0]}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span data-testid="zoom-display" className="text-xs tabular-nums w-10 text-center">{zoomLevel}%</span>
                  <button
                    data-testid="zoom-in-btn"
                    onClick={() => setZoomLevel(z => ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) + 1] ?? z)}
                    className="p-1 hover:bg-secondary/70 rounded transition-colors"
                    disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              {/* Diff content area */}
              <div className="flex-1 overflow-auto bg-muted/60 p-4">
                <div
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  className="transition-all duration-300"
                >
                  <div
                    className="bg-white shadow-paper mx-auto rounded-sm font-mono text-[10pt] leading-relaxed"
                    style={{ width: '100%', maxWidth: '816px', minHeight: '1056px', padding: '48px 56px' }}
                  >
                    {diffLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex gap-2 px-1 rounded-sm',
                          line.type === 'added' && 'bg-green-50',
                          line.type === 'removed' && 'bg-red-50',
                        )}
                      >
                        <span className={cn(
                          'select-none shrink-0 w-4 text-right text-[9pt]',
                          line.type === 'added' && 'text-green-600',
                          line.type === 'removed' && 'text-red-500',
                          line.type === 'same' && 'text-transparent',
                        )}>
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className={cn(
                          'flex-1 whitespace-pre-wrap break-words',
                          line.type === 'removed' && 'line-through text-red-700',
                          line.type === 'added' && 'text-green-800',
                          line.type === 'same' && 'text-gray-800',
                          line.text === '' && 'h-4',
                        )}>
                          {line.text || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── STEP 2 LIVE PREVIEW ───────────────────────────────────────── */
            <>
              {/* Preview panel header */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-background border-b border-border">
                {/* Single toggle — always rendered, same position, icon changes */}
                <button
                  onClick={() => setCenterCollapsed(prev => !prev)}
                  title={centerCollapsed ? "Show editor" : "Minimize editor"}
                  className="shrink-0 hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  {centerCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronLeft className="size-4" />
                  )}
                </button>
                <span className="text-xs font-semibold text-foreground hidden sm:block">Live Preview</span>
              </div>
              {/* Preview content area — relative wrapper so enrichment overlay stays within viewport */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                {/* Enrichment loading overlay — fixed to right panel viewport, not the scroll container */}
                {enrichmentState === 'loading' && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="bg-card border border-border shadow-lg rounded-xl px-6 py-5 flex flex-col items-center gap-3 text-center w-64 pointer-events-auto">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-xs font-bold uppercase tracking-wider text-foreground min-h-[16px]">{ENRICHMENT_LOADING_MESSAGES[enrichMsgIndex]}</p>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${enrichProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{Math.round(enrichProgress)}% complete</p>
                    </div>
                  </div>
                )}
                {/* Scrollable preview content */}
                <div className="flex-1 overflow-auto bg-muted/60 p-4 relative">
                  <div
                    className={cn('transition-all duration-300', enrichmentState === 'loading' && 'opacity-30 blur-sm pointer-events-none')}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  >
                    <ResumePreview
                      resume={resume}
                      flashSections={flashSections}
                      industry={selectedIndustry}
                      detectedIndustry={resume.detectedIndustry}
                    />
                  </div>
                </div>
                {/* Streaming panel — shows in right panel so it's always visible */}
                {stream && enrichmentState === 'idle' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-[0_-8px_24px_-12px_rgba(0,113,227,0.25)] flex flex-col rounded-t-xl"
                    style={panelCollapsed ? undefined : { height: panelHeight }}
                  >
                    <div onMouseDown={handleDragStart} className="shrink-0 flex items-center justify-center h-3 cursor-ns-resize hover:bg-foreground/5 group">
                      <div className="flex flex-col gap-[3px] opacity-25 group-hover:opacity-60 transition-opacity">
                        <div className="w-6 h-px bg-muted-foreground" />
                        <div className="w-6 h-px bg-muted-foreground" />
                        <div className="w-6 h-px bg-muted-foreground" />
                      </div>
                    </div>
                    <div className="shrink-0 h-0.5 bg-border overflow-hidden">
                      <div className="h-full bg-primary ease-out" style={{ width: `${streamProgress}%`, transition: `width ${stream.done ? '0.3s' : '30s'} ease-out` }} />
                    </div>
                    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 min-w-0 truncate">
                        {!stream.done ? (
                          <span className="flex items-center gap-1.5 text-primary"><Loader2 className="size-3 animate-spin shrink-0" />{STREAMING_MESSAGES[msgIndex]}</span>
                        ) : stream.error ? (
                          <span className="text-destructive truncate">✗ Something went wrong</span>
                        ) : (
                          <span className="text-primary">✓ Done — your enriched resume is ready!</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {stream.done && !stream.error && (
                          <button onClick={applyStreamed} className="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">Apply changes</button>
                        )}
                        <button onClick={() => setStream(null)} className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-lg transition-colors">Dismiss</button>
                        <button onClick={() => setPanelCollapsed((c) => !c)} className="p-1 border border-border bg-secondary text-muted-foreground hover:bg-secondary/70 rounded-lg transition-colors">
                          {panelCollapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>
                    {!panelCollapsed && (
                      <div className="flex-1 min-h-0 overflow-y-scroll px-3 pb-3 scrollbar-thin scrollbar-thumb-[#D2D2D7] scrollbar-track-transparent">
                        <StreamingOutput text={stream.text} isStreaming={!stream.done} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── REVIEW & EXPORT STEP 3 ──────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Step 3 Toolbar */}
            <div className="shrink-0 h-12 border-b border-border bg-background flex items-center px-4 gap-2">
              {/* Inner scrollable section — all formatting controls */}
              <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 pr-2">
                {/* Formatting controls — shown for resume and cover letter tabs */}
                {reviewDocTab === 'resume' && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap shrink-0">Template</span>
                    <select
                      data-testid="template-select"
                      value={selectedIndustry}
                      onChange={(e) => setSelectedIndustry(e.target.value)}
                      className="h-8 text-xs bg-background border border-border rounded-md px-2 py-0 text-foreground outline-none focus:ring-1 focus:ring-primary/50 shrink-0"
                    >
                      <option value="general">Modern</option>
                      <option value="tech">Tech</option>
                      <option value="finance">Finance</option>
                      <option value="creative">Creative</option>
                      <option value="healthcare">Healthcare</option>
                    </select>
                  </>
                )}
                {(reviewDocTab === 'resume' || reviewDocTab === 'coverletter') && (
                  <>
                    <select
                      value={reviewFont}
                      onChange={(e) => setReviewFont(e.target.value)}
                      className="h-8 text-xs bg-background border border-border rounded-md px-2 py-0 text-foreground outline-none focus:ring-1 focus:ring-primary/50 shrink-0 w-28"
                    >
                      <option>Inter</option>
                      <option>Georgia</option>
                      <option>Times New Roman</option>
                      <option>Roboto</option>
                    </select>
                    <select
                      value={reviewFontSize}
                      onChange={(e) => setReviewFontSize(e.target.value)}
                      className="h-8 text-xs bg-background border border-border rounded-md px-2 py-0 text-foreground outline-none focus:ring-1 focus:ring-primary/50 shrink-0 w-20"
                    >
                      <option>10pt</option>
                      <option>11pt</option>
                      <option>12pt</option>
                    </select>
                    {/* Bold */}
                    <button
                      type="button"
                      onClick={() => setReviewBold(b => !b)}
                      title="Bold"
                      className={cn(
                        'min-h-[32px] min-w-[32px] flex items-center justify-center px-2 py-1 rounded border text-xs font-bold transition-colors shrink-0',
                        reviewBold
                          ? 'bg-primary/10 text-primary border-primary/50'
                          : 'bg-background text-muted-foreground border-border hover:bg-secondary/60',
                      )}
                    >
                      <Bold className="size-3.5" />
                    </button>
                    {/* Italic */}
                    <button
                      type="button"
                      onClick={() => setReviewItalic(i => !i)}
                      title="Italic"
                      className={cn(
                        'min-h-[32px] min-w-[32px] flex items-center justify-center px-2 py-1 rounded border text-xs transition-colors shrink-0',
                        reviewItalic
                          ? 'bg-primary/10 text-primary border-primary/50'
                          : 'bg-background text-muted-foreground border-border hover:bg-secondary/60',
                      )}
                    >
                      <Italic className="size-3.5" />
                    </button>
                    {/* Underline */}
                    <button
                      type="button"
                      onClick={() => setReviewUnderline(u => !u)}
                      title="Underline"
                      className={cn(
                        'min-h-[32px] min-w-[32px] flex items-center justify-center px-2 py-1 rounded border text-xs transition-colors shrink-0',
                        reviewUnderline
                          ? 'bg-primary/10 text-primary border-primary/50'
                          : 'bg-background text-muted-foreground border-border hover:bg-secondary/60',
                      )}
                    >
                      <Underline className="size-3.5" />
                    </button>
                    {/* Color picker */}
                    <label
                      title="Text color"
                      className="relative min-h-[32px] min-w-[32px] flex items-center justify-center px-2 py-1 rounded border border-border bg-background hover:bg-secondary/60 cursor-pointer shrink-0"
                    >
                      <input
                        type="color"
                        value={reviewColor}
                        onChange={(e) => setReviewColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <span className="text-xs font-bold leading-none" style={{ color: reviewColor, textDecoration: 'underline', textDecorationColor: reviewColor }}>A</span>
                    </label>
                  </>
                )}

                {/* Separator */}
                <div className="h-5 w-px bg-border shrink-0 mx-1" />

                {/* Review mode toggles */}
                {reviewDocTab === 'resume' && (
                  <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
                    {(['final', 'split', 'unified'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setReviewResumeMode(mode)}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[28px]',
                          reviewResumeMode === mode
                            ? 'bg-background shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {mode === 'final' ? 'Final' : mode === 'split' ? 'Split Compare' : 'Unified Review'}
                      </button>
                    ))}
                  </div>
                )}
                {reviewDocTab === 'coverletter' && (
                  <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
                    {(['final', 'compare'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setReviewClMode(mode)}
                        disabled={mode === 'compare'}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[28px]',
                          reviewClMode === mode
                            ? 'bg-background shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                          mode === 'compare' && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        {mode === 'final' ? 'Final' : 'Compare Drafts'}
                      </button>
                    ))}
                  </div>
                )}
                {reviewDocTab === 'ats' && (
                  <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
                    {(['overview', 'keywords', 'suggestions'] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setReviewAtsView(view)}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[28px]',
                          reviewAtsView === view
                            ? 'bg-background shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed right section — Save button + Export dropdown (no overflow-x-auto so dropdown is not clipped) */}
              <div ref={primaryExportRef} className="relative flex items-center gap-2 shrink-0">
                {/* Save toast anchored below this section when in step 3 */}
                {saveToast && currentStep === 3 && (
                  <div className={cn(
                    'absolute top-full right-0 mt-2 z-[100] flex items-center gap-2 px-3 py-2 shadow-lg text-xs font-bold rounded-lg whitespace-nowrap',
                    saveToast.ok ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground',
                  )}>
                    {saveToast.ok ? '✓' : '✗'} {saveToast.text}
                  </div>
                )}

                {/* Save button — right side, all tabs */}
                <Button
                  size="sm"
                  onClick={currentResumeId ? handleUpdate : handleSaveClick}
                  disabled={
                    isSaving ||
                    (reviewDocTab === 'coverletter' && !clStreamContent) ||
                    (reviewDocTab === 'ats' && !atsResult)
                  }
                  className="flex items-center justify-center gap-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 h-8 w-24 shrink-0"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save
                </Button>

                {/* Export dropdown */}
                <button
                  type="button"
                  onClick={() => setPrimaryExportOpen((o) => !o)}
                  disabled={(reviewDocTab === 'coverletter' && !clStreamContent) || (reviewDocTab === 'ats' && !atsResult)}
                  className="flex items-center justify-center gap-1.5 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors h-8 w-24 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="size-3.5" />
                  Export
                  <ChevronDown className={cn('size-3.5 transition-transform', primaryExportOpen && 'rotate-180')} />
                </button>
                {primaryExportOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-lg py-1 min-w-[200px] shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); handleExport('pdf') }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left disabled:opacity-50"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      Resume PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); handleExport('docx') }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left disabled:opacity-50"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      Resume DOCX
                    </button>
                    <div className="h-px bg-border mx-2 my-1" />
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); setSaveToast({ text: 'Cover Letter PDF export coming soon', ok: true }); setTimeout(() => setSaveToast(null), 3000) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                    >
                      <Mail className="size-3.5 shrink-0" />
                      Cover Letter PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); setSaveToast({ text: 'Cover Letter DOCX export coming soon', ok: true }); setTimeout(() => setSaveToast(null), 3000) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                    >
                      <Mail className="size-3.5 shrink-0" />
                      Cover Letter DOCX
                    </button>
                    <div className="h-px bg-border mx-2 my-1" />
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); setSaveToast({ text: 'ATS Report PDF coming soon', ok: true }); setTimeout(() => setSaveToast(null), 3000) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 transition-colors text-left"
                    >
                      <Target className="size-3.5 shrink-0" />
                      ATS Report PDF
                      <span className="ml-auto text-[10px] text-muted-foreground/60">Soon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPrimaryExportOpen(false); setSaveToast({ text: 'Application Package ZIP coming soon', ok: true }); setTimeout(() => setSaveToast(null), 3000) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 transition-colors text-left"
                    >
                      <Download className="size-3.5 shrink-0" />
                      Application Package ZIP
                      <span className="ml-auto text-[10px] text-muted-foreground/60">Soon</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 Preview Area */}
            <div className="flex-1 overflow-auto bg-muted/30 p-6">

              {/* Resume Tab */}
              {reviewDocTab === 'resume' && (
                <>
                  {reviewResumeMode === 'final' && (
                    <div className="flex justify-center">
                      <div className="bg-white text-black shadow-md rounded-sm" style={{ width: '816px', maxWidth: '100%' }}>
                        <ResumePreview
                          resume={resume}
                          flashSections={flashSections}
                          industry={selectedIndustry}
                          detectedIndustry={resume.detectedIndustry}
                          fontFamily={reviewFont}
                          fontSize={reviewFontSize}
                          bold={reviewBold}
                          italic={reviewItalic}
                          underline={reviewUnderline}
                          textColor={reviewColor}
                        />
                      </div>
                    </div>
                  )}
                  {reviewResumeMode === 'split' && (
                    <div className="flex gap-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center">Original</p>
                        <div className="bg-white text-black shadow-md rounded-sm overflow-hidden">
                          <ResumePreview
                            resume={originalResume ?? resume}
                            industry={selectedIndustry}
                            detectedIndustry={resume.detectedIndustry}
                            fontFamily={reviewFont}
                            fontSize={reviewFontSize}
                            bold={reviewBold}
                            italic={reviewItalic}
                            underline={reviewUnderline}
                            textColor={reviewColor}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 text-center">AI Enhanced</p>
                        <div className="bg-white text-black shadow-md rounded-sm overflow-hidden">
                          <ResumePreview
                            resume={enrichedResume ?? resume}
                            flashSections={flashSections}
                            industry={selectedIndustry}
                            detectedIndustry={resume.detectedIndustry}
                            fontFamily={reviewFont}
                            fontSize={reviewFontSize}
                            bold={reviewBold}
                            italic={reviewItalic}
                            underline={reviewUnderline}
                            textColor={reviewColor}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {reviewResumeMode === 'unified' && (
                    <div className="flex justify-center">
                      <div className="bg-white text-black shadow-md rounded-sm" style={{ width: '816px', maxWidth: '100%' }}>
                        <ResumePreview
                          resume={resume}
                          flashSections={flashSections}
                          industry={selectedIndustry}
                          detectedIndustry={resume.detectedIndustry}
                          fontFamily={reviewFont}
                          fontSize={reviewFontSize}
                          bold={reviewBold}
                          italic={reviewItalic}
                          underline={reviewUnderline}
                          textColor={reviewColor}
                          diffHighlight={
                            originalResume && enrichedResume
                              ? {
                                  summary: originalResume.summary !== enrichedResume.summary,
                                  experience: enrichedResume.experience.map((exp, i) =>
                                    exp.bullets.map((b, bi) => b !== (originalResume.experience[i]?.bullets[bi] ?? ''))
                                  ),
                                }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Cover Letter Tab */}
              {reviewDocTab === 'coverletter' && (
                <div className="flex justify-center">
                  {clStreamContent ? (
                    <div className="bg-white text-black shadow-md rounded-sm p-10 leading-relaxed" style={{ width: '816px', maxWidth: '100%', fontFamily: reviewFont, fontSize: reviewFontSize, fontWeight: reviewBold ? 'bold' : undefined, fontStyle: reviewItalic ? 'italic' : undefined, textDecoration: reviewUnderline ? 'underline' : undefined, color: reviewColor }}>
                      <pre className="whitespace-pre-wrap font-inherit text-sm text-black leading-relaxed" style={{ fontFamily: 'inherit' }}>
                        {clStreamContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                      <Mail className="size-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No cover letter yet — generate one in the AI Enhance step.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ATS Report Tab */}
              {reviewDocTab === 'ats' && (
                <div className="flex justify-center">
                  {atsResult ? (
                    <div className="bg-white text-black shadow-md rounded-sm p-8 space-y-6" style={{ width: '816px', maxWidth: '100%' }}>
                      {/* Overview */}
                      {(reviewAtsView === 'overview') && (
                        <>
                          <div className="flex items-baseline gap-2 border-b border-gray-200 pb-4">
                            <span className={cn('text-5xl font-bold', atsResult.overallScore >= 75 ? 'text-blue-600' : atsResult.overallScore >= 50 ? 'text-amber-500' : 'text-red-500')}>
                              {atsResult.overallScore}
                            </span>
                            <span className="text-lg text-gray-500">/ 100</span>
                            <span className="ml-2 text-sm font-semibold text-gray-700">ATS Match Score</span>
                          </div>
                          {atsResult.summary && (
                            <p className="text-sm text-gray-700 leading-relaxed">{atsResult.summary}</p>
                          )}
                        </>
                      )}
                      {/* Keywords */}
                      {(reviewAtsView === 'keywords') && (
                        <div className="space-y-4">
                          {atsResult.matchedKeywords.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Matched Keywords</p>
                              <div className="flex flex-wrap gap-1.5">
                                {atsResult.matchedKeywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 text-xs rounded border border-blue-300 text-blue-700 bg-blue-50">{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {atsResult.missingKeywords.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Missing Keywords</p>
                              <div className="flex flex-wrap gap-1.5">
                                {atsResult.missingKeywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 text-xs rounded border border-red-300 text-red-700 bg-red-50">{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Suggestions */}
                      {(reviewAtsView === 'suggestions') && atsResult.suggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Suggestions</p>
                          <ul className="space-y-2">
                            {atsResult.suggestions.map((s, i) => (
                              <li key={i} className="flex gap-2 items-start text-sm text-gray-700">
                                <span className="text-blue-500 mt-0.5 shrink-0 font-bold">{i + 1}.</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                      <Target className="size-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No ATS report yet — run ATS Score in the AI Enhance step.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM STATUS BAR ─────────────────────────────────────────────────── */}
      <div className="shrink-0 h-12 flex items-center justify-end px-4 lg:px-6 bg-background border-t border-border">
        <div className="flex items-center gap-2">
          {/* Back button — shown in stages 2 and 3 */}
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(s - 1, 1))}
              className="flex items-center gap-1.5 px-4 py-1.5 border border-border text-xs font-medium text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px]"
            >
              <ArrowLeft className="size-3.5" />
              {currentStep === 2 ? 'Back to Edit' : 'Back to AI Enhance'}
            </button>
          )}

          {/* Next stage button — shown in stages 1 and 2 */}
          {currentStep < 3 && (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.min(s + 1, 3))}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors min-h-[32px]"
            >
              {currentStep === 1 ? 'Continue to AI Enhance' : 'Continue to Review & Export'}
              <ArrowRight className="size-3.5" />
            </button>
          )}

        </div>
      </div>

      {/* ── Tailor modal ─────────────────────────────────────────────────────── */}
      <Modal open={tailorOpen}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold text-foreground uppercase tracking-wide"
                >
                  Target Role Tailoring
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste the job description for the role you want to apply to.
                </p>
              </div>
              <button
                onClick={() => setTailorOpen(false)}
                className="text-muted-foreground hover:text-foreground ml-4 shrink-0 p-1 hover:bg-secondary transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            {/* Job description */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Target Job Description
              </label>
              <textarea
                className="w-full min-h-48 border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary resize-none transition-shadow"
                placeholder="Paste the job description for the role you want to apply to."
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
              />
            </div>
            {/* Section checkboxes */}
            <div className="mb-6">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Sections to tailor:
              </p>
              <div className="flex gap-4">
                {(['summary', 'experience', 'education', 'skills'] as const).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none uppercase tracking-wide"
                  >
                    <input
                      type="checkbox"
                      checked={tailorSections[s]}
                      onChange={(e) =>
                        setTailorSections((prev) => ({ ...prev, [s]: e.target.checked }))
                      }
                      className="accent-primary"
                    />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTailorOpen(false)}
                className="px-5 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTailor}
                disabled={!jobDesc.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
              >
                <Wand2 className="size-4" />
                Tailor Resume to Target Role
              </button>
            </div>
      </Modal>

      {/* ── Save dialog ─────────────────────────────────────────────────────── */}
      <Modal open={saveDialogOpen} className="max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <h2
                className="text-base font-bold text-foreground uppercase tracking-wide"
              >
                Save Resume
              </h2>
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Title
              </label>
              <input
                autoFocus
                className="w-full px-3 py-2 border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-shadow"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSaveDialogOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={isSaving || !saveTitle.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
              >
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </button>
            </div>
      </Modal>

      {/* ── Discard & re-enrich confirm dialog ──────────────────────────────── */}
      <Modal open={confirmReEnrichOpen} className="max-w-sm p-6">
            <h2 className="text-base font-bold text-foreground uppercase tracking-wide mb-4">
              Discard Enrichment?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              You have unsaved enrichment changes. Discard and re-enrich?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmReEnrichOpen(false)}
                className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReEnrich}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
              >
                Confirm
              </button>
            </div>
      </Modal>

      {/* ── Save toast (global, for steps 1 and 2 only) ─────────────────────── */}
      {saveToast && currentStep !== 3 && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 shadow-lg text-xs font-bold uppercase tracking-wide transition-all',
            saveToast.ok
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground',
          )}
        >
          {saveToast.ok ? '✓' : '✗'} {saveToast.text}
        </div>
      )}
    </div>
  )
}
