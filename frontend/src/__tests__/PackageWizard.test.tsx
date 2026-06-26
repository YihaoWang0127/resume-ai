import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  validateRole: vi.fn().mockResolvedValue({ valid: true, reason: '' }),
  validateJobDescription: vi.fn().mockResolvedValue({ valid: true, reason: '' }),
  tailorResume: vi.fn(),
  generateCoverLetter: vi.fn(),
  scoreATS: vi.fn(),
  exportResume: vi.fn(),
  exportCoverLetter: vi.fn(),
  fromBackend: vi.fn((x) => x),
}))

vi.mock('@/services/resumes', () => ({
  saveResume: vi.fn(),
  listResumes: vi.fn(),
}))

vi.mock('@/services/coverLetters', () => ({
  saveCoverLetter: vi.fn(),
}))

vi.mock('@/components/ResumeUploader', () => ({
  default: ({ onParsed }: { onParsed: (r: unknown) => void }) => (
    <div data-testid="resume-uploader">
      <button type="button" onClick={() => onParsed({ metadata: { fullName: 'Test User' }, summary: '', experience: [], education: [], skills: [] })}>
        Upload
      </button>
    </div>
  ),
}))

vi.mock('@/components/ResumePreview', () => ({
  default: () => <div data-testid="resume-preview" />,
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { validateRole, validateJobDescription } from '@/services/api'
import { listResumes } from '@/services/resumes'
import PackageWizard from '@/components/PackageWizard'
import type { SavedResume } from '@/services/resumes'
import type { ResumeSchema } from '@/types/resume'

const mockValidateRole = vi.mocked(validateRole)
const mockValidateJobDescription = vi.mocked(validateJobDescription)
const mockListResumes = vi.mocked(listResumes)

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockResumeData: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Experienced software engineer',
  experience: [],
  education: [],
  skills: [],
  detectedIndustry: 'tech',
}

const savedResume1: SavedResume = {
  id: 'r1',
  user_id: 'u1',
  title: 'Software Engineer Resume',
  resume_data: mockResumeData,
  detected_industry: 'tech',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
}

const savedResume2: SavedResume = {
  id: 'r2',
  user_id: 'u1',
  title: 'Product Manager Resume',
  resume_data: mockResumeData,
  detected_industry: 'finance',
  created_at: '2024-01-10T00:00:00Z',
  updated_at: '2024-01-20T00:00:00Z',
}

// ── render helper ─────────────────────────────────────────────────────────────

interface RenderProps {
  open?: boolean
  onClose?: () => void
}

function renderWizard({
  open = true,
  onClose = vi.fn(),
}: RenderProps = {}) {
  return render(
    <PackageWizard
      open={open}
      onClose={onClose}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: validation always passes
  mockValidateRole.mockResolvedValue({ valid: true, reason: '' })
  mockValidateJobDescription.mockResolvedValue({ valid: true, reason: '' })
  // Default: listResumes returns two fixtures
  mockListResumes.mockResolvedValue([savedResume1, savedResume2])
})

// ── visibility ────────────────────────────────────────────────────────────────

describe('PackageWizard — visibility', () => {
  it('does not render anything when open=false', () => {
    renderWizard({ open: false })
    expect(screen.queryByText(/create application package/i)).not.toBeInTheDocument()
  })

  it('renders the JD step when open=true', () => {
    renderWizard()
    expect(screen.getByText(/create application package/i)).toBeInTheDocument()
  })
})

// ── JD step rendering ─────────────────────────────────────────────────────────

describe('PackageWizard — JD step', () => {
  it('shows Company Name, Position, and Job Description fields', () => {
    renderWizard()
    expect(screen.getByPlaceholderText(/e\.g\. google/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/software engineer/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/paste the job description here/i)).toBeInTheDocument()
  })

  it('shows two step cards — Job Description (active) and Resume Selection', () => {
    renderWizard()
    expect(screen.getByText('Job Description', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Resume Selection', { selector: 'span' })).toBeInTheDocument()
  })

  it('Next button is disabled when all fields are empty', () => {
    renderWizard()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('Next button is disabled when position validation is invalid', async () => {
    mockValidateRole.mockResolvedValue({ valid: false, reason: 'Not a job title.' })

    vi.useFakeTimers()
    renderWizard()

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. google/i), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), { target: { value: 'xkcd!!' } })
    fireEvent.change(screen.getByPlaceholderText(/paste the job description here/i), { target: { value: 'We need an engineer.' } })

    await act(async () => { vi.advanceTimersByTime(1000) })
    vi.useRealTimers()

    await waitFor(() => expect(mockValidateRole).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('Next button is disabled when JD validation is invalid', async () => {
    mockValidateJobDescription.mockResolvedValue({ valid: false, reason: 'Not a job description.' })

    vi.useFakeTimers()
    renderWizard()

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. google/i), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), { target: { value: 'Software Engineer' } })
    fireEvent.change(screen.getByPlaceholderText(/paste the job description here/i), { target: { value: 'Some random text.' } })

    await act(async () => { vi.advanceTimersByTime(1000) })
    vi.useRealTimers()

    await waitFor(() => expect(mockValidateJobDescription).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('Cancel button calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWizard({ onClose })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Close (X) button calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWizard({ onClose })

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── resume step ───────────────────────────────────────────────────────────────

describe('PackageWizard — resume step', () => {
  /**
   * Fill in the JD form and advance the debounce timers so both validations
   * resolve to valid=true, then click Next.
   */
  async function advanceToResumeStep(user: ReturnType<typeof userEvent.setup>) {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. google/i), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), { target: { value: 'Software Engineer' } })
    fireEvent.change(screen.getByPlaceholderText(/paste the job description here/i), {
      target: { value: 'We are looking for a talented software engineer to join our team.' },
    })

    await act(async () => { vi.advanceTimersByTime(1000) })
    vi.useRealTimers()

    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled())
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/choose a resume/i)).toBeInTheDocument())
  }

  it('shows the resume list on the resume step', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument()
    expect(screen.getByText('Product Manager Resume')).toBeInTheDocument()
  })

  it('shows "Upload New Resume" dashed button', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    expect(screen.getByText(/\+ upload new resume/i)).toBeInTheDocument()
  })

  it('Back button returns to the JD step', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    await user.click(screen.getByRole('button', { name: /back/i }))

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/paste the job description here/i)).toBeInTheDocument()
    )
  })

  it('Generate button is disabled until a resume is selected', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })

  it('Generate button becomes enabled after selecting a resume', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    await user.click(screen.getByText('Software Engineer Resume'))

    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled()
  })

  it('clicking "Upload New Resume" reveals the ResumeUploader', async () => {
    const user = userEvent.setup()
    renderWizard()
    await advanceToResumeStep(user)

    await user.click(screen.getByText(/\+ upload new resume/i))

    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
  })
})
