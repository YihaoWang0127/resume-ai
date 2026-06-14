import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChangePasswordSettings from '@/components/settings/ChangePasswordSettings'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), updateUser: vi.fn() },
    rpc: vi.fn(),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const mockUseAuth = vi.mocked(useAuth)
const mockSignIn = vi.mocked(supabase.auth.signInWithPassword)
const mockUpdateUser = vi.mocked(supabase.auth.updateUser)

const signOut = vi.fn()

function setupAuth(identities: { provider: string }[] = [{ provider: 'email' }]) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'jane@example.com', identities },
    signOut,
  } as any)
}

function renderChangePasswordSettings() {
  return render(
    <MemoryRouter>
      <ChangePasswordSettings />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

describe('ChangePasswordSettings — password change', () => {
  it('shows the Change Password card for email/password accounts', () => {
    renderChangePasswordSettings()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
  })

  it('hides the Change Password card for OAuth-only accounts', () => {
    setupAuth([{ provider: 'google' }])
    renderChangePasswordSettings()
    expect(screen.queryByText('Change Password')).not.toBeInTheDocument()
  })

  it('disables Update Password until all fields are filled', () => {
    renderChangePasswordSettings()
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
  })

  it('shows an error toast when the new password is too short', async () => {
    const user = userEvent.setup()
    renderChangePasswordSettings()

    await user.type(screen.getByLabelText('Current Password'), 'oldpass')
    await user.type(screen.getByLabelText('New Password'), 'abc')
    await user.type(screen.getByLabelText('Confirm New Password'), 'abc')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(toast.error).toHaveBeenCalledWith('New password must be at least 6 characters')
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('shows an error toast when the passwords do not match', async () => {
    const user = userEvent.setup()
    renderChangePasswordSettings()

    await user.type(screen.getByLabelText('Current Password'), 'oldpass')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass2')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(toast.error).toHaveBeenCalledWith('Passwords do not match')
  })

  it('re-authenticates and updates the password on success', async () => {
    mockSignIn.mockResolvedValue({ error: null } as any)
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as any)
    const user = userEvent.setup()
    renderChangePasswordSettings()

    await user.type(screen.getByLabelText('Current Password'), 'oldpass')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'oldpass' })
    )
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass1' })
    expect(toast.success).toHaveBeenCalledWith('Password updated')
  })

  it('shows "Current password is incorrect" when re-authentication fails', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } } as any)
    const user = userEvent.setup()
    renderChangePasswordSettings()

    await user.type(screen.getByLabelText('Current Password'), 'wrongpass')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Current password is incorrect'))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
