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

vi.mock('@/services/resumes', () => ({
  listResumes: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/profile', () => ({
  getProfile: vi.fn().mockResolvedValue(null),
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
    expect(screen.getByText('Every job application,')).toBeInTheDocument()
    expect(screen.getByText('in minutes.')).toBeInTheDocument()
    expect(screen.getByText("Resume, cover letter, and ATS check — crafted for the exact role you're chasing.")).toBeInTheDocument()
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
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Upload Your Resume')).toBeInTheDocument()
    expect(screen.getByText('Paste a Job Description')).toBeInTheDocument()
    expect(screen.getByText('Your application package')).toBeInTheDocument()
  })
})

// ── CTA button behavior — no session ─────────────────────────────────────────

describe('Home — "Create My Resume Package" button (no session)', () => {
  it('opens picker modal when user is null and isGuest is false', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()
    expect(openAuthModal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does nothing when loading is still true', async () => {
    setupAuth({ user: null, isGuest: false, loading: true })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
    expect(openAuthModal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — guest session ──────────────────────────────────────

describe('Home — "Create My Resume Package" button (anonymous guest)', () => {
  it('opens the picker modal when isGuest is true', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })

    const user = userEvent.setup()
    renderHome()

    // Picker should not be visible before clicking
    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()
    expect(screen.getByText('Use Saved Resume')).toBeInTheDocument()
    expect(screen.getByText('Upload New Resume')).toBeInTheDocument()
    expect(screen.getByText('Create From Profile')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── CTA button behavior — authenticated ──────────────────────────────────────

describe('Home — "Create My Resume Package" button (authenticated)', () => {
  it('opens picker modal when a real user is logged in (isGuest: false)', async () => {
    setupAuth({
      user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any,
      isGuest: false,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})

// ── Picker modal ──────────────────────────────────────────────────────────────

describe('Home — picker modal', () => {
  it('shows all 3 option cards after clicking CTA', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))

    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()
    expect(screen.getByText('Use Saved Resume')).toBeInTheDocument()
    expect(screen.getByText('Upload New Resume')).toBeInTheDocument()
    expect(screen.getByText('Create From Profile')).toBeInTheDocument()
  })

  it('"Upload New Resume" card → shows upload sub-view with resume-uploader', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Upload New Resume'))

    expect(screen.getByRole('heading', { name: /Upload New Resume/i })).toBeInTheDocument()
    expect(screen.getByTestId('resume-uploader')).toBeInTheDocument()
  })

  it('"Use Saved Resume" card when !user → closes modal and calls openAuthModal', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Use Saved Resume'))

    expect(openAuthModal).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
  })

  it('"Use Saved Resume" card when isGuest: true → closes modal and calls openAuthModal', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Use Saved Resume'))

    expect(openAuthModal).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
  })

  it('"Create From Profile" card when !user → closes modal and calls openAuthModal', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Create From Profile'))

    expect(openAuthModal).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
  })

  it('back arrow in upload sub-view returns to picker', async () => {
    setupAuth({ user: null, isGuest: false, loading: false })
    const user = userEvent.setup()
    renderHome()

    // Open picker → navigate to upload sub-view
    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Upload New Resume'))
    expect(screen.getByRole('heading', { name: /Upload New Resume/i })).toBeInTheDocument()

    // Click back arrow (the ArrowLeft button that only appears in sub-views)
    const heading = screen.getByRole('heading', { name: /Upload New Resume/i })
    const headerDiv = heading.closest('div')!.parentElement!
    const backButton = headerDiv.querySelector('button')!
    await user.click(backButton)

    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()
  })

  it('uploading a resume from upload sub-view navigates to /editor', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    await user.click(screen.getByText('Upload New Resume'))

    // Simulate upload completing via the mocked ResumeUploader
    await user.click(screen.getByRole('button', { name: /Upload/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/editor', expect.objectContaining({ state: expect.objectContaining({ from: '/' }) }))
    expect(screen.queryByRole('heading', { name: /Upload New Resume/i })).not.toBeInTheDocument()
  })
})

// ── Modal close behavior ──────────────────────────────────────────────────────

describe('Home — picker modal close behavior', () => {
  it('clicking the X button closes the picker modal', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    // Open the modal first
    await user.click(screen.getByRole('button', { name: /Create My Resume Package/i }))
    expect(screen.getByRole('heading', { name: /Create Your Resume Package/i })).toBeInTheDocument()

    // The X close button is the only button after the heading in the modal header.
    const heading = screen.getByRole('heading', { name: /Create Your Resume Package/i })
    const headerDiv = heading.closest('div')!.parentElement!
    // X button is the last button in the header (no back arrow shown in picker view)
    const closeButton = headerDiv.querySelector('button')!
    await user.click(closeButton)

    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
  })

  it.each([
    ['authenticated user', { user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any, isGuest: false, loading: false }],
    ['no session', { user: null, isGuest: false, loading: false }],
  ])('picker modal is NOT visible for %s without clicking CTA', (_label, auth) => {
    setupAuth(auth)
    renderHome()
    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
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

  it('does not open the picker modal when clicked while disabled (guest)', async () => {
    setupAuth({
      user: { id: 'anon1', is_anonymous: true } as any,
      isGuest: true,
      loading: false,
    })
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /See Example/i }))

    expect(screen.queryByRole('heading', { name: /Create Your Resume Package/i })).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})
