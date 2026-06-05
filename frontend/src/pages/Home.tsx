import { FileText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ResumeUploader from '@/components/ResumeUploader'
import { useAuth } from '@/contexts/AuthContext'
import type { ResumeSchema } from '@/types/resume'

const FEATURE_CHIPS = [
  '✦ AI ENRICHMENT',
  '✦ JD TAILORING',
  '✦ ATS OPTIMIZATION',
  '✦ STYLE DETECTION',
  '✦ LIVE PREVIEW',
  '✦ PDF & DOCX EXPORT',
  '✦ ONE-CLICK DOWNLOAD',
  '✦ POWERED BY CLAUDE',
]

export default function Home() {
  const { user, loading, isGuest, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handleParsed = (resume: ResumeSchema) => {
    navigate('/editor', { state: { resume } })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="shrink-0 border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 bg-primary rounded flex items-center justify-center">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <span
            className="font-bold text-sm tracking-widest uppercase text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Resume AI
          </span>
        </div>

        {/* Auth area */}
        {!loading && (
          isGuest ? (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-xs font-bold uppercase tracking-wider text-primary border border-primary px-4 py-1.5 hover:bg-primary/10 transition-colors"
            >
              Sign up to save resumes
            </button>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.email && (
                <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[200px]">
                  {user.email}
                </span>
              )}
              <button
                type="button"
                onClick={signOut}
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : null
        )}
      </nav>

      {/* Hero */}
      <main className="flex-1 px-6 pt-10">
        <div className="w-full max-w-2xl mx-auto">

          {/* Headline + Subtitle */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 border border-primary/40 rounded-full px-4 py-1.5 text-xs text-primary uppercase tracking-widest">
              <Sparkles className="size-3.5" />
              AI-powered resume builder
            </div>
            <h1
              className="text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-none mt-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="block text-foreground uppercase">Your Resume.</span>
              <span className="block text-primary uppercase">Elevated.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-4">
              AI-powered resume enrichment, tailoring, and export — in seconds.
            </p>
          </div>

          {/* Feature chips — always 2 columns */}
          <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto mt-8">
            {FEATURE_CHIPS.map((chip) => (
              <div
                key={chip}
                className="flex items-center border border-primary/60 bg-background px-3 py-2 text-xs text-primary uppercase font-medium tracking-wider rounded-lg whitespace-nowrap"
              >
                {chip}
              </div>
            ))}
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

          <p className="text-center text-xs text-muted-foreground mt-4">
            Your data stays in your browser session and is never stored.
          </p>
        </div>
      </main>
    </div>
  )
}
