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
  it('renders badge, headline, subtitle, checklist items, and CTA buttons', () => {
    renderHome()
    expect(screen.getByText('Built for Every Job Application')).toBeInTheDocument()
    expect(screen.getByText('Build every job application package')).toBeInTheDocument()
    expect(screen.getByText('in minutes.')).toBeInTheDocument()
    expect(screen.getByText('Resume, cover letter, and ATS check — tailored to each job.')).toBeInTheDocument()
    expect(screen.getByText('Tailored Resume')).toBeInTheDocument()
    expect(screen.getAllByText('Cover Letter').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ATS Score').length).toBeGreaterThan(0)
    expect(screen.getByText('Job-Specific Keywords')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create My Resume Package/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /See Example/i })).toBeInTheDocument()
  })
})

// ── Social proof & trust bar ──────────────────────────────────────────────────

describe('Home — social proof and trust bar', () => {
  it('renders social proof text, avatar initials, and all company names', () => {
    renderHome()
    expect(screen.getByText(/Loved by 20,000\+ job seekers/i)).toBeInTheDocument()
    expect(screen.getByText('JK')).toBeInTheDocument()
    expect(screen.getByText('SM')).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
    expect(screen.getByText(/Trusted by professionals from top companies/i)).toBeInTheDocument()
    for (const name of ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Airbnb', 'Stripe']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })
})

// ── Resume preview card ───────────────────────────────────────────────────────

describe('Home — resume preview card', () => {
  it('renders the 3-step workflow card', () => {
    renderHome()
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('Upload Your Resume')).toBeInTheDocument()
    expect(screen.getByText('Paste a Job Description')).toBeInTheDocument()
    expect(screen.getByText('Your application package')).toBeInTheDocument()
  })
})

// ── CTA button behavior — no session ─────────────────────────────────────────

describe('Home — "Create My Resume Package" button (no session)', () => {
  it('calls openAuthModal when user is null and isGuest is false', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(openAuthModal).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does nothing when loading is still true', async () => {
    setupAuth({ user: null, isGuest: false, loading: true })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(openAuthModal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — guest session ──────────────────────────────────────

describe('Home — "Create My Resume Package" button (anonymous guest)', () => {
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

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.getByRole('heading', { name: /Upload Resume/i })).toBeInTheDocument()
    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — authenticated ──────────────────────────────────────

describe('Home — "Create My Resume Package" button (authenticated)', () => {
  it('navigates to /dashboard when a real user is logged in (isGuest: false)', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      isGuest: false,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── Guest upload modal ────────────────────────────────────────────────────────

describe('Home — guest upload modal', () => {
  it('upload modal appears after clicking Enhance when isGuest is true', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

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
    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    expect(screen.getByRole('heading', { name: /Upload Resume/i })).toBeInTheDocument()

    // The X close button is the only button in the modal header (next to the heading).
    // It has no text — find the button sibling of the "Upload Resume" heading.
    const heading = screen.getByRole('heading', { name: /Upload Resume/i })
    const headerDiv = heading.parentElement!
    const closeButton = headerDiv.querySelector('button')!
    await user.click(closeButton)

    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
  })

  it.each([
    ['authenticated user', { user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any, isGuest: false, loading: false }],
    ['no session', { user: null, isGuest: false, loading: false }],
  ])('upload modal is NOT visible for %s without clicking Enhance', (_label, auth) => {
    setupAuth(auth)
    renderHome()
    expect(screen.queryByRole('heading', { name: /Upload Resume/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('resume-uploader')).not.toBeInTheDocument()
  })
})

// ── "See Example" button ──────────────────────────────────────────────────────

describe('Home — "See Example" button (disabled)', () => {
  it('is rendered as a disabled button with cursor-not-allowed and opacity-50 classes', () => {
    renderHome()
    const btn = screen.getByRole('button', { name: /See Example/i })
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('cursor-not-allowed')
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
