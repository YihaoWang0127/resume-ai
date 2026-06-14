import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/resumes', () => ({ listResumes: vi.fn(), deleteResume: vi.fn(), updateAtsScore: vi.fn() }))
vi.mock('@/services/coverLetters', () => ({ listCoverLetters: vi.fn(), deleteCoverLetter: vi.fn() }))
vi.mock('@/services/api', () => ({ exportResume: vi.fn(), exportCoverLetter: vi.fn(), scoreATS: vi.fn() }))
vi.mock('@/services/aiUsage', () => ({ getAiUsageStats: vi.fn() }))
vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }))
vi.mock('@/components/ResumeUploader', () => ({
  default: ({ onParsed }: { onParsed: (r: ResumeSchema) => void }) => (
    <div data-testid="resume-uploader">
      <button onClick={() => onParsed(mockResume)}>Upload</button>
    </div>
  ),
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext'
import { listResumes, deleteResume, updateAtsScore } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter } from '@/services/coverLetters'
import { scoreATS } from '@/services/api'
import { getAiUsageStats } from '@/services/aiUsage'
import Dashboard from '@/pages/Dashboard'

const mockUseAuth = vi.mocked(useAuth)
const mockListResumes = vi.mocked(listResumes)
const mockDeleteResume = vi.mocked(deleteResume)
const mockUpdateAtsScore = vi.mocked(updateAtsScore)
const mockListCoverLetters = vi.mocked(listCoverLetters)
const mockDeleteCoverLetter = vi.mocked(deleteCoverLetter)
const mockScoreATS = vi.mocked(scoreATS)
const mockGetAiUsageStats = vi.mocked(getAiUsageStats)

// Navigate mock — capture calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Engineer',
  experience: [],
  education: [],
  skills: [],
  detectedIndustry: 'tech',
}

const savedResume1 = {
  id: 'r1',
  user_id: 'u1',
  title: 'Software Engineer Resume',
  resume_data: mockResume,
  detected_industry: 'tech',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
}

const savedResume2 = {
  id: 'r2',
  user_id: 'u1',
  title: 'Product Manager Resume',
  resume_data: mockResume,
  detected_industry: 'finance',
  created_at: '2024-01-10T00:00:00Z',
  updated_at: '2024-01-20T00:00:00Z',
}

const savedCoverLetter1 = {
  id: 'cl1',
  user_id: 'u1',
  resume_id: 'r1',
  title: 'Cover Letter for Stripe',
  content: 'I am excited to apply...',
  company_name: 'Stripe',
  job_description: 'Senior engineer...',
  tone: 'professional',
  created_at: '2024-01-05T00:00:00Z',
  updated_at: '2024-01-18T00:00:00Z',
}

const defaultAuth = {
  user: { id: 'u1', email: 'user@test.com', is_anonymous: false },
  session: null,
  loading: false,
  isGuest: false,
  showAuthModal: false,
  openAuthModal: vi.fn(),
  closeAuthModal: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInAsGuest: vi.fn(),
  signOut: vi.fn(),
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

const emptyUsageStats = {
  totalCalls: 0,
  callsThisMonth: 0,
  callsByAction: { parse: 0, enrich: 0, tailor: 0, cover_letter: 0, ats_score: 0 },
  recent: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(defaultAuth as any)
  mockListResumes.mockResolvedValue([savedResume1, savedResume2] as any)
  mockListCoverLetters.mockResolvedValue([savedCoverLetter1] as any)
  mockDeleteResume.mockResolvedValue(undefined)
  mockDeleteCoverLetter.mockResolvedValue(undefined)
  mockUpdateAtsScore.mockResolvedValue({} as any)
  mockGetAiUsageStats.mockResolvedValue({ ...emptyUsageStats, callsThisMonth: 3 } as any)
})

// Switches to the Cover Letters tab and waits for its content to render
async function goToCoverLettersTab(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('button', { name: /cover letters/i })).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /cover letters/i }))
}

// Switches to the ATS Score tab and waits for its content to render
async function goToAtsScoreTab(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('button', { name: /ats score/i })).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /ats score/i }))
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('Dashboard — rendering', () => {
  it('renders the "My Resumes" heading', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
    )
  })

  it('renders resume cards from listResumes data', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())
    expect(screen.getByText('Product Manager Resume')).toBeInTheDocument()
  })

  it('shows the New Resume card at the end of the grid', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('New Resume')).toBeInTheDocument())

    const cards = screen.getAllByRole('button').filter(b => b.tagName === 'BUTTON')
    const newResumeCard = cards.find(b => b.textContent?.includes('New Resume'))
    expect(newResumeCard).toBeInTheDocument()
  })

  it('shows skeleton placeholders while fetching', () => {
    mockListResumes.mockReturnValue(new Promise(() => {}) as any)
    renderDashboard()
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders the "My Cover Letters" heading', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    )
  })

  it('renders cover letter cards from listCoverLetters data', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() =>
      expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument()
    )
    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('shows the New Cover Letter card', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() =>
      expect(screen.getByText('New Cover Letter')).toBeInTheDocument()
    )
  })

  it('shows count badges on the Resumes and Cover Letters tabs', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())
    // Resume tab badge: 2, cover letter tab badge: 1
    const resumesTab = screen.getByRole('button', { name: /resumes/i })
    const coverLettersTab = screen.getByRole('button', { name: /cover letters/i })
    expect(resumesTab.textContent).toContain('2')
    expect(coverLettersTab.textContent).toContain('1')
  })
})

// ── stats bar ─────────────────────────────────────────────────────────────────

describe('Dashboard — stats bar', () => {
  it('shows resume count, cover letter count, and AI calls this month', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())

    expect(screen.getAllByText('Resumes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cover Letters').length).toBeGreaterThan(0)
    expect(screen.getByText('Avg ATS Score')).toBeInTheDocument()
    expect(screen.getByText('AI Calls This Month')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows a placeholder for Avg ATS Score when no resume has been scored', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('computes Avg ATS Score from resumes that have a score', async () => {
    mockListResumes.mockResolvedValue([
      { ...savedResume1, ats_score: 80 },
      { ...savedResume2, ats_score: 60 },
    ] as any)
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('shows skeleton placeholders in the stats bar while fetching', () => {
    mockListResumes.mockReturnValue(new Promise(() => {}) as any)
    renderDashboard()
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })
})

// ── tab switching ────────────────────────────────────────────────────────────

describe('Dashboard — tab switching', () => {
  it('shows the Resumes tab by default', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('heading', { name: /my cover letters/i })).not.toBeInTheDocument()
  })

  it('switches to the Cover Letters tab and back to Resumes', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)

    expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /my resumes/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^resumes/i }))
    expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
  })

  it('switches to the ATS Score tab', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    expect(screen.getByRole('heading', { name: /ats score/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /my resumes/i })).not.toBeInTheDocument()
  })

  it('shows resume cards with "Check ATS Score" buttons on the ATS Score tab', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /check ats score/i }).length).toBe(2)
    expect(screen.getAllByText('Not checked yet').length).toBe(2)
  })

  it('shows the saved ATS score on the ATS Score tab when a resume has one', async () => {
    mockListResumes.mockResolvedValue([
      { ...savedResume1, ats_score: 85, ats_score_updated_at: '2024-02-01T00:00:00Z' },
      savedResume2,
    ] as any)
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    expect(screen.getByText('Score: 85/100')).toBeInTheDocument()
  })
})

// ── ATS check modal ──────────────────────────────────────────────────────────

describe('Dashboard — ATS check modal', () => {
  it('opens the ATS check modal when "Check ATS Score" is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    await user.click(screen.getAllByRole('button', { name: /check ats score/i })[0])

    expect(screen.getByRole('heading', { name: /check ats score/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/paste the job description here/i)).toBeInTheDocument()
  })

  it('runs the ATS check, shows the result, and persists the score', async () => {
    mockScoreATS.mockResolvedValue({
      overallScore: 78,
      matchedKeywords: ['React', 'TypeScript'],
      missingKeywords: ['GraphQL'],
      suggestions: ['Add more metrics'],
      summary: 'Solid match overall.',
    } as any)

    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    await user.click(screen.getAllByRole('button', { name: /check ats score/i })[0])
    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'We need a React engineer')
    await user.click(screen.getByRole('button', { name: /run check/i }))

    await waitFor(() => expect(screen.getByText('78/100')).toBeInTheDocument())
    expect(screen.getByText('Solid match overall.')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('GraphQL')).toBeInTheDocument()
    expect(screen.getByText('Add more metrics')).toBeInTheDocument()

    expect(mockScoreATS).toHaveBeenCalledWith(savedResume1.resume_data, 'We need a React engineer')
    await waitFor(() =>
      expect(mockUpdateAtsScore).toHaveBeenCalledWith(savedResume1.id, 78)
    )
  })

  it('shows an error message when the ATS check fails', async () => {
    mockScoreATS.mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    await user.click(screen.getAllByRole('button', { name: /check ats score/i })[0])
    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'job description')
    await user.click(screen.getByRole('button', { name: /run check/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to run ats check/i)).toBeInTheDocument()
    )
    expect(mockUpdateAtsScore).not.toHaveBeenCalled()
  })

  it('closes the ATS check modal', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    await user.click(screen.getAllByRole('button', { name: /check ats score/i })[0])
    expect(screen.getByRole('heading', { name: /check ats score/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('heading', { name: /check ats score/i })).not.toBeInTheDocument()
  })

  it('disables the Run Check button until a job description is entered', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToAtsScoreTab(user)

    await user.click(screen.getAllByRole('button', { name: /check ats score/i })[0])

    expect(screen.getByRole('button', { name: /run check/i })).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'job description')
    expect(screen.getByRole('button', { name: /run check/i })).not.toBeDisabled()
  })
})

// ── navigation ────────────────────────────────────────────────────────────────

describe('Dashboard — navigation', () => {
  it('Edit button navigates to /editor with resume data and from:/dashboard', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0))

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(mockNavigate).toHaveBeenCalledWith('/editor', {
      state: {
        resume: savedResume1.resume_data,
        resumeId: savedResume1.id,
        from: '/dashboard',
      },
    })
  })

  it('Edit button on cover letter navigates to /cover-letter/:id', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/cover-letter/cl1', { state: { from: '/dashboard' } })
  })

  it('redirects guest users to home', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, isGuest: true } as any)
    renderDashboard()
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to home', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, user: null } as any)
    renderDashboard()
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })
})

// ── delete flow (resumes) ─────────────────────────────────────────────────────

const getCardDeleteButtons = () =>
  Array.from(document.querySelectorAll<HTMLElement>('button[class*="red-500"]'))
const getModalConfirmButton = () =>
  document.querySelector<HTMLElement>('button[class*="bg-red-600"]')!

describe('Dashboard — delete flow', () => {
  it('clicking Delete shows the confirmation modal', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0))

    await user.click(getCardDeleteButtons()[0])

    expect(screen.getByRole('heading', { name: /delete resume/i })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('confirms deletion and removes card from the list', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0))

    await user.click(getCardDeleteButtons()[0])
    await user.click(getModalConfirmButton())

    await waitFor(() => expect(mockDeleteResume).toHaveBeenCalledWith(savedResume1.id))
    await waitFor(() =>
      expect(screen.queryByText('Software Engineer Resume')).not.toBeInTheDocument()
    )
  })

  it('Cancel button hides the confirmation modal without deleting', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0))

    await user.click(getCardDeleteButtons()[0])
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('heading', { name: /delete resume/i })).not.toBeInTheDocument()
    expect(mockDeleteResume).not.toHaveBeenCalled()
  })
})

// ── delete flow (cover letters) ───────────────────────────────────────────────

describe('Dashboard — cover letter delete flow', () => {
  it('clicking delete on a cover letter shows the cover letter confirmation modal', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    await user.click(getCardDeleteButtons()[0])

    expect(screen.getByRole('heading', { name: /delete cover letter/i })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('confirms cover letter deletion and removes card from the list', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    await user.click(getCardDeleteButtons()[0])
    await user.click(getModalConfirmButton())

    await waitFor(() => expect(mockDeleteCoverLetter).toHaveBeenCalledWith(savedCoverLetter1.id))
    await waitFor(() =>
      expect(screen.queryByText('Cover Letter for Stripe')).not.toBeInTheDocument()
    )
  })
})

// ── export dropdown ───────────────────────────────────────────────────────────

describe('Dashboard — export dropdown', () => {
  it('Export button opens a dropdown with PDF and Word options', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /export/i }).length).toBeGreaterThan(0))

    await user.click(screen.getAllByRole('button', { name: /export/i })[0])

    expect(screen.getByText('Save as PDF')).toBeInTheDocument()
    expect(screen.getByText('Save as Word (.docx)')).toBeInTheDocument()
  })

  it('cover letter Export button opens a dropdown with PDF, DOCX, TXT options', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await goToCoverLettersTab(user)
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /export/i }))

    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('DOCX')).toBeInTheDocument()
    expect(screen.getByText('TXT')).toBeInTheDocument()
  })
})
