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
const signOut = vi.fn()

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
    signOut,
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

  it('resets loading after a sign-in error', async () => {
    signInWithEmail.mockRejectedValue(new Error('Invalid login credentials'))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.type(screen.getByPlaceholderText('Email'), 'bad@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong')
    await user.click(submitButton())

    // After the error the submit button should be re-enabled (not showing "...")
    await waitFor(() =>
      expect(submitButton().textContent).toBe('Sign In')
    )
  })

  it('calls signInAsGuest when Continue as Guest is clicked', async () => {
    signInAsGuest.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    await waitFor(() => expect(signInAsGuest).toHaveBeenCalled())
  })

  it('resets loading after a guest sign-in error', async () => {
    signInAsGuest.mockRejectedValue(new Error('Guest sign-in failed'))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue as guest/i })).not.toBeDisabled()
    )
  })
})

// ── guest user ────────────────────────────────────────────────────────────────

describe('AuthModal — guest user', () => {
  it('shows the auth form (not the already-signed-in view) for a guest user', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    render(<AuthModal />)
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.queryByText("You're already signed in")).not.toBeInTheDocument()
  })

  it('shows close button for a guest user (they have a session)', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    render(<AuthModal />)
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('clicking Continue as Guest just closes the modal when already a guest', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue as guest/i }))

    expect(closeAuthModal).toHaveBeenCalled()
    expect(signInAsGuest).not.toHaveBeenCalled()
  })
})

// ── already signed in (non-guest) ────────────────────────────────────────────

describe('AuthModal — already signed in', () => {
  beforeEach(() => {
    setupAuth({ user: { id: 'u1', email: 'u@x.com' } as any, isGuest: false })
  })

  it('shows "You\'re already signed in" message', () => {
    render(<AuthModal />)
    expect(screen.getByText("You're already signed in")).toBeInTheDocument()
  })

  it('shows the user email', () => {
    render(<AuthModal />)
    expect(screen.getByText('u@x.com')).toBeInTheDocument()
  })

  it('shows a Continue button that closes the modal', async () => {
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(closeAuthModal).toHaveBeenCalled()
  })

  it('shows a Sign Out button that calls signOut and closes the modal', async () => {
    signOut.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    await waitFor(() => expect(closeAuthModal).toHaveBeenCalled())
  })

  it('does not render the auth form', () => {
    render(<AuthModal />)
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument()
  })
})

// ── close / backdrop ──────────────────────────────────────────────────────────

describe('AuthModal — close behaviour', () => {
  it('does not show close button when user has no session', () => {
    setupAuth({ user: null })
    render(<AuthModal />)
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
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
