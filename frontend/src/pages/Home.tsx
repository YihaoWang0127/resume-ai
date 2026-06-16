import { useNavigate } from 'react-router-dom'
import { Sparkles, CheckCircle2, ArrowRight, Eye } from 'lucide-react'
import ResumeUploader from '@/components/ResumeUploader'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import type { ResumeSchema } from '@/types/resume'

const CHECKLIST = [
  'AI Content Enhancement',
  'ATS Optimization',
  'Smart Suggestions',
  'HR-Approved Templates',
]

const COMPANIES = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Airbnb', 'Stripe']

export default function Home() {
  const { user, loading, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handleParsed = (resume: ResumeSchema) => {
    navigate('/editor', { state: { resume, from: '/' } })
  }

  const handleEnhance = () => {
    if (!loading && user) {
      navigate('/dashboard')
    } else {
      openAuthModal()
    }
  }

  const handleSeeExample = () => {
    const el = document.getElementById('uploader')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero Section ─────────────────────────────────────── */}
        <section className="px-6 pt-16 pb-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: text + CTAs */}
            <div className="flex flex-col gap-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium w-fit">
                <Sparkles className="size-4 shrink-0" />
                AI-Powered Resume Enhancement
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                <span className="block text-foreground">Your Resume.</span>
                <span className="block text-primary">Enhanced by AI.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
                Improve your resume, stand out to recruiters, and land more interviews with the power of AI.
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
                  Enhance My Resume
                  <ArrowRight className="size-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={handleSeeExample}
                  className="inline-flex items-center gap-2 border border-border bg-background rounded-lg px-6 py-3 font-semibold text-sm hover:bg-secondary transition-colors min-h-[44px]"
                >
                  See Example
                  <Eye className="size-4 shrink-0" />
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['JK', 'SM', 'AR'].map((initials) => (
                    <div
                      key={initials}
                      className="size-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary"
                    >
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

            {/* Right: decorative resume preview card (desktop only) */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-5 space-y-4">
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Software Engineer</span>
                  <span className="bg-green-100 text-green-700 rounded-full text-xs px-2.5 py-0.5 font-medium">
                    ATS Score 98%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* AI Suggestions panel */}
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">AI Suggestions</span>
                      <span className="bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-px font-bold">4</span>
                    </div>
                    {[
                      { label: 'Improve Impact', done: true },
                      { label: 'Quantify Results', done: true },
                      { label: 'Keyword Match', done: false },
                      { label: 'Skills Enhancement', done: false },
                    ].map((s) => (
                      <div key={s.label} className="flex items-start gap-1.5">
                        <CheckCircle2 className={`size-3 shrink-0 mt-0.5 ${s.done ? 'text-green-500' : 'text-primary'}`} />
                        <div>
                          <p className="text-[10px] font-semibold text-foreground leading-tight">{s.label}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">AI recommendation</p>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="text-[10px] text-primary font-medium hover:underline">
                      View All Suggestions →
                    </button>
                  </div>

                  {/* Resume preview panel */}
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">Alex Johnson</p>
                      <p className="text-[10px] text-muted-foreground">Software Engineer</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">alex@email.com · (555) 123-4567 · San Francisco, CA</p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-foreground mb-1">Professional Summary</p>
                      <div className="space-y-0.5">
                        <div className="h-1.5 bg-muted rounded-full w-full" />
                        <div className="h-1.5 bg-muted rounded-full w-4/5" />
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-foreground mb-1">Experience</p>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[9px] font-semibold text-foreground">Senior Software Engineer</p>
                        <p className="text-[8px] text-muted-foreground">2021–Present</p>
                      </div>
                      <p className="text-[8px] text-muted-foreground mb-1">Tech Corp</p>
                      <div className="space-y-0.5 pl-2">
                        {[100, 90, 95, 80].map((w, i) => (
                          <div key={i} className="h-1 bg-muted rounded-full" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Bar ────────────────────────────────────────── */}
        <section className="border-t border-border py-10 mt-2">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Trusted by professionals from top companies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 px-6">
            {COMPANIES.map((name) => (
              <span key={name} className="text-lg font-semibold text-muted-foreground/50">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* ── Upload Section ───────────────────────────────────── */}
        <section id="uploader" className="py-12 max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            Ready to enhance your resume?
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-6">
            Upload your resume and get AI-powered improvements in seconds.
          </p>
          <div className="relative">
            <ResumeUploader onParsed={handleParsed} />
            {!loading && !user && (
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={openAuthModal}
                onDragOver={(e) => { e.preventDefault(); openAuthModal() }}
              />
            )}
          </div>
        </section>
      </main>

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
