import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthModal from '@/components/AuthModal'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

const signInWithEmail = vi.fn()
const signUpWithEmail = vi.fn()
const signInAsGuest = vi.fn()
const signInWithGoogle = vi.fn()
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
    signInWithGoogle,
    signOut,
    ...overrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

// Helpers — disambiguate tab buttons (type="button") from the form submit
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

  it('shows Continue with Google button', () => {
    render(<AuthModal />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
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

    await waitFor(() => expect(submitButton().textContent).toBe('Sign In'))
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

// ── Google sign-in ────────────────────────────────────────────────────────────

describe('AuthModal — Google sign-in', () => {
  it('calls signInWithGoogle when Continue with Google is clicked', async () => {
    signInWithGoogle.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled())
  })

  it('shows error message when Google sign-in fails', async () => {
    signInWithGoogle.mockRejectedValue(new Error('OAuth failed'))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() =>
      expect(screen.getByText('OAuth failed')).toBeInTheDocument()
    )
  })

  it('resets loading after a Google sign-in error', async () => {
    signInWithGoogle.mockRejectedValue(new Error('OAuth failed'))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue with google/i })).not.toBeDisabled()
    )
  })

  it('disables the Guest button while Google sign-in is loading', async () => {
    let resolveGoogle: () => void
    signInWithGoogle.mockReturnValue(new Promise<void>((resolve) => { resolveGoogle = resolve }))
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled()

    await act(async () => { resolveGoogle!(); })
  })
})

// ── sign-up success card ──────────────────────────────────────────────────────

describe('AuthModal — sign-up success', () => {
  async function doSignUp() {
    signUpWithEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal />)

    await user.click(tabButton('Sign Up'))
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(submitButton())
    return user
  }

  it('shows "Check your email!" heading after sign-up', async () => {
    await doSignUp()
    await waitFor(() =>
      expect(screen.getByText('Check your email!')).toBeInTheDocument()
    )
  })

  it('shows the email address used for sign-up', async () => {
    await doSignUp()
    await waitFor(() =>
      expect(screen.getByText('new@example.com')).toBeInTheDocument()
    )
  })

  it('does not close the modal automatically after sign-up', async () => {
    await doSignUp()
    await waitFor(() => expect(screen.getByText('Check your email!')).toBeInTheDocument())
    expect(closeAuthModal).not.toHaveBeenCalled()
  })

  it('hides the form and shows the success card', async () => {
    await doSignUp()
    await waitFor(() => expect(screen.getByText('Check your email!')).toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument()
  })

  it('"OK, GOT IT" button closes the modal', async () => {
    await doSignUp()
    const user = userEvent.setup()
    await waitFor(() => screen.getByText('OK, GOT IT'))
    await user.click(screen.getByRole('button', { name: /ok, got it/i }))
    expect(closeAuthModal).toHaveBeenCalled()
  })
})

// ── email validation ──────────────────────────────────────────────────────────
// Use fireEvent.change (synchronous) + act(vi.advanceTimersByTime) to avoid
// the deadlock that occurs when userEvent.type()'s internal delays interact
// with vi.useFakeTimers().

describe('AuthModal — email validation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupAuth()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    render(<AuthModal />)
    return screen.getByPlaceholderText('Email')
  }

  function typeEmail(input: HTMLElement, value: string) {
    fireEvent.change(input, { target: { value } })
  }

  function fireDebounce() {
    act(() => { vi.advanceTimersByTime(300) })
  }

  it('shows no validation state when email field is empty', () => {
    setup()
    fireDebounce()
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
  })

  it('shows error text for invalid email after debounce', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'notanemail')
    fireDebounce()
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it('does not show error for a valid email', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'valid@example.com')
    fireDebounce()
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
  })

  it('does not show error while user is still typing (before debounce fires)', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'partial@')
    // Debounce NOT advanced — error must not appear yet
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
  })

  it('disables submit button when email is invalid after debounce', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'bad')
    fireDebounce()
    expect(submitButton()).toBeDisabled()
  })

  it('submit button is enabled for a valid email', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'good@example.com')
    fireDebounce()
    expect(submitButton()).not.toBeDisabled()
  })

  it('submit button is enabled when field is empty (no content to validate)', () => {
    setup()
    fireDebounce()
    expect(submitButton()).not.toBeDisabled()
  })

  it('clears validation error when switching tabs', () => {
    const emailInput = setup()
    typeEmail(emailInput, 'bad')
    fireDebounce()
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    fireEvent.click(tabButton('Sign Up'))
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument()
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
    const backdrop = container.querySelector('.fixed.inset-0')!
    await user.click(backdrop)
    expect(closeAuthModal).not.toHaveBeenCalled()
  })
})
