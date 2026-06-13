import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailVerificationBanner from '@/components/EmailVerificationBanner'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const mockUseAuth = vi.mocked(useAuth)
const resendVerificationEmail = vi.fn()

function setupAuth(overrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'jane@example.com' },
    isGuest: false,
    emailVerified: false,
    resendVerificationEmail,
    ...overrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  setupAuth()
})

describe('EmailVerificationBanner — visibility', () => {
  it('renders nothing when there is no user', () => {
    setupAuth({ user: null })
    const { container } = render(<EmailVerificationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a guest user', () => {
    setupAuth({ isGuest: true })
    const { container } = render(<EmailVerificationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the email is already verified', () => {
    setupAuth({ emailVerified: true })
    const { container } = render(<EmailVerificationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when previously dismissed this session', () => {
    sessionStorage.setItem('email-verification-dismissed:user-1', 'true')
    const { container } = render(<EmailVerificationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner with the user email for an unverified user', () => {
    render(<EmailVerificationBanner />)
    expect(screen.getByText(/jane@example.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend email/i })).toBeInTheDocument()
  })
})

describe('EmailVerificationBanner — resend', () => {
  it('calls resendVerificationEmail, shows a success toast, and starts the cooldown', async () => {
    resendVerificationEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<EmailVerificationBanner />)

    await user.click(screen.getByRole('button', { name: /resend email/i }))

    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Verification email sent')
    expect(screen.getByRole('button', { name: /resend \(60s\)/i })).toBeDisabled()
  })

  it('shows an error toast when resend fails', async () => {
    resendVerificationEmail.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<EmailVerificationBanner />)

    await user.click(screen.getByRole('button', { name: /resend email/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
    expect(screen.getByRole('button', { name: /resend email/i })).not.toBeDisabled()
  })

  describe('cooldown countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('counts down the cooldown after a successful resend', async () => {
      resendVerificationEmail.mockResolvedValue(undefined)
      render(<EmailVerificationBanner />)

      const resendButton = screen.getByRole('button', { name: /resend email/i })
      await act(async () => {
        resendButton.click()
      })

      expect(screen.getByRole('button', { name: /resend \(60s\)/i })).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      expect(screen.getByRole('button', { name: /resend \(59s\)/i })).toBeInTheDocument()
    })
  })
})

describe('EmailVerificationBanner — dismiss', () => {
  it('hides the banner and persists dismissal to sessionStorage', async () => {
    const user = userEvent.setup()
    const { container } = render(<EmailVerificationBanner />)

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(container).toBeEmptyDOMElement()
    expect(sessionStorage.getItem('email-verification-dismissed:user-1')).toBe('true')
  })
})
