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

  const resume = (location.state as { resume?: ResumeSchema } | null)?.resume
  if (!resume) return <Navigate to="/" replace />

  return <ResumeEditor initialResume={resume} onBack={() => navigate('/')} onSignUp={openAuthModal} />
}
