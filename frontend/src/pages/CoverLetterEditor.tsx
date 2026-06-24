import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Download, ChevronDown, Loader2, Save, RefreshCw, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import ExportMenu from '@/components/ExportMenu'
import { generateCoverLetter, exportCoverLetter, improveCoverLetter, QuotaExceededError } from '@/services/api'
import { saveCoverLetter, updateCoverLetter, getCoverLetter } from '@/services/coverLetters'
import { getResume, listResumes } from '@/services/resumes'
import type { SavedResume } from '@/services/resumes'
import ResumePreview from '@/components/ResumePreview'
import QuotaExceededModal from '@/components/QuotaExceededModal'
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
  const [jobDescription, setJobDescription] = useState(state.jobDescription ?? '')
  const [tone, setTone] = useState<Tone>((state.tone as Tone) ?? 'professional')
  const [resume, setResume] = useState<ResumeSchema | null>(state.resume ?? null)
  const [resumeId, setResumeId] = useState<string | null>(state.resumeId ?? null)
  const [coverId, setCoverId] = useState<string | null>(id ?? null)
  const [loadingRecord, setLoadingRecord] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [improving, setImproving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [showJdEditor, setShowJdEditor] = useState(false)
  const [jdDraft, setJdDraft] = useState('')
  const [showNoJdModal, setShowNoJdModal] = useState(false)
  const [resumeTitle, setResumeTitle] = useState<string>('')
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState<string | null>(null)
  const [showResumeView, setShowResumeView] = useState(false)
  const [showResumePicker, setShowResumePicker] = useState(false)
  const [allResumes, setAllResumes] = useState<SavedResume[]>([])
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null)
  const [showChangeWarning, setShowChangeWarning] = useState(false)
  const [showQuotaModal, setShowQuotaModal] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const autoGenRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load from DB when accessing /cover-letter/:id
  useEffect(() => {
    if (!id) return
    getCoverLetter(id)
      .then(async (cl) => {
        setContent(cl.content)
        setTitle(cl.title)
        setCompanyName(cl.company_name ?? '')
        setTone((cl.tone as Tone) ?? 'professional')
        setCoverId(cl.id)
        // Also load JD and resume
        if (cl.job_description) setJobDescription(cl.job_description)
        if (cl.resume_id) {
          setResumeId(cl.resume_id)
          try {
            const saved = await getResume(cl.resume_id)
            setResume(saved.resume_data)
            setResumeTitle(saved.title)
            setResumeUpdatedAt(saved.updated_at)
          } catch {
            // Resume may have been deleted — continue without it
          }
        }
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
        <Navbar onBack={() => navigate(state.from ?? '/dashboard', { state: { activeTab: 'cover-letters' } })} />
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
        await updateCoverLetter(coverId, content, title, jobDescription || undefined, tone)
      } else {
        const cl = await saveCoverLetter(
          content, title,
          companyName || undefined,
          jobDescription || undefined,
          tone,
          resumeId ?? undefined,
        )
        setCoverId(cl.id)
      }
      setIsDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async (force = false) => {
    if (!resume || !companyName) return
    if (!jobDescription && !force) {
      setShowNoJdModal(true)
      return
    }
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
      setIsDirty(true)
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setShowQuotaModal(true)
        return
      }
      console.error('Regenerate failed:', err)
    } finally {
      setRegenerating(false)
    }
  }

  const handleAiImprove = async () => {
    const ta = textareaRef.current
    const selStart = ta?.selectionStart ?? 0
    const selEnd = ta?.selectionEnd ?? 0
    const selection = selStart !== selEnd ? content.slice(selStart, selEnd) : undefined

    setImproving(true)
    try {
      const stream = await improveCoverLetter(content, {
        selection,
        jobDescription: jobDescription || undefined,
        resume: resume || undefined,
        tone,
      })
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        if (selection !== undefined) {
          // replace just the selected portion
          setContent(content.slice(0, selStart) + accumulated + content.slice(selEnd))
        } else {
          setContent(accumulated)
        }
      }
      setIsDirty(true)
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setShowQuotaModal(true)
        return
      }
      console.error('AI Improve failed:', err)
    } finally {
      setImproving(false)
    }
  }

  const openResumePicker = async () => {
    try {
      const resumes = await listResumes()
      setAllResumes(resumes)
      setShowResumePicker(true)
    } catch (err) {
      console.error('Failed to load resumes:', err)
    }
  }

  const doAttachResume = async (selectedId: string) => {
    try {
      const saved = await getResume(selectedId)
      setResume(saved.resume_data)
      setResumeId(selectedId)
      setResumeTitle(saved.title)
      setResumeUpdatedAt(saved.updated_at)
      if (coverId) {
        await updateCoverLetter(coverId, content, title, jobDescription || undefined, tone, selectedId)
      }
    } catch (err) {
      console.error('Failed to attach resume:', err)
    }
  }

  const pickResume = (selectedId: string) => {
    setShowResumePicker(false)
    if (resume && resumeId && resumeId !== selectedId) {
      // Changing an existing attachment — show warning first
      setPendingResumeId(selectedId)
      setShowChangeWarning(true)
    } else {
      // No existing resume or same one — attach directly
      void doAttachResume(selectedId)
    }
  }

  const handleSaveJd = async () => {
    setJobDescription(jdDraft)
    setShowJdEditor(false)
    if (coverId) {
      try {
        await updateCoverLetter(coverId, content, title, jdDraft || undefined, tone)
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      } catch (err) {
        console.error('Failed to save JD:', err)
      }
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
  const canRegenerate = !!companyName && !!resume

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navbar onBack={() => navigate(state.from ?? '/dashboard', { state: { activeTab: 'cover-letters' } })} />

      {/* ── Header bar ── */}
      <div className="shrink-0 border-b border-border/60 px-6 py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 bg-background">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsDirty(true) }}
          className="w-full md:flex-1 md:min-w-0 min-h-[44px] md:min-h-0 bg-transparent text-foreground font-medium text-sm outline-none border-b border-transparent hover:border-border focus:border-primary/40 transition-colors py-0.5 truncate"
        />

        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto md:shrink-0">
          {/* Regenerate — secondary, lighter weight */}
          <button
            type="button"
            onClick={() => handleRegenerate()}
            disabled={!canRegenerate || regenerating}
            title={canRegenerate ? 'Regenerate with current style' : 'Attach a resume to enable regeneration'}
            className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] md:min-h-0 w-full md:w-auto text-sm text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('size-3.5', regenerating && 'animate-spin')} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>

          {/* Save — quiet status when clean, outline when dirty */}
          {coverId && !isDirty && !saving ? (
            <span className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] md:min-h-0 w-full md:w-auto text-sm text-muted-foreground">
              {savedFlash ? '✓ Saved' : '✓ Saved'}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] md:min-h-0 w-full md:w-auto text-sm font-medium text-foreground border border-border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving…' : savedFlash ? '✓ Saved' : !coverId ? 'Save' : 'Save Changes'}
            </button>
          )}

          {/* Export — primary blue */}
          <div ref={exportRef} className="relative w-full md:w-auto">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] md:min-h-0 w-full md:w-auto text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
            >
              <Download className="size-3.5" />
              Export
              <ChevronDown className={cn('size-3 transition-transform', exportOpen && 'rotate-180')} />
            </button>
            {exportOpen && (
              <ExportMenu className="min-w-[120px] w-full md:w-auto">
                {(['pdf', 'docx', 'txt'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full px-4 py-2 min-h-[44px] md:min-h-0 text-sm text-foreground hover:bg-secondary text-left capitalize"
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
      <div className="md:hidden shrink-0 border-b border-border/60 flex bg-background">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={cn(
            'flex-1 min-h-[44px] py-2.5 text-sm font-medium transition-colors',
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
            'flex-1 min-h-[44px] py-2.5 text-sm font-medium transition-colors',
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

        {/* LEFT — Edit panel */}
        <div className={cn(
          'flex-col overflow-hidden border-border/60',
          mobileTab === 'edit' ? 'flex flex-1 w-full' : 'hidden',
          'md:flex md:flex-none md:w-[40%] md:border-r',
        )}>

          {/* ── CONTEXT SECTION ── */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/50 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Context</p>

            {/* Company row */}
            <div>
              <p className="text-[11px] text-muted-foreground/60 mb-0.5">Company</p>
              <p className="text-sm text-foreground font-medium">
                {companyName || <span className="text-muted-foreground font-normal italic">Not set</span>}
              </p>
            </div>

            {/* Resume row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground/60 mb-0.5">Resume</p>
                {resume ? (
                  <div>
                    <p className="text-sm text-foreground truncate">{resumeTitle || 'Attached Resume'}</p>
                    {resumeUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        Updated {new Date(resumeUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not attached</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {resume ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowResumeView(true)}
                      className="text-xs text-primary hover:underline min-h-[44px] md:min-h-0 flex items-center"
                    >
                      View
                    </button>
                    <span className="text-border/80">·</span>
                    <button
                      type="button"
                      onClick={openResumePicker}
                      className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] md:min-h-0 flex items-center"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openResumePicker}
                    className="text-xs text-primary hover:underline min-h-[44px] md:min-h-0 flex items-center"
                  >
                    Attach
                  </button>
                )}
              </div>
            </div>

            {/* Job Description row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground/60 mb-0.5">Job Description</p>
                {jobDescription ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {jobDescription.slice(0, 140)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not added</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setJdDraft(jobDescription); setShowJdEditor(true) }}
                className="text-xs text-primary hover:underline shrink-0 pt-0.5 min-h-[44px] md:min-h-0 flex items-center"
              >
                {jobDescription ? 'Edit' : 'Add'}
              </button>
            </div>
          </div>

          {/* ── WRITING STYLE SECTION ── */}
          <div className="shrink-0 px-4 py-3 border-b border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">Writing Style</p>
            {/* Segmented control — subtle pill tabs */}
            <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTone(t); setIsDirty(true) }}
                  className={cn(
                    'flex-1 min-h-[44px] md:min-h-0 py-1.5 text-xs font-medium rounded-md capitalize transition-all duration-150',
                    tone === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── COVER LETTER SECTION ── */}
          <div className="shrink-0 px-4 pt-3 pb-1">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Cover Letter</p>
          </div>

          {/* Textarea — document feel */}
          <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); setIsDirty(true) }}
              disabled={regenerating}
              placeholder={regenerating ? 'Generating…' : 'Start writing or use Regenerate to draft from scratch…'}
              className="flex-1 w-full bg-transparent border border-border/30 rounded-lg px-4 py-4 text-[13px] text-foreground leading-[1.65] resize-none outline-none focus:border-primary/30 transition-colors placeholder:text-muted-foreground/40 disabled:opacity-60"
            />
          </div>

          {/* Word count + hint */}
          <div className="shrink-0 flex justify-between items-center px-4 pb-2 text-[11px] text-muted-foreground/50">
            <span>{wordCount(content)} words</span>
            <span>Select text for targeted edits</span>
          </div>

          {/* ── IMPROVE WRITING BUTTON ── */}
          <div className="shrink-0 px-4 pb-4">
            <button
              type="button"
              onClick={handleAiImprove}
              disabled={improving || regenerating}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-foreground border border-border hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {improving ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-primary/70" />}
              {improving ? 'Improving…' : 'Improve Writing'}
            </button>
            {!jobDescription && !resume && (
              <p className="text-[11px] text-muted-foreground/50 text-center mt-1.5">
                Add context above for stronger results.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Preview panel */}
        <div className={cn(
          'flex-1 overflow-y-auto bg-muted/40 justify-center py-10 px-6 w-full',
          mobileTab === 'preview' ? 'flex' : 'hidden',
          'md:flex',
        )}>
          <div className="w-full max-w-[620px] bg-white rounded shadow-paper px-12 py-10 min-h-[880px]">
            <p className="text-gray-400 text-xs mb-8 font-mono">{todayLong()}</p>
            {paragraphs.length > 0 ? (
              <>
                {paragraphs.map((para, i) => (
                  <p key={i} className="text-gray-800 text-[13px] leading-[1.75] mb-5 whitespace-pre-line">
                    {para}
                  </p>
                ))}
                <div className="mt-8">
                  <p className="text-gray-800 text-[13px] leading-[1.75]">Best regards,</p>
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

      {/* JD Editor modal */}
      {showJdEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl mx-4">
            <h2 className="font-semibold text-sm text-foreground mb-4">
              Job Description
            </h2>
            <textarea
              value={jdDraft}
              onChange={(e) => setJdDraft(e.target.value)}
              rows={10}
              className="w-full border border-border rounded p-3 text-sm text-foreground bg-background resize-none outline-none focus:border-primary/50 transition-colors leading-relaxed"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowJdEditor(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveJd}
                className="px-4 py-2 min-h-[44px] text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No JD modal for Regenerate */}
      {showNoJdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl mx-4">
            <h2 className="font-semibold text-sm text-foreground mb-3">
              No Job Description
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              No job description is saved for this cover letter. Add one for a stronger result, or regenerate using resume and company only.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNoJdModal(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowNoJdModal(false); setJdDraft(''); setShowJdEditor(true) }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded-lg transition-colors"
              >
                Add Job Description
              </button>
              <button
                type="button"
                onClick={() => { setShowNoJdModal(false); handleRegenerate(true) }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                Regenerate Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Resume modal */}
      {showResumeView && resume && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">
                {resumeTitle || 'Attached Resume'}
              </h2>
              <button
                type="button"
                onClick={() => setShowResumeView(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <ResumePreview resume={resume} industry={resume.detectedIndustry ?? 'general'} />
            </div>
          </div>
        </div>
      )}

      {/* Resume picker modal */}
      {showResumePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl mx-4">
            <h2 className="font-semibold text-sm text-foreground mb-4">
              Select a Resume
            </h2>
            {allResumes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved resumes found.</p>
            ) : (
              <ul className="space-y-2">
                {allResumes.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => pickResume(r.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                        r.id === resumeId
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <div className="font-medium text-sm text-foreground">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Updated {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowResumePicker(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota exceeded modal */}
      <QuotaExceededModal open={showQuotaModal} onClose={() => setShowQuotaModal(false)} />

      {/* Change Resume warning modal */}
      {showChangeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl mx-4">
            <h2 className="font-semibold text-sm text-foreground mb-3">
              Change Resume?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Changing the resume may affect AI Improve and Regenerate results for this cover letter.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowChangeWarning(false); setPendingResumeId(null) }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowChangeWarning(false)
                  if (pendingResumeId) void doAttachResume(pendingResumeId)
                  setPendingResumeId(null)
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                Change Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
