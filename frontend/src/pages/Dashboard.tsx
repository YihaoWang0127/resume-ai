import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Edit, Download, Loader2, ChevronDown, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume, type SavedResume } from '@/services/resumes'
import { exportResume } from '@/services/api'
import Navbar from '@/components/Navbar'
import ResumeUploader from '@/components/ResumeUploader'
import type { ResumeSchema } from '@/types/resume'

export default function Dashboard() {
  const { user, loading, isGuest } = useAuth()
  const navigate = useNavigate()
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [fetching, setFetching] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SavedResume | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [exportOpenId, setExportOpenId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleNewResumeParsed = (resume: ResumeSchema) => {
    setUploadModalOpen(false)
    navigate('/editor', { state: { resume, from: '/dashboard' } })
  }

  useEffect(() => {
    if (!user || isGuest) return
    listResumes()
      .then(setResumes)
      .finally(() => setFetching(false))
  }, [user, isGuest])

  if (loading) return null
  if (!user || isGuest) return <Navigate to="/" replace />

  const handleEdit = (r: SavedResume) => {
    navigate('/editor', { state: { resume: r.resume_data, resumeId: r.id, from: '/dashboard' } })
  }

  const handleDownload = async (r: SavedResume, format: 'pdf' | 'docx') => {
    setExportOpenId(null)
    try {
      const blob = await exportResume(r.resume_data, format, r.detected_industry)
      const baseName = (r.resume_data.metadata.fullName || 'resume').replace(/ /g, '_')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.${format}`
      a.click()
      URL.revokeObjectURL(url)
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={() => navigate('/')} />

      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full">
        <h1
          className="text-3xl font-bold uppercase tracking-wider text-foreground mb-8"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          My Resumes
        </h1>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
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
                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary/40 hover:bg-primary/10 rounded transition-colors"
                  >
                    <Edit className="size-3.5" />
                    Edit
                  </button>

                  {/* Export dropdown */}
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
                            onClick={() => handleDownload(r, 'pdf')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-foreground text-left whitespace-nowrap"
                          >
                            <Download className="size-3.5 shrink-0 text-muted-foreground" />
                            Save as PDF
                          </button>
                          <button
                            onClick={() => handleDownload(r, 'docx')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-foreground text-left whitespace-nowrap"
                          >
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            Save as Word (.docx)
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Delete — icon only */}
                  <button
                    onClick={() => setDeleteTarget(r)}
                    className="flex items-center justify-center px-3 py-2 text-red-500 border border-red-500/40 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* New Resume card — always last */}
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
        )}
      </main>

      {/* Upload new resume modal */}
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

      {/* Delete confirmation modal */}
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
    </div>
  )
}
