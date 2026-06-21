import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { UserPreferences } from '@/types/preferences'
import type { AiUsageStats } from '@/types/aiUsage'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/services/preferences', () => ({ getPreferences: vi.fn(), upsertPreferences: vi.fn() }))
vi.mock('@/services/aiUsage', () => ({ getAiUsageStats: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/Navbar', () => ({
  default: ({ onBack }: { onBack?: () => void }) => <button onClick={onBack}>Back</button>,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

// ── imports after mocks ───────────────────────────────────────────────────────

import { getPreferences, upsertPreferences } from '@/services/preferences'
import { getAiUsageStats } from '@/services/aiUsage'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import AI from '@/pages/AI'

const mockGetPreferences = vi.mocked(getPreferences)
const mockUpsertPreferences = vi.mocked(upsertPreferences)
const mockGetAiUsageStats = vi.mocked(getAiUsageStats)
const mockUseAuth = vi.mocked(useAuth)

const emptyStats: AiUsageStats = {
  totalCalls: 0,
  callsThisMonth: 0,
  callsByAction: { parse: 0, enrich: 0, tailor: 0, cover_letter: 0, cover_letter_improve: 0, ats_score: 0 },
  recent: [],
}

const savedPrefs: UserPreferences = {
  user_id: 'user-1',
  tone: 'executive',
  writing_style: 'detailed',
  industry: 'Finance',
  job_level: 'senior',
  ats_mode: true,
  notify_export_complete: true,
  notify_product_updates: false,
  updated_at: '2026-01-01T00:00:00Z',
}

function renderAI() {
  return render(
    <MemoryRouter initialEntries={['/ai']}>
      <Routes>
        <Route path="/ai" element={<AI />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAiUsageStats.mockResolvedValue(emptyStats)
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'jane@example.com' },
    isGuest: false,
  } as any)
})

// ── AI Preferences card ───────────────────────────────────────────────────────

describe('AI — AI Preferences (loading)', () => {
  it('shows a skeleton while preferences are loading', () => {
    mockGetPreferences.mockReturnValue(new Promise(() => {}))
    renderAI()
    expect(screen.queryByLabelText('Target Industry')).not.toBeInTheDocument()
  })
})

describe('AI — AI Preferences (defaults)', () => {
  it('falls back to default preferences when none are saved (null)', async () => {
    mockGetPreferences.mockResolvedValue(null)
    renderAI()

    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())
    expect(screen.getByLabelText('Target Industry')).toHaveValue(DEFAULT_PREFERENCES.industry)
    expect(screen.getByRole('switch', { name: /ats mode/i })).not.toBeChecked()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows an error toast when loading preferences fails', async () => {
    mockGetPreferences.mockRejectedValue(new Error('Network error'))
    renderAI()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
  })
})

describe('AI — AI Preferences (saved values)', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(savedPrefs))

  it('pre-fills the industry field and ATS switch from saved preferences', async () => {
    renderAI()

    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toHaveValue('Finance'))
    expect(screen.getByRole('switch', { name: /ats mode/i })).toBeChecked()
  })

  it('disables Save Changes until something is edited', async () => {
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })
})

describe('AI — AI Preferences (editing)', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('enables Save after editing the industry field', async () => {
    const user = userEvent.setup()
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')

    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled()
  })

  it('saves the updated preferences and disables Save again', async () => {
    const saved: UserPreferences = { ...DEFAULT_PREFERENCES, user_id: 'user-1', industry: 'Healthcare', updated_at: 'now' }
    mockUpsertPreferences.mockResolvedValue(saved)
    const user = userEvent.setup()
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockUpsertPreferences).toHaveBeenCalledWith(expect.objectContaining({ industry: 'Healthcare' }))
    )
    expect(toast.success).toHaveBeenCalledWith('Preferences saved')
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled())
  })

  it('shows an error toast when saving fails', async () => {
    mockUpsertPreferences.mockRejectedValue(new Error('Save failed'))
    const user = userEvent.setup()
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'))
  })
})

// ── Technical details collapsible ────────────────────────────────────────────

describe('AI — Technical details', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('shows model info after expanding the Technical details section', async () => {
    renderAI()
    await waitFor(() => expect(screen.getByText('Technical details')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Technical details').closest('button')!)

    expect(screen.getByText('Resume Parsing')).toBeInTheDocument()
    expect(screen.getByText('Enrichment & Tailoring')).toBeInTheDocument()
    expect(screen.getByText('Cover Letters')).toBeInTheDocument()
    expect(screen.getByText('ATS Scoring')).toBeInTheDocument()
    expect(screen.getAllByText(/Claude Haiku 4\.5/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Claude Sonnet 4\.6/).length).toBeGreaterThan(0)
  })
})

// ── AI Usage card ────────────────────────────────────────────────────────────

describe('AI — AI Usage card (loading)', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('shows skeleton placeholders while usage stats are loading', () => {
    mockGetAiUsageStats.mockReturnValue(new Promise(() => {}))
    renderAI()

    expect(screen.queryByText('Total AI Calls')).not.toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows an error toast when loading usage stats fails', async () => {
    mockGetAiUsageStats.mockRejectedValue(new Error('Usage fetch failed'))
    renderAI()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Usage fetch failed'))
  })
})

describe('AI — AI Usage card (empty state)', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('shows zero totals and the empty-activity message when there is no usage yet', async () => {
    mockGetAiUsageStats.mockResolvedValue(emptyStats)
    renderAI()

    await waitFor(() => expect(screen.getByText('Total AI Calls')).toBeInTheDocument())
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText(/no ai activity yet/i)).toBeInTheDocument()

    // Both stat tiles should show 0
    const totalCallsTile = screen.getByText('Total AI Calls').previousElementSibling
    expect(totalCallsTile?.textContent).toBe('0')
  })

  it('shows zero counts for each action in the By Action breakdown', async () => {
    mockGetAiUsageStats.mockResolvedValue(emptyStats)
    renderAI()

    await waitFor(() => expect(screen.getByText('By Action')).toBeInTheDocument())
    expect(screen.getByText('Parse Resume')).toBeInTheDocument()
    expect(screen.getByText('Enrich Resume')).toBeInTheDocument()
    expect(screen.getByText('Tailor Resume')).toBeInTheDocument()
    expect(screen.getByText('Cover Letter')).toBeInTheDocument()
    expect(screen.getByText('ATS Score')).toBeInTheDocument()
  })
})

describe('AI — AI Usage card (with usage)', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('shows totals and recent activity entries', async () => {
    const stats: AiUsageStats = {
      totalCalls: 12,
      callsThisMonth: 5,
      callsByAction: { parse: 3, enrich: 4, tailor: 2, cover_letter: 2, cover_letter_improve: 0, ats_score: 1 },
      recent: [
        { id: 'log-1', action: 'enrich', model: 'claude-sonnet-4-6', created_at: '2026-06-01T10:00:00Z' },
        { id: 'log-2', action: 'parse', model: 'claude-haiku-4-5', created_at: '2026-06-02T11:00:00Z' },
      ],
    }
    mockGetAiUsageStats.mockResolvedValue(stats)
    renderAI()

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    // "Enrich Resume" and "Parse Resume" each appear in both the By Action
    // breakdown and the Recent Activity list
    expect(screen.getAllByText('Enrich Resume').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Parse Resume').length).toBeGreaterThan(1)
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
    expect(screen.getByText('claude-haiku-4-5')).toBeInTheDocument()
  })

  it('shows the correct per-action counts in the breakdown', async () => {
    const stats: AiUsageStats = {
      totalCalls: 12,
      callsThisMonth: 5,
      callsByAction: { parse: 3, enrich: 4, tailor: 2, cover_letter: 2, cover_letter_improve: 0, ats_score: 1 },
      recent: [],
    }
    mockGetAiUsageStats.mockResolvedValue(stats)
    renderAI()

    await waitFor(() => expect(screen.getByText('By Action')).toBeInTheDocument())
    const parseRow = screen.getByText('Parse Resume').closest('div')
    expect(parseRow?.textContent).toContain('3')
  })

  it('limits recent activity display to 10 entries', async () => {
    const recent = Array.from({ length: 15 }, (_, i) => ({
      id: `log-${i}`,
      action: 'parse' as const,
      model: 'claude-haiku-4-5',
      created_at: `2026-06-${(i + 1).toString().padStart(2, '0')}T10:00:00Z`,
    }))
    const stats: AiUsageStats = {
      totalCalls: 15,
      callsThisMonth: 15,
      callsByAction: { parse: 15, enrich: 0, tailor: 0, cover_letter: 0, cover_letter_improve: 0, ats_score: 0 },
      recent,
    }
    mockGetAiUsageStats.mockResolvedValue(stats)
    renderAI()

    await waitFor(() => expect(screen.getByText('Recent Activity')).toBeInTheDocument())
    expect(screen.getAllByText('claude-haiku-4-5').length).toBe(10)
  })
})

// ── back navigation ──────────────────────────────────────────────────────────

describe('AI — back navigation', () => {
  beforeEach(() => mockGetPreferences.mockResolvedValue(null))

  it('navigates to the dashboard when there are no unsaved changes', async () => {
    const user = userEvent.setup()
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.click(screen.getByText('Back'))

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('asks for confirmation when there are unsaved changes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderAI()
    await waitFor(() => expect(screen.getByLabelText('Target Industry')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Target Industry'), 'Healthcare')
    await user.click(screen.getByText('Back'))

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument()
  })
})
