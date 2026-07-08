import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, CheckCircle2, FileText, ClipboardList, BarChart2, X, ArrowLeft, Bookmark, Upload, UserCircle, Loader2, ExternalLink, Mail } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import ResumeUploader from '@/components/ResumeUploader'
import Modal from '@/components/Modal'
import type { ResumeSchema, SkillCategory } from '@/types/resume'
import { listResumes, type SavedResume } from '@/services/resumes'
import { getProfile } from '@/services/profile'
import type { ProfileData } from '@/types/profile'

const CHECKLIST = [
  'Tailored Resume',
  'Cover Letter',
  'ATS Score',
  'Job-Specific Keywords',
]

const WORKFLOW_STEPS = [
  {
    step: '1',
    icon: FileText,
    title: 'Upload Your Resume',
    description: 'Drop in your existing resume. We accept PDF, DOCX, or plain text.',
  },
  {
    step: '2',
    icon: ClipboardList,
    title: 'Paste a Job Description',
    description: 'Copy in the job posting. We extract the role, requirements, and keywords.',
  },
  {
    step: '3',
    icon: BarChart2,
    title: 'Get Resume + Cover Letter + ATS Score',
    description: 'Your resume is tailored to the job, a cover letter is generated, and your ATS fit is scored — in minutes.',
  },
]

function profileToResume(profile: ProfileData, userEmail: string): ResumeSchema {
  const skillCategories: SkillCategory[] = []
  if (profile.skills_technical) {
    skillCategories.push({
      category: 'Technical Skills',
      items: profile.skills_technical.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }
  if (profile.skills_tools) {
    skillCategories.push({
      category: 'Tools & Platforms',
      items: profile.skills_tools.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }
  if (profile.skills_certifications) {
    skillCategories.push({
      category: 'Certifications',
      items: profile.skills_certifications.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }
  return {
    metadata: {
      fullName: profile.full_name,
      email: userEmail,
      phone: profile.phone || undefined,
      location: profile.address || undefined,
      linkedIn: profile.linkedin_url || undefined,
      github: profile.github_url || undefined,
    },
    experience: profile.experience ?? [],
    education: [],
    skills: skillCategories,
    summary: profile.job_title
      ? `${profile.job_title} with ${profile.years_of_experience > 0 ? profile.years_of_experience + '+ years' : 'experience'} in ${profile.target_industry || 'the industry'}.`
      : '',
    detectedIndustry: profile.target_industry || undefined,
  }
}

type ModalView = 'picker' | 'upload' | 'saved-resumes'

export default function Home() {
  const { user, loading, isGuest, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [modalView, setModalView] = useState<ModalView | null>(null)
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])
  const [loadingResumes, setLoadingResumes] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const handleEnhance = () => {
    if (loading) return
    setModalView('picker')
  }

  const handleParsed = (resume: ResumeSchema) => {
    setModalView(null)
    navigate('/editor', { state: { resume, from: '/' } })
  }

  const handleUseSaved = async () => {
    if (!user || isGuest) {
      setModalView(null)
      openAuthModal()
      return
    }
    setModalView('saved-resumes')
    setLoadingResumes(true)
    try {
      const resumes = await listResumes()
      setSavedResumes(resumes)
    } catch {
      setSavedResumes([])
    } finally {
      setLoadingResumes(false)
    }
  }

  const handleSelectSavedResume = (saved: SavedResume) => {
    setModalView(null)
    navigate('/editor', { state: { resume: saved.resume_data, resumeId: saved.id, from: '/' } })
  }

  const handleUploadNew = () => {
    setModalView('upload')
  }

  const handleCreateFromProfile = async () => {
    if (!user || isGuest) {
      setModalView(null)
      openAuthModal()
      return
    }
    setLoadingProfile(true)
    try {
      const profile = await getProfile()
      if (!profile) {
        // No profile saved yet — redirect to profile page
        setModalView(null)
        navigate('/profile')
        return
      }
      const resume = profileToResume(profile, user.email ?? '')
      setModalView(null)
      navigate('/editor', { state: { resume, from: '/' } })
    } catch {
      setLoadingProfile(false)
    } finally {
      setLoadingProfile(false)
    }
  }

  return (
    <div className="bg-background flex flex-col overflow-x-hidden">
      <Navbar />

      <main>
        {/* ── Hero Section ─────────────────────────────────────── */}
        <section className="bg-[hsl(var(--hero-bg))]">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 lg:gap-12 items-start pt-16 pb-8 px-8 max-w-7xl mx-auto">

            {/* Left: text + CTAs */}
            <div className="flex flex-col gap-6">
              {/* Badge */}
              <div className="border-l-2 border-primary pl-3 py-0.5 w-fit">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Built for Every Job Application
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-4xl font-bold tracking-tight leading-tight max-w-2xl text-[hsl(var(--heading))]">
                <span className="block">Every job application,</span>
                <span className="block">perfectly tailored</span>
                <span className="block">
                  <span className="text-primary">
                    in minutes.
                  </span>
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base text-[hsl(var(--text-muted))] leading-relaxed max-w-lg mt-6">
                Resume, cover letter, and ATS check — crafted for the exact role you're chasing.
              </p>

              {/* Feature checklist */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {CHECKLIST.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full ring-2 ring-primary/30 bg-primary/10 p-0.5 flex items-center justify-center">
                      <CheckCircle2 className="size-3.5 text-primary" />
                    </span>
                    <span className="text-sm font-medium text-[hsl(var(--checklist-text))]">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={handleEnhance}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold text-sm hover:bg-primary/90 transition-colors min-h-[44px]"
                >
                  Create My Resume Package
                  <Sparkles className="size-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* Right: Job Application Workflow Card */}
            <div className="hidden lg:flex flex-col gap-4">
              {/* Header label */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How It Works</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Step cards */}
              {WORKFLOW_STEPS.map(({ step, icon: Icon, title, description }) => (
                <div
                  key={step}
                  className="bg-card rounded-2xl shadow-sm border border-border p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
                >
                  {/* Step number + icon */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-primary/60 tracking-widest">STEP {step}</span>
                  </div>

                  {/* Text */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    <p className="text-sm font-semibold text-card-foreground leading-tight">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>

                  {/* Completion indicator */}
                  <div className="ml-auto shrink-0 pt-0.5">
                    <CheckCircle2 className="size-5 text-green-400" />
                  </div>
                </div>
              ))}

              {/* Output summary badge */}
              <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">Your application package</p>
                  <p className="text-xs text-muted-foreground">Everything you need, ready to send.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full">Resume</span>
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full">Cover Letter</span>
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full">ATS Score</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 3-option picker / upload / saved-resumes modal */}
      <Modal
        open={modalView !== null}
        onClose={() => setModalView(null)}
        overlayClassName="p-4"
        className="rounded-2xl max-w-2xl p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            {modalView !== 'picker' && (
              <button
                onClick={() => setModalView('picker')}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <h2 className="text-base font-bold text-foreground">
              {modalView === 'picker' && 'Create Your Resume Package'}
              {modalView === 'upload' && 'Upload New Resume'}
              {modalView === 'saved-resumes' && 'Choose a Saved Resume'}
            </h2>
          </div>
          <button
            onClick={() => setModalView(null)}
            className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Picker view */}
        {modalView === 'picker' && (
          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-6">
              Choose how you'd like to start your resume package.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Option 1: Use Saved Resume */}
              <button
                type="button"
                onClick={handleUseSaved}
                className="flex flex-col items-start gap-3 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all text-left min-h-[44px] group"
              >
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Bookmark className="size-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Use Saved Resume</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose an existing resume as your starting point.
                  </p>
                </div>
              </button>

              {/* Option 2: Upload New Resume */}
              <button
                type="button"
                onClick={handleUploadNew}
                className="flex flex-col items-start gap-3 p-5 border border-primary/40 rounded-xl bg-primary/5 hover:border-primary hover:bg-primary/10 cursor-pointer transition-all text-left min-h-[44px] group"
              >
                <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                  <Upload className="size-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Upload New Resume</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Import a PDF, DOCX, or TXT file to get started.
                  </p>
                </div>
              </button>

              {/* Option 3: Create From Profile */}
              <button
                type="button"
                onClick={handleCreateFromProfile}
                disabled={loadingProfile}
                className="flex flex-col items-start gap-3 p-5 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all text-left min-h-[44px] group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  {loadingProfile ? (
                    <Loader2 className="size-5 text-primary animate-spin" />
                  ) : (
                    <UserCircle className="size-5 text-primary" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Create From Profile</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Generate a resume using your saved profile information.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Upload view */}
        {modalView === 'upload' && (
          <div className="p-6">
            <ResumeUploader onParsed={handleParsed} />
          </div>
        )}

        {/* Saved resumes view */}
        {modalView === 'saved-resumes' && (
          <div className="p-6">
            {loadingResumes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 text-primary animate-spin" />
              </div>
            ) : savedResumes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="size-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No saved resumes yet</p>
                <p className="text-xs mt-1">Upload a new resume to get started.</p>
                <button
                  onClick={() => setModalView('upload')}
                  className="mt-4 text-primary text-sm font-medium hover:underline"
                >
                  Upload now
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                {savedResumes.map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => handleSelectSavedResume(saved)}
                    className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left min-h-[44px] group"
                  >
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{saved.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(saved.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowLeft className="size-4 text-muted-foreground rotate-180 group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border bg-background px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Link rows */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <a
              href="https://github.com/YihaoWang0127"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="size-4 shrink-0" />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/jasewang0127/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="size-4 shrink-0" />
              LinkedIn
            </a>
            <a
              href="mailto:yihaowang0127@gmail.com"
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="size-4 shrink-0" />
              Contact
            </a>
          </div>

          {/* Copyright bar */}
          <div className="border-t border-border pt-4">
            <p className="text-center text-xs text-muted-foreground">
              © 2026 Yihao Wang. Built with Claude.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
