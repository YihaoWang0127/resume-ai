import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SecuritySettings from '@/components/settings/SecuritySettings'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

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
const mockRpc = vi.mocked(supabase.rpc)

const signOut = vi.fn()

function setupAuth(identities: { provider: string }[] = [{ provider: 'email' }]) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'jane@example.com', identities },
    signOut,
  } as any)
}

function renderSecuritySettings() {
  return render(
    <MemoryRouter>
      <SecuritySettings />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

describe('SecuritySettings — password change', () => {
  it('shows the Change Password card for email/password accounts', () => {
    renderSecuritySettings()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
  })

  it('hides the Change Password card for OAuth-only accounts', () => {
    setupAuth([{ provider: 'google' }])
    renderSecuritySettings()
    expect(screen.queryByText('Change Password')).not.toBeInTheDocument()
  })

  it('disables Update Password until all fields are filled', () => {
    renderSecuritySettings()
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
  })

  it('shows an error toast when the new password is too short', async () => {
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.type(screen.getByLabelText('Current Password'), 'oldpass')
    await user.type(screen.getByLabelText('New Password'), 'abc')
    await user.type(screen.getByLabelText('Confirm New Password'), 'abc')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(toast.error).toHaveBeenCalledWith('New password must be at least 6 characters')
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('shows an error toast when the passwords do not match', async () => {
    const user = userEvent.setup()
    renderSecuritySettings()

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
    renderSecuritySettings()

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
    renderSecuritySettings()

    await user.type(screen.getByLabelText('Current Password'), 'wrongpass')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Current password is incorrect'))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})

describe('SecuritySettings — delete account', () => {
  it('opens the confirmation modal when Delete Account is clicked', async () => {
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('keeps the confirm button disabled until "DELETE" is typed', async () => {
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    expect(confirmButton).not.toBeDisabled()
  })

  it('calls the delete RPC and signs out on confirm', async () => {
    mockRpc.mockResolvedValue({ error: null } as any)
    signOut.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_user_account'))
    expect(signOut).toHaveBeenCalled()
  })

  it('shows an error toast and does not sign out if deletion fails', async () => {
    mockRpc.mockResolvedValue({ error: new Error('Server error') } as any)
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server error'))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('closes the modal and clears the confirm text on Cancel', async () => {
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()
  })

  it('closes the modal, shows a success toast, and navigates to "/" on successful deletion', async () => {
    mockRpc.mockResolvedValue({ error: null } as any)
    signOut.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderSecuritySettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Your account has been deleted.'))
    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
