import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function ResumeUploader({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      role="button"
      tabIndex={0}
      aria-label="Upload resume"
      className={cn(
        'relative rounded-2xl border-2 border-dashed p-14 text-center transition-colors cursor-pointer select-none',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/40',
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
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="sr-only"
        onChange={onChange}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="size-12 animate-spin text-primary" />
          <div>
            <p className="font-medium text-foreground">Parsing with Claude AI…</p>
            <p className="text-sm mt-1">Extracting your resume data</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {dragging ? (
              <FileText className="size-8 text-primary" />
            ) : (
              <Upload className="size-8 text-primary" />
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {dragging ? 'Drop to upload' : 'Drop your resume here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF or DOCX · up to 10 MB
            </p>
          </div>
          <Button variant="outline" size="sm" className="mt-1 pointer-events-none">
            Browse files
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-5 text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  )
}
