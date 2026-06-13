import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileSettings from '@/components/settings/ProfileSettings'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { updateUser: vi.fn() },
    storage: { from: vi.fn() },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const mockUseAuth = vi.mocked(useAuth)
const mockUpdateUser = vi.mocked(supabase.auth.updateUser)
const mockStorageFrom = vi.mocked(supabase.storage.from)

const resendVerificationEmail = vi.fn()

function setupAuth(overrides: Record<string, unknown> = {}, authOverrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      user_metadata: { full_name: 'Jane Smith' },
      ...overrides,
    },
    isGuest: false,
    emailVerified: true,
    resendVerificationEmail,
    ...authOverrides,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

describe('ProfileSettings — initial render', () => {
  it('shows the current display name', () => {
    render(<ProfileSettings onDirtyChange={vi.fn()} />)
    expect(screen.getByLabelText('Display Name')).toHaveValue('Jane Smith')
  })

  it('shows a read-only email field', () => {
    render(<ProfileSettings onDirtyChange={vi.fn()} />)
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveValue('jane@example.com')
    expect(emailInput).toBeDisabled()
  })

  it('shows initials in the avatar fallback when there is no avatar image', () => {
    render(<ProfileSettings onDirtyChange={vi.fn()} />)
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('disables Save Changes when nothing has changed', () => {
    render(<ProfileSettings onDirtyChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })
})

describe('ProfileSettings — editing the display name', () => {
  it('reports dirty and enables Save Changes after editing the name', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<ProfileSettings onDirtyChange={onDirtyChange} />)

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled()
  })

  it('calls supabase.auth.updateUser with the new full_name on save', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as any)
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<ProfileSettings onDirtyChange={onDirtyChange} />)

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'New Name' } })
    )
    expect(toast.success).toHaveBeenCalledWith('Profile updated')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('shows an error toast when saving fails', async () => {
    mockUpdateUser.mockResolvedValue({ data: null, error: new Error('Update failed') } as any)
    const user = userEvent.setup()
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Update failed'))
  })
})

describe('ProfileSettings — avatar upload', () => {
  it('uploads the selected file and updates the avatar URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.test/avatar.png' } })
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl } as any)
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as any)

    const user = userEvent.setup()
    const { container } = render(<ProfileSettings onDirtyChange={vi.fn()} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith('user-1/avatar.png', file, { upsert: true })
    )
    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { avatar_url: expect.stringContaining('https://cdn.test/avatar.png') },
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Avatar updated')
  })

  it('shows an error toast when the upload fails', async () => {
    const upload = vi.fn().mockResolvedValue({ error: new Error('Storage error') })
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl: vi.fn() } as any)

    const user = userEvent.setup()
    const { container } = render(<ProfileSettings onDirtyChange={vi.fn()} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Storage error'))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})

describe('ProfileSettings — email verification', () => {
  it('shows a "Verified" pill when the email is verified', () => {
    setupAuth({}, { emailVerified: true })
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend verification email/i })).not.toBeInTheDocument()
  })

  it('shows a "Not Verified" pill and resend button when the email is unverified', () => {
    setupAuth({}, { emailVerified: false })
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    expect(screen.getByText('Not Verified')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
  })

  it('resend button calls resendVerificationEmail, shows success toast, and starts cooldown', async () => {
    setupAuth({}, { emailVerified: false })
    resendVerificationEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /resend verification email/i }))

    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Verification email sent')
    expect(screen.getByRole('button', { name: /resend \(60s\)/i })).toBeDisabled()
  })

  it('shows an error toast when resend fails', async () => {
    setupAuth({}, { emailVerified: false })
    resendVerificationEmail.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /resend verification email/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
    expect(screen.getByRole('button', { name: /resend verification email/i })).not.toBeDisabled()
  })

  it('renders nothing for guest users', () => {
    setupAuth({}, { isGuest: true, emailVerified: true })
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend verification email/i })).not.toBeInTheDocument()
  })

  it('renders nothing when the user has no email', () => {
    setupAuth({ email: undefined }, { emailVerified: false })
    render(<ProfileSettings onDirtyChange={vi.fn()} />)

    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
  })
})
