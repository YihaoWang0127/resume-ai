import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/api', () => ({
  enrichResume: vi.fn(),
  exportResume: vi.fn(),
  tailorResume: vi.fn(),
  scoreATS: vi.fn(),
  fromBackend: vi.fn((d: unknown) => d),
}))
vi.mock('@/services/resumes', () => ({
  saveResume: vi.fn(),
  updateResume: vi.fn(),
}))
vi.mock('@/components/ResumePreview', () => ({
  default: () => <div data-testid="resume-preview" />,
}))
vi.mock('@/components/StreamingOutput', () => ({
  default: () => <div data-testid="streaming-output" />,
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext'
import { saveResume } from '@/services/resumes'
import { scoreATS } from '@/services/api'
import ResumeEditor from '@/components/ResumeEditor'
import type { ATSScoreResult } from '@/types/resume'

const mockUseAuth = vi.mocked(useAuth)
const mockSaveResume = vi.mocked(saveResume)
const mockScoreATS = vi.mocked(scoreATS)

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Software engineer',
  experience: [],
  education: [],
  skills: [],
  detectedIndustry: 'tech',
}

const regularUser = { id: 'u1', email: 'user@test.com', is_anonymous: false }
const guestUser = { id: 'anon-1', email: null, is_anonymous: true }

const defaultAuth = {
  user: regularUser,
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

function renderEditor(props: Partial<Parameters<typeof ResumeEditor>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ResumeEditor
        initialResume={mockResume}
        onBack={vi.fn()}
        onSignUp={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(defaultAuth as any)
})

// ── save / update buttons ─────────────────────────────────────────────────────

describe('ResumeEditor — save button', () => {
  it('shows Save button for a logged-in user', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('opens save dialog when logged-in user clicks Save', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('heading', { name: /save resume/i })).toBeInTheDocument()
  })

  it('calls onSignUp instead of opening dialog when a guest clicks Save', async () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, user: guestUser, isGuest: true } as any)
    const onSignUp = vi.fn()
    const user = userEvent.setup()
    renderEditor({ onSignUp })

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSignUp).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
  })

  it('shows Update button instead of Save when initialResumeId is provided', () => {
    renderEditor({ initialResumeId: 'existing-id' })
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^update$/i })).toBeInTheDocument()
  })
})

// Helper: get the save dialog container after opening it
async function openSaveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^save$/i }))
  return screen.getByRole('heading', { name: /save resume/i }).closest('div.bg-card') as HTMLElement
}

// ── save dialog ───────────────────────────────────────────────────────────────

describe('ResumeEditor — save dialog', () => {
  it('prefills the title input with a default value', async () => {
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    const input = within(dialog).getByRole('textbox')
    expect((input as HTMLInputElement).value).toMatch(/resume/i)
  })

  it('calls saveResume with the entered title on confirm', async () => {
    mockSaveResume.mockResolvedValue({ id: 'new-id' } as any)
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    const input = within(dialog).getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'My Custom Title')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockSaveResume).toHaveBeenCalledWith(mockResume, 'My Custom Title')
    )
  })

  it('closes the save dialog after a successful save', async () => {
    mockSaveResume.mockResolvedValue({ id: 'new-id' } as any)
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
    )
  })

  it('Cancel button closes the save dialog without saving', async () => {
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
    expect(mockSaveResume).not.toHaveBeenCalled()
  })
})

// ── user dropdown (via Navbar) ────────────────────────────────────────────────

describe('ResumeEditor — user dropdown in navbar', () => {
  it('shows sign-out option in the user dropdown', async () => {
    const user = userEvent.setup()
    renderEditor()

    // Click the user menu button (identified by the email text it contains)
    const emailText = screen.getByText('user@test.com')
    const menuButton = emailText.closest('button')!
    await user.click(menuButton)

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows My Resumes option in the user dropdown', async () => {
    const user = userEvent.setup()
    renderEditor()

    const emailText = screen.getByText('user@test.com')
    await user.click(emailText.closest('button')!)

    expect(screen.getByRole('button', { name: /my resumes/i })).toBeInTheDocument()
  })

  it('calls signOut when Sign Out is clicked', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ ...defaultAuth, signOut } as any)
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByText('user@test.com').closest('button')!)
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalled()
  })
})

// ── ATS Score tab ─────────────────────────────────────────────────────────────

const mockATSResult: ATSScoreResult = {
  overallScore: 78,
  matchedKeywords: ['Python', 'Distributed Systems'],
  missingKeywords: ['Kubernetes'],
  suggestions: ['Add a bullet about container orchestration.', 'Mention CI/CD pipeline experience.'],
  summary: 'Strong overall match with a few gaps in infrastructure tooling.',
}

async function openATSTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /ats score/i }))
}

describe('ResumeEditor — ATS Score tab', () => {
  it('switches to the ATS Score tab and shows the job description field', async () => {
    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)

    expect(screen.getByText(/job description/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Paste the job description here…')).toBeInTheDocument()
  })

  it('disables the Analyze button until a job description is entered', async () => {
    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)

    const analyzeButton = screen.getByRole('button', { name: /analyze/i })
    expect(analyzeButton).toBeDisabled()

    const textarea = screen.getByPlaceholderText('Paste the job description here…')
    await user.type(textarea, 'Senior Software Engineer role requiring Python.')

    expect(analyzeButton).toBeEnabled()
  })

  it('shows a loading state and calls scoreATS when Analyze is clicked', async () => {
    let resolvePromise: (value: ATSScoreResult) => void = () => {}
    mockScoreATS.mockReturnValue(
      new Promise<ATSScoreResult>((resolve) => {
        resolvePromise = resolve
      }),
    )

    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)
    const textarea = screen.getByPlaceholderText('Paste the job description here…')
    await user.type(textarea, 'Senior Software Engineer role requiring Python.')

    const analyzeButton = screen.getByRole('button', { name: /analyze/i })
    await user.click(analyzeButton)

    expect(analyzeButton).toBeDisabled()
    expect(mockScoreATS).toHaveBeenCalledWith(
      mockResume,
      'Senior Software Engineer role requiring Python.',
    )

    resolvePromise(mockATSResult)
    await waitFor(() => expect(analyzeButton).toBeEnabled())
  })

  it('renders the results panel with score, summary, keywords, and suggestions', async () => {
    mockScoreATS.mockResolvedValue(mockATSResult)
    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)
    const textarea = screen.getByPlaceholderText('Paste the job description here…')
    await user.type(textarea, 'Senior Software Engineer role requiring Python.')
    await user.click(screen.getByRole('button', { name: /analyze/i }))

    await waitFor(() => expect(screen.getByText('78')).toBeInTheDocument())
    expect(screen.getByText(mockATSResult.summary)).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Distributed Systems')).toBeInTheDocument()
    expect(screen.getByText('Kubernetes')).toBeInTheDocument()
    expect(screen.getByText('Add a bullet about container orchestration.')).toBeInTheDocument()
    expect(screen.getByText('Mention CI/CD pipeline experience.')).toBeInTheDocument()
  })

  it('shows an error message when scoreATS rejects', async () => {
    mockScoreATS.mockRejectedValue(new Error('502 Bad Gateway'))
    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)
    const textarea = screen.getByPlaceholderText('Paste the job description here…')
    await user.type(textarea, 'Senior Software Engineer role requiring Python.')
    await user.click(screen.getByRole('button', { name: /analyze/i }))

    await waitFor(() => expect(screen.getByText(/502 bad gateway/i)).toBeInTheDocument())
    expect(screen.queryByText('78')).not.toBeInTheDocument()
  })

  it('does not render the results panel before Analyze is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    await openATSTab(user)

    expect(screen.queryByText(/matched keywords/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/missing keywords/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/suggestions/i)).not.toBeInTheDocument()
  })
})

// ── desktop layout — left panel width & tab bar spacing ───────────────────────

describe('ResumeEditor — desktop layout', () => {
  it('renders the left editor panel with the responsive 40% width (bounded 420px–640px)', () => {
    renderEditor()

    const leftPanel = screen.getByText('Contact').closest('div')!.parentElement as HTMLElement
    expect(leftPanel.className).toContain('lg:w-[40%]')
    expect(leftPanel.className).toContain('lg:min-w-[420px]')
    expect(leftPanel.className).toContain('lg:max-w-[640px]')
    // mobile width and visibility behavior remain unchanged
    expect(leftPanel.className).toContain('w-full')
  })

  it('renders each tab bar button with centered text and the updated vertical padding', () => {
    renderEditor()

    const tabNames = [/^summary$/i, /^experience$/i, /^education$/i, /^skills$/i, /^ats score$/i]
    for (const name of tabNames) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toContain('text-center')
      expect(button.className).toContain('py-2.5')
    }
  })
})
