import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Edit, Download, Loader2, ChevronDown, X, Mail, Wand2, PenLine, ArrowLeft, Target, MoreHorizontal, Building2, Briefcase } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume, updateAtsScore, clearAtsScore, type SavedResume } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter, type CoverLetter } from '@/services/coverLetters'
import { exportResume, exportCoverLetter, scoreATS } from '@/services/api'
import { getAiUsageStats } from '@/services/aiUsage'
import { listApplications, updateApplicationStatus, deleteApplication, type Application } from '@/services/applications'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import ResumeUploader from '@/components/ResumeUploader'
import Modal from '@/components/Modal'
import ExportMenu from '@/components/ExportMenu'
import EmptyState from '@/components/EmptyState'
import ResumePreview from '@/components/ResumePreview'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

type RelationshipRow = {
  resume: SavedResume
  coverLetter: CoverLetter | null
  company: string | null
  jobTitle: string | null
  lastUpdated: string
}

function extractJobTitle(jobDescription: string | null): string | null {
  if (!jobDescription) return null
  const firstLine = jobDescription.trim().split('\n')[0].trim()
  return firstLine.length > 0 && firstLine.length < 100 ? firstLine : null
}

function atsScoreLabel(score: number): { label: string; className: string } {
  if (score >= 85) return { label: 'Excellent', className: 'bg-green-500/10 text-green-600 border-green-500/30' }
  if (score >= 70) return { label: 'Good', className: 'bg-primary/10 text-primary border-primary/30' }
  if (score >= 55) return { label: 'Fair', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' }
  return { label: 'Needs Work', className: 'bg-red-500/10 text-red-500 border-red-500/30' }
}

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

function SkeletonOverview() {
  return (
    <>
      {/* Stat card skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="h-7 w-10 bg-muted rounded mb-2" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
      {/* Table skeleton rows */}
      <div className="h-7 w-48 bg-muted rounded animate-pulse mb-6" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {['Resume', 'Company', 'Job Title', 'Cover Letter', 'ATS Score', 'Last Updated', 'Actions'].map((col) => (
                <th key={col} className="py-3 px-4 text-left">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i} className="border-b border-border">
                {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                  <td key={j} className="py-3 px-4">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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

  // ── ATS score check ──────────────────────────────────────────────────────────
  const [atsTarget, setAtsTarget] = useState<SavedResume | null>(null)
  const [atsJobDesc, setAtsJobDesc] = useState('')
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null)
  const [atsError, setAtsError] = useState<string | null>(null)
  const [atsViewMode, setAtsViewMode] = useState(false)
  const [atsNewCheckStep, setAtsNewCheckStep] = useState<'closed' | 'resume-pick'>('closed')
  const [atsClearingId, setAtsClearingId] = useState<string | null>(null)
  const [atsCompanyName, setAtsCompanyName] = useState('')
  const [atsJobTitle, setAtsJobTitle] = useState('')

  // ── Resume preview modal ─────────────────────────────────────────────────────
  const [previewResume, setPreviewResume] = useState<SavedResume | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<SavedResume | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [exportOpenId, setExportOpenId] = useState<string | null>(null)

  const [clDeleteTarget, setClDeleteTarget] = useState<CoverLetter | null>(null)
  const [clDeleting, setClDeleting] = useState(false)
  const [clExportOpenId, setClExportOpenId] = useState<string | null>(null)

  // ── applications ─────────────────────────────────────────────────────────────
  const [applications, setApplications] = useState<Application[]>([])
  const [appStatusUpdating, setAppStatusUpdating] = useState<string | null>(null)
  const [appDeleteTarget, setAppDeleteTarget] = useState<Application | null>(null)
  const [appDeleting, setAppDeleting] = useState(false)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // ── More menu state ──────────────────────────────────────────────────────────
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null)
  const [clMoreOpenId, setClMoreOpenId] = useState<string | null>(null)
  const [atsMoreOpenId, setAtsMoreOpenId] = useState<string | null>(null)

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
      listApplications().catch(() => [] as Application[]),
    ]).then(([res, cls, usage, apps]) => {
      setResumes(res)
      setCoverLetters(cls)
      setAiCallsThisMonth(usage?.callsThisMonth ?? 0)
      setApplications(apps)
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

  // ── application actions ──────────────────────────────────────────────────────
  const handleAppStatusChange = async (app: Application, status: Application['status']) => {
    setAppStatusUpdating(app.id)
    try {
      const updated = await updateApplicationStatus(app.id, status)
      setApplications(prev => prev.map(a => a.id === app.id ? updated : a))
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setAppStatusUpdating(null)
    }
  }

  const handleAppDeleteConfirm = async () => {
    if (!appDeleteTarget) return
    setAppDeleting(true)
    try {
      await deleteApplication(appDeleteTarget.id)
      setApplications(prev => prev.filter(a => a.id !== appDeleteTarget.id))
      setAppDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setAppDeleting(false)
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
    setAtsCompanyName('')
    setAtsJobTitle('')
  }

  // Open modal showing saved ATS results (skip JD entry)
  const openAtsDetail = (r: SavedResume) => {
    setAtsTarget(r)
    setAtsJobDesc(r.ats_job_description ?? '')
    setAtsResult(r.ats_result ?? null)
    setAtsViewMode(true)
    setAtsCompanyName(r.ats_company_name ?? '')
    setAtsJobTitle(r.ats_job_title ?? '')
  }

  // Open modal to run a fresh ATS check (Re-check: pre-fills from saved data)
  const openAtsCheck = (r: SavedResume) => {
    setAtsTarget(r)
    setAtsJobDesc(r.ats_job_description ?? '')
    setAtsResult(null)
    setAtsError(null)
    setAtsViewMode(false)
    setAtsCompanyName(r.ats_company_name ?? '')
    setAtsJobTitle(r.ats_job_title ?? '')
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
          companyName: atsCompanyName || undefined,
          jobTitle: atsJobTitle || undefined,
        })
        const updatedAt = new Date().toISOString()
        setResumes((prev) =>
          prev.map((r) =>
            r.id === atsTarget.id
              ? { ...r, ats_score: result.overallScore, ats_score_updated_at: updatedAt, ats_company_name: atsCompanyName || null, ats_job_title: atsJobTitle || null }
              : r
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

  // ── Overview relationship rows ────────────────────────────────────────────────
  const relationshipRows = (() => {
    const resumeMap = new Map(resumes.map(r => [r.id, r]))
    const coveredResumeIds = new Set<string>()
    const rows: RelationshipRow[] = []

    for (const cl of coverLetters) {
      const resume = cl.resume_id ? resumeMap.get(cl.resume_id) : undefined
      if (!resume) continue
      coveredResumeIds.add(resume.id)
      const lastUpdated = cl.updated_at > resume.updated_at ? cl.updated_at : resume.updated_at
      rows.push({
        resume,
        coverLetter: cl,
        company: cl.company_name ?? null,
        jobTitle: extractJobTitle(cl.job_description),
        lastUpdated,
      })
    }

    for (const r of resumes) {
      if (!coveredResumeIds.has(r.id)) {
        rows.push({
          resume: r,
          coverLetter: null,
          company: r.ats_company_name ?? null,
          jobTitle: r.ats_job_title ?? null,
          lastUpdated: r.updated_at,
        })
      }
    }

    return rows
  })()


  return (
    <div className="min-h-screen lg:h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/')} />

      <main className="flex-1 lg:overflow-hidden px-6 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8 py-10 lg:py-0">
        <div className="lg:py-10">
          <AccountSidebar />
        </div>

        <div className="flex-1 min-w-0 lg:overflow-y-auto lg:py-10 pb-16">

        {(loading || fetching) ? (
          <>
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <SkeletonOverview />
            </div>
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <div className="h-7 w-40 bg-muted rounded animate-pulse mb-6" />
              <SkeletonCards />
            </div>
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <div className="h-7 w-48 bg-muted rounded animate-pulse mb-6" />
              <SkeletonCards />
            </div>
          </>
        ) : (
          <>
            {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
            <section id="overview" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
              <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground mb-6">
                Overview
              </h2>

              {/* Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{resumes.length}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Resumes</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{coverLetters.length}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Cover Letters</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{avgAtsScore ?? '—'}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg ATS Score</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{aiCallsThisMonth ?? 0}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Actions Used This Month</p>
                </div>
              </div>

              {/* Application Overview table */}
              <h3 className="text-base font-bold uppercase tracking-wider text-foreground mb-4">
                Application Overview
              </h3>

              {relationshipRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents yet. Upload a resume to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse" style={{ minWidth: '860px' }}>
                    <thead>
                      <tr className="border-b border-border">
                        {['Resume', 'Company', 'Job Title', 'Cover Letter', 'ATS Score', 'Last Updated', 'Actions'].map((col) => (
                          <th
                            key={col}
                            className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relationshipRows.map((row, idx) => {
                        const scoreInfo = row.resume.ats_score != null ? atsScoreLabel(row.resume.ats_score) : null
                        return (
                          <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                            {/* Resume */}
                            <td className="py-3 px-4 text-sm font-medium text-foreground min-w-[200px]">
                              {row.resume.title}
                            </td>
                            {/* Company */}
                            <td className="py-3 px-4 text-sm text-foreground min-w-[120px] whitespace-nowrap">
                              {row.company ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            {/* Job Title */}
                            <td className="py-3 px-4 text-sm text-foreground min-w-[160px]">
                              {row.jobTitle ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            {/* Cover Letter */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              {row.coverLetter ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border bg-green-500/10 text-green-600 border-green-500/30">
                                  Generated
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not generated</span>
                              )}
                            </td>
                            {/* ATS Score */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              {row.resume.ats_score != null && scoreInfo ? (
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${scoreInfo.className}`}>
                                  {row.resume.ats_score} {scoreInfo.label}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not checked</span>
                              )}
                            </td>
                            {/* Last Updated */}
                            <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(row.lastUpdated)}
                            </td>
                            {/* Actions */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setPreviewResume(row.resume)}
                                  className="text-xs font-medium text-primary hover:text-primary/80 min-h-[36px] whitespace-nowrap transition-colors"
                                >
                                  View Resume
                                </button>
                                {row.coverLetter && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/cover-letter/${row.coverLetter!.id}`, { state: { from: '/dashboard' } })}
                                    className="text-xs font-medium text-primary hover:text-primary/80 min-h-[36px] whitespace-nowrap transition-colors"
                                  >
                                    View Cover Letter
                                  </button>
                                )}
                                {row.resume.ats_score != null && (
                                  <button
                                    type="button"
                                    onClick={() => openAtsDetail(row.resume)}
                                    className="text-xs font-medium text-primary hover:text-primary/80 min-h-[36px] whitespace-nowrap transition-colors"
                                  >
                                    View ATS
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── MY RESUMES ─────────────────────────────────────────────────── */}
            <section id="resumes" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
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
                  description="Import PDF, DOCX, or TXT — Claude rewrites it with stronger bullet points and ATS-friendly keywords."
                  actionLabel="Upload Resume"
                  onAction={() => setUploadModalOpen(true)}
                />
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="bg-card border border-border rounded-xl p-6 flex flex-col min-h-[240px] hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-base truncate">{r.title}</p>
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                          {r.detected_industry}
                        </span>
                        {r.ats_score != null && (
                          <button
                            type="button"
                            onClick={() => openAtsDetail(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold tracking-wider hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            <Target className="size-2.5 shrink-0" />
                            ATS {r.ats_score}
                          </button>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Updated {formatDate(r.updated_at)}</p>
                          <span className="text-[11px] text-muted-foreground mt-0.5 block">
                            {coverLetters.filter(cl => cl.resume_id === r.id).length} cover letter · {r.ats_score != null ? 1 : 0} ATS check
                          </span>
                        </div>
                        <button
                          onClick={() => navigate(`/apply/${r.id}`)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-green-600 hover:bg-green-500 text-white rounded transition-colors min-h-[36px]"
                        >
                          <Briefcase className="size-3" />
                          Apply
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-1.5 mt-5 pt-4 border-t border-border w-full">
                      <button
                        onClick={() => setPreviewResume(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                      >
                        Preview
                      </button>

                      <button
                        onClick={() => handleEdit(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setExportOpenId(exportOpenId === r.id ? null : r.id)}
                          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors"
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

                      {/* More menu */}
                      <div className="relative">
                        <button
                          aria-label="More options"
                          onClick={() => {
                            setMoreOpenId(moreOpenId === r.id ? null : r.id)
                            setClMoreOpenId(null)
                            setAtsMoreOpenId(null)
                          }}
                          className="w-9 min-h-[44px] flex items-center justify-center text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {moreOpenId === r.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMoreOpenId(null)} />
                            <div className="absolute right-0 bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-md py-1 min-w-[120px]">
                              <button
                                onClick={() => { setMoreOpenId(null); setDeleteTarget(r) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 text-left"
                              >
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 min-h-[240px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">
                      Upload Resume
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 group-hover:text-primary/70 mt-0.5">
                      Import PDF, DOCX, or TXT
                    </p>
                  </div>
                </button>
              </div>
              )}
            </section>

            {/* ── MY COVER LETTERS ────────────────────────────────────────────── */}
            <section id="cover-letters" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
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
                  description="Choose a resume and paste a job description — Claude writes a tailored cover letter in seconds."
                  actionLabel="New Cover Letter"
                  onAction={() => setNewClStep('options')}
                />
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coverLetters.map((cl) => {
                  const resumeTitle = cl.resume_id ? resumes.find(r => r.id === cl.resume_id)?.title : null
                  return (
                  <div
                    key={cl.id}
                    className="bg-card border border-border rounded-xl p-5 flex flex-col min-h-[200px] hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Primary heading: cover letter title */}
                      <p className="font-semibold text-foreground text-sm truncate">
                        {cl.title}
                      </p>
                      {/* Company badge */}
                      {cl.company_name && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold uppercase tracking-wider truncate max-w-full">
                            <Mail className="size-2.5 shrink-0 text-primary" />
                            {cl.company_name}
                          </span>
                        </div>
                      )}
                      {/* Job title (extracted from job_description first line) — below company badge */}
                      {(() => {
                        const jobTitle = extractJobTitle(cl.job_description)
                        return jobTitle ? (
                          <p className="mt-1 text-xs text-muted-foreground truncate">{jobTitle}</p>
                        ) : null
                      })()}
                      {/* Based on resume */}
                      {resumeTitle && (
                        <span className="text-[11px] text-muted-foreground mt-1.5 block">
                          Based on: {resumeTitle}
                        </span>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Updated {formatDate(cl.updated_at)}
                      </p>
                    </div>

                    <div className="flex gap-1.5 mt-4 pt-3 border-t border-border w-full">
                      <button
                        onClick={() => handleClEdit(cl)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setClExportOpenId(clExportOpenId === cl.id ? null : cl.id)}
                          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors"
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

                      {/* More menu */}
                      <div className="relative">
                        <button
                          aria-label="More options"
                          onClick={() => {
                            setClMoreOpenId(clMoreOpenId === cl.id ? null : cl.id)
                            setMoreOpenId(null)
                            setAtsMoreOpenId(null)
                          }}
                          className="w-9 min-h-[44px] flex items-center justify-center text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {clMoreOpenId === cl.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setClMoreOpenId(null)} />
                            <div className="absolute right-0 bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-md py-1 min-w-[120px]">
                              <button
                                onClick={() => { setClMoreOpenId(null); setClDeleteTarget(cl) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 text-left"
                              >
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setNewClStep('options')}
                  className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 min-h-[200px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">
                      Generate Cover Letter
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 group-hover:text-primary/70 mt-0.5">
                      Choose resume and job description
                    </p>
                  </div>
                </button>
              </div>
              )}
            </section>

            {/* ── APPLICATIONS ────────────────────────────────────────────────── */}
            <section id="applications" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
                  Applications
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {applications.length}
                </span>
              </div>

              {applications.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No applications yet"
                  description="Click the briefcase icon on any resume card to start a one-shot apply: tailor → cover letter → ATS score in one action."
                  actionLabel="Upload Resume"
                  onAction={() => setUploadModalOpen(true)}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {applications.map((app) => {
                    const statusColors: Record<Application['status'], string> = {
                      applied:      'bg-primary/10 text-primary border-primary/30',
                      interviewing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
                      offer:        'bg-green-500/10 text-green-600 border-green-500/30',
                      rejected:     'bg-red-500/10 text-red-500 border-red-500/30',
                    }
                    const resume = resumes.find(r => r.id === app.resume_id)
                    return (
                      <div key={app.id} className="bg-card border border-border rounded-xl p-5 flex flex-col min-h-[180px] hover:border-primary/30 hover:shadow-sm transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-base truncate">{app.company || '—'}</p>
                          <p className="text-sm text-muted-foreground truncate">{app.role || '—'}</p>
                          {resume && (
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">Resume: {resume.title}</p>
                          )}
                          {app.ats_score != null && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">ATS Score: {app.ats_score}/100</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Applied {formatDate(app.applied_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border">
                          {/* Status selector */}
                          <select
                            value={app.status}
                            disabled={appStatusUpdating === app.id}
                            onChange={(e) => handleAppStatusChange(app, e.target.value as Application['status'])}
                            className={`flex-1 min-h-[44px] px-2 text-[10px] font-bold uppercase tracking-wider border rounded transition-colors bg-transparent cursor-pointer disabled:opacity-50 ${statusColors[app.status]}`}
                          >
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="offer">Offer</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          {/* Delete */}
                          <div className="relative">
                            <button
                              aria-label="More options"
                              onClick={() => setAppDeleteTarget(app)}
                              className="w-9 min-h-[44px] flex items-center justify-center text-muted-foreground border border-border hover:border-red-500/30 hover:text-red-500 rounded transition-colors shrink-0"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── ATS SCORE ───────────────────────────────────────────────────── */}
            <section id="ats-scores" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
                  ATS Scores
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
                {resumes.filter((r) => r.ats_score != null).map((r) => {
                  const scoreInfo = r.ats_score != null ? atsScoreLabel(r.ats_score) : null
                  return (
                  <div
                    key={r.id}
                    className="bg-card border border-border rounded-xl p-5 flex flex-col min-h-[160px] hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Resume title */}
                      <p className="font-semibold text-foreground text-sm truncate">{r.title}</p>
                      {/* Company name */}
                      {r.ats_company_name && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="size-3 shrink-0" />
                          {r.ats_company_name}
                        </p>
                      )}
                      {/* Job title */}
                      {r.ats_job_title && (
                        <p className="text-xs text-muted-foreground truncate">{r.ats_job_title}</p>
                      )}
                      {/* Score row */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-sm font-bold text-primary">{r.ats_score}/100</span>
                        {scoreInfo && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${scoreInfo.className}`}>
                            {scoreInfo.label}
                          </span>
                        )}
                      </div>
                      {/* Checked date */}
                      <p className="text-[11px] text-muted-foreground">
                        Checked {r.ats_score_updated_at ? formatDate(r.ats_score_updated_at) : '—'}
                      </p>
                    </div>

                    <div className="flex gap-1.5 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => openAtsDetail(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                      >
                        <Target className="size-3.5" />
                        View Report
                      </button>
                      <button
                        onClick={() => openAtsCheck(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors"
                      >
                        Re-check
                      </button>

                      {/* More menu */}
                      <div className="relative">
                        <button
                          aria-label="More options"
                          onClick={() => {
                            setAtsMoreOpenId(atsMoreOpenId === r.id ? null : r.id)
                            setMoreOpenId(null)
                            setClMoreOpenId(null)
                          }}
                          className="w-9 min-h-[44px] flex items-center justify-center text-muted-foreground border border-border hover:border-primary/20 hover:text-foreground rounded transition-colors shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {atsMoreOpenId === r.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setAtsMoreOpenId(null)} />
                            <div className="absolute right-0 bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-md py-1 min-w-[120px]">
                              <button
                                onClick={() => { setAtsMoreOpenId(null); handleClearAts(r) }}
                                disabled={atsClearingId === r.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 text-left disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}

                {/* ADD NEW ATS CHECK card */}
                <button
                  type="button"
                  onClick={() => setAtsNewCheckStep('resume-pick')}
                  className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center">
                    <Plus className="size-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">
                      New ATS Check
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 group-hover:text-primary/70 mt-0.5">
                      Compare resume with job description
                    </p>
                  </div>
                </button>
              </div>
              )}
            </section>
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

      {/* ── Delete Application confirmation ─────────────────────────────────── */}
      <Modal open={!!appDeleteTarget} className="max-w-sm p-6">
            <h2 className="text-base font-bold text-foreground uppercase tracking-wide mb-2">Delete Application</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Remove the application to <span className="text-foreground font-medium">"{appDeleteTarget?.company}"</span> from your tracker?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAppDeleteTarget(null)} disabled={appDeleting}
                className="px-4 py-2 border border-border text-xs font-bold text-muted-foreground hover:bg-secondary uppercase tracking-wide transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleAppDeleteConfirm} disabled={appDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50">
                {appDeleting && <Loader2 className="size-3.5 animate-spin" />}
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
                {/* Company Name */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                    Company Name
                  </label>
                  <input
                    placeholder="e.g. Google, Apple, Stripe"
                    value={atsCompanyName}
                    onChange={(e) => setAtsCompanyName(e.target.value)}
                    disabled={atsLoading}
                    className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Job Title */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                    Job Title
                  </label>
                  <input
                    placeholder="e.g. Software Engineer, Product Manager"
                    value={atsJobTitle}
                    onChange={(e) => setAtsJobTitle(e.target.value)}
                    disabled={atsLoading}
                    className="w-full px-3 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>

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
                {/* Company / Job title info in view mode */}
                {atsViewMode && (atsCompanyName || atsJobTitle) && (
                  <div className="mb-3 space-y-0.5">
                    {atsCompanyName && <p className="text-sm font-semibold text-foreground">{atsCompanyName}</p>}
                    {atsJobTitle && <p className="text-xs text-muted-foreground">{atsJobTitle}</p>}
                  </div>
                )}

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
                        setAtsCompanyName('')
                        setAtsJobTitle('')
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
      {/* ── Resume Preview modal ────────────────────────────────────────────────── */}
      <Modal open={!!previewResume} overlayClassName="bg-black/60 backdrop-blur-sm px-4" className="max-w-4xl rounded-xl relative flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header — fixed, never scrolls */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
              <h2 className="text-base font-bold text-foreground uppercase tracking-wide truncate pr-4">
                {previewResume?.title ?? 'Preview'}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewResume(null)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded transition-colors shrink-0"
                aria-label="Close preview"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Scrollable body */}
            {previewResume && (
              <div className="overflow-y-auto flex-1 p-6">
                <ResumePreview
                  resume={previewResume.resume_data}
                  industry={previewResume.detected_industry}
                />
              </div>
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
