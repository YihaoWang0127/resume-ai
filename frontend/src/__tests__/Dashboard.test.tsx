import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/resumes', () => ({ listResumes: vi.fn(), deleteResume: vi.fn(), updateAtsScore: vi.fn(), clearAtsScore: vi.fn() }))
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
import { listResumes, deleteResume, updateAtsScore, clearAtsScore } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter } from '@/services/coverLetters'
import { scoreATS } from '@/services/api'
import { getAiUsageStats } from '@/services/aiUsage'
import Dashboard from '@/pages/Dashboard'

const mockUseAuth = vi.mocked(useAuth)
const mockListResumes = vi.mocked(listResumes)
const mockDeleteResume = vi.mocked(deleteResume)
const mockUpdateAtsScore = vi.mocked(updateAtsScore)
const mockClearAtsScore = vi.mocked(clearAtsScore)
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

// ── render helper ─────────────────────────────────────────────────────────────

function renderDashboard(tab?: string) {
  const path = tab ? `/dashboard?tab=${tab}` : '/dashboard'
  return render(
    <MemoryRouter initialEntries={[path]}>
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
  mockClearAtsScore.mockResolvedValue(undefined)
  mockGetAiUsageStats.mockResolvedValue({ ...emptyUsageStats, callsThisMonth: 3 } as any)
})

// ── section helpers ───────────────────────────────────────────────────────────

function getResumesSection() {
  return document.getElementById('resumes')!
}

function getCoverLettersSection() {
  return document.getElementById('cover-letters')!
}

function getAtsSection() {
  return document.getElementById('ats-scores')!
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('Dashboard — rendering', () => {
  it('renders the "My Resumes" heading on the resumes tab', async () => {
    renderDashboard('resumes')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
    )
  })

  it('renders resume cards from listResumes data', async () => {
    renderDashboard('resumes')
    // Resume titles appear in both the Overview table and the My Resumes cards section
    await waitFor(() => expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Product Manager Resume').length).toBeGreaterThan(0)
  })

  it('shows the New Resume card at the end of the grid', async () => {
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getByText('Upload Resume')).toBeInTheDocument())

    const cards = screen.getAllByRole('button').filter(b => b.tagName === 'BUTTON')
    const newResumeCard = cards.find(b => b.textContent?.includes('Upload Resume'))
    expect(newResumeCard).toBeInTheDocument()
  })

  it('shows skeleton placeholders while fetching', () => {
    mockListResumes.mockReturnValue(new Promise(() => {}) as any)
    renderDashboard()
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders the "My Cover Letters" heading on the cover-letters tab', async () => {
    renderDashboard('cover-letters')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    )
  })

  it('renders cover letter cards from listCoverLetters data', async () => {
    renderDashboard('cover-letters')
    // Card heading shows company_name; title field is no longer displayed
    await waitFor(() =>
      expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0)
    )
    expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0)
  })

  it('shows the New Cover Letter card', async () => {
    renderDashboard('cover-letters')
    await waitFor(() =>
      expect(screen.getByText('Generate Cover Letter')).toBeInTheDocument()
    )
  })
})

// ── stats bar ─────────────────────────────────────────────────────────────────

describe('Dashboard — stats bar', () => {
  it('shows resume count, cover letter count, avg ATS score, and AI actions on the overview view', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())

    expect(screen.getByText('Total Resumes')).toBeInTheDocument()
    expect(screen.getByText('Total Cover Letters')).toBeInTheDocument()
    expect(screen.getByText('Avg ATS Score')).toBeInTheDocument()
    expect(screen.getByText('AI Actions Used This Month')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows a placeholder for Avg ATS Score when no resume has been scored', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('computes Avg ATS Score from resumes that have a score', async () => {
    mockListResumes.mockResolvedValue([
      { ...savedResume1, ats_score: 80 },
      { ...savedResume2, ats_score: 60 },
    ] as any)
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('shows skeleton placeholders in the stats bar while fetching', () => {
    mockListResumes.mockReturnValue(new Promise(() => {}) as any)
    renderDashboard()
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('shows stats bar on the resumes tab (all sections always rendered)', async () => {
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument())
    // All sections are always rendered — stats bar is always present
    expect(screen.getByText('Total Resumes')).toBeInTheDocument()
    expect(screen.getByText('Avg ATS Score')).toBeInTheDocument()
  })
})

// ── tab switching ────────────────────────────────────────────────────────────

describe('Dashboard — tab switching', () => {
  it('shows the Overview view by default (Application Overview heading present)', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText('Application Overview')).toBeInTheDocument()
    )
    // All sections are always rendered now — headings for all sections are present
    expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
  })

  it('shows resumes view when tab=resumes', async () => {
    renderDashboard('resumes')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
    )
    // All sections are always rendered — other section headings are also present
    expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    expect(screen.getByText('Application Overview')).toBeInTheDocument()
  })

  it('shows cover letters view when tab=cover-letters', async () => {
    renderDashboard('cover-letters')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    )
    // All sections are always rendered — resumes heading is also present
    expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
  })

  it('shows ATS Score view when tab=ats-scores', async () => {
    renderDashboard('ats-scores')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /ats score/i })).toBeInTheDocument()
    )
    // All sections are always rendered — resumes heading is also present
    expect(screen.getByRole('heading', { name: /my resumes/i })).toBeInTheDocument()
  })

  it('shows only resumes with ats_score in the ATS Score section and a "New ATS Check" card', async () => {
    // Default mock has no ats_score on either resume → neither card appears in ATS section
    renderDashboard('ats-scores')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /ats score/i })).toBeInTheDocument()
    )

    const atsSection = getAtsSection()
    // No scored resumes → no resume cards appear in the ATS grid
    expect(within(atsSection).queryByText('Software Engineer Resume')).not.toBeInTheDocument()
    expect(within(atsSection).queryByText('Product Manager Resume')).not.toBeInTheDocument()
    // The "New ATS Check" dashed card is always present
    expect(screen.getByText('New ATS Check')).toBeInTheDocument()
  })

  it('shows only the scored resume in the ATS Score section when one resume has ats_score', async () => {
    mockListResumes.mockResolvedValue([
      { ...savedResume1, ats_score: 85, ats_score_updated_at: '2024-02-01T00:00:00Z' },
      savedResume2,
    ] as any)
    renderDashboard('ats-scores')

    await waitFor(() => {
      const atsSection = getAtsSection()
      expect(within(atsSection).getByText('Software Engineer Resume')).toBeInTheDocument()
    })
    const atsSection = getAtsSection()
    // Score is displayed as "85/100" without the "Score:" prefix
    expect(within(atsSection).getByText('85/100')).toBeInTheDocument()
    // The un-scored resume must not appear in the ATS section
    expect(within(atsSection).queryByText('Product Manager Resume')).not.toBeInTheDocument()
  })
})

// ── helper: open the ATS JD-entry modal via New ATS Check → resume picker ────
// Requires at least one resume in the list (uses the first one listed in the picker).
async function openFreshAtsCheckModal(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByText('New ATS Check')).toBeInTheDocument())
  await user.click(screen.getByText('New ATS Check'))
  // The resume-picker modal opens; pick the first resume
  await waitFor(() => expect(screen.getByRole('heading', { name: /new ats check/i })).toBeInTheDocument())
  await user.click(screen.getAllByRole('button', { name: /software engineer resume/i })[0])
  // The ATS JD-entry modal should now be open
  await waitFor(() =>
    expect(screen.getByPlaceholderText(/paste the job description here/i)).toBeInTheDocument()
  )
}

// ── ATS check modal ──────────────────────────────────────────────────────────

describe('Dashboard — ATS check modal', () => {
  it('opens the ATS JD-entry modal via New ATS Check → resume picker', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')
    await openFreshAtsCheckModal(user)

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
    renderDashboard('ats-scores')
    await openFreshAtsCheckModal(user)

    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'We need a React engineer')
    await user.click(screen.getByRole('button', { name: /run check/i }))

    // Score appears in modal and may also appear on the ATS tab card after save
    await waitFor(() => expect(screen.getAllByText('78/100').length).toBeGreaterThan(0))
    expect(screen.getByText('Solid match overall.')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('GraphQL')).toBeInTheDocument()
    expect(screen.getByText('Add more metrics')).toBeInTheDocument()

    expect(mockScoreATS).toHaveBeenCalledWith(savedResume1.resume_data, 'We need a React engineer')
    await waitFor(() =>
      expect(mockUpdateAtsScore).toHaveBeenCalledWith(
        savedResume1.id,
        78,
        expect.objectContaining({ jobDescription: expect.any(String), result: expect.any(Object) }),
      )
    )
  })

  it('shows an error message when the ATS check fails', async () => {
    mockScoreATS.mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    renderDashboard('ats-scores')
    await openFreshAtsCheckModal(user)

    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'job description')
    await user.click(screen.getByRole('button', { name: /run check/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to run ats check/i)).toBeInTheDocument()
    )
    expect(mockUpdateAtsScore).not.toHaveBeenCalled()
  })

  it('closes the ATS check modal via the Close button', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')
    await openFreshAtsCheckModal(user)

    expect(screen.getByRole('heading', { name: /check ats score/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/paste the job description here/i)).not.toBeInTheDocument()
  })

  it('disables the Run Check button until a job description is entered', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')
    await openFreshAtsCheckModal(user)

    expect(screen.getByRole('button', { name: /run check/i })).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/paste the job description here/i), 'job description')
    expect(screen.getByRole('button', { name: /run check/i })).not.toBeDisabled()
  })
})

// ── navigation ────────────────────────────────────────────────────────────────

describe('Dashboard — navigation', () => {
  it('Edit button navigates to /editor with resume data and from:/dashboard', async () => {
    const user = userEvent.setup()
    renderDashboard('resumes')
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
    renderDashboard('cover-letters')
    // Wait for cover letter section to be loaded
    await waitFor(() => expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0))

    // Scope to the cover letters section to find its Edit button
    const clSection = getCoverLettersSection()
    const editButton = within(clSection).getByRole('button', { name: /edit/i })
    await user.click(editButton)

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

// Delete is now inside the ⋯ More menu — open it first, then click Delete
async function openMoreMenuAndDelete(user: ReturnType<typeof userEvent.setup>, index = 0) {
  const moreButtons = screen.getAllByRole('button', { name: /more options/i })
  await user.click(moreButtons[index])
  await user.click(screen.getByRole('button', { name: /^delete$/i }))
}

const getModalConfirmButton = () =>
  document.querySelector<HTMLElement>('button[class*="bg-red-600"]')!

describe('Dashboard — delete flow', () => {
  it('clicking Delete shows the confirmation modal', async () => {
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))

    await openMoreMenuAndDelete(user, 0)

    expect(screen.getByRole('heading', { name: /delete resume/i })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('confirms deletion and removes card from the list', async () => {
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))

    await openMoreMenuAndDelete(user, 0)
    await user.click(getModalConfirmButton())

    await waitFor(() => expect(mockDeleteResume).toHaveBeenCalledWith(savedResume1.id))
    await waitFor(() => {
      const resumesSection = getResumesSection()
      expect(within(resumesSection).queryByText('Software Engineer Resume')).not.toBeInTheDocument()
    })
  })

  it('Cancel button hides the confirmation modal without deleting', async () => {
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))

    await openMoreMenuAndDelete(user, 0)
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('heading', { name: /delete resume/i })).not.toBeInTheDocument()
    expect(mockDeleteResume).not.toHaveBeenCalled()
  })
})

// ── delete flow (cover letters) ───────────────────────────────────────────────

describe('Dashboard — cover letter delete flow', () => {
  it('clicking delete on a cover letter shows the cover letter confirmation modal', async () => {
    const user = userEvent.setup()
    renderDashboard('cover-letters')
    // Card now shows company_name as heading; wait for the More button to be ready
    await waitFor(() => expect(screen.getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))

    // Scope to cover letters section to get the correct More Options button
    const clSection = getCoverLettersSection()
    const moreBtn = within(clSection).getByRole('button', { name: /more options/i })
    await user.click(moreBtn)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(screen.getByRole('heading', { name: /delete cover letter/i })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('confirms cover letter deletion and removes card from the list', async () => {
    const user = userEvent.setup()
    renderDashboard('cover-letters')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))

    // Scope to cover letters section to get the correct More Options button
    const clSection = getCoverLettersSection()
    const moreBtn = within(clSection).getByRole('button', { name: /more options/i })
    await user.click(moreBtn)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(getModalConfirmButton())

    await waitFor(() => expect(mockDeleteCoverLetter).toHaveBeenCalledWith(savedCoverLetter1.id))
    // After deletion, no more options button should remain in the cover letters section
    await waitFor(() =>
      expect(within(getCoverLettersSection()).queryByRole('button', { name: /more options/i })).not.toBeInTheDocument()
    )
  })
})

// ── ATS badge on resume card (new behavior) ───────────────────────────────────

describe('Dashboard — ATS badge on resume card', () => {
  const resumeWithAts = {
    ...savedResume1,
    ats_score: 72,
    ats_score_updated_at: '2024-02-10T00:00:00Z',
    ats_job_description: 'We need a TypeScript engineer',
    ats_result: {
      overallScore: 72,
      matchedKeywords: ['TypeScript'],
      missingKeywords: ['GraphQL'],
      suggestions: ['Add more metrics'],
      summary: 'Good overall match.',
    },
  }

  it('shows an ATS score badge on resume cards that have a saved ats_score', async () => {
    mockListResumes.mockResolvedValue([resumeWithAts, savedResume2] as any)
    renderDashboard('resumes')
    // Resume title appears in both Overview table and My Resumes cards
    await waitFor(() => expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0))
    // Badge text: "ATS 72"
    expect(screen.getByText(/ATS 72/)).toBeInTheDocument()
    // Resume without a score should not show a badge
    expect(screen.queryByText(/ATS.*Product/)).not.toBeInTheDocument()
  })

  it('ATS badge is a button that opens the detail modal in view mode (not JD entry form)', async () => {
    mockListResumes.mockResolvedValue([resumeWithAts, savedResume2] as any)
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getByText(/ATS 72/)).toBeInTheDocument())

    await user.click(screen.getByText(/ATS 72/))

    // ATS modal heading appears
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check ats score/i })).toBeInTheDocument()
    )
    // View mode shows the score result directly — NOT the JD entry textarea
    expect(screen.queryByPlaceholderText(/paste the job description here/i)).not.toBeInTheDocument()
    // 72/100 appears in the ATS score card and again in the modal — use getAllByText
    expect(screen.getAllByText('72/100').length).toBeGreaterThan(0)
    expect(screen.getByText('Good overall match.')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('GraphQL')).toBeInTheDocument()
  })

  it('ATS badge detail modal shows Re-run Check button (view mode indicator)', async () => {
    mockListResumes.mockResolvedValue([resumeWithAts, savedResume2] as any)
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getByText(/ATS 72/)).toBeInTheDocument())

    await user.click(screen.getByText(/ATS 72/))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /re-run check/i })).toBeInTheDocument()
    )
  })

  it('ATS badge is not rendered for resumes without ats_score', async () => {
    // Default mock: both resumes have no ats_score
    renderDashboard('resumes')
    // Resume title appears in both Overview table and My Resumes cards
    await waitFor(() => expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0))
    expect(screen.queryByText(/ATS \d+/)).not.toBeInTheDocument()
  })
})

// ── ATS Score tab — Detail and trash buttons (new behavior) ───────────────────

describe('Dashboard — ATS Score tab Detail and trash buttons', () => {
  const resumeWithAts = {
    ...savedResume1,
    ats_score: 80,
    ats_score_updated_at: '2024-02-15T00:00:00Z',
    ats_job_description: 'Looking for a React developer',
    ats_result: {
      overallScore: 80,
      matchedKeywords: ['React'],
      missingKeywords: ['Vue'],
      suggestions: ['Add Vue experience'],
      summary: 'Strong match.',
    },
  }

  beforeEach(() => {
    mockListResumes.mockResolvedValue([resumeWithAts, savedResume2] as any)
  })

  it('Detail button in ATS Score tab opens view mode showing saved score (no JD textarea)', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')

    // Button was renamed from "Detail" to "View Report"
    await waitFor(() => expect(screen.getByRole('button', { name: /view report/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /view report/i }))

    // View mode — score shown immediately, no JD entry textarea
    // 80/100 appears on the card and in the modal (both show the same score)
    await waitFor(() => expect(screen.getAllByText('80/100').length).toBeGreaterThan(0))
    expect(screen.queryByPlaceholderText(/paste the job description here/i)).not.toBeInTheDocument()
    expect(screen.getByText('Strong match.')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Vue')).toBeInTheDocument()
  })

  it('trash button in ATS Score tab calls clearAtsScore and removes the resume from the tab', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')

    await waitFor(() => {
      const atsSection = getAtsSection()
      expect(within(atsSection).getByText('Software Engineer Resume')).toBeInTheDocument()
    })

    // Delete is now inside the ⋯ More menu in the ATS section — open it then click Delete
    const atsSection = getAtsSection()
    await waitFor(() => expect(within(atsSection).getAllByRole('button', { name: /more options/i }).length).toBeGreaterThan(0))
    await user.click(within(atsSection).getAllByRole('button', { name: /more options/i })[0])
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(mockClearAtsScore).toHaveBeenCalledWith(resumeWithAts.id))
    // After clearing, the resume disappears from the ATS tab list
    await waitFor(() =>
      expect(within(getAtsSection()).queryByText('Software Engineer Resume')).not.toBeInTheDocument()
    )
  })
})

// ── ATS Score tab — New ATS Check card ───────────────────────────────────────

describe('Dashboard — ATS Score tab New ATS Check card', () => {
  it('shows the "New ATS Check" dashed card in the ATS Score tab', async () => {
    renderDashboard('ats-scores')

    await waitFor(() => expect(screen.getByText('New ATS Check')).toBeInTheDocument())
  })

  it('"New ATS Check" card opens the resume-picker modal', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')

    await waitFor(() => expect(screen.getByText('New ATS Check')).toBeInTheDocument())
    await user.click(screen.getByText('New ATS Check'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /new ats check/i })).toBeInTheDocument()
    )
    expect(screen.getByText(/choose the resume to check/i)).toBeInTheDocument()
  })

  it('resume picker lists all resumes and selecting one opens the ATS JD-entry modal', async () => {
    const user = userEvent.setup()
    renderDashboard('ats-scores')

    await waitFor(() => expect(screen.getByText('New ATS Check')).toBeInTheDocument())
    await user.click(screen.getByText('New ATS Check'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /new ats check/i })).toBeInTheDocument()
    )
    // Both resumes are listed in the picker modal
    const pickerModal = screen.getByRole('heading', { name: /new ats check/i }).closest('div[class]') as HTMLElement
    expect(within(pickerModal).getByText('Software Engineer Resume')).toBeInTheDocument()
    expect(within(pickerModal).getByText('Product Manager Resume')).toBeInTheDocument()

    // Picking a resume opens the JD entry form
    await user.click(within(pickerModal).getByText('Software Engineer Resume'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/paste the job description here/i)).toBeInTheDocument()
    )
  })
})

// ── export dropdown ───────────────────────────────────────────────────────────

describe('Dashboard — export dropdown', () => {
  it('Export button opens a dropdown with PDF and Word options', async () => {
    const user = userEvent.setup()
    renderDashboard('resumes')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /export/i }).length).toBeGreaterThan(0))

    await user.click(screen.getAllByRole('button', { name: /export/i })[0])

    expect(screen.getByText('Save as PDF')).toBeInTheDocument()
    expect(screen.getByText('Save as Word (.docx)')).toBeInTheDocument()
  })

  it('cover letter Export button opens a dropdown with PDF, DOCX, TXT options', async () => {
    const user = userEvent.setup()
    renderDashboard('cover-letters')
    // Wait for cover letter cards to render
    await waitFor(() => expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0))

    // Scope to cover letters section to click its Export button
    const clSection = getCoverLettersSection()
    const exportButton = within(clSection).getByRole('button', { name: /export/i })
    await user.click(exportButton)

    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('DOCX')).toBeInTheDocument()
    expect(screen.getByText('TXT')).toBeInTheDocument()
  })
})

// ── Overview view ─────────────────────────────────────────────────────────────

describe('Dashboard — overview', () => {
  it('renders the Application Overview table by default', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText('Application Overview')).toBeInTheDocument()
    )
  })

  it('shows stat cards on the overview view', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())
    expect(screen.getByText('Total Resumes')).toBeInTheDocument()
    expect(screen.getByText('Total Cover Letters')).toBeInTheDocument()
    expect(screen.getByText('Avg ATS Score')).toBeInTheDocument()
    expect(screen.getByText('AI Actions Used This Month')).toBeInTheDocument()
  })

  it('shows cover letter relationships in the table', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())
    // savedCoverLetter1 is linked to savedResume1, company_name is 'Stripe'
    // Resume titles appear in both the Overview table and the My Resumes section
    expect(screen.getAllByText('Software Engineer Resume').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0)
  })

  it('shows resume rows without cover letters', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Application Overview')).toBeInTheDocument())
    // savedResume2 has no cover letter — it should still appear as its own row
    // Title appears in both Overview table and My Resumes section
    expect(screen.getAllByText('Product Manager Resume').length).toBeGreaterThan(0)
  })
})
