import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthModal from '@/components/AuthModal'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

const signInWithEmail = vi.fn()
const signUpWithEmail = vi.fn()
const signInAsGuest = vi.fn()
const closeAuthModal = vi.fn()

function setupAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    loading: false,
    isGuest: false,
    showAuthModal: true,
    openAuthModal: vi.fn(),
    closeAuthModal,
    signInWithEmail,
    signUpWithEmail,
    signInAsGuest,
    signOut: vi.fn(),
    ...overrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

// Helper: the Sign In / Sign Up tab buttons are type="button";
// the form submit is type="submit". Use selector to disambiguate.
const tabButton = (name: string) => screen.getByText(name, { selector: 'button[type="button"]' })
const submitButton = () => screen.getByText(/^(Sign In|Create Account)$/, { selector: 'button[type="submit"]' })

// ── initial render ────────────────────────────────────────────────────────────

describe('AuthModal — initial render', () => {
  it('renders with the Sign In tab active by default', () => {
    render(<AuthModal />)
    const signInTab = tabButton('Sign In')
    expect(signInTab).toBeInTheDocument()
    expect(signInTab.className).toMatch(/border-primary/)
  })

  it('shows both Sign In and Sign Up tabs', () => {
    render(<AuthModal />)
    expect(tabButton('Sign In')).toBeInTheDocument()
    expect(tabButton('Sign Up')).toBeInTheDocument()
  })

  it('shows Continue as Guest button', () => {
    render(<AuthModal />)
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument()
  })

  it('does not render when showAuthModal is false', () => {
    setupAuth({ showAuthModal: false })
    render(<AuthModal />)
    expect(screen.queryByText('Continue as Guest')).not.toBeInTheDocument()
  })
})

// ── tab switching ─────────────────────────────────────────────────────────────

describe('AuthModal — tab switching', () => {
  it('switches to Sign Up tab on click', async () => {
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(tabButton('Sign Up'))

    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('switches back to Sign In tab after being on Sign Up', async () => {
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(tabButton('Sign Up'))
    await user.click(tabButton('Sign In'))

    // Submit button reverts to "Sign In" label
    expect(screen.getByText('Sign In', { selector: 'button[type="submit"]' })).toBeInTheDocument()
  })
})

// ── form submission ───────────────────────────────────────────────────────────

describe('AuthModal — form submission', () => {
  it('calls signInWithEmail with entered credentials on Sign In submit', async () => {
    signInWithEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.click(submitButton())

    await waitFor(() =>
      expect(signInWithEmail).toHaveBeenCalledWith('test@example.com', 'secret123')
    )
  })

  it('calls closeAuthModal after a successful sign-in', async () => {
    signInWithEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(submitButton())

    await waitFor(() => expect(closeAuthModal).toHaveBeenCalled())
  })

  it('shows error message on sign-in failure', async () => {
    signInWithEmail.mockRejectedValue(new Error('Invalid login credentials'))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.type(screen.getByPlaceholderText('Email'), 'bad@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong')
    await user.click(submitButton())

    await waitFor(() =>
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    )
  })

  it('calls signInAsGuest when Continue as Guest is clicked', async () => {
    signInAsGuest.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    await waitFor(() => expect(signInAsGuest).toHaveBeenCalled())
  })
})

// ── close / backdrop ──────────────────────────────────────────────────────────

describe('AuthModal — close behaviour', () => {
  it('does not show close button when user has no session', () => {
    setupAuth({ user: null })
    render(<AuthModal />)
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('shows close button when user already has a session', () => {
    setupAuth({ user: { id: 'u1', email: 'u@x.com' } as any })
    render(<AuthModal />)
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('clicking the backdrop does not call closeAuthModal', async () => {
    const user = userEvent.setup()
    const { container } = render(<AuthModal />)
    // The outer backdrop div has no click handler — clicking it should do nothing
    const backdrop = container.querySelector('.fixed.inset-0')!
    await user.click(backdrop)
    expect(closeAuthModal).not.toHaveBeenCalled()
  })
})
