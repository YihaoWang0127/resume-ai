import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Loader2, Trash2, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter } from '@/services/coverLetters'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import Modal from '@/components/Modal'
import PackageWizard, { type PackageViewData } from '@/components/PackageWizard'
import type { SavedResume } from '@/services/resumes'
import type { CoverLetter } from '@/services/coverLetters'

// ── types ─────────────────────────────────────────────────────────────────────

interface PackageItem {
  resume: SavedResume
  coverLetter: CoverLetter
  companyName: string
  position: string
}

type RelationshipRow = {
  resume: SavedResume
  coverLetter: CoverLetter | null
  company: string | null
  jobTitle: string | null
  lastUpdated: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function SkeletonSection() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6 animate-pulse">
      <div className="h-7 w-48 bg-muted rounded mb-6" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function Package() {
  const { user, loading, isGuest } = useAuth()
  const navigate = useNavigate()

  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([])
  const [fetching, setFetching] = useState(true)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [viewData, setViewData] = useState<PackageViewData | undefined>()

  const [deleteTarget, setDeleteTarget] = useState<PackageItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!user || isGuest) return
    Promise.all([
      listResumes().catch(() => [] as SavedResume[]),
      listCoverLetters().catch(() => [] as CoverLetter[]),
    ]).then(([res, cls]) => {
      setResumes(res)
      setCoverLetters(cls)
    }).finally(() => setFetching(false))
  }, [user, isGuest])

  if (!loading && (!user || isGuest)) return <Navigate to="/" replace />

  // ── build package items ───────────────────────────────────────────────────────
  const packageItems: PackageItem[] = (() => {
    const seen = new Set<string>()
    const items: PackageItem[] = []
    for (const cl of coverLetters) {
      if (!cl.resume_id) continue
      if (seen.has(cl.resume_id)) continue
      const resume = resumes.find((r) => r.id === cl.resume_id)
      if (!resume || !resume.ats_company_name || resume.ats_score == null || !resume.ats_result) continue
      seen.add(cl.resume_id)
      items.push({
        resume,
        coverLetter: cl,
        companyName: resume.ats_company_name,
        position: resume.ats_job_title ?? '',
      })
    }
    return items
  })()

  // ── build relationship rows (same logic as Dashboard overview table) ──────────
  const relationshipRows: RelationshipRow[] = (() => {
    const resumeMap = new Map(resumes.map((r) => [r.id, r]))
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

  const packageResumeIds = new Set(packageItems.map((p) => p.resume.id))

  // ── handlers ─────────────────────────────────────────────────────────────────

  const handleViewPackage = (item: PackageItem) => {
    setViewData({
      resume: item.resume,
      coverLetterText: item.coverLetter.content,
      companyName: item.companyName,
      position: item.position,
    })
    setWizardOpen(true)
  }

  const handleScrollToCard = (resumeId: string) => {
    document.getElementById(`package-${resumeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteCoverLetter(deleteTarget.coverLetter.id)
      await deleteResume(deleteTarget.resume.id)
      setCoverLetters((prev) => prev.filter((cl) => cl.id !== deleteTarget.coverLetter.id))
      setResumes((prev) => prev.filter((r) => r.id !== deleteTarget.resume.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed', err)
    } finally {
      setIsDeleting(false)
    }
  }

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
              <SkeletonSection />
              <SkeletonSection />
            </>
          ) : (
            <>
              {/* ── PACKAGE OVERVIEW ──────────────────────────────────────── */}
              <section id="package-overview" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
                    Package Overview
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                    {relationshipRows.length}
                  </span>
                </div>

                {relationshipRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No documents yet. Upload a resume to get started.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse" style={{ minWidth: '900px' }}>
                      <thead>
                        <tr className="border-b border-border">
                          {['Last Updated', 'Resume', 'Company', 'Job Title', 'Cover Letter', 'ATS Score', 'View Package'].map((col) => (
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
                          const isPackage = packageResumeIds.has(row.resume.id)
                          return (
                            <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                              {/* Last Updated */}
                              <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                                {formatDate(row.lastUpdated)}
                              </td>
                              {/* Resume */}
                              <td className="py-3 px-4 text-sm font-medium text-foreground min-w-[180px]">
                                {row.resume.title}
                              </td>
                              {/* Company */}
                              <td className="py-3 px-4 text-sm text-foreground min-w-[120px] whitespace-nowrap">
                                {row.company ?? <span className="text-muted-foreground">—</span>}
                              </td>
                              {/* Job Title */}
                              <td className="py-3 px-4 text-sm text-foreground min-w-[140px]">
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
                              {/* View Package */}
                              <td className="py-3 px-4">
                                {isPackage ? (
                                  <button
                                    type="button"
                                    onClick={() => handleScrollToCard(row.resume.id)}
                                    className="text-xs font-medium text-primary hover:text-primary/80 min-h-[36px] whitespace-nowrap transition-colors"
                                  >
                                    View Package ↓
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ── APPLICATION PACKAGE ───────────────────────────────────── */}
              <section id="application-package" className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 scroll-mt-4">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-wider text-foreground">
                    Application Package
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                    {packageItems.length}
                  </span>
                </div>

                {packageItems.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
                    <p className="text-sm font-semibold text-foreground mb-1">No application packages yet</p>
                    <p className="text-xs text-muted-foreground">Use the one-click package generator to create a tailored resume, cover letter, and ATS score in one shot.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {packageItems.map((item) => {
                      const scoreInfo = item.resume.ats_score != null ? atsScoreLabel(item.resume.ats_score) : null
                      return (
                        <div
                          key={item.resume.id}
                          id={`package-${item.resume.id}`}
                          className="bg-card border border-border rounded-xl p-5 flex flex-col min-h-[200px] hover:border-primary/30 hover:shadow-sm transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-base truncate">{item.companyName}</p>
                            {item.position && (
                              <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.position}</p>
                            )}
                            <div className="mt-3 space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Resume: <span className="text-foreground">{item.resume.title}</span>
                              </p>
                              {item.resume.ats_score != null && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  ATS Score:{' '}
                                  <span className="font-semibold text-foreground">{item.resume.ats_score}/100</span>
                                  {scoreInfo && (
                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${scoreInfo.className}`}>
                                      {scoreInfo.label}
                                    </span>
                                  )}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Applied {formatDate(item.coverLetter.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-1.5 mt-4 pt-3 border-t border-border">
                            <button
                              type="button"
                              onClick={() => handleViewPackage(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                            >
                              <Eye className="size-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="w-9 min-h-[44px] flex items-center justify-center text-muted-foreground border border-border hover:border-red-500/30 hover:text-red-500 rounded transition-colors shrink-0"
                              aria-label="Delete package"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} className="max-w-sm p-6">
        <h2 className="text-base font-bold text-foreground uppercase tracking-wide mb-2">
          Delete Package
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete the package for{' '}
          <span className="text-foreground font-medium">
            "{deleteTarget?.companyName}{deleteTarget?.position ? ` – ${deleteTarget.position}` : ''}"
          </span>
          ? This will delete the tailored resume and cover letter. This cannot be undone.
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

      {/* ── Package viewer ──────────────────────────────────────────────── */}
      <PackageWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        viewData={viewData}
      />
    </div>
  )
}
