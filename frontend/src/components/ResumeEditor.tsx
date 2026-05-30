import { useRef, useState } from 'react'
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
  'w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50 transition-shadow placeholder:text-muted-foreground'
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

export default function ResumeEditor({ initialResume, onBack }: Props) {
  const [resume, setResume] = useState<ResumeSchema>(initialResume)
  const [tab, setTab] = useState<Tab>('summary')
  const [stream, setStream] = useState<StreamState | null>(null)
  const [tailorOpen, setTailorOpen] = useState(false)
  const [jobDesc, setJobDesc] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [streamLoading, setStreamLoading] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(256)
  const [flashSections, setFlashSections] = useState<Set<string>>(new Set())
  const accumRef = useRef('')
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startHeight: panelHeight }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const next = Math.min(
        Math.max(dragRef.current.startHeight + delta, 80),
        window.innerHeight * 0.8,
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
      if (text.startsWith('```')) {
        text = text.split('\n').slice(1).join('\n').replace(/```\s*$/, '').trim()
      }
      const newResume = fromBackend(JSON.parse(text))

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
    } catch {
      setStream((s: StreamState | null) =>
        s ? { ...s, error: 'Could not parse AI response as JSON.' } : null,
      )
    }
  }

  // ── actions ────────────────────────────────────────────────────────────────
  const handleEnrich = () => runStream(() => enrichResume(resume))

  const handleTailor = () => {
    setTailorOpen(false)
    runStream(() => tailorResume(resume, jobDesc))
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const blob = await exportResume(resume)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resume.metadata.fullName || 'resume'}.pdf`.replace(/ /g, '_')
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
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
      <header className="shrink-0 border-b border-border px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            ← Back
          </Button>
          <span className="text-sm font-semibold">Resume AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleEnrich} disabled={streamLoading}>
            <Sparkles className="size-3.5" />
            Enrich with AI
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTailorOpen(true)}
            disabled={streamLoading}
          >
            <Briefcase className="size-3.5" />
            Tailor for Job
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export PDF
          </Button>
        </div>
      </header>

      {/* ── main ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: form */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-border overflow-hidden">
          {/* Metadata */}
          <div className="shrink-0 border-b border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
          <div className="shrink-0 border-b border-border flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 py-2 text-xs font-medium transition-colors',
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
                <label className="text-xs text-muted-foreground">Professional summary</label>
                <textarea
                  className={cn(field, 'resize-none min-h-[200px]')}
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
                  <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
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
                          className="rounded"
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
                      <p className="text-xs text-muted-foreground">Bullets</p>
                      {exp.bullets.map((b, bi) => (
                        <div key={bi} className="flex gap-1.5 items-start">
                          <span className="mt-1.5 text-muted-foreground text-xs">•</span>
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
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="size-3" /> Add bullet
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={addExp}>
                  <Plus className="size-3.5" /> Add position
                </Button>
              </div>
            )}

            {/* Education */}
            {tab === 'education' && (
              <div className="space-y-4">
                {resume.education.map((edu, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
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
                <Button variant="outline" size="sm" className="w-full" onClick={addEdu}>
                  <Plus className="size-3.5" /> Add education
                </Button>
              </div>
            )}

            {/* Skills */}
            {tab === 'skills' && (
              <div className="space-y-4">
                {resume.skills.map((group, gi) => (
                  <div key={gi} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        className={cn(field, 'font-medium')}
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
                          className="flex items-center gap-1 bg-muted rounded-md px-2 py-0.5"
                        >
                          <input
                            className="bg-transparent text-xs outline-none w-24 placeholder:text-muted-foreground"
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
                        className="text-xs text-primary hover:underline flex items-center gap-0.5 px-2 py-0.5"
                      >
                        <Plus className="size-3" /> Add
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={addSkillGroup}>
                  <Plus className="size-3.5" /> Add category
                </Button>
              </div>
            )}
          </div>

          {/* Streaming panel */}
          {stream && (
            <div
              className="shrink-0 border-t border-border bg-gray-950 flex flex-col"
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
              {/* Header — always visible, never scrolls away */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-medium text-green-400 flex items-center gap-1.5 min-w-0 truncate">
                  {!stream.done ? (
                    <>
                      <Loader2 className="size-3 animate-spin shrink-0" />
                      AI is writing…
                    </>
                  ) : stream.error ? (
                    <span className="text-destructive truncate">{stream.error}</span>
                  ) : (
                    'Done — review output below'
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {stream.done && !stream.error && (
                    <button
                      onClick={applyStreamed}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green-400 hover:bg-green-300 text-gray-950 transition-colors"
                    >
                      Apply changes
                    </button>
                  )}
                  <button
                    onClick={() => setStream(null)}
                    className="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setPanelCollapsed((c) => !c)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
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
                <div className="overflow-y-auto px-3 pb-3">
                  <StreamingOutput text={stream.text} isStreaming={!stream.done} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Live Preview
            </p>
            <ChevronUp className="size-3 text-muted-foreground" />
          </div>
          <ResumePreview resume={resume} flashSections={flashSections} />
        </div>
      </div>

      {/* ── Tailor modal ─────────────────────────────────────────────────────── */}
      {tailorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg p-6 space-y-4 mx-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">Tailor for Job</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Paste the job description and Claude will rewrite your resume to match.
                </p>
              </div>
              <button
                onClick={() => setTailorOpen(false)}
                className="text-muted-foreground hover:text-foreground ml-4 shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              className={cn(field, 'min-h-[220px] resize-none')}
              placeholder="Paste the full job description here…"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setTailorOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleTailor} disabled={!jobDesc.trim()}>
                <Sparkles className="size-3.5" />
                Tailor Resume
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
