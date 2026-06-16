import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }))

vi.mock('@/components/ResumeUploader', () => ({
  default: ({ onParsed }: { onParsed: (r: unknown) => void }) => (
    <div data-testid="resume-uploader">
      <button onClick={() => onParsed({ name: 'Test User' })}>Upload</button>
    </div>
  ),
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext'
import Home from '@/pages/Home'

const mockUseAuth = vi.mocked(useAuth)

const openAuthModal = vi.fn()

function setupAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    loading: false,
    isGuest: false,
    showAuthModal: false,
    openAuthModal,
    closeAuthModal: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInAsGuest: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

function renderHome() {
  return render(<Home />, { wrapper: MemoryRouter })
}

// ── Hero section ──────────────────────────────────────────────────────────────

describe('Home — hero section', () => {
  it('renders the AI-Powered badge', () => {
    renderHome()
    expect(screen.getByText('AI-Powered Resume Enhancement')).toBeInTheDocument()
  })

  it('renders the two-part headline', () => {
    renderHome()
    expect(screen.getByText('Your Resume.')).toBeInTheDocument()
    expect(screen.getByText('Enhanced by AI.')).toBeInTheDocument()
  })

  it('renders the subtitle text', () => {
    renderHome()
    expect(
      screen.getByText(/Improve your resume, stand out to recruiters/i)
    ).toBeInTheDocument()
  })

  it('renders all four checklist items', () => {
    renderHome()
    expect(screen.getByText('AI Content Enhancement')).toBeInTheDocument()
    expect(screen.getByText('ATS Optimization')).toBeInTheDocument()
    expect(screen.getByText('Smart Suggestions')).toBeInTheDocument()
    expect(screen.getByText('HR-Approved Templates')).toBeInTheDocument()
  })

  it('renders the "Enhance My Resume" CTA button', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /Enhance My Resume/i })).toBeInTheDocument()
  })

  it('renders the "See Example" CTA button', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /See Example/i })).toBeInTheDocument()
  })
})

// ── Social proof ──────────────────────────────────────────────────────────────

describe('Home — social proof', () => {
  it('renders the "Loved by 20,000+ job seekers" line', () => {
    renderHome()
    expect(screen.getByText(/Loved by 20,000\+ job seekers/i)).toBeInTheDocument()
  })

  it('renders avatar initials JK, SM, AR', () => {
    renderHome()
    expect(screen.getByText('JK')).toBeInTheDocument()
    expect(screen.getByText('SM')).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
  })
})

// ── Trust bar ─────────────────────────────────────────────────────────────────

describe('Home — trust bar', () => {
  it('renders the trusted companies tagline', () => {
    renderHome()
    expect(
      screen.getByText(/Trusted by professionals from top companies/i)
    ).toBeInTheDocument()
  })

  it('renders all company names', () => {
    renderHome()
    const companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Airbnb', 'Stripe']
    for (const name of companies) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })
})

// ── Resume preview card ───────────────────────────────────────────────────────

describe('Home — resume preview card', () => {
  it('renders the Preview tab in the top bar', () => {
    renderHome()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders the Suggestions tab in the top bar', () => {
    renderHome()
    expect(screen.getByText('Suggestions')).toBeInTheDocument()
  })

  it('renders the Download tab in the top bar', () => {
    renderHome()
    expect(screen.getByText('Download')).toBeInTheDocument()
  })

  it('renders the ATS Score label in the AI Suggestions panel', () => {
    renderHome()
    expect(screen.getByText(/ATS Score/i)).toBeInTheDocument()
  })

  it('renders the Professional Summary section in the resume content', () => {
    renderHome()
    expect(screen.getByText('Professional Summary')).toBeInTheDocument()
  })

  it('renders the Experience section in the resume content', () => {
    renderHome()
    expect(screen.getByText('Experience')).toBeInTheDocument()
  })

  it('renders the Education section in the resume content', () => {
    renderHome()
    expect(screen.getByText('Education')).toBeInTheDocument()
  })
})

// ── CTA button behavior — no session ─────────────────────────────────────────

describe('Home — "Enhance My Resume" button (no session)', () => {
  it('calls openAuthModal when user is null and isGuest is false', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(openAuthModal).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does nothing when loading is still true', async () => {
    setupAuth({ user: null, isGuest: false, loading: true })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(openAuthModal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — guest session ──────────────────────────────────────

describe('Home — "Enhance My Resume" button (anonymous guest)', () => {
  it('opens the upload modal when isGuest is true', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })

    const user = userEvent.setup()
    renderHome()

    // Modal should not be visible before clicking
    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(screen.getByRole('heading', { name: /Upload Resume/i })).toBeInTheDocument()
    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — authenticated ──────────────────────────────────────

describe('Home — "Enhance My Resume" button (authenticated)', () => {
  it('navigates to /dashboard when a real user is logged in (isGuest: false)', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      isGuest: false,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── Guest upload modal ────────────────────────────────────────────────────────

describe('Home — guest upload modal', () => {
  it('upload modal is NOT visible by default when isGuest is true', () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    renderHome()

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('resume-uploader')).not.toBeInTheDocument()
  })

  it('upload modal appears after clicking Enhance when isGuest is true', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(screen.getByRole('heading', { name: /Upload Resume/i })).toBeInTheDocument()
    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
  })

  it('clicking the X button closes the upload modal', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    // Open the modal first
    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))
    expect(screen.getByRole('heading', { name: /Upload Resume/i })).toBeInTheDocument()

    // The X close button is the only button in the modal header (next to the heading).
    // It has no text — find the button sibling of the "Upload Resume" heading.
    const heading = screen.getByRole('heading', { name: /Upload Resume/i })
    const headerDiv = heading.parentElement!
    const closeButton = headerDiv.querySelector('button')!
    await user.click(closeButton)

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
  })

  it('upload modal is NOT visible for a real authenticated user (no Enhance click)', () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      isGuest: false,
      loading: false,
    })
    renderHome()

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('resume-uploader')).not.toBeInTheDocument()
  })

  it('upload modal is NOT visible when user is null (no session)', () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    renderHome()

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('resume-uploader')).not.toBeInTheDocument()
  })
})

// ── "See Example" button ──────────────────────────────────────────────────────

describe('Home — "See Example" button (disabled)', () => {
  it('is rendered as a disabled button', () => {
    renderHome()
    const btn = screen.getByRole('button', { name: /See Example/i })
    expect(btn).toBeDisabled()
  })

  it('has the cursor-not-allowed style class', () => {
    renderHome()
    const btn = screen.getByRole('button', { name: /See Example/i })
    expect(btn.className).toContain('cursor-not-allowed')
  })

  it('has the opacity-50 style class', () => {
    renderHome()
    const btn = screen.getByRole('button', { name: /See Example/i })
    expect(btn.className).toContain('opacity-50')
  })

  it('does not call openAuthModal when clicked while disabled (no session)', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(openAuthModal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate or open modals when clicked while disabled (authenticated)', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      isGuest: false,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })

  it('does not open the upload modal when clicked while disabled (guest)', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})
