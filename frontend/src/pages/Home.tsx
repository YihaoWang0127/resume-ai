import { useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import ResumeUploader from '@/components/ResumeUploader'
import ResumeEditor from '@/components/ResumeEditor'
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
  const [resume, setResume] = useState<ResumeSchema | null>(null)

  if (resume) {
    return <ResumeEditor initialResume={resume} onBack={() => setResume(null)} />
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
        <span className="text-xs text-muted-foreground uppercase tracking-widest">
          Powered by Claude
        </span>
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

          {/* Uploader */}
          <div className="mt-8">
            <ResumeUploader onParsed={setResume} />
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Your data stays in your browser session and is never stored.
          </p>
        </div>
      </main>
    </div>
  )
}
