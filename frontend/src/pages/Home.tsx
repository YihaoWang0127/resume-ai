import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, CheckCircle2, Eye, FileText, ClipboardList, BarChart2, X } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import ResumeUploader from '@/components/ResumeUploader'
import Modal from '@/components/Modal'
import type { ResumeSchema } from '@/types/resume'

const CHECKLIST = [
  'Tailored Resume',
  'Cover Letter',
  'ATS Score',
  'Job-Specific Keywords',
]

const COMPANIES = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Airbnb', 'Stripe']

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

export default function Home() {
  const { user, loading, isGuest, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleParsed = (resume: ResumeSchema) => {
    setUploadModalOpen(false)
    navigate('/editor', { state: { resume, from: '/' } })
  }

  const handleEnhance = () => {
    if (loading) return
    if (isGuest) {
      setUploadModalOpen(true)
    } else if (user) {
      navigate('/dashboard')
    } else {
      openAuthModal()
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF2FF] dark:bg-gray-950 flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero Section ─────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 lg:gap-12 items-start pt-16 pb-8 px-8 max-w-7xl mx-auto">

            {/* Left: text + CTAs */}
            <div className="flex flex-col gap-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium w-fit">
                <Sparkles className="size-4 shrink-0" />
                Built for Every Job Application
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                <span className="block text-foreground">Build every job application package</span>
                <span className="block text-primary">in minutes.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
                Resume, cover letter, and ATS check — tailored to each job.
              </p>

              {/* Feature checklist */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {CHECKLIST.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3">
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
                  className="inline-flex items-center gap-2 border border-border bg-background rounded-lg px-6 py-3 font-semibold text-sm min-h-[44px] opacity-50 cursor-not-allowed"
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
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How it works</span>
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
        </section>

        {/* ── Trust Bar ────────────────────────────────────────── */}
        <div className="py-12 px-8 max-w-7xl mx-auto">
          <div className="bg-white/70 dark:bg-gray-800/70 rounded-2xl py-10 px-8">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-8">
              Trusted by professionals from top companies
            </p>
            <div className="flex flex-wrap items-center justify-center gap-10">
              {COMPANIES.map((name) => (
                <span key={name} className="text-xl font-bold text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 transition-colors">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Guest upload modal */}
      <Modal open={uploadModalOpen} overlayClassName="p-4" className="rounded-xl max-w-lg p-0">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground uppercase tracking-wide">
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
          <ResumeUploader onParsed={handleParsed} />
        </div>
      </Modal>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border px-6 py-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span>© 2026 Yihao Wang. Built with Claude.</span>
            <span className="text-border">·</span>
            <a href="mailto:yihaowang0127@gmail.com" className="hover:text-primary transition-colors">
              yihaowang0127@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
