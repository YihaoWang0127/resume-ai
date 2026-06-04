import { useRef, useState, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { parseResume } from '@/services/api'
import type { ResumeSchema } from '@/types/resume'
import { cn } from '@/lib/utils'

interface Props {
  onParsed: (resume: ResumeSchema) => void
}

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

const PROGRESS_MESSAGES = [
  'Extracting text from your resume...',
  'Identifying your experience and skills...',
  'Structuring your information...',
  'Almost ready...',
]

export default function ResumeUploader({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading) return
    setMsgIndex(0)
    setVisible(true)
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % PROGRESS_MESSAGES.length)
        setVisible(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [loading])

  const process = async (file: File) => {
    if (!ALLOWED.has(file.type)) {
      setError('Please upload a PDF or DOCX file.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const resume = await parseResume(file)
      onParsed(resume)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume.')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) process(file)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) process(file)
    e.target.value = ''
  }

  return (
    <div
      aria-label="Upload resume"
      className={cn(
        'relative w-full max-w-lg min-h-[180px] mx-auto',
        'flex flex-col items-center justify-center gap-3',
        'bg-card border border-dashed rounded-xl px-6 py-5',
        'transition-all cursor-pointer select-none',
        error
          ? 'border-red-500'
          : dragging
          ? 'border-primary border-solid bg-primary/5'
          : 'border-[#333] hover:border-primary hover:border-solid',
        loading && 'pointer-events-none',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !loading && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !loading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="sr-only"
        onChange={onChange}
      />

      {loading ? (
        /* Loading state */
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground uppercase tracking-wide">
              Parsing with Claude AI
            </p>
            <p
              className="text-xs mt-1 text-muted-foreground transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {PROGRESS_MESSAGES[msgIndex]}
            </p>
          </div>
        </div>
      ) : (
        /* Default / drag state */
        <div className="flex flex-col items-center gap-3 w-full text-center">
          <Upload className="size-6 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">
              {dragging ? 'Drop to upload' : 'Drag & drop your resume'}
            </p>
            <p className="text-xs text-muted-foreground">PDF or DOCX, up to 10MB</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Browse button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            className="w-full bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse Files
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 font-medium text-center">{error}</p>
      )}
    </div>
  )
}
