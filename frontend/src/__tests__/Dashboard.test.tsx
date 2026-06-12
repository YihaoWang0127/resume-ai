import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/resumes', () => ({ listResumes: vi.fn(), deleteResume: vi.fn() }))
vi.mock('@/services/coverLetters', () => ({ listCoverLetters: vi.fn(), deleteCoverLetter: vi.fn() }))
vi.mock('@/services/api', () => ({ exportResume: vi.fn(), exportCoverLetter: vi.fn() }))
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
import { listResumes, deleteResume } from '@/services/resumes'
import { listCoverLetters, deleteCoverLetter } from '@/services/coverLetters'
import Dashboard from '@/pages/Dashboard'

const mockUseAuth = vi.mocked(useAuth)
const mockListResumes = vi.mocked(listResumes)
const mockDeleteResume = vi.mocked(deleteResume)
const mockListCoverLetters = vi.mocked(listCoverLetters)
const mockDeleteCoverLetter = vi.mocked(deleteCoverLetter)

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

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(defaultAuth as any)
  mockListResumes.mockResolvedValue([savedResume1, savedResume2] as any)
  mockListCoverLetters.mockResolvedValue([savedCoverLetter1] as any)
  mockDeleteResume.mockResolvedValue(undefined)
  mockDeleteCoverLetter.mockResolvedValue(undefined)
})

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
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my cover letters/i })).toBeInTheDocument()
    )
  })

  it('renders cover letter cards from listCoverLetters data', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument()
    )
    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('shows the New Cover Letter card', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText('New Cover Letter')).toBeInTheDocument()
    )
  })

  it('shows count badges for both sections', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument())
    // Resume count badge: 2, cover letter count badge: 1
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    // Cover letter Edit buttons come after resume Edit buttons; find the last one
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[editButtons.length - 1])

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
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    // Cover letter delete button is the last red-500 button
    const deleteBtns = getCardDeleteButtons()
    await user.click(deleteBtns[deleteBtns.length - 1])

    expect(screen.getByRole('heading', { name: /delete cover letter/i })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('confirms cover letter deletion and removes card from the list', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    const deleteBtns = getCardDeleteButtons()
    await user.click(deleteBtns[deleteBtns.length - 1])
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
    await waitFor(() => expect(screen.getByText('Cover Letter for Stripe')).toBeInTheDocument())

    // Last Export button belongs to the cover letter card
    const exportBtns = screen.getAllByRole('button', { name: /export/i })
    await user.click(exportBtns[exportBtns.length - 1])

    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('DOCX')).toBeInTheDocument()
    expect(screen.getByText('TXT')).toBeInTheDocument()
  })
})
