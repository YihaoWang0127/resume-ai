import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIPreferencesSettings from '@/components/settings/AIPreferencesSettings'
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
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AIPreferencesSettings — loading', () => {
  it('shows a skeleton while preferences are loading', () => {
    mockGetPreferences.mockReturnValue(new Promise(() => {}))
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)
    expect(screen.queryByLabelText('Target Industry')).not.toBeInTheDocument()
  })
})

describe('AIPreferencesSettings — defaults', () => {
  it('falls back to default preferences when none are saved (null)', async () => {
    mockGetPreferences.mockResolvedValue(null)
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())
    expect(screen.getByLabelText('Target Industry')).toHaveValue(DEFAULT_PREFERENCES.industry)
    expect(screen.getByRole('switch', { name: /ats mode/i })).not.toBeChecked()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows an error toast when loading preferences fails', async () => {
    mockGetPreferences.mockRejectedValue(new Error('Network error'))
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
  })
})

describe('AIPreferencesSettings — saved values', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(savedPrefs))

  it('pre-fills the industry field and ATS switch from saved preferences', async () => {
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toHaveValue('Finance'))
    expect(screen.getByRole('switch', { name: /ats mode/i })).toBeChecked()
  })

  it('disables Save Changes until something is edited', async () => {
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })
})

describe('AIPreferencesSettings — editing', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('reports dirty and enables Save after toggling ATS mode', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<AIPreferencesSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.click(screen.getByRole('switch', { name: /ats mode/i }))

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled()
  })

  it('reports dirty after editing the industry field', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<AIPreferencesSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('saves the updated preferences and clears the dirty flag', async () => {
    const saved: UserPreferences = { ...DEFAULT_PREFERENCES, user_id: 'user-1', industry: 'Healthcare', updated_at: 'now' }
    mockUpsertPreferences.mockResolvedValue(saved)
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<AIPreferencesSettings onDirtyChange={onDirtyChange} />)
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockUpsertPreferences).toHaveBeenCalledWith(expect.objectContaining({ industry: 'Healthcare' }))
    )
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(toast.success).toHaveBeenCalledWith('Preferences saved')
  })

  it('shows an error toast when saving fails', async () => {
    mockUpsertPreferences.mockRejectedValue(new Error('Save failed'))
    const user = userEvent.setup()
    render(<AIPreferencesSettings onDirtyChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'))
  })
})
