import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'
import { enrichResume, exportResume, fromBackend, tailorResume } from '@/services/api'
import ResumePreview from './ResumePreview'
import StreamingOutput from './StreamingOutput'

interface Props {
  initialResume: ResumeSchema
  onBack: () => void
}

type Tab = 'summary' | 'experience' | 'education' | 'skills'

interface StreamState {
  text: string
  done: boolean
  error: string | null
}

const field =
  'w-full px-2.5 py-1.5 border border-[#333] bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-shadow placeholder:text-muted-foreground'
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

export default function ResumeEditor({ initialResume, onBack }: Props) {
  const [resume, setResume] = useState<ResumeSchema>(initialResume)
  const [tab, setTab] = useState<Tab>('summary')
  const [stream, setStream] = useState<StreamState | null>(null)
  const [tailorOpen, setTailorOpen] = useState(false)
  const [jobDesc, setJobDesc] = useState('')
  const [tailorSections, setTailorSections] = useState({
    summary: true, experience: true, education: true, skills: true,
  })
  const [isExporting, setIsExporting] = useState(false)
  const [streamLoading, setStreamLoading] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(200)
  const [flashSections, setFlashSections] = useState<Set<string>>(new Set())
  const [msgIndex, setMsgIndex] = useState(0)
  const [streamProgress, setStreamProgress] = useState(0)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState<string>(initialResume.detectedIndustry ?? 'general')
  const [saveToast, setSaveToast] = useState<{ text: string; ok: boolean } | null>(null)
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
  ]

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── top bar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border px-4 h-12 flex items-center justify-between gap-3 bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground uppercase text-xs tracking-wider">
            ← Back
          </Button>
          <span
            className="hidden sm:block text-sm font-bold tracking-widest uppercase text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Resume AI
          </span>
        </div>
        <div className="flex items-center gap-2">
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
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border py-1 min-w-[190px]">
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
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── main ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left: form */}
        <div className="relative w-full lg:w-[420px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border overflow-hidden bg-card h-[55vh] lg:h-auto">
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
                  'flex-1 min-w-[72px] py-2 text-xs font-bold uppercase tracking-wider transition-colors',
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
                  className={cn(field, 'resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#111]')}
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
                        className="text-muted-foreground hover:text-red-400 transition-colors"
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
                              className="mt-1 text-muted-foreground hover:text-red-400"
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
                        className="text-muted-foreground hover:text-red-400"
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
                        className="ml-2 shrink-0 text-muted-foreground hover:text-red-400"
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
                              className="text-muted-foreground hover:text-red-400"
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
          </div>

          {/* Streaming panel */}
          {stream && (
            <div
              className="absolute bottom-0 left-0 right-0 z-50 border border-border bg-card flex flex-col"
              style={panelCollapsed ? undefined : { height: panelHeight }}
            >
              {/* Drag handle */}
              <div
                onMouseDown={handleDragStart}
                className="shrink-0 flex items-center justify-center h-3 cursor-ns-resize hover:bg-white/5 group"
              >
                <div className="flex flex-col gap-[3px] opacity-25 group-hover:opacity-60 transition-opacity">
                  <div className="w-6 h-px bg-gray-400" />
                  <div className="w-6 h-px bg-gray-400" />
                  <div className="w-6 h-px bg-gray-400" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="shrink-0 h-0.5 bg-secondary overflow-hidden">
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
                    <span className="text-red-400 truncate">✗ Something went wrong</span>
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
                    className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-500 transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setPanelCollapsed((c) => !c)}
                    className="p-1 border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
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
                <div className="flex-1 min-h-0 overflow-y-scroll px-3 pb-3 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#0a0a0a]">
                  <StreamingOutput text={stream.text} isStreaming={!stream.done} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className="flex-1 overflow-auto bg-[#0d0d0d] p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <p
              className="text-xs font-bold text-primary uppercase tracking-widest"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
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

      {/* ── Tailor modal ─────────────────────────────────────────────────────── */}
      {tailorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-2xl mx-4 p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold text-foreground uppercase tracking-wide"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
                className="w-full min-h-48 border border-[#333] bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary resize-none transition-shadow"
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
          </div>
        </div>
      )}

      {/* ── Save toast ───────────────────────────────────────────────────────── */}
      {saveToast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 shadow-lg text-xs font-bold uppercase tracking-wide transition-all',
            saveToast.ok
              ? 'bg-primary text-primary-foreground'
              : 'bg-red-600 text-white',
          )}
        >
          {saveToast.ok ? '✓' : '✗'} {saveToast.text}
        </div>
      )}
    </div>
  )
}
