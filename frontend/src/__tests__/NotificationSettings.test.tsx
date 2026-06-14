import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSettings from '@/components/settings/NotificationSettings'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { UserPreferences } from '@/types/preferences'

vi.mock('@/services/preferences', () => ({
  getPreferences: vi.fn(),
  upsertPreferences: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getPreferences, upsertPreferences } from '@/services/preferences'
import { toast } from 'sonner'

const mockGetPreferences = vi.mocked(getPreferences)
const mockUpsertPreferences = vi.mocked(upsertPreferences)

const savedPrefs: UserPreferences = {
  user_id: 'user-1',
  tone: 'executive',
  writing_style: 'detailed',
  industry: 'Finance',
  job_level: 'senior',
  ats_mode: true,
  notify_export_complete: true,
  notify_product_updates: true,
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationSettings — loading', () => {
  it('shows a skeleton while preferences are loading', () => {
    mockGetPreferences.mockReturnValue(new Promise(() => {}))
    render(<NotificationSettings onDirtyChange={vi.fn()} />)

    expect(screen.queryByLabelText('Export Complete Emails')).not.toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })
})

describe('NotificationSettings — defaults', () => {
  it('falls back to default preferences when none are saved (null)', async () => {
    mockGetPreferences.mockResolvedValue(null)
    render(<NotificationSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText('Export Complete Emails')).toBeInTheDocument())
    expect(screen.getByRole('switch', { name: /export complete emails/i })).toBeChecked()
    expect(screen.getByRole('switch', { name: /product updates/i })).not.toBeChecked()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows an error toast when loading preferences fails', async () => {
    mockGetPreferences.mockRejectedValue(new Error('Network error'))
    render(<NotificationSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
  })
})

describe('NotificationSettings — saved values', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(savedPrefs))

  it('pre-fills both toggles from saved preferences', async () => {
    render(<NotificationSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('switch', { name: /export complete emails/i })).toBeChecked())
    expect(screen.getByRole('switch', { name: /product updates/i })).toBeChecked()
  })

  it('disables Save Changes until something is edited', async () => {
    render(<NotificationSettings onDirtyChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Export Complete Emails')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })
})

describe('NotificationSettings — editing', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('reports dirty and enables Save after toggling Export Complete Emails', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<NotificationSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Export Complete Emails')).toBeInTheDocument())

    await user.click(screen.getByRole('switch', { name: /export complete emails/i }))

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled()
  })

  it('reports dirty after toggling Product Updates', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<NotificationSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Product Updates')).toBeInTheDocument())

    await user.click(screen.getByRole('switch', { name: /product updates/i }))

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('saves the updated preferences, clears the dirty flag, and shows a success toast', async () => {
    const saved: UserPreferences = { ...DEFAULT_PREFERENCES, user_id: 'user-1', notify_product_updates: true, updated_at: 'now' }
    mockUpsertPreferences.mockResolvedValue(saved)
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<NotificationSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Product Updates')).toBeInTheDocument())

    await user.click(screen.getByRole('switch', { name: /product updates/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockUpsertPreferences).toHaveBeenCalledWith(expect.objectContaining({ notify_product_updates: true }))
    )
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(toast.success).toHaveBeenCalledWith('Preferences saved')
  })

  it('shows an error toast when saving fails', async () => {
    mockUpsertPreferences.mockRejectedValue(new Error('Save failed'))
    const user = userEvent.setup()
    render(<NotificationSettings onDirtyChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Export Complete Emails')).toBeInTheDocument())

    await user.click(screen.getByRole('switch', { name: /export complete emails/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'))
  })
})
