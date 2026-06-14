import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DangerZoneSettings from '@/components/settings/DangerZoneSettings'

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
const mockRpc = vi.mocked(supabase.rpc)

const signOut = vi.fn()

function setupAuth(identities: { provider: string }[] = [{ provider: 'email' }]) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'jane@example.com', identities },
    signOut,
  } as any)
}

function renderDangerZoneSettings() {
  return render(
    <MemoryRouter>
      <DangerZoneSettings />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

describe('DangerZoneSettings — delete account', () => {
  it('opens the confirmation modal when Delete Account is clicked', async () => {
    const user = userEvent.setup()
    renderDangerZoneSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('keeps the confirm button disabled until "DELETE" is typed', async () => {
    const user = userEvent.setup()
    renderDangerZoneSettings()

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
    renderDangerZoneSettings()

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
    renderDangerZoneSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server error'))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('closes the modal and clears the confirm text on Cancel', async () => {
    const user = userEvent.setup()
    renderDangerZoneSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()
  })

  it('closes the modal, shows a success toast, and navigates to "/" on successful deletion', async () => {
    mockRpc.mockResolvedValue({ error: null } as any)
    signOut.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDangerZoneSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    const confirmButtons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Your account has been deleted.'))
    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
