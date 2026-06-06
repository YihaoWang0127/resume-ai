import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Edit, Download, Loader2, ChevronDown, X, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume, type SavedResume } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter, type CoverLetter } from '@/services/coverLetters'
import { exportResume, exportCoverLetter } from '@/services/api'
import Navbar from '@/components/Navbar'
import ResumeUploader from '@/components/ResumeUploader'
import type { ResumeSchema } from '@/types/resume'

export default function Dashboard() {
  const { user, loading, isGuest } = useAuth()
  const navigate = useNavigate()

  // ── resumes ──────────────────────────────────────────────────────────────────
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([])
  const [fetching, setFetching] = useState(true)

  const [deleteTarget, setDeleteTarget] = useState<SavedResume | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [exportOpenId, setExportOpenId] = useState<string | null>(null)

  const [clDeleteTarget, setClDeleteTarget] = useState<CoverLetter | null>(null)
  const [clDeleting, setClDeleting] = useState(false)
  const [clExportOpenId, setClExportOpenId] = useState<string | null>(null)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleNewResumeParsed = (resume: ResumeSchema) => {
    setUploadModalOpen(false)
    navigate('/editor', { state: { resume, from: '/dashboard' } })
  }

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

  if (loading) return null
  if (!user || isGuest) return <Navigate to="/" replace />

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/')} />

      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full">

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── MY RESUMES ─────────────────────────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <h2
                  className="text-2xl font-bold uppercase tracking-wider text-foreground"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  My Resumes
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {resumes.length}
                </span>
              </div>

              {resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">
                  No saved resumes yet. Upload one to get started.
                </p>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#111] border border-primary/40 rounded-xl p-5 flex flex-col min-h-[200px] hover:border-primary/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{r.title}</p>
                      <div className="mt-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider truncate max-w-full">
                          {r.detected_industry}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Updated {formatDate(r.updated_at)}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => handleEdit(r)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setExportOpenId(exportOpenId === r.id ? null : r.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                        >
                          <Download className="size-3.5" />
                          Export
                          <ChevronDown className="size-3" />
                        </button>
                        {exportOpenId === r.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setExportOpenId(null)} />
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded py-1 shadow-lg shadow-black/40 w-44">
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
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="flex items-center justify-center px-3 py-2 text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="bg-[#0d0d0d] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-[#00FF87] hover:bg-[#00FF87]/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-gray-600 group-hover:border-[#00FF87] flex items-center justify-center transition-colors">
                    <Plus className="size-5 text-gray-500 group-hover:text-[#00FF87] transition-colors" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-[#00FF87] transition-colors">
                    New Resume
                  </span>
                </button>
              </div>
            </section>

            {/* ── MY COVER LETTERS ────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2
                  className="text-2xl font-bold uppercase tracking-wider text-foreground"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  My Cover Letters
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/30 rounded-full">
                  {coverLetters.length}
                </span>
              </div>

              {coverLetters.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">
                  No cover letters yet. Open a resume and click "Cover Letter" to generate one.
                </p>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coverLetters.map((cl) => (
                  <div
                    key={cl.id}
                    className="bg-[#111] border border-primary/40 rounded-xl p-5 flex flex-col min-h-[200px] hover:border-primary/70 transition-colors"
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

                    <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => handleClEdit(cl)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>

                      <div className="flex-1 relative">
                        <button
                          onClick={() => setClExportOpenId(clExportOpenId === cl.id ? null : cl.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                        >
                          <Download className="size-3.5" />
                          Export
                          <ChevronDown className="size-3" />
                        </button>
                        {clExportOpenId === cl.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setClExportOpenId(null)} />
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded py-1 shadow-lg shadow-black/40 w-40">
                              {(['pdf', 'docx', 'txt'] as const).map((fmt) => (
                                <button
                                  key={fmt}
                                  onClick={() => handleClDownload(cl, fmt)}
                                  className="w-full px-3 py-2 text-xs hover:bg-secondary text-foreground text-left font-bold uppercase tracking-wider"
                                >
                                  {fmt.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setClDeleteTarget(cl)}
                        className="flex items-center justify-center px-3 py-2 text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  title="Generate from a resume"
                  className="bg-[#0d0d0d] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-[#00FF87] hover:bg-[#00FF87]/5 hover:scale-[1.02] transition-all duration-200 group"
                >
                  <div className="size-10 rounded-full border-2 border-dashed border-gray-600 group-hover:border-[#00FF87] flex items-center justify-center transition-colors">
                    <Plus className="size-5 text-gray-500 group-hover:text-[#00FF87] transition-colors" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-[#00FF87] transition-colors text-center px-2">
                    New Cover Letter
                  </span>
                  <span className="text-[10px] text-gray-600 group-hover:text-[#00FF87]/60 transition-colors text-center px-4 leading-tight">
                    Generate from a resume
                  </span>
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* ── Upload resume modal ─────────────────────────────────────────────── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h2
                className="text-base font-bold text-foreground uppercase tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
          </div>
        </div>
      )}

      {/* ── Delete Resume confirmation ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm mx-4 p-6">
            <h2
              className="text-base font-bold text-foreground uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Delete Resume
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">"{deleteTarget.title}"</span>?
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
          </div>
        </div>
      )}

      {/* ── Delete Cover Letter confirmation ────────────────────────────────── */}
      {clDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm mx-4 p-6">
            <h2
              className="text-base font-bold text-foreground uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Delete Cover Letter
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">"{clDeleteTarget.title}"</span>?
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
          </div>
        </div>
      )}
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
