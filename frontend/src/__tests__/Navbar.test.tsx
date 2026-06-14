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
  it('shows a Guest trigger', () => {
    renderNavbar()
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('opens the guest menu showing Profile, AI, Settings and Sign In / Sign Up', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('navigates to /profile when Profile is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Profile'))

    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('navigates to /ai when AI is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('AI'))

    expect(mockNavigate).toHaveBeenCalledWith('/ai')
  })

  it('navigates to /settings when Settings is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Settings'))

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  it('calls openAuthModal when Sign In / Sign Up is clicked', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Sign In / Sign Up'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('closes the guest menu when clicking the trigger again', async () => {
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()

    await user.click(screen.getByText('Guest'))
    expect(screen.queryByText('Sign In / Sign Up')).not.toBeInTheDocument()
  })

  it('closes the guest menu when clicking outside of it', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Navbar />
        <button>Outside</button>
      </div>,
      { wrapper: MemoryRouter }
    )

    await user.click(screen.getByText('Guest'))
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()

    await user.click(screen.getByText('Outside'))
    expect(screen.queryByText('Sign In / Sign Up')).not.toBeInTheDocument()
  })
})

describe('Navbar — anonymous guest session (isGuest: true)', () => {
  it('shows a Guest trigger for an anonymous user', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderNavbar()
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('opens the guest menu showing Profile, AI, Settings and Sign In / Sign Up', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('calls openAuthModal when Sign In / Sign Up is clicked', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderNavbar()

    await user.click(screen.getByText('Guest'))
    await user.click(screen.getByText('Sign In / Sign Up'))

    expect(openAuthModal).toHaveBeenCalled()
  })

  it('closes the guest menu when clicking outside of it', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    render(
      <div>
        <Navbar />
        <button>Outside</button>
      </div>,
      { wrapper: MemoryRouter }
    )

    await user.click(screen.getByText('Guest'))
    expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument()

    await user.click(screen.getByText('Outside'))
    expect(screen.queryByText('Sign In / Sign Up')).not.toBeInTheDocument()
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
