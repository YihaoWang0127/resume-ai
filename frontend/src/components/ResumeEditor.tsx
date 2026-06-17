import { useEffect, useRef, useState } from 'react'
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
  RotateCcw,
  RotateCw,
  Minus,
  Clock,
  Eye,
  Settings,
  ArrowRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  ArrowLeft,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import ExportMenu from '@/components/ExportMenu'
import { cn } from '@/lib/utils'
import type { ATSScoreResult, EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'
import { enrichResume, exportResume, fromBackend, scoreATS, tailorResume } from '@/services/api'
import { saveResume, updateResume } from '@/services/resumes'
import { useAuth } from '@/contexts/AuthContext'
import ResumePreview from './ResumePreview'
import StreamingOutput from './StreamingOutput'
import ComparisonView from './ComparisonView'

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

function newExp(): ExperienceItem {
  return { company: '', title: '', startDate: '', current: true, bullets: [''] }
}
function newEdu(): EducationItem {
  return { institution: '', degree: '', field: '', graduationYear: '' }
}
function newSkill(): SkillCategory {
  return { category: '', items: [''] }
}


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

type CoverLetterTone = 'professional' | 'enthusiastic' | 'concise'

const ZOOM_LEVELS = [75, 90, 100, 110, 125]

const SECTION_DEFS: Array<{ id: Tab; label: string; description: string; Icon: LucideIcon }> = [
  { id: 'contact',    label: 'Contact',    description: 'Add your contact details and professional links.',    Icon: User },
  { id: 'summary',    label: 'Summary',    description: 'Write a brief professional summary.',                 Icon: FileText },
  { id: 'experience', label: 'Experience', description: 'Add your work experience and achievements.',          Icon: Briefcase },
  { id: 'education',  label: 'Education',  description: 'Add your educational background.',                    Icon: GraduationCap },
  { id: 'skills',     label: 'Skills',     description: 'List your technical and soft skills.',                Icon: Zap },
  { id: 'ats',        label: 'ATS Score',  description: 'Analyze your resume against a job description.',      Icon: Target },
]

export default function ResumeEditor({ initialResume, initialResumeId, onBack, onSignUp }: Props) {
  const { user, isGuest } = useAuth()
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
  const [coverLetterOpen, setCoverLetterOpen] = useState(false)
  const [clCompany, setClCompany] = useState('')
  const [clJobDesc, setClJobDesc] = useState('')
  const [clTone, setClTone] = useState<CoverLetterTone>('professional')
  const [saveTitle, setSaveTitle] = useState(
    () => `Resume - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  )
  const [isSaving, setIsSaving] = useState(false)
  const [enrichmentState, setEnrichmentState] = useState<EnrichmentState>('idle')
  const [originalResume, setOriginalResume] = useState<ResumeSchema | null>(null)
  const [enrichedResume, setEnrichedResume] = useState<ResumeSchema | null>(null)
  const [enrichMsgIndex, setEnrichMsgIndex] = useState(0)
  const [confirmReEnrichOpen, setConfirmReEnrichOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [centerCollapsed, setCenterCollapsed] = useState(false)
  const [centerWidth, setCenterWidth] = useState(380)
  const accumRef = useRef('')
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const centerDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const sectionRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    contact: null, summary: null, experience: null, education: null, skills: null, ats: null,
  })

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
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumRef.current += chunk
        setStream((s: StreamState | null) => (s ? { ...s, text: s.text + chunk } : null))
      }
      setStream((s: StreamState | null) => (s ? { ...s, done: true } : null))
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
    runStream(() => enrichResume(resume))
    // Enrich's loading/comparison UI lives in the right (preview) panel —
    // switch mobile view there so the user sees it (overrides runStream's
    // setMobileViewTab('edit') for the Tailor flow).
    setMobileViewTab('preview')
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

  const handleAnalyzeATS = async () => {
    setAtsLoading(true)
    setAtsError(null)
    try {
      const result = await scoreATS(resume, atsJobDesc)
      setAtsResult(result)
    } catch (err) {
      setAtsError(err instanceof Error ? err.message : String(err))
    } finally {
      setAtsLoading(false)
    }
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
    try {
      const saved = await saveResume({ ...resume, detectedIndustry: selectedIndustry }, saveTitle.trim())
      setCurrentResumeId(saved.id)
      setSaveDialogOpen(false)
      showToast('Resume saved!', true)
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
    try {
      await updateResume(currentResumeId, { ...resume, detectedIndustry: selectedIndustry })
      showToast('Resume updated!', true)
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
      if (!centerDragRef.current) return
      const delta = e.clientX - centerDragRef.current.startX
      const newW = Math.max(260, Math.min(600, centerDragRef.current.startW + delta))
      setCenterWidth(newW)
    }
    const onMouseUp = () => { centerDragRef.current = null }
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
  const wordCount = resume.summary?.split(/\s+/).filter(Boolean).length ?? 0
  const aiSuggestionCount =
    resume.experience.reduce((a, e) => a + e.bullets.length, 0) + (resume.summary ? 3 : 0)
  const avatarInitial = (
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'U'
  ).charAt(0).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

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
            { num: 3, label: 'Preview & Customize' },
            { num: 4, label: 'Download' },
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
              {i < 3 && <span className="text-muted-foreground/60 text-xs">→</span>}
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTailorOpen(true)}
            disabled={streamLoading}
            className="hidden lg:flex items-center gap-1.5 text-xs h-8 rounded-lg border-border"
          >
            <Wand2 className="size-3.5" />
            Tailor
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCoverLetterOpen(true)}
            disabled={streamLoading}
            className="hidden lg:flex items-center gap-1.5 text-xs h-8 rounded-lg border-border"
          >
            <Mail className="size-3.5" />
            Cover Letter
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMobileViewTab(mobileViewTab === 'preview' ? 'edit' : 'preview')}
            className="hidden sm:flex items-center gap-1.5 text-xs h-8 rounded-lg border-border"
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
          <div ref={exportMenuRef} className="relative">
            <Button
              size="sm"
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span className="hidden sm:block">Download</span>
              <ChevronDown className="size-3" />
            </Button>
            {exportMenuOpen && (
              <ExportMenu rounded="lg" className="min-w-[190px]">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-foreground text-left"
                >
                  <Download className="size-3.5 text-muted-foreground" />
                  Save as PDF
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-foreground text-left"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  Save as Word (.docx)
                </button>
              </ExportMenu>
            )}
          </div>
          <div className="size-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-primary">{avatarInitial}</span>
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
        <aside className="hidden lg:flex flex-col w-[200px] xl:w-[220px] shrink-0 border-r border-border bg-background overflow-y-auto">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-4 pb-2">
            Edit Sections
          </p>
          <nav className="flex-1">
            {SECTION_DEFS.map((s) => {
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
          {/* AI Suggestions card */}
          <div className="m-3 p-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-sm font-semibold text-foreground">AI Suggestions</span>
              <span className="ml-auto text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold leading-none">
                {aiSuggestionCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
              Improve your content, impact and ATS score with AI suggestions.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={streamLoading}
              className="w-full text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10 h-8"
            >
              View Suggestions
            </Button>
          </div>
        </aside>

        {/* CENTER EDITOR ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            'relative flex-col overflow-hidden bg-background border-r border-border',
            mobileViewTab === 'edit' ? 'flex' : 'hidden',
            centerCollapsed ? 'lg:hidden' : 'lg:flex lg:shrink-0',
          )}
          style={centerCollapsed ? {} : { width: centerWidth }}
        >
          {/* Minimize button — top-right corner of center panel (conditionally rendered so JSDOM tests can detect its absence) */}
          {!centerCollapsed && (
            <button
              onClick={() => setCenterCollapsed(true)}
              title="Minimize editor"
              className="absolute top-2 right-2 z-20 hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}

          {/* Mobile: horizontal section tab strip */}
          <div className="lg:hidden shrink-0 flex overflow-x-auto scrollbar-none bg-background border-b border-border">
            {SECTION_DEFS.map((s) => (
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
          <div className="flex-1 overflow-y-auto p-4 pt-8 lg:p-6 lg:pt-10 space-y-10">

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
                <Plus className="size-4" /> Add Category
              </button>
            </div>

            {/* ── ATS SCORE ── */}
            <div ref={(el) => { sectionRefs.current.ats = el }} className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">ATS Score</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Analyze your resume against a job description.</p>
              </div>
              <div className="bg-background rounded-xl border border-border p-4 space-y-3 shadow-sm">
                <label className="block text-xs font-medium text-muted-foreground">Job Description</label>
                <textarea className={cn(field, 'min-h-32 resize-none')} placeholder="Paste the job description here…" value={atsJobDesc} onChange={(e) => setAtsJobDesc(e.target.value)} />
                <Button size="sm" onClick={handleAnalyzeATS} disabled={!atsJobDesc.trim() || atsLoading} className="w-full min-h-[44px] bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">
                  {atsLoading ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Sparkles className="size-3.5 mr-2" />}
                  Analyze ATS Score
                </Button>
              </div>
              {atsError && <p className="text-xs text-destructive px-1">{atsError}</p>}
              {atsResult && (
                <div className="bg-background rounded-xl border border-border p-4 space-y-4 shadow-sm">
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-4xl font-bold', atsResult.overallScore >= 75 ? 'text-primary' : atsResult.overallScore >= 50 ? 'text-amber-500' : 'text-destructive')}>{atsResult.overallScore}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
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
            </div>

          </div>
        </div>

        {/* CENTER / RIGHT RESIZE HANDLE ──────────────────────────────────────── */}
        {!centerCollapsed && (
          <div
            onMouseDown={(e) => {
              centerDragRef.current = { startX: e.clientX, startW: centerWidth }
              e.preventDefault()
            }}
            className="hidden lg:flex shrink-0 w-1.5 cursor-col-resize bg-border hover:bg-primary/50 transition-colors z-10"
          />
        )}

        {/* RIGHT PREVIEW ────────────────────────────────────────────────────── */}
        <div className={cn(
          'relative flex flex-col overflow-hidden flex-1',
          mobileViewTab === 'preview' ? 'flex' : 'hidden',
          'lg:flex',
        )}>
          {/* Re-open button — absolutely positioned at top-left, mirrors the close button exactly */}
          {centerCollapsed && (
            <button
              onClick={() => setCenterCollapsed(false)}
              title="Show editor"
              className="absolute top-2 left-2 z-20 hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
          {enrichmentState === 'comparing' && enrichedResume && originalResume ? (
            <ComparisonView
              originalResume={originalResume}
              enrichedResume={enrichedResume}
              onAccept={handleAcceptEnrichment}
              onDiscard={handleDiscardEnrichment}
            />
          ) : (
            <>
              {/* Preview panel header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-background border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground hidden sm:block">Live Preview</span>
                  <div className="w-px h-3 bg-border hidden sm:block" />
                  <span className="text-xs font-medium text-muted-foreground">Template</span>
                  <select
                    data-testid="template-select"
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                    value={selectedIndustry}
                    onChange={(e) => setSelectedIndustry(e.target.value)}
                  >
                    <option value="general">Modern</option>
                    <option value="tech">Tech</option>
                    <option value="finance">Finance</option>
                    <option value="creative">Creative</option>
                    <option value="healthcare">Healthcare</option>
                  </select>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Style</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { hex: '#0071E3', id: 'tech' },
                      { hex: '#16a34a', id: 'healthcare' },
                      { hex: '#7c3aed', id: 'creative' },
                      { hex: '#1e3a5f', id: 'finance' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => setSelectedIndustry(s.id)} title={s.id}
                        className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110', selectedIndustry === s.id ? 'border-foreground scale-110' : 'border-transparent')}
                        style={{ background: s.hex }}
                      />
                    ))}
                  </div>
                  <button type="button" className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                    <Settings className="size-3.5" />
                  </button>
                </div>
              </div>
              {/* Preview content + streaming panel overlay */}
              <div className="flex-1 overflow-auto bg-muted/60 p-4 relative">
                <div className="relative">
                  <div
                    className={cn('transition-all duration-300', enrichmentState === 'loading' && 'opacity-30 blur-sm pointer-events-none')}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  >
                    <ResumePreview resume={resume} flashSections={flashSections} industry={selectedIndustry} detectedIndustry={resume.detectedIndustry} />
                  </div>
                  {enrichmentState === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-card border border-border shadow-lg rounded-xl px-6 py-5 flex flex-col items-center gap-3 text-center max-w-xs">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground">{ENRICHMENT_LOADING_MESSAGES[enrichMsgIndex]}</p>
                      </div>
                    </div>
                  )}
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
      </div>

      {/* ── BOTTOM STATUS BAR ─────────────────────────────────────────────────── */}
      <div className="shrink-0 h-12 flex items-center justify-between px-4 lg:px-6 bg-background border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          <span className="hidden sm:block">Last saved just now</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" title="Undo" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
            <RotateCcw className="size-3.5" />
          </button>
          <button type="button" title="Redo" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
            <RotateCw className="size-3.5" />
          </button>
          <button type="button" title="Upload" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
            <Upload className="size-3.5" />
          </button>
          <div className="flex items-center mx-1 border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                const idx = ZOOM_LEVELS.indexOf(zoomLevel)
                setZoomLevel(ZOOM_LEVELS[Math.max(0, idx - 1)])
              }}
              className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[30px]"
            >
              <Minus className="size-3" />
            </button>
            <div><span className="px-2 text-xs text-foreground font-medium min-w-[44px] text-center border-x border-border">{zoomLevel}%</span></div>
            <button
              type="button"
              onClick={() => {
                const idx = ZOOM_LEVELS.indexOf(zoomLevel)
                setZoomLevel(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, idx + 1)])
              }}
              className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[30px]"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <button type="button" title="History" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
            <Clock className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {currentResumeId && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="size-3.5" />
              Autosaved
            </div>
          )}
          {currentResumeId ? (
            <button
              onClick={handleUpdate}
              disabled={isSaving}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium text-foreground rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-50 min-h-[32px]"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Update
            </button>
          ) : (
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium text-foreground rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-50 min-h-[32px]"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(s - 1, 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-border text-xs font-medium text-foreground rounded-lg hover:bg-secondary/60 transition-colors min-h-[32px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="size-3.5" />
            Prev Step
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(s + 1, 4))}
            disabled={currentStep === 4}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors min-h-[32px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next Step
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Cover Letter modal ──────────────────────────────────────────────── */}
      <Modal open={coverLetterOpen}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold text-foreground uppercase tracking-wide"
                >
                  Generate Cover Letter
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Claude will write a personalized cover letter based on your resume and the job
                </p>
              </div>
              <button
                onClick={() => setCoverLetterOpen(false)}
                className="text-muted-foreground hover:text-foreground ml-4 shrink-0 p-1 hover:bg-secondary transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Company Name */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus
                className="w-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-shadow"
                placeholder="e.g. Google, Stripe, Acme Corp"
                value={clCompany}
                onChange={(e) => setClCompany(e.target.value)}
              />
            </div>

            {/* Job Description */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Job Description <span className="text-destructive">*</span>
              </label>
              <textarea
                className="w-full min-h-32 border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary resize-none transition-shadow"
                placeholder="Paste the job description here..."
                value={clJobDesc}
                onChange={(e) => setClJobDesc(e.target.value)}
              />
            </div>

            {/* Tone selector */}
            <div className="mb-6">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Tone
              </p>
              <div className="flex gap-3">
                {(['professional', 'enthusiastic', 'concise'] as CoverLetterTone[]).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none uppercase tracking-wide"
                  >
                    <input
                      type="radio"
                      name="cl-tone"
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

            {/* Footer */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCoverLetterOpen(false)}
                className="px-5 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setCoverLetterOpen(false)
                  navigate('/cover-letter/new', {
                    state: {
                      companyName: clCompany,
                      jobDescription: clJobDesc,
                      tone: clTone,
                      resume,
                      from: '/editor',
                    },
                  })
                }}
                disabled={!clCompany.trim() || !clJobDesc.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
              >
                <Mail className="size-4" />
                Generate
              </button>
            </div>
      </Modal>

      {/* ── Tailor modal ─────────────────────────────────────────────────────── */}
      <Modal open={tailorOpen}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold text-foreground uppercase tracking-wide"
                >
                  Tailor Resume for Job
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste the job description and Claude will rewrite your resume to match
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
                Job Description
              </label>
              <textarea
                className="w-full min-h-48 border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary resize-none transition-shadow"
                placeholder="Paste the full job description here..."
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
                Tailor Resume
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

      {/* ── Save toast ───────────────────────────────────────────────────────── */}
      {saveToast && (
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
