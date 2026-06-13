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
  Loader2,
  Wand2,
  FileText,
  Save,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import ExportMenu from '@/components/ExportMenu'
import { cn } from '@/lib/utils'
import type { ATSScoreResult, EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'
import { enrichResume, exportResume, fromBackend, scoreATS, tailorResume } from '@/services/api'
import { saveResume, updateResume } from '@/services/resumes'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import ResumePreview from './ResumePreview'
import StreamingOutput from './StreamingOutput'

interface Props {
  initialResume: ResumeSchema
  initialResumeId?: string | null
  onBack: () => void
  onSignUp?: () => void
}

type Tab = 'summary' | 'experience' | 'education' | 'skills' | 'ats'

interface StreamState {
  text: string
  done: boolean
  error: string | null
}

const field =
  'w-full px-2.5 py-1.5 border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-shadow placeholder:text-muted-foreground'
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

type CoverLetterTone = 'professional' | 'enthusiastic' | 'concise'

export default function ResumeEditor({ initialResume, initialResumeId, onBack, onSignUp }: Props) {
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const [resume, setResume] = useState<ResumeSchema>(initialResume)
  const [tab, setTab] = useState<Tab>('summary')
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
  const accumRef = useRef('')
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

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
  const handleEnrich = () => runStream(() => enrichResume(resume))

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
      const saved = await saveResume(resume, saveTitle.trim())
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
      await updateResume(currentResumeId, resume)
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

  const TABS: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'ats', label: 'ATS Score' },
  ]

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── top bar ─────────────────────────────────────────────────────────── */}
      <Navbar onBack={onBack}>
        <Button
          size="sm"
          onClick={handleEnrich}
          disabled={streamLoading}
          className="bg-primary text-primary-foreground uppercase text-xs tracking-wider font-bold rounded-none border-0 hover:bg-primary/90"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">Enrich with AI</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTailorOpen(true)}
          disabled={streamLoading}
          className="border-primary text-primary uppercase text-xs tracking-wider font-bold rounded-none bg-background hover:bg-primary/10"
        >
          <Briefcase className="size-3.5" />
          <span className="hidden sm:inline">Tailor for Job</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCoverLetterOpen(true)}
          disabled={streamLoading}
          className="border-primary text-primary uppercase text-xs tracking-wider font-bold rounded-none bg-background hover:bg-primary/10"
        >
          <Mail className="size-3.5" />
          <span className="hidden sm:inline">Cover Letter</span>
        </Button>
        <div ref={exportMenuRef} className="relative">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExportMenuOpen((o) => !o)}
            disabled={isExporting}
            className="border-primary text-primary uppercase text-xs tracking-wider font-bold rounded-none bg-background hover:bg-primary/10"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="size-3 ml-0.5" />
          </Button>
          {exportMenuOpen && (
            <ExportMenu rounded="none" className="min-w-[190px]">
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
        {currentResumeId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpdate}
            disabled={isSaving}
            className="border-primary text-primary uppercase text-xs tracking-wider font-bold rounded-none bg-background hover:bg-primary/10"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span className="hidden sm:inline">Update</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveClick}
            disabled={isSaving}
            className="border-primary text-primary uppercase text-xs tracking-wider font-bold rounded-none bg-background hover:bg-primary/10"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </Button>
        )}
        <div className="h-4 w-px bg-border" />
      </Navbar>

      {/* Guest banner */}
      {isGuest && (
        <div className="shrink-0 border-b border-yellow-900/40 bg-yellow-950/20 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-yellow-400/90">
            You're browsing as guest. Sign up to save your resumes.
          </p>
          <button
            type="button"
            onClick={() => onSignUp?.()}
            className="shrink-0 text-xs font-bold uppercase tracking-wider text-primary border border-primary px-3 py-1 hover:bg-primary/10 transition-colors"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* ── main ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Mobile Edit / Preview toggle */}
        <div className="md:hidden shrink-0 border-b border-border flex bg-background">
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

        {/* Left: form */}
        <div className={cn(
          'relative w-full lg:w-[40%] lg:min-w-[420px] lg:max-w-[640px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-border overflow-hidden bg-card h-[55vh] lg:h-auto',
          mobileViewTab === 'edit' ? 'flex' : 'hidden',
          'md:flex',
        )}>
          {/* Metadata */}
          <div className="shrink-0 border-b border-border p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Contact
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={cn(field, 'col-span-2')}
                placeholder="Full name"
                value={resume.metadata.fullName}
                onChange={(e) => setMeta('fullName', e.target.value)}
              />
              <input
                className={field}
                placeholder="Email"
                value={resume.metadata.email}
                onChange={(e) => setMeta('email', e.target.value)}
              />
              <input
                className={field}
                placeholder="Phone"
                value={resume.metadata.phone ?? ''}
                onChange={(e) => setMeta('phone', e.target.value)}
              />
              <input
                className={field}
                placeholder="Location"
                value={resume.metadata.location ?? ''}
                onChange={(e) => setMeta('location', e.target.value)}
              />
              <input
                className={field}
                placeholder="LinkedIn URL"
                value={resume.metadata.linkedIn ?? ''}
                onChange={(e) => setMeta('linkedIn', e.target.value)}
              />
              <input
                className={cn(field, 'col-span-2')}
                placeholder="GitHub URL"
                value={resume.metadata.github ?? ''}
                onChange={(e) => setMeta('github', e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b border-border flex overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 min-w-[72px] py-2.5 text-xs font-bold uppercase tracking-wider text-center transition-colors',
                  tab === t.id
                    ? 'text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Summary */}
            {tab === 'summary' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Professional summary
                </label>
                <textarea
                  rows={10}
                  className={cn(field, 'resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#D2D2D7] scrollbar-track-[#F5F5F7]')}
                  placeholder="A brief professional summary…"
                  value={resume.summary ?? ''}
                  onChange={(e) =>
                    setResume((r: ResumeSchema): ResumeSchema => ({
                      ...r,
                      summary: e.target.value || undefined,
                    }))
                  }
                />
              </div>
            )}

            {/* Experience */}
            {tab === 'experience' && (
              <div className="space-y-5">
                {resume.experience.map((exp, i) => (
                  <div key={i} className="border border-border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Position {i + 1}
                      </span>
                      <button
                        onClick={() => removeExp(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={cn(field, 'col-span-2')}
                        placeholder="Job title"
                        value={exp.title}
                        onChange={(e) => setExp(i, 'title', e.target.value)}
                      />
                      <input
                        className={cn(field, 'col-span-2')}
                        placeholder="Company"
                        value={exp.company}
                        onChange={(e) => setExp(i, 'company', e.target.value)}
                      />
                      <input
                        className={field}
                        placeholder="Start (e.g. Jan 2022)"
                        value={exp.startDate}
                        onChange={(e) => setExp(i, 'startDate', e.target.value)}
                      />
                      {!exp.current && (
                        <input
                          className={field}
                          placeholder="End"
                          value={exp.endDate ?? ''}
                          onChange={(e) => setExp(i, 'endDate', e.target.value)}
                        />
                      )}
                      <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={exp.current}
                          onChange={(e) => {
                            setExp(i, 'current', e.target.checked)
                            if (e.target.checked) setExp(i, 'endDate', undefined)
                          }}
                        />
                        Currently working here
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bullets</p>
                      {exp.bullets.map((b, bi) => (
                        <div key={bi} className="flex gap-1.5 items-start">
                          <span className="mt-1.5 text-primary text-xs">•</span>
                          <input
                            className={cn(fieldSm, 'flex-1')}
                            placeholder="Achievement or responsibility…"
                            value={b}
                            onChange={(e) => setBullet(i, bi, e.target.value)}
                          />
                          {exp.bullets.length > 1 && (
                            <button
                              onClick={() => removeBullet(i, bi)}
                              className="mt-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addBullet(i)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 uppercase tracking-wide font-bold"
                      >
                        <Plus className="size-3" /> Add bullet
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border text-muted-foreground uppercase text-xs tracking-wider rounded-none hover:border-primary hover:text-primary"
                  onClick={addExp}
                >
                  <Plus className="size-3.5" /> Add position
                </Button>
              </div>
            )}

            {/* Education */}
            {tab === 'education' && (
              <div className="space-y-4">
                {resume.education.map((edu, i) => (
                  <div key={i} className="border border-border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Education {i + 1}
                      </span>
                      <button
                        onClick={() => removeEdu(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <input
                      className={field}
                      placeholder="Institution"
                      value={edu.institution}
                      onChange={(e) => setEdu(i, 'institution', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={field}
                        placeholder="Degree (e.g. B.S.)"
                        value={edu.degree}
                        onChange={(e) => setEdu(i, 'degree', e.target.value)}
                      />
                      <input
                        className={field}
                        placeholder="Field of study"
                        value={edu.field}
                        onChange={(e) => setEdu(i, 'field', e.target.value)}
                      />
                      <input
                        className={cn(field, 'col-span-2')}
                        placeholder="Graduation year (e.g. 2024)"
                        value={edu.graduationYear}
                        onChange={(e) => setEdu(i, 'graduationYear', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border text-muted-foreground uppercase text-xs tracking-wider rounded-none hover:border-primary hover:text-primary"
                  onClick={addEdu}
                >
                  <Plus className="size-3.5" /> Add education
                </Button>
              </div>
            )}

            {/* Skills */}
            {tab === 'skills' && (
              <div className="space-y-4">
                {resume.skills.map((group, gi) => (
                  <div key={gi} className="border border-border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <input
                        className={cn(field, 'font-bold')}
                        placeholder="Category (e.g. Languages)"
                        value={group.category}
                        onChange={(e) => setSkillCat(gi, e.target.value)}
                      />
                      <button
                        onClick={() => removeSkillGroup(gi)}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item, ii) => (
                        <div
                          key={ii}
                          className="flex items-center gap-1 bg-secondary border border-border px-2 py-0.5"
                        >
                          <input
                            className="bg-transparent text-xs outline-none w-24 text-foreground placeholder:text-muted-foreground"
                            placeholder="Skill"
                            value={item}
                            onChange={(e) => setSkillItem(gi, ii, e.target.value)}
                          />
                          {group.items.length > 1 && (
                            <button
                              onClick={() => removeSkillItem(gi, ii)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addSkillItem(gi)}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5 px-2 py-0.5 uppercase tracking-wide font-bold"
                      >
                        <Plus className="size-3" /> Add
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border text-muted-foreground uppercase text-xs tracking-wider rounded-none hover:border-primary hover:text-primary"
                  onClick={addSkillGroup}
                >
                  <Plus className="size-3.5" /> Add category
                </Button>
              </div>
            )}

            {/* ATS Score */}
            {tab === 'ats' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Job Description
                  </label>
                  <textarea
                    className={cn(field, 'min-h-32 resize-none')}
                    placeholder="Paste the job description here…"
                    value={atsJobDesc}
                    onChange={(e) => setAtsJobDesc(e.target.value)}
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleAnalyzeATS}
                  disabled={!atsJobDesc.trim() || atsLoading}
                  className="w-full min-h-[44px] bg-primary text-primary-foreground uppercase text-xs tracking-wider font-bold rounded-none border-0 hover:bg-primary/90"
                >
                  {atsLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Analyze
                </Button>

                {atsError && (
                  <p className="text-xs text-destructive">{atsError}</p>
                )}

                {atsResult && (
                  <div className="space-y-4 border border-border p-3 bg-background">
                    {/* Overall score */}
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          'text-3xl font-bold',
                          atsResult.overallScore >= 75
                            ? 'text-primary'
                            : atsResult.overallScore >= 50
                              ? 'text-amber-500'
                              : 'text-destructive',
                        )}
                      >
                        {atsResult.overallScore}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        / 100
                      </span>
                    </div>

                    {/* Summary */}
                    {atsResult.summary && (
                      <p className="text-sm text-muted-foreground">{atsResult.summary}</p>
                    )}

                    {/* Matched keywords */}
                    {atsResult.matchedKeywords.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Matched Keywords
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {atsResult.matchedKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs border border-primary/40 text-primary bg-primary/10"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing keywords */}
                    {atsResult.missingKeywords.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Missing Keywords
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {atsResult.missingKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs border border-destructive/40 text-destructive bg-destructive/10"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {atsResult.suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Suggestions
                        </p>
                        <ul className="space-y-1">
                          {atsResult.suggestions.map((s, i) => (
                            <li key={i} className="flex gap-1.5 items-start">
                              <span className="mt-0.5 text-primary text-xs">•</span>
                              <span className="text-sm text-foreground">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Streaming panel */}
          {stream && (
            <div
              className="absolute bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-[0_-8px_24px_-12px_rgba(0,113,227,0.25)] flex flex-col"
              style={panelCollapsed ? undefined : { height: panelHeight }}
            >
              {/* Drag handle */}
              <div
                onMouseDown={handleDragStart}
                className="shrink-0 flex items-center justify-center h-3 cursor-ns-resize hover:bg-foreground/5 group"
              >
                <div className="flex flex-col gap-[3px] opacity-25 group-hover:opacity-60 transition-opacity">
                  <div className="w-6 h-px bg-muted-foreground" />
                  <div className="w-6 h-px bg-muted-foreground" />
                  <div className="w-6 h-px bg-muted-foreground" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="shrink-0 h-0.5 bg-border overflow-hidden">
                <div
                  className="h-full bg-primary ease-out"
                  style={{
                    width: `${streamProgress}%`,
                    transition: `width ${stream.done ? '0.3s' : '30s'} ease-out`,
                  }}
                />
              </div>
              {/* Header — always visible, never scrolls away */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 min-w-0 truncate">
                  {!stream.done ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="size-3 animate-spin shrink-0" />
                      {STREAMING_MESSAGES[msgIndex]}
                    </span>
                  ) : stream.error ? (
                    <span className="text-destructive truncate">✗ Something went wrong</span>
                  ) : (
                    <span className="text-primary">✓ Done — your enriched resume is ready!</span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {stream.done && !stream.error && (
                    <button
                      onClick={applyStreamed}
                      className="px-3 py-1 text-xs font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                    >
                      Apply changes
                    </button>
                  )}
                  <button
                    onClick={() => setStream(null)}
                    className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground bg-destructive hover:bg-destructive/90 transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setPanelCollapsed((c) => !c)}
                    className="p-1 border border-border bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
                  >
                    {panelCollapsed ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              {/* Scrollable output */}
              {!panelCollapsed && (
                <div className="flex-1 min-h-0 overflow-y-scroll px-3 pb-3 scrollbar-thin scrollbar-thumb-[#D2D2D7] scrollbar-track-transparent">
                  <StreamingOutput text={stream.text} isStreaming={!stream.done} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className={cn(
          'flex-1 overflow-auto bg-muted p-4 lg:p-6',
          mobileViewTab === 'preview' ? 'block' : 'hidden',
          'md:block',
        )}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-primary uppercase tracking-widest font-display">
              Live Preview
            </p>
            <ChevronUp className="size-3 text-muted-foreground" />
          </div>
          <ResumePreview
            resume={resume}
            flashSections={flashSections}
            industry={selectedIndustry}
            detectedIndustry={resume.detectedIndustry}
            onIndustryChange={setSelectedIndustry}
          />
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
