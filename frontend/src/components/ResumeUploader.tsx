import { useRef, useState, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Upload, FileText } from 'lucide-react'
import { isAxiosError, isCancel } from 'axios'
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ResumeUploader({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState<string | null>(null)
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!uploading) return
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
  }, [uploading])

  const resetAll = () => {
    setSelectedFile(null)
    setError(null)
    setWarning(null)
    setCancelMessage(null)
  }

  const selectFile = (file: File) => {
    if (!ALLOWED.has(file.type)) {
      setError('Please upload a PDF or DOCX file.')
      setSelectedFile(null)
      return
    }
    setError(null)
    setWarning(null)
    setCancelMessage(null)
    setSelectedFile(file)
  }

  const upload = async () => {
    if (!selectedFile) return
    const controller = new AbortController()
    setAbortController(controller)
    setUploading(true)
    setCancelMessage(null)
    try {
      const resume = await parseResume(selectedFile, controller.signal)
      onParsed(resume)
    } catch (err) {
      if (isCancel(err)) {
        setCancelMessage('Upload cancelled. Try again?')
        return
      }
      setSelectedFile(null)
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail as string | undefined
        const status = err.response?.status
        if (status === 400) {
          setWarning(detail ?? 'This does not appear to be a resume.')
        } else if (status === 422) {
          setWarning(detail ?? 'Invalid file format. Please upload a PDF or DOCX resume.')
        } else if (status === 415) {
          setWarning(detail ?? 'Unsupported file type. Please upload PDF or DOCX only.')
        } else if (status === 413) {
          setError(detail ?? 'File too large. Please upload a file under 10MB.')
        } else if (status === 500 || status === 502) {
          setError(detail ?? 'Something went wrong. Please try again.')
        } else {
          setError(detail ?? 'Upload failed. Please try again.')
        }
      } else {
        setError('Upload failed. Please try again.')
      }
    } finally {
      setUploading(false)
      setAbortController(null)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (uploading) return
    const file = e.dataTransfer.files[0]
    if (file) selectFile(file)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) selectFile(file)
    e.target.value = ''
  }

  const isDefaultState = !uploading && !selectedFile && !warning && !error

  const ext = selectedFile?.name.split('.').pop()?.toUpperCase() ?? ''

  return (
    <div
      aria-label="Upload resume"
      className={cn(
        'relative w-full max-w-lg min-h-[180px] mx-auto',
        'flex flex-col items-center justify-center gap-3',
        'bg-[#111111] border border-dashed rounded-xl px-6 py-5',
        'transition-all select-none',
        uploading
          ? 'border-primary pointer-events-none'
          : selectedFile
          ? 'border-primary cursor-default'
          : warning
          ? 'border-amber-500 cursor-default'
          : error
          ? 'border-red-500 cursor-default'
          : dragging
          ? 'border-primary border-solid bg-primary/5 cursor-pointer'
          : 'border-[#333] hover:border-primary hover:border-solid cursor-pointer',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!uploading) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => isDefaultState && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && isDefaultState && inputRef.current?.click()}
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

      {uploading ? (
        /* Uploading state */
        <div className="flex flex-col items-center gap-3 text-center w-full">
          <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary animate-pulse rounded-full" />
          </div>
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
          <button
            type="button"
            onClick={() => abortController?.abort()}
            className="text-xs text-red-400 border border-red-500 rounded px-3 py-1 hover:bg-red-500/10 transition-colors pointer-events-auto"
          >
            Cancel
          </button>
        </div>
      ) : selectedFile ? (
        /* Preview card state */
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex items-center gap-3 w-full">
            <FileText className="size-8 text-primary shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} · {ext}
              </p>
            </div>
          </div>
          {cancelMessage && (
            <p className="text-xs text-muted-foreground text-center">{cancelMessage}</p>
          )}
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                resetAll()
                inputRef.current?.click()
              }}
              className="flex-1 text-sm font-bold py-2 rounded-lg border border-primary text-primary bg-black hover:bg-primary/10 transition-colors"
            >
              Change File
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                upload()
              }}
              className="flex-1 text-sm font-bold py-2 rounded-lg bg-primary text-black hover:bg-primary/90 transition-colors"
            >
              Upload Now →
            </button>
          </div>
        </div>
      ) : warning ? (
        /* Not-a-resume warning state */
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-amber-400">⚠️ {warning}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              resetAll()
              inputRef.current?.click()
            }}
            className="text-xs text-amber-400 border border-amber-500 rounded px-3 py-1 hover:bg-amber-500/10 transition-colors"
          >
            Try a different file
          </button>
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

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

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
