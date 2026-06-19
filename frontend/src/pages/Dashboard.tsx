import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Edit, Download, Loader2, ChevronDown, X, Mail, Wand2, PenLine, ArrowLeft, Target } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume, updateAtsScore, clearAtsScore, type SavedResume } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter, type CoverLetter } from '@/services/coverLetters'
import { exportResume, exportCoverLetter, scoreATS } from '@/services/api'
import { getAiUsageStats } from '@/services/aiUsage'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import ResumeUploader from '@/components/ResumeUploader'
import Modal from '@/components/Modal'
import ExportMenu from '@/components/ExportMenu'
import EmptyState from '@/components/EmptyState'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 min-h-[240px] flex flex-col animate-pulse">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded-full" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
          <div className="flex gap-2 mt-5 pt-3 border-t border-border">
            <div className="h-11 flex-1 bg-muted rounded" />
            <div className="h-11 flex-1 bg-muted rounded" />
            <div className="h-11 w-11 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user, loading, isGuest } = useAuth()
  const navigate = useNavigate()

  // ── resumes ──────────────────────────────────────────────────────────────────
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([])
  const [fetching, setFetching] = useState(true)
  const [aiCallsThisMonth, setAiCallsThisMonth] = useState<number | null>(null)

  type DashboardTab = 'resumes' | 'cover-letters' | 'ats-score'
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumes')

  // ── ATS score check ──────────────────────────────────────────────────────────
  const [atsTarget, setAtsTarget] = useState<SavedResume | null>(null)
  const [atsJobDesc, setAtsJobDesc] = useState('')
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null)
  const [atsError, setAtsError] = useState<string | null>(null)
  const [atsViewMode, setAtsViewMode] = useState(false)
  const [atsNewCheckStep, setAtsNewCheckStep] = useState<'closed' | 'resume-pick'>('closed')
  const [atsClearingId, setAtsClearingId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<SavedResume | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [exportOpenId, setExportOpenId] = useState<string | null>(null)

  const [clDeleteTarget, setClDeleteTarget] = useState<CoverLetter | null>(null)
  const [clDeleting, setClDeleting] = useState(false)
  const [clExportOpenId, setClExportOpenId] = useState<string | null>(null)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  type NewClStep = 'closed' | 'options' | 'resume-pick' | 'generate-form'
  type NewClTone = 'professional' | 'enthusiastic' | 'concise'
  const [newClStep, setNewClStep] = useState<NewClStep>('closed')
  const [newClResume, setNewClResume] = useState<SavedResume | null>(null)
  const [newClCompany, setNewClCompany] = useState('')
  const [newClJobDesc, setNewClJobDesc] = useState('')
  const [newClTone, setNewClTone] = useState<NewClTone>('professional')

  const closeNewClModal = () => {
    setNewClStep('closed')
    setNewClResume(null)
    setNewClCompany('')
    setNewClJobDesc('')
    setNewClTone('professional')
  }

  const handleNewResumeParsed = (resume: ResumeSchema) => {
    setUploadModalOpen(false)
    navigate('/editor', { state: { resume, from: '/dashboard' } })
  }

  useEffect(() => {
    if (!user || isGuest) return
    Promise.all([
      listResumes().catch(() => [] as SavedResume[]),
      listCoverLetters().catch(() => [] as CoverLetter[]),
      getAiUsageStats().catch(() => null),
    ]).then(([res, cls, usage]) => {
      setResumes(res)
      setCoverLetters(cls)
      setAiCallsThisMonth(usage?.callsThisMonth ?? 0)
    }).finally(() => setFetching(false))
  }, [user, isGuest])

  if (!loading && (!user || isGuest)) return <Navigate to="/" replace />

  // ── resume actions ───────────────────────────────────────────────────────────
  const handleEdit = (r: SavedResume) => {
    navigate('/editor', { state: { resume: r.resume_data, resumeId: r.id, from: '/dashboard' } })
  }

  const handleResumeDownload = async (r: SavedResume, format: 'pdf' | 'docx') => {
    setExportOpenId(null)
    try {
      const blob = await exportResume(r.resume_data, format, r.detected_industry)
      const baseName = (r.resume_data.metadata.fullName || 'resume').replace(/ /g, '_')
      triggerDownload(blob, `${baseName}.${format}`)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteResume(deleteTarget.id)
      setResumes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── cover letter actions ─────────────────────────────────────────────────────
  const handleClEdit = (cl: CoverLetter) => {
    navigate(`/cover-letter/${cl.id}`, { state: { from: '/dashboard' } })
  }

  const handleClDownload = async (cl: CoverLetter, format: 'pdf' | 'docx' | 'txt') => {
    setClExportOpenId(null)
    try {
      const blob = await exportCoverLetter(cl.content, cl.company_name ?? 'company', format)
      const slug = (cl.company_name || 'cover_letter').replace(/\W+/g, '_').toLowerCase()
      triggerDownload(blob, `cover_letter_${slug}.${format}`)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleClDeleteConfirm = async () => {
    if (!clDeleteTarget) return
    setClDeleting(true)
    try {
      await deleteCoverLetter(clDeleteTarget.id)
      setCoverLetters((prev) => prev.filter((cl) => cl.id !== clDeleteTarget.id))
      setClDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setClDeleting(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── ATS score check ──────────────────────────────────────────────────────────
  const closeAtsModal = () => {
    setAtsTarget(null)
    setAtsJobDesc('')
    setAtsResult(null)
    setAtsError(null)
    setAtsLoading(false)
    setAtsViewMode(false)
  }

  // Open modal showing saved ATS results (skip JD entry)
  const openAtsDetail = (r: SavedResume) => {
    setAtsTarget(r)
    setAtsJobDesc(r.ats_job_description ?? '')
    setAtsResult(r.ats_result ?? null)
    setAtsViewMode(true)
  }

  // Open modal to run a fresh ATS check
  const openAtsCheck = (r: SavedResume) => {
    setAtsTarget(r)
    setAtsJobDesc('')
    setAtsResult(null)
    setAtsError(null)
    setAtsViewMode(false)
  }

  // Clear ATS score for a resume (in ATS Score tab)
  const handleClearAts = async (r: SavedResume) => {
    setAtsClearingId(r.id)
    try {
      await clearAtsScore(r.id)
      setResumes((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, ats_score: null, ats_score_updated_at: null, ats_job_description: null, ats_result: null }
            : x
        )
      )
    } catch (err) {
      console.error('Failed to clear ATS score:', err)
    } finally {
      setAtsClearingId(null)
    }
  }

  const handleRunAtsCheck = async () => {
    if (!atsTarget || !atsJobDesc.trim()) return
    setAtsLoading(true)
    setAtsError(null)
    try {
      const result = await scoreATS(atsTarget.resume_data, atsJobDesc)
      setAtsResult(result)
      try {
        await updateAtsScore(atsTarget.id, result.overallScore, {
          jobDescription: atsJobDesc,
          result,
        })
        const updatedAt = new Date().toISOString()
        setResumes((prev) =>
          prev.map((r) =>
            r.id === atsTarget.id ? { ...r, ats_score: result.overallScore, ats_score_updated_at: updatedAt } : r
          )
        )
        setAtsTarget((prev) => (prev ? { ...prev, ats_score: result.overallScore, ats_score_updated_at: updatedAt } : prev))
      } catch (err) {
        console.error('Failed to save ATS score:', err)
      }
    } catch (err) {
      console.error('ATS score check failed:', err)
      setAtsError('Failed to run ATS check. Please try again.')
    } finally {
      setAtsLoading(false)
    }
  }

  const avgAtsScore = (() => {
    const scored = resumes.filter((r) => r.ats_score != null) as (SavedResume & { ats_score: number })[]
    if (scored.length === 0) return null
    const sum = scored.reduce((acc, r) => acc + r.ats_score, 0)
    return Math.round(sum / scored.length)
  })()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/')} />

      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        <AccountSidebar />

        <div className="flex-1 min-w-0">

        {/* ── STATS BAR ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">
              {fetching ? <span className="inline-block h-7 w-10 bg-muted rounded animate-pulse" /> : resumes.length}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resumes</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">
              {fetching ? <span className="inline-block h-7 w-10 bg-muted rounded animate-pulse" /> : coverLetters.length}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cover Letters</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">
              {fetching ? <span className="inline-block h-7 w-10 bg-muted rounded animate-pulse" /> : (avgAtsScore ?? '—')}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg ATS Score</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">
              {fetching ? <span className="inline-block h-7 w-10 bg-muted rounded animate-pulse" /> : (aiCallsThisMonth ?? 0)}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Calls This Month</p>
          </div>
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto mb-8">
          <div className="flex gap-2 min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('resumes')}
              className={`flex items-center gap-2 px-4 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                activeTab === 'resumes'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              Resumes
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === 'resumes'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                {resumes.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cover-letters')}
              className={`flex items-center gap-2 px-4 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                activeTab === 'cover-letters'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              Cover Letters
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === 'cover-letters'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                {coverLetters.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ats-score')}
              className={`flex items-center gap-2 px-4 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                activeTab === 'ats-score'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              ATS Score
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === 'ats-score'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                {resumes.filter((r) => r.ats_score != null).length}
              </span>
            </button>
          </div>
        </div>

        {(loading || fetching) ? (
          <>
            <section className="mb-12">
              <div className="h-7 w-40 bg-muted rounded animate-pulse mb-6" />
              <SkeletonCards />
            </section>
            <section>
              <div className="h-7 w-48 bg-muted rounded animate-pulse mb-6" />
              <SkeletonCards />
            </section>
          </>
        ) : (
          <>
            {/* ── MY RESUMES ─────────────────────────────────────────────────── */}
            {activeTab === 'resumes' && (
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <h2
                  className="text-2xl font-bold uppercase tracking-wider text-foreground"
                >
                  My Resumes
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {resumes.length}
                </span>
              </div>

              {resumes.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No resumes yet"
                  description="Upload your existing resume and let Claude rewrite it with stronger bullet points, quantified impact, and ATS-friendly keywords."
                  actionLabel="Upload Resume"
                  onAction={() => setUploadModalOpen(true)}
                />
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="bg-card border border-primary/40 rounded-xl p-6 flex flex-col min-h-[240px] hover:border-primary/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-base truncate">{r.title}</p>
                      <div className="mt-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider truncate max-w-full">
                          {r.detected_industry}
                        </span>
                      </div>
                      {r.ats_score != null && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => openAtsDetail(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold tracking-wider hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            <Target className="size-2.5 shrink-0" />
                            ATS {r.ats_score}
                          </button>
                        </div>
                      )}
                      <p className="mt-2.5 text-xs text-muted-foreground">
                        Updated {formatDate(r.updated_at)}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-5 pt-4 border-t border-border w-full">
                      <button
                        onClick={() => handleEdit(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setExportOpenId(exportOpenId === r.id ? null : r.id)}
                          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                        >
                          <Download className="size-3.5" />
                          Export
                          <ChevronDown className="size-3" />
                        </button>
                        {exportOpenId === r.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setExportOpenId(null)} />
                            <ExportMenu align="center" side="top" rounded="sm" className="w-44">
                              <button
                                onClick={() => handleResumeDownload(r, 'pdf')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-foreground text-left whitespace-nowrap"
                              >
                                <Download className="size-3.5 shrink-0 text-muted-foreground" />
                                Save as PDF
                              </button>
                              <button
                                onClick={() => handleResumeDownload(r, 'docx')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-foreground text-left whitespace-nowrap"
                              >
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                Save as Word (.docx)
                              </button>
                            </ExportMenu>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="w-11 min-h-[44px] flex items-center justify-center text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 min-h-[240px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center transition-colors">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                    New Resume
                  </span>
                </button>
              </div>
              )}
            </section>
            )}

            {/* ── MY COVER LETTERS ────────────────────────────────────────────── */}
            {activeTab === 'cover-letters' && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2
                  className="text-2xl font-bold uppercase tracking-wider text-foreground"
                >
                  My Cover Letters
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {coverLetters.length}
                </span>
              </div>

              {coverLetters.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No cover letters yet"
                  description="Generate a cover letter from one of your resumes, tailored to a specific job in seconds."
                  actionLabel="New Cover Letter"
                  onAction={() => setNewClStep('options')}
                />
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coverLetters.map((cl) => (
                  <div
                    key={cl.id}
                    className="bg-card border border-primary/40 rounded-xl p-5 flex flex-col min-h-[200px] hover:border-primary/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{cl.title}</p>
                      {cl.company_name && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider truncate max-w-full">
                            <Mail className="size-2.5 shrink-0" />
                            {cl.company_name}
                          </span>
                        </div>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Updated {formatDate(cl.updated_at)}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-border w-full">
                      <button
                        onClick={() => handleClEdit(cl)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setClExportOpenId(clExportOpenId === cl.id ? null : cl.id)}
                          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                        >
                          <Download className="size-3.5" />
                          Export
                          <ChevronDown className="size-3" />
                        </button>
                        {clExportOpenId === cl.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setClExportOpenId(null)} />
                            <ExportMenu align="center" side="top" rounded="sm" className="w-40">
                              {(['pdf', 'docx', 'txt'] as const).map((fmt) => (
                                <button
                                  key={fmt}
                                  onClick={() => handleClDownload(cl, fmt)}
                                  className="w-full px-3 py-2 text-xs hover:bg-secondary text-foreground text-left font-bold uppercase tracking-wider"
                                >
                                  {fmt.toUpperCase()}
                                </button>
                              ))}
                            </ExportMenu>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setClDeleteTarget(cl)}
                        className="w-11 min-h-[44px] flex items-center justify-center text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setNewClStep('options')}
                  className="bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center transition-colors">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors text-center px-2">
                    New Cover Letter
                  </span>
                </button>
              </div>
              )}
            </section>
            )}

            {/* ── ATS SCORE ───────────────────────────────────────────────────── */}
            {activeTab === 'ats-score' && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2
                  className="text-2xl font-bold uppercase tracking-wider text-foreground"
                >
                  ATS Score
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {resumes.filter((r) => r.ats_score != null).length}
                </span>
              </div>

              {resumes.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No resumes yet"
                  description="Upload a resume first, then run an ATS check against any job description to see how well it matches."
                  actionLabel="Upload Resume"
                  onAction={() => setUploadModalOpen(true)}
                />
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resumes.filter((r) => r.ats_score != null).map((r) => (
                  <div
                    key={r.id}
                    className="bg-card border border-primary/40 rounded-xl p-5 flex flex-col min-h-[160px] hover:border-primary/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{r.title}</p>
                      <p className="mt-2 text-sm font-bold text-primary">
                        Score: {r.ats_score}/100
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Checked {r.ats_score_updated_at ? formatDate(r.ats_score_updated_at) : '—'}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => openAtsDetail(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                      >
                        <Target className="size-3.5" />
                        Detail
                      </button>
                      <button
                        onClick={() => handleClearAts(r)}
                        disabled={atsClearingId === r.id}
                        className="w-11 min-h-[44px] flex items-center justify-center text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors shrink-0 disabled:opacity-50"
                      >
                        {atsClearingId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* ADD NEW ATS CHECK card */}
                <button
                  type="button"
                  onClick={() => setAtsNewCheckStep('resume-pick')}
                  className="bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 min-h-[160px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center transition-colors">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors text-center px-2">
                    New ATS Check
                  </span>
                </button>
              </div>
              )}
            </section>
            )}
          </>
        )}
        </div>
      </main>

      {/* ── Upload resume modal ─────────────────────────────────────────────── */}
      <Modal open={uploadModalOpen} overlayClassName="p-4" className="rounded-xl max-w-lg p-0">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h2
                className="text-base font-bold text-foreground uppercase tracking-wide"
              >
                Upload Resume
              </h2>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6">
              <ResumeUploader onParsed={handleNewResumeParsed} />
            </div>
      </Modal>

      {/* ── Delete Resume confirmation ──────────────────────────────────────── */}
      <Modal open={!!deleteTarget} className="max-w-sm p-6">
            <h2
              className="text-base font-bold text-foreground uppercase tracking-wide mb-2"
            >
              Delete Resume
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">"{deleteTarget?.title}"</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
                Delete
              </button>
            </div>
      </Modal>

      {/* ── New Cover Letter modal ─────────────────────────────────────────── */}
      <Modal open={newClStep !== 'closed'} overlayClassName="bg-black/60 px-4" className="max-w-md rounded-xl relative">

            {/* Close */}
            <button
              type="button"
              onClick={closeNewClModal}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            {/* ── Step: options ───────────────────────────────────────────── */}
            {newClStep === 'options' && (
              <>
                <h2
                  className="text-lg font-bold text-foreground uppercase tracking-wide mb-1"
                >
                  Create Cover Letter
                </h2>
                <p className="text-xs text-muted-foreground mb-6">Choose how you want to start</p>

                <div className="flex flex-col gap-3">
                  {/* Generate from Resume */}
                  <button
                    type="button"
                    onClick={() => setNewClStep('resume-pick')}
                    className="w-full text-left p-5 border border-primary/40 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="size-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Wand2 className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm uppercase tracking-wide">
                          Generate from a Resume
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          AI writes a cover letter based on your resume
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Write from Scratch */}
                  <button
                    type="button"
                    onClick={() => {
                      closeNewClModal()
                      navigate('/cover-letter/new', { state: { content: '', from: '/dashboard' } })
                    }}
                    className="w-full text-left p-5 border border-border rounded-lg hover:border-muted-foreground hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="size-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 group-hover:border-muted-foreground transition-colors">
                        <PenLine className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm uppercase tracking-wide">
                          Write from Scratch
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Start with a blank cover letter
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* ── Step: resume picker ─────────────────────────────────────── */}
            {newClStep === 'resume-pick' && (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <button
                    type="button"
                    onClick={() => setNewClStep('options')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <h2
                    className="text-lg font-bold text-foreground uppercase tracking-wide"
                  >
                    Choose a Resume
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mb-5 pl-7">
                  Select the resume to base your cover letter on
                </p>

                {resumes.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">No saved resumes yet.</p>
                    <button
                      type="button"
                      onClick={() => { closeNewClModal(); setUploadModalOpen(true) }}
                      className="text-xs font-bold uppercase tracking-wider text-primary border border-primary/50 px-4 py-2 hover:bg-primary/10 transition-colors"
                    >
                      Upload a Resume First
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {resumes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setNewClResume(r); setNewClStep('generate-form') }}
                        className="w-full text-left px-4 py-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                            {r.detected_industry}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(r.updated_at)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Step: generate form ─────────────────────────────────────── */}
            {newClStep === 'generate-form' && (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <button
                    type="button"
                    onClick={() => setNewClStep('resume-pick')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <h2
                    className="text-lg font-bold text-foreground uppercase tracking-wide"
                  >
                    Generate Cover Letter
                  </h2>
                </div>

                {/* Selected resume badge */}
                {newClResume && (
                  <div className="flex items-center gap-2 ml-7 mb-5 mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resume:</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                      {newClResume.title}
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Company Name */}
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      autoFocus
                      placeholder="e.g. Google, Stripe, Acme Corp"
                      value={newClCompany}
                      onChange={(e) => setNewClCompany(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Job Description */}
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                      Job Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      placeholder="Paste the job description here..."
                      value={newClJobDesc}
                      onChange={(e) => setNewClJobDesc(e.target.value)}
                      className="w-full min-h-24 px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none transition-colors"
                    />
                  </div>

                  {/* Tone */}
                  <div>
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Tone</p>
                    <div className="flex gap-2">
                      {(['professional', 'enthusiastic', 'concise'] as NewClTone[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewClTone(t)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                            newClTone === t
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeNewClModal}
                    className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newClCompany.trim() || !newClJobDesc.trim()}
                    onClick={() => {
                      closeNewClModal()
                      navigate('/cover-letter/new', {
                        state: {
                          resume: newClResume?.resume_data,
                          companyName: newClCompany,
                          jobDescription: newClJobDesc,
                          tone: newClTone,
                          from: '/dashboard',
                        },
                      })
                    }}
                    className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
                  >
                    <Wand2 className="size-3.5" />
                    Generate
                  </button>
                </div>
              </>
            )}
      </Modal>

      {/* ── Delete Cover Letter confirmation ────────────────────────────────── */}
      <Modal open={!!clDeleteTarget} className="max-w-sm p-6">
            <h2
              className="text-base font-bold text-foreground uppercase tracking-wide mb-2"
            >
              Delete Cover Letter
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">"{clDeleteTarget?.title}"</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setClDeleteTarget(null)}
                disabled={clDeleting}
                className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClDeleteConfirm}
                disabled={clDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                {clDeleting && <Loader2 className="size-3.5 animate-spin" />}
                Delete
              </button>
            </div>
      </Modal>

      {/* ── ATS Score Check modal ───────────────────────────────────────────── */}
      <Modal open={!!atsTarget} overlayClassName="bg-black/60 backdrop-blur-sm px-4" className="max-w-lg rounded-xl relative">
            <button
              type="button"
              onClick={closeAtsModal}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide mb-1">
              Check ATS Score
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              Paste the job description for{' '}
              <span className="text-foreground font-medium">"{atsTarget?.title}"</span>
            </p>

            {!atsResult && !atsViewMode ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                    Job Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    autoFocus
                    placeholder="Paste the job description here..."
                    value={atsJobDesc}
                    onChange={(e) => setAtsJobDesc(e.target.value)}
                    disabled={atsLoading}
                    className="w-full min-h-32 px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none transition-colors disabled:opacity-50"
                  />
                </div>

                {atsError && (
                  <p className="mt-3 text-xs text-red-500">{atsError}</p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeAtsModal}
                    disabled={atsLoading}
                    className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!atsJobDesc.trim() || atsLoading}
                    onClick={handleRunAtsCheck}
                    className="flex items-center gap-2 px-5 py-2 min-h-[44px] bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wide transition-colors"
                  >
                    {atsLoading && <Loader2 className="size-3.5 animate-spin" />}
                    Run Check
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Saved JD (read-only, shown in view mode) */}
                {atsViewMode && atsJobDesc && (
                  <details className="mb-4">
                    <summary className="text-xs font-bold text-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors">
                      Job Description
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                      {atsJobDesc}
                    </p>
                  </details>
                )}

                {/* Results */}
                <div className="space-y-5">
                  {/* Overall score */}
                  {atsResult && (
                    <div className="text-center py-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-3xl font-bold text-primary">{atsResult.overallScore}/100</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Overall ATS Score
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  {atsResult?.summary && (
                    <p className="text-sm text-foreground">{atsResult.summary}</p>
                  )}

                  {/* Matched keywords */}
                  {atsResult && atsResult.matchedKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                        Matched Keywords
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.matchedKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-600 border border-green-500/30 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing keywords */}
                  {atsResult && atsResult.missingKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                        Missing Keywords
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.missingKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/30 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {atsResult && atsResult.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                        Suggestions
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {atsResult.suggestions.map((s, i) => (
                          <li key={i} className="text-sm text-foreground">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-3 mt-6">
                  {atsViewMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setAtsResult(null)
                        setAtsJobDesc('')
                        setAtsViewMode(false)
                      }}
                      className="px-4 py-2 border border-primary/40 text-xs font-bold text-primary hover:bg-primary/10 uppercase tracking-wide transition-colors"
                    >
                      Re-run Check
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeAtsModal}
                    className="ml-auto px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
      </Modal>
      {/* ── New ATS Check — resume picker ─────────────────────────────────────────── */}
      <Modal open={atsNewCheckStep === 'resume-pick'} overlayClassName="bg-black/60 backdrop-blur-sm px-4" className="max-w-md rounded-xl relative">
            <button
              type="button"
              onClick={() => setAtsNewCheckStep('closed')}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide mb-1">
              New ATS Check
            </h2>
            <p className="text-xs text-muted-foreground mb-5">Choose the resume to check</p>

            {resumes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No saved resumes yet.</p>
                <button
                  type="button"
                  onClick={() => { setAtsNewCheckStep('closed'); setUploadModalOpen(true) }}
                  className="text-xs font-bold uppercase tracking-wider text-primary border border-primary/50 px-4 py-2 hover:bg-primary/10 transition-colors"
                >
                  Upload a Resume First
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {resumes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setAtsNewCheckStep('closed')
                      openAtsCheck(r)
                    }}
                    className="w-full text-left px-4 py-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                        {r.detected_industry}
                      </span>
                      {r.ats_score != null && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Last score: {r.ats_score}/100
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
      </Modal>
    </div>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
