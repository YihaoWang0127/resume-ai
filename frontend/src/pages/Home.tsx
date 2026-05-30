import { useState } from 'react'
import { FileText, Sparkles, Wand2 } from 'lucide-react'
import ResumeUploader from '@/components/ResumeUploader'
import ResumeEditor from '@/components/ResumeEditor'
import type { ResumeSchema } from '@/types/resume'

export default function Home() {
  const [resume, setResume] = useState<ResumeSchema | null>(null)

  if (resume) {
    return <ResumeEditor initialResume={resume} onBack={() => setResume(null)} />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Resume AI</span>
        </div>
        <span className="text-xs text-muted-foreground">Powered by Claude</span>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-10">
          {/* Headline */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-muted rounded-full px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              AI-powered resume builder
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Your resume,{' '}
              <span className="text-primary">elevated by AI</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Upload your PDF or DOCX. Claude parses it, enriches every bullet, and tailors it to any job in seconds.
            </p>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Wand2, text: 'AI-powered enrichment' },
              { icon: Sparkles, text: 'Job description tailoring' },
              { icon: FileText, text: 'One-click PDF export' },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2 bg-muted/60 border border-border rounded-full px-4 py-1.5 text-sm"
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>

          {/* Uploader */}
          <ResumeUploader onParsed={setResume} />

          <p className="text-center text-xs text-muted-foreground">
            Your data stays in your browser session and is never stored.
          </p>
        </div>
      </main>
    </div>
  )
}
