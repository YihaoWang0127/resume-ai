import { useNavigate } from 'react-router-dom'
import { Sparkles, CheckCircle2, Eye, ChevronDown, User } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'

const CHECKLIST = [
  'AI Content Enhancement',
  'ATS Optimization',
  'Smart Suggestions',
  'HR-Approved Templates',
]

const COMPANIES = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Airbnb', 'Stripe']

export default function Home() {
  const { user, loading, isGuest, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handleEnhance = () => {
    if (loading) return
    if (isGuest) {
      navigate('/editor')
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
                AI-Powered Resume Enhancement
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
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
                  <Sparkles className="size-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={handleEnhance}
                  className="inline-flex items-center gap-2 border border-border bg-background rounded-lg px-6 py-3 font-semibold text-sm hover:bg-secondary transition-colors min-h-[44px]"
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

            {/* Right: Detailed Resume Preview Card */}
            <div className="hidden lg:block">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                {/* Card top bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <User className="size-4 text-gray-400 dark:text-gray-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Software Engineer</span>
                    <span className="bg-green-100 text-green-700 rounded-full text-xs px-2.5 py-0.5 font-semibold">
                      ATS Score 98%
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-primary border-b-2 border-primary pb-0.5">Preview</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">Suggestions <span className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">12</span></span>
                    <span className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1">Download <ChevronDown className="size-3" /></span>
                  </div>
                </div>

                {/* Card body — two panels */}
                <div className="flex divide-x divide-gray-100 dark:divide-gray-700/50">
                  {/* Left: AI Suggestions */}
                  <div className="w-[200px] shrink-0 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI Suggestions</span>
                      <span className="bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-px font-bold">12</span>
                    </div>
                    {[
                      { label: 'Improve Impact', sub: 'Add more impact to your bullet points.', color: 'text-green-500' },
                      { label: 'Quantify Results', sub: 'Add metrics to showcase your achievements.', color: 'text-blue-400' },
                      { label: 'Keyword Match', sub: 'Great match with job description.', color: 'text-blue-400' },
                      { label: 'Skills Enhancement', sub: 'Add in-demand skills for this role.', color: 'text-green-500' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-start gap-2">
                        <CheckCircle2 className={`size-4 shrink-0 mt-0.5 ${s.color}`} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{s.label}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{s.sub}</p>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      View All Suggestions →
                    </button>
                  </div>

                  {/* Right: Resume content */}
                  <div className="flex-1 p-4 space-y-3 text-[11px]">
                    <div>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">Alex Johnson</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Software Engineer</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">alex.johnson@email.com · (555) 123-4567 · San Francisco, CA · linkedin.com/in/alexjohnson</p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 mb-1 border-b border-gray-200 dark:border-gray-700/50 pb-0.5">Professional Summary</p>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">Results-driven software engineer with 5+ years of experience building scalable web applications. Passionate about clean code, user experience, and delivering impactful solutions.</p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 mb-1 border-b border-gray-200 dark:border-gray-700/50 pb-0.5">Experience</p>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200">Senior Software Engineer</p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-500">2021 - Present</p>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 mb-1">Tech Corp</p>
                      <ul className="space-y-0.5 pl-2">
                        {[
                          'Developed and maintained scalable web applications serving 100K+ users',
                          'Improved application performance by 40% through code optimization',
                          'Led a team of 4 engineers and mentored junior developers',
                          'Implemented CI/CD pipelines reducing deployment time by 60%',
                        ].map((bullet) => (
                          <li key={bullet} className="text-[9px] text-gray-500 dark:text-gray-500 flex gap-1">
                            <span className="shrink-0">·</span>{bullet}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 mb-1 border-b border-gray-200 dark:border-gray-700/50 pb-0.5">Education</p>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200">Bachelor of Science in Computer Science</p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-500">2017 - 2021</p>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500">University of California, Berkeley</p>
                    </div>
                  </div>
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
