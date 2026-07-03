import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, CheckCircle2, Eye, FileText, ClipboardList, BarChart2, X, ArrowLeft, Bookmark, Upload, UserCircle, Loader2, ExternalLink, Mail } from 'lucide-react'
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

const COMPANIES = [
  {
    name: 'Google',
    color: '#4285F4',
    path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
  {
    name: 'Microsoft',
    color: '#0078D4',
    path: 'M0 0v11.408h11.408V0zm12.594 0v11.408H24V0zM0 12.594V24h11.408V12.594zm12.594 0V24H24V12.594z',
  },
  {
    name: 'Amazon',
    color: '#FF9900',
    path: 'M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-10.951-.577 17.88 17.88 0 01-5.43-3.35c-.1-.074-.151-.15-.151-.22 0-.047.021-.09.051-.13zm6.565-6.218c0-1.005.247-1.863.743-2.577.495-.71 1.17-1.25 2.04-1.615.796-.335 1.756-.575 2.912-.72.39-.046 1.033-.103 1.92-.174v-.37c0-.93-.105-1.558-.3-1.875-.302-.43-.78-.65-1.44-.65h-.182c-.48.046-.896.196-1.246.46-.35.27-.575.63-.675 1.096-.06.3-.206.465-.435.51l-2.52-.315c-.248-.06-.372-.18-.372-.39 0-.046.007-.09.022-.15.247-1.29.855-2.25 1.82-2.88.976-.616 2.1-.975 3.39-1.05h.54c1.65 0 2.957.434 3.888 1.29.135.15.27.3.405.48.12.165.224.314.283.45.075.134.15.33.195.57.06.254.105.42.135.51.03.104.062.3.076.615.01.313.02.493.02.553v5.28c0 .376.06.72.165 1.036.105.313.21.54.315.674l.51.674c.09.136.136.256.136.36 0 .12-.06.226-.18.314-1.2 1.05-1.86 1.62-1.963 1.71-.165.135-.375.15-.63.045a6.062 6.062 0 01-.526-.496l-.31-.347a9.391 9.391 0 01-.317-.42l-.3-.435c-.81.886-1.603 1.44-2.4 1.665-.494.15-1.093.227-1.83.227-1.11 0-2.04-.343-2.76-1.034-.72-.69-1.08-1.665-1.08-2.94l-.05-.076zm3.753-.438c0 .566.14 1.02.425 1.364.285.34.675.512 1.155.512.045 0 .106-.007.195-.02.09-.016.134-.023.166-.023.614-.16 1.08-.553 1.424-1.178.165-.28.285-.58.36-.91.09-.32.12-.59.135-.8.015-.195.015-.54.015-1.005v-.54c-.84 0-1.484.06-1.92.18-1.275.36-1.92 1.17-1.92 2.43l-.035-.02zm9.162 7.027c.03-.06.075-.11.132-.17.362-.243.714-.41 1.05-.5a8.094 8.094 0 011.612-.24c.14-.012.28 0 .41.03.65.06 1.05.168 1.172.33.063.09.099.228.099.39v.15c0 .51-.149 1.11-.424 1.8-.278.69-.664 1.248-1.156 1.68-.073.06-.14.09-.197.09-.03 0-.06 0-.09-.012-.09-.044-.107-.12-.064-.24.54-1.26.806-2.143.806-2.64 0-.15-.03-.27-.087-.344-.145-.166-.55-.257-1.224-.257-.243 0-.533.016-.87.046-.363.045-.7.09-1 .135-.09 0-.148-.014-.18-.044-.03-.03-.036-.047-.02-.077 0-.017.006-.03.02-.063v-.06z',
  },
  {
    name: 'Meta',
    color: '#0866FF',
    path: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z',
  },
  {
    name: 'Netflix',
    color: '#E50914',
    path: 'M5.398 0 13.746 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z',
  },
  {
    name: 'Airbnb',
    color: '#FF5A5F',
    path: 'M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z',
  },
  {
    name: 'Stripe',
    color: '#635BFF',
    path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z',
  },
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
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <Navbar />

      <main>
        {/* ── Hero Section ─────────────────────────────────────── */}
        <section className="bg-[hsl(var(--hero-bg))]">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 lg:gap-12 items-start pt-16 pb-8 px-8 max-w-7xl mx-auto">

            {/* Left: text + CTAs */}
            <div className="flex flex-col gap-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium w-fit">
                <Sparkles className="size-4 shrink-0" />
                Built for Every Job Application
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-4xl font-bold tracking-tight leading-tight max-w-2xl text-[hsl(var(--heading))]">
                <span className="block">Every job application,</span>
                <span className="block">perfectly tailored</span>
                <span className="block">
                  <span className="bg-gradient-to-r from-[#0B74F1] to-[#1473E6] bg-clip-text text-transparent">
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
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 border border-primary text-primary bg-transparent rounded-lg px-6 py-3 font-semibold text-sm min-h-[44px] opacity-50 cursor-not-allowed hover:bg-primary/10 transition-colors"
                >
                  See Example
                  <Eye className="size-4 shrink-0" />
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[
                    { initials: 'JK', bg: 'bg-orange-400' },
                    { initials: 'SM', bg: 'bg-purple-400' },
                    { initials: 'AR', bg: 'bg-blue-400' },
                  ].map(({ initials, bg }) => (
                    <div key={initials} className={`size-9 rounded-full ${bg} border-2 border-white dark:border-gray-800 flex items-center justify-center text-[11px] font-bold text-white`}>
                      {initials}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex text-amber-400 text-xs gap-px leading-none">
                    {'★★★★★'}
                  </div>
                  <p className="text-sm text-muted-foreground">Loved by 20,000+ job seekers</p>
                </div>
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
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-5 flex items-start gap-4"
                >
                  {/* Step number + icon */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-primary/60 tracking-widest">STEP {step}</span>
                  </div>

                  {/* Text */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{title}</p>
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
          {/* ── Trust Bar ──────────────────────────────────────── */}
          <div className="border-t border-primary/10 py-10 px-8 max-w-7xl mx-auto">
            <p className="text-center text-sm text-[hsl(var(--text-muted))] mb-8">
              Trusted by professionals from top companies
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {COMPANIES.map(({ name, color, path }) => (
                <div
                  key={name}
                  className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 shrink-0"
                    style={{ fill: color }}
                    aria-hidden="true"
                  >
                    <path d={path} />
                  </svg>
                  <span className="text-sm font-semibold" style={{ color }}>
                    {name}
                  </span>
                </div>
              ))}
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
