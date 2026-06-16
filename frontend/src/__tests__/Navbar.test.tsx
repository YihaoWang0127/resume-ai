import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '@/components/Navbar'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

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
  it('shows "Sign in" text link and "Get Started Free" button', () => {
    renderNavbar()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByText('Get Started Free')).toBeInTheDocument()
  })

  it('does not show a Guest dropdown trigger', () => {
    renderNavbar()
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
  })

  it('calls openAuthModal when "Sign in" is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Sign in'))

    expect(openAuthModal).toHaveBeenCalled()
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
  it('shows "Sign in" text link and "Get Started Free" button for anonymous users', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderNavbar()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByText('Get Started Free')).toBeInTheDocument()
  })

  it('does not show a Guest dropdown trigger for anonymous users', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderNavbar()
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
  })

  it('calls openAuthModal when "Sign in" is clicked for anonymous users', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Sign in'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('calls openAuthModal when "Get Started Free" is clicked for anonymous users', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Get Started Free'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('does not show Dashboard in the nav for anonymous users', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderNavbar()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})

describe('Navbar — center nav links', () => {
  it('renders all four nav links when no onBack or children props are present', () => {
    renderNavbar()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })

  it('hides center nav links when onBack prop is provided', () => {
    render(<Navbar onBack={vi.fn()} />, { wrapper: MemoryRouter })
    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.queryByText('How It Works')).not.toBeInTheDocument()
    expect(screen.queryByText('Templates')).not.toBeInTheDocument()
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
  })

  it('hides center nav links when children are provided', () => {
    render(
      <Navbar>
        <button>Action</button>
      </Navbar>,
      { wrapper: MemoryRouter }
    )
    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.queryByText('How It Works')).not.toBeInTheDocument()
    expect(screen.queryByText('Templates')).not.toBeInTheDocument()
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument()
  })
})

describe('Navbar — signed in', () => {
  it('shows initials in the avatar fallback when there is no avatar image', () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    renderNavbar()
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('shows the display name from user_metadata.full_name', () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    renderNavbar()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('falls back to the email as the display name when full_name is missing', () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: {} } as any })
    renderNavbar()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('opens the user menu showing Profile, Dashboard, AI, Settings and Sign Out', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('navigates to /profile when Profile is clicked', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('Profile'))

    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('navigates to /dashboard when Dashboard is clicked', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('Dashboard'))

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('navigates to /ai when AI is clicked', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('AI'))

    expect(mockNavigate).toHaveBeenCalledWith('/ai')
  })

  it('navigates to /settings when Settings is clicked', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('Settings'))

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  it('calls signOut when Sign Out is clicked', async () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com', user_metadata: { full_name: 'Jane Smith' } } as any })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Jane Smith'))
    await user.click(screen.getByText('Sign Out'))

    expect(signOut).toHaveBeenCalled()
  })
})
