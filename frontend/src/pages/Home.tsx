import { useState, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ResumeUploader from '@/components/ResumeUploader'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import type { ResumeSchema } from '@/types/resume'

const FEATURES = [
  { label: 'AI ENRICHMENT', desc: 'AI rewrites every bullet point with strong action verbs, quantified impact, and ATS-friendly keywords.' },
  { label: 'JD TAILORING', desc: "Paste any job description and AI rewrites your resume to match the role's keywords and requirements." },
  { label: 'ATS OPTIMIZATION', desc: 'Automatically injects relevant keywords so your resume passes Applicant Tracking Systems.' },
  { label: 'STYLE DETECTION', desc: 'AI detects your industry (Tech, Finance, Creative, Healthcare) and applies matching typography.' },
  { label: 'LIVE PREVIEW', desc: 'See your resume update in real-time as you edit, with 5 industry style presets to switch between.' },
  { label: 'PDF & DOCX EXPORT', desc: 'Export your polished resume as PDF or Word document with native Save As dialog.' },
  { label: 'ONE-CLICK DOWNLOAD', desc: 'Download your resume or cover letter instantly in your preferred format.' },
  { label: 'POWERED BY CLAUDE', desc: "Built on Anthropic's Claude AI — the most capable AI for nuanced, professional writing." },
]

export default function Home() {
  const { user, loading, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expandedFeature === null) return
    const handler = (e: MouseEvent) => {
      if (chipsRef.current && !chipsRef.current.contains(e.target as Node)) {
        setExpandedFeature(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expandedFeature])

  const handleParsed = (resume: ResumeSchema) => {
    navigate('/editor', { state: { resume, from: '/' } })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <main className="relative flex-1 px-6 pt-10 overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-220px] -translate-x-1/2 w-[760px] h-[760px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute right-[-100px] top-[160px] w-[320px] h-[320px] rounded-full bg-primary/[0.06] blur-[100px]" />
        </div>

        <div className="relative w-full max-w-2xl mx-auto">

          {/* Headline + Subtitle */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 border border-primary/40 rounded-full px-4 py-1.5 text-xs text-primary uppercase tracking-widest">
              <Sparkles className="size-3.5" />
              AI-powered resume builder
            </div>
            <h1
              className="text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-none mt-4"
            >
              <span className="block text-foreground uppercase">Your Resume.</span>
              <span className="block text-primary uppercase">Enhanced by AI.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-4">
              AI-powered resume enrichment, tailoring, and export — in seconds.
            </p>
          </div>

          {/* Feature chips — always 2 columns, click to expand */}
          <div ref={chipsRef} className="grid grid-cols-2 gap-2 max-w-2xl mx-auto mt-8">
            {FEATURES.map((feature, i) => {
              const isLeft = i % 2 === 0
              const row = Math.floor(i / 2)
              const popupVClass = row === 0
                ? 'md:top-0'
                : row === 1
                ? 'md:top-[-25%]'
                : row === 2
                ? 'md:bottom-[-25%]'
                : 'md:bottom-0'
              const arrowV: React.CSSProperties = row < 2 ? { top: '10px' } : { bottom: '10px' }
              return (
                <div key={feature.label} className="relative">
                  <button
                    onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
                    className="w-full flex items-center border border-primary/60 bg-background px-3 py-2 text-xs text-primary uppercase font-medium tracking-wider rounded-lg whitespace-nowrap hover:bg-primary/5 transition-colors"
                  >
                    ✦ {feature.label}
                  </button>
                  {expandedFeature === i && (
                    <>
                      {/* Mobile backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/30 md:hidden"
                        onClick={() => setExpandedFeature(null)}
                      />
                      <div
                        style={{
                          animation: isLeft ? 'chipFadeInLeft 0.15s ease' : 'chipFadeInRight 0.15s ease',
                        }}
                        className={`fixed inset-x-4 bottom-4 z-50 max-w-lg mx-auto max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm text-primary shadow-dropdown md:absolute md:inset-x-auto md:bottom-auto md:z-10 md:mx-0 md:w-56 md:max-h-none md:max-w-none md:overflow-visible md:p-3 ${popupVClass} ${
                          isLeft ? 'md:right-full md:mr-1' : 'md:left-full md:ml-1'
                        }`}
                      >
                        <div className="hidden md:block">
                          {isLeft ? (
                            <>
                              <div style={{ position: 'absolute', right: '-9px', ...arrowV, width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '8px solid hsl(var(--border))' }} />
                              <div style={{ position: 'absolute', right: '-7px', ...arrowV, width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '8px solid hsl(var(--card))' }} />
                            </>
                          ) : (
                            <>
                              <div style={{ position: 'absolute', left: '-9px', ...arrowV, width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '8px solid hsl(var(--border))' }} />
                              <div style={{ position: 'absolute', left: '-7px', ...arrowV, width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '8px solid hsl(var(--card))' }} />
                            </>
                          )}
                        </div>
                        {feature.desc}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Uploader — intercepted when no session */}
          <div className="relative mt-8">
            <ResumeUploader onParsed={handleParsed} />
            {!loading && !user && (
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={openAuthModal}
                onDragOver={(e) => { e.preventDefault(); openAuthModal() }}
              />
            )}
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

      <style>{`@keyframes chipFadeInLeft { from { opacity: 0; transform: translateX(4px); } to { opacity: 1; transform: translateX(0); } } @keyframes chipFadeInRight { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  )
}
