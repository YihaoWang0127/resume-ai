import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ResumeEditor from '@/components/ResumeEditor'
import type { ResumeSchema } from '@/types/resume'

export default function EditorPage() {
  const { user, loading, openAuthModal } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return null

  if (!user) return <Navigate to="/" replace />

  const state = location.state as { resume?: ResumeSchema; resumeId?: string; from?: string } | null
  const resume = state?.resume
  const resumeId = state?.resumeId
  const from = state?.from ?? '/'

  if (!resume) return <Navigate to="/" replace />

  return <ResumeEditor initialResume={resume} initialResumeId={resumeId} onBack={() => navigate(from)} onSignUp={openAuthModal} />
}
