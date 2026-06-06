import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResumeUploader from '@/components/ResumeUploader'
import type { ResumeSchema } from '@/types/resume'

// Mock the whole api module — tests never hit the network
vi.mock('@/services/api', () => ({
  parseResume: vi.fn(),
}))

import { parseResume } from '@/services/api'
const mockParseResume = vi.mocked(parseResume)

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Engineer',
  experience: [],
  education: [],
  skills: [],
}

function makePdfFile(name = 'resume.pdf') {
  return new File(['%PDF-1.4 fake'], name, { type: 'application/pdf' })
}

function makeDocxFile(name = 'resume.docx') {
  return new File(['PK fake'], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('No file input found')
  return input
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResumeUploader', () => {
  it('renders drop zone text', () => {
    render(<ResumeUploader onParsed={vi.fn()} />)
    expect(screen.getByText('Drag & drop your resume')).toBeInTheDocument()
  })

  it('renders browse files button', () => {
    render(<ResumeUploader onParsed={vi.fn()} />)
    expect(screen.getByText('Browse Files')).toBeInTheDocument()
  })

  it('renders file type and size hint', () => {
    render(<ResumeUploader onParsed={vi.fn()} />)
    expect(screen.getByText(/PDF or DOCX/i)).toBeInTheDocument()
  })

  it('accepts a PDF file and calls onParsed after Upload Now', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    mockParseResume.mockResolvedValue(mockResume)

    const { container } = render(<ResumeUploader onParsed={onParsed} />)
    await user.upload(getFileInput(container), makePdfFile())
    await user.click(screen.getByText('Upload Now →'))

    await waitFor(() => expect(onParsed).toHaveBeenCalledWith(mockResume))
    expect(mockParseResume).toHaveBeenCalledTimes(1)
  })

  it('accepts a DOCX file and calls onParsed after Upload Now', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    mockParseResume.mockResolvedValue(mockResume)

    const { container } = render(<ResumeUploader onParsed={onParsed} />)
    await user.upload(getFileInput(container), makeDocxFile())
    await user.click(screen.getByText('Upload Now →'))

    await waitFor(() => expect(onParsed).toHaveBeenCalledWith(mockResume))
  })

  it('rejects an invalid file format and shows error message', async () => {
    // userEvent.upload respects the input's accept attribute by default (v14),
    // so a .txt file gets silently filtered and onChange never fires.
    // Use fireEvent.change with explicitly set files to bypass the filter.
    const { container } = render(<ResumeUploader onParsed={vi.fn()} />)
    const txtFile = new File(['text'], 'resume.txt', { type: 'text/plain' })
    const input = getFileInput(container)

    Object.defineProperty(input, 'files', { value: [txtFile], configurable: true })
    fireEvent.change(input)

    await waitFor(() =>
      expect(screen.getByText('Please upload a PDF or DOCX file.')).toBeInTheDocument(),
    )
    expect(mockParseResume).not.toHaveBeenCalled()
  })

  it('shows "Parsing with Claude AI" heading while uploading', async () => {
    // Never resolves so loading state stays visible
    mockParseResume.mockImplementation(() => new Promise(() => {}))

    const user = userEvent.setup()
    const { container } = render(<ResumeUploader onParsed={vi.fn()} />)
    await user.upload(getFileInput(container), makePdfFile())
    await user.click(screen.getByText('Upload Now →'))

    await waitFor(() =>
      expect(screen.getByText('Parsing with Claude AI')).toBeInTheDocument(),
    )
  })

  it('shows first progress hint while loading', async () => {
    mockParseResume.mockImplementation(() => new Promise(() => {}))

    const user = userEvent.setup()
    const { container } = render(<ResumeUploader onParsed={vi.fn()} />)
    await user.upload(getFileInput(container), makePdfFile())
    await user.click(screen.getByText('Upload Now →'))

    await waitFor(() =>
      expect(screen.getByText('Extracting text from your resume...')).toBeInTheDocument(),
    )
  })

  it('shows generic error message when API call fails', async () => {
    mockParseResume.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    const { container } = render(<ResumeUploader onParsed={vi.fn()} />)
    await user.upload(getFileInput(container), makePdfFile())
    await user.click(screen.getByText('Upload Now →'))

    await waitFor(() =>
      expect(screen.getByText('Upload failed. Please try again.')).toBeInTheDocument(),
    )
  })

  it('does not call parseResume when no file is selected', () => {
    render(<ResumeUploader onParsed={vi.fn()} />)
    expect(mockParseResume).not.toHaveBeenCalled()
  })
})
