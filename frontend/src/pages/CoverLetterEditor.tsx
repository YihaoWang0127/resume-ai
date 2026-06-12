import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Download, ChevronDown, Loader2, Save, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import ExportMenu from '@/components/ExportMenu'
import { generateCoverLetter, exportCoverLetter } from '@/services/api'
import { saveCoverLetter, updateCoverLetter, getCoverLetter } from '@/services/coverLetters'
import { cn } from '@/lib/utils'
import type { ResumeSchema } from '@/types/resume'

type Tone = 'professional' | 'enthusiastic' | 'concise'

interface RouteState {
  content?: string
  companyName?: string
  jobDescription?: string
  tone?: Tone
  resumeId?: string
  resume?: ResumeSchema
  from?: string
}

const TONES: Tone[] = ['professional', 'enthusiastic', 'concise']

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function CoverLetterEditor() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading, isGuest } = useAuth()
  const state = (location.state ?? {}) as RouteState

  const [content, setContent] = useState(state.content ?? '')
  const [title, setTitle] = useState(
    state.companyName ? `Cover Letter for ${state.companyName}` : 'Cover Letter'
  )
  const [companyName, setCompanyName] = useState(state.companyName ?? '')
  const [jobDescription] = useState(state.jobDescription ?? '')
  const [tone, setTone] = useState<Tone>((state.tone as Tone) ?? 'professional')
  const [resume] = useState<ResumeSchema | null>(state.resume ?? null)
  const [coverId, setCoverId] = useState<string | null>(id ?? null)
  const [loadingRecord, setLoadingRecord] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const exportRef = useRef<HTMLDivElement>(null)
  const autoGenRef = useRef(false)

  // Load from DB when accessing /cover-letter/:id
  useEffect(() => {
    if (!id) return
    getCoverLetter(id)
      .then((cl) => {
        setContent(cl.content)
        setTitle(cl.title)
        setCompanyName(cl.company_name ?? '')
        setTone((cl.tone as Tone) ?? 'professional')
        setCoverId(cl.id)
      })
      .catch(console.error)
      .finally(() => setLoadingRecord(false))
  }, [id])

  // Auto-generate when navigated from ResumeEditor with resume + JD but no content yet.
  // No `cancelled` flag: React 18 handles setState after unmount gracefully, and the
  // autoGenRef guard prevents the second Strict Mode effect invocation from re-firing.
  useEffect(() => {
    if (autoGenRef.current || id || state.content || !state.resume || !state.jobDescription || !state.companyName) return
    autoGenRef.current = true
    setRegenerating(true)
    setContent('')
    console.log('[CoverLetterEditor] auto-generation starting')
    generateCoverLetter(state.resume, state.jobDescription, state.companyName, (state.tone as Tone) ?? 'professional')
      .then(async (stream) => {
        console.log('[CoverLetterEditor] stream opened')
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          console.log('[CoverLetterEditor] chunk', chunk.length, 'chars')
          accumulated += chunk
          setContent(accumulated)
        }
        console.log('[CoverLetterEditor] stream complete — total', accumulated.length, 'chars')
      })
      .catch(console.error)
      .finally(() => setRegenerating(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  if (authLoading) return null
  if (!user || isGuest) return <Navigate to="/" replace />
  if (loadingRecord) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Navbar onBack={() => navigate(state.from ?? '/dashboard')} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (coverId) {
        await updateCoverLetter(coverId, content, title)
      } else {
        const cl = await saveCoverLetter(
          content, title,
          companyName || undefined,
          jobDescription || undefined,
          tone,
          state.resumeId,
        )
        setCoverId(cl.id)
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!resume || !jobDescription || !companyName) return
    setRegenerating(true)
    setContent('')
    try {
      const stream = await generateCoverLetter(resume, jobDescription, companyName, tone)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setContent(accumulated)
      }
    } catch (err) {
      console.error('Regenerate failed:', err)
    } finally {
      setRegenerating(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    setExportOpen(false)
    try {
      const blob = await exportCoverLetter(content, companyName || 'company', format)
      const slug = (companyName || 'cover_letter').replace(/\W+/g, '_').toLowerCase()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `cover_letter_${slug}.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const paragraphs = content.trim().split(/\n\n+/).filter(Boolean)
  const canRegenerate = !!resume && !!jobDescription && !!companyName

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navbar onBack={() => navigate(state.from ?? '/dashboard')} />

      {/* ── Header bar ── */}
      <div className="shrink-0 border-b border-border px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 bg-background">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full md:flex-1 md:min-w-0 min-h-[44px] md:min-h-0 bg-transparent text-foreground font-display font-bold text-sm uppercase tracking-widest outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors py-0.5 truncate"
        />

        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto md:shrink-0">
          {/* Regenerate */}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canRegenerate || regenerating}
            title={canRegenerate ? 'Regenerate with current tone' : 'Resume or job description unavailable'}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] md:min-h-0 w-full md:w-auto text-xs font-bold uppercase tracking-wider text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('size-3.5', regenerating && 'animate-spin')} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>

          {/* Save / Update */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] md:min-h-0 w-full md:w-auto text-xs font-bold uppercase tracking-wider text-primary border border-primary/50 hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
          >
            {saving
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Save className="size-3.5" />}
            {savedFlash ? 'Saved!' : coverId ? 'Update' : 'Save'}
          </button>

          {/* Export dropdown */}
          <div ref={exportRef} className="relative w-full md:w-auto">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] md:min-h-0 w-full md:w-auto text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
            >
              <Download className="size-3.5" />
              Export
              <ChevronDown className={cn('size-3 transition-transform', exportOpen && 'rotate-180')} />
            </button>
            {exportOpen && (
              <ExportMenu className="min-w-[140px] w-full md:w-auto">
                {(['pdf', 'docx', 'txt'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full px-4 py-2 min-h-[44px] md:min-h-0 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-secondary text-left"
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </ExportMenu>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Edit / Preview toggle */}
      <div className="md:hidden shrink-0 border-b border-border flex bg-background">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={cn(
            'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
            mobileTab === 'edit'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={cn(
            'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
            mobileTab === 'preview'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Preview
        </button>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT — Edit panel (40%) */}
        <div className={cn(
          'flex-col overflow-hidden border-border',
          mobileTab === 'edit' ? 'flex flex-1 w-full' : 'hidden',
          'md:flex md:flex-none md:w-[40%] md:border-r',
        )}>

          {/* Tone selector */}
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">
              Tone:
            </span>
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={cn(
                  'flex items-center justify-center px-2.5 py-1 min-h-[44px] md:min-h-0 text-[10px] font-bold uppercase tracking-wider rounded transition-colors',
                  tone === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={regenerating}
              placeholder={regenerating ? 'Generating…' : 'Your cover letter will appear here. You can edit it directly.'}
              className="flex-1 w-full bg-card border border-border rounded-lg p-4 text-sm text-foreground leading-relaxed resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground disabled:opacity-60"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground px-1">
              <span>{wordCount(content)} words</span>
              <span className="uppercase tracking-widest">Edit directly</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Preview panel (60%) */}
        <div className={cn(
          'flex-1 overflow-y-auto bg-muted justify-center py-10 px-6 w-full',
          mobileTab === 'preview' ? 'flex' : 'hidden',
          'md:flex',
        )}>
          <div className="w-full max-w-[620px] bg-white rounded-sm shadow-paper px-12 py-10 min-h-[880px]">

            {/* Date */}
            <p className="text-gray-400 text-xs mb-8 font-mono">{todayLong()}</p>

            {paragraphs.length > 0 ? (
              <>
                {paragraphs.map((para, i) => (
                  <p key={i} className="text-gray-800 text-[13px] leading-7 mb-5 whitespace-pre-line">
                    {para}
                  </p>
                ))}
                <div className="mt-8">
                  <p className="text-gray-800 text-[13px] leading-7">Best regards,</p>
                </div>
              </>
            ) : (
              <p className="text-gray-300 text-sm italic">
                {regenerating ? 'Generating your cover letter…' : 'Your formatted cover letter will appear here.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
