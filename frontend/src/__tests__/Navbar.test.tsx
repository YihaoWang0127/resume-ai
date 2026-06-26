import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '@/components/Navbar'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/components/PackageWizard', () => ({ default: () => null }))

// Navigate mock — capture calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

const signOut = vi.fn()
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
    signOut,
    ...overrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

function renderNavbar() {
  return render(<Navbar />, { wrapper: MemoryRouter })
}

describe('Navbar — signed out', () => {
  it('shows "Get Started Free" button and no "Sign in" text link', () => {
    renderNavbar()
    expect(screen.getByText('Get Started Free')).toBeInTheDocument()
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
  })

  it('does not show a Guest dropdown trigger', () => {
    renderNavbar()
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
  })

  it('calls openAuthModal when "Get Started Free" is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Get Started Free'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('does not show the user dropdown menu', () => {
    renderNavbar()
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})

describe('Navbar — anonymous guest session (isGuest: true)', () => {
  it('shows "Guest" avatar dropdown trigger instead of Sign in / Get Started Free', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderNavbar()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
    expect(screen.queryByText('Get Started Free')).not.toBeInTheDocument()
  })

  it('does not show Dashboard in the guest dropdown', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('shows Profile, AI, Settings and "Sign In / Sign Up" in the guest dropdown', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()
  })

  it('calls openAuthModal when "Sign In / Sign Up" is clicked from the guest dropdown', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Sign In / Sign Up'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('navigates to /profile when Profile is clicked from the guest dropdown', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Profile'))

    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })
})

describe('Navbar — center nav links', () => {
  it('renders all five nav links when no onBack or children props are present', () => {
    renderNavbar()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Examples')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Blog')).toBeInTheDocument()
  })

  it('does not render the removed "Templates" link', () => {
    renderNavbar()
    expect(screen.queryByText('Templates')).not.toBeInTheDocument()
  })

  it('hides center nav links when onBack prop is provided', () => {
    render(<Navbar onBack={vi.fn()} />, { wrapper: MemoryRouter })
    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Examples')).not.toBeInTheDocument()
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    expect(screen.queryByText('Blog')).not.toBeInTheDocument()
  })

  it('hides center nav links when children are provided', () => {
    render(
      <Navbar>
        <button>Action</button>
      </Navbar>,
      { wrapper: MemoryRouter }
    )
    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Examples')).not.toBeInTheDocument()
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
    expect(screen.queryByText('Blog')).not.toBeInTheDocument()
  })
})

describe('Navbar — nav dropdown panels', () => {
  it('opens the Features panel when "Features" button is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Features/i }))

    // Panel header text unique to FeaturesPanel
    expect(screen.getByText('What you get')).toBeInTheDocument()
  })

  it('closes the Features panel when "Features" button is clicked again (toggle)', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Features/i }))
    expect(screen.getByText('What you get')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Features/i }))
    expect(screen.queryByText('What you get')).not.toBeInTheDocument()
  })

  it('opens the "Steps" panel when that button is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Steps/i }))

    expect(screen.getByText('Three simple steps')).toBeInTheDocument()
  })

  it('switches from Features panel to "Steps" panel (only one open at a time)', async () => {
    const user = userEvent.setup()
    renderNavbar()

    // Open Features
    await user.click(screen.getByRole('button', { name: /Features/i }))
    expect(screen.getByText('What you get')).toBeInTheDocument()

    // Click Steps — Features panel should close, Steps opens
    await user.click(screen.getByRole('button', { name: /Steps/i }))
    expect(screen.queryByText('What you get')).not.toBeInTheDocument()
    expect(screen.getByText('Three simple steps')).toBeInTheDocument()
  })

  it('closes the open panel when Escape key is pressed', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Features/i }))
    expect(screen.getByText('What you get')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('What you get')).not.toBeInTheDocument()
  })

  it('closes the open panel when clicking outside the nav area', async () => {
    const user = userEvent.setup()
    const { container } = renderNavbar()

    await user.click(screen.getByRole('button', { name: /Features/i }))
    expect(screen.getByText('What you get')).toBeInTheDocument()

    // Click on the document body outside the navbar
    await user.click(container.ownerDocument.body)
    expect(screen.queryByText('What you get')).not.toBeInTheDocument()
  })

  it('opens the Pricing panel showing Free and Pro tiers', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Pricing/i }))

    expect(screen.getByText('Simple pricing')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('opens the Examples panel showing "Coming Soon"', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /^Examples$/i }))

    // ExamplesPanel renders "Coming Soon" text
    const comingSoonEls = screen.getAllByText('Coming Soon')
    expect(comingSoonEls.length).toBeGreaterThanOrEqual(1)
  })

  it('opens the Blog panel showing "Coming Soon"', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /^Blog$/i }))

    const comingSoonEls = screen.getAllByText('Coming Soon')
    expect(comingSoonEls.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Tips, guides, and industry insights/i)).toBeInTheDocument()
  })

  it('nav panel buttons are not rendered when onBack prop is provided', () => {
    render(<Navbar onBack={vi.fn()} />, { wrapper: MemoryRouter })
    // Nav buttons are hidden when onBack is set — no panel triggers exist
    expect(screen.queryByRole('button', { name: /^Features$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pricing$/i })).not.toBeInTheDocument()
  })

  it('FeaturesPanel lists AI Enhancement, ATS Optimization, Cover Letters, One-Click Export', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Features/i }))

    expect(screen.getByText('AI Enhancement')).toBeInTheDocument()
    expect(screen.getByText('ATS Optimization')).toBeInTheDocument()
    expect(screen.getByText('Cover Letters')).toBeInTheDocument()
    expect(screen.getByText('One-Click Export')).toBeInTheDocument()
  })

  it('HowItWorksPanel lists Upload, Enhance, Export steps', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByRole('button', { name: /Steps/i }))

    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Enhance')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })
})

describe('Navbar — signed in', () => {
  const signedInUser = { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } }

  beforeEach(() => {
    setupAuth({ user: signedInUser as any })
  })

  it('shows initials and display name in the avatar', () => {
    renderNavbar()
    expect(screen.getByText('JS')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('falls back to the email as the display name when full_name is missing', () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any })
    renderNavbar()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('opens the user menu showing Profile, Dashboard, AI, Settings and Sign Out', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it.each([
    ['Profile', '/profile'],
    ['Dashboard', '/dashboard'],
    ['AI', '/ai'],
    ['Settings', '/settings'],
  ])('navigates to %s when %s is clicked', async (label, path) => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText(label))

    expect(mockNavigate).toHaveBeenCalledWith(path)
  })

  it('calls signOut when Sign Out is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('Sign Out'))

    expect(signOut).toHaveBeenCalled()
  })
})
