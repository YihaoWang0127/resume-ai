import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

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
import Home from '@/pages/Home'

const mockUseAuth = vi.mocked(useAuth)

const openAuthModal = vi.fn()

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Engineer',
  experience: [],
  education: [],
  skills: [],
}

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

// ── Upload section ────────────────────────────────────────────────────────────

describe('Home — upload section', () => {
  it('renders the ResumeUploader component', () => {
    renderHome()
    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
  })

  it('renders the upload section heading', () => {
    renderHome()
    expect(screen.getByText(/Ready to enhance your resume\?/i)).toBeInTheDocument()
  })

  it('navigates to /editor after a successful parse', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(mockNavigate).toHaveBeenCalledWith('/editor', {
      state: { resume: mockResume, from: '/' },
    })
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
  it('calls scrollIntoView on the #uploader element', async () => {
    const scrollIntoView = vi.fn()
    const el = document.createElement('div')
    el.id = 'uploader'
    el.scrollIntoView = scrollIntoView
    document.body.appendChild(el)

    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })

    document.body.removeChild(el)
  })
})

// ── Guest overlay on uploader ─────────────────────────────────────────────────

describe('Home — guest overlay on uploader', () => {
  it('shows a clickable overlay when the user is not logged in', () => {
    setupAuth({ user: null, loading: false })
    renderHome()
    // The overlay div sits above the uploader; clicking it calls openAuthModal
    const uploader = screen.getByTestId('resume-uploader')
    // The overlay is a sibling — find its parent's relative container
    const container = uploader.closest('div.relative')
    expect(container).not.toBeNull()
    const overlay = container!.querySelector('div.absolute')
    expect(overlay).not.toBeNull()
  })

  it('calls openAuthModal when the guest overlay is clicked', async () => {
    setupAuth({ user: null, loading: false })
    const user = userEvent.setup()
    renderHome()

    const uploader = screen.getByTestId('resume-uploader')
    const container = uploader.closest('div.relative')!
    const overlay = container.querySelector<HTMLElement>('div.absolute')!
    await user.click(overlay)

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('does not render the guest overlay when user is logged in', () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      loading: false,
    })
    renderHome()

    const uploader = screen.getByTestId('resume-uploader')
    const container = uploader.closest('div.relative')!
    const overlay = container.querySelector('div.absolute')
    expect(overlay).toBeNull()
  })
})
