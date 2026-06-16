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

// ── CTA button behavior — guest ───────────────────────────────────────────────

describe('Home — "Enhance My Resume" button (guest / unauthenticated)', () => {
  it('calls openAuthModal when user is null', async () => {
    setupAuth({ user: null, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(openAuthModal).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard')
  })

  it('calls openAuthModal when loading is still true', async () => {
    setupAuth({ user: null, loading: true })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(openAuthModal).toHaveBeenCalled()
  })
})

// ── CTA button behavior — authenticated ──────────────────────────────────────

describe('Home — "Enhance My Resume" button (authenticated)', () => {
  it('navigates to /dashboard when a real user is logged in', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Enhance My Resume/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── "See Example" button ──────────────────────────────────────────────────────

describe('Home — "See Example" button', () => {
  it('calls openAuthModal when user is null (same as "Enhance My Resume")', async () => {
    setupAuth({ user: null, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(openAuthModal).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard')
  })

  it('navigates to /dashboard when a real user is logged in', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})
