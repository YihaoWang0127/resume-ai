import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { getPreferences, upsertPreferences } from '@/services/preferences'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import type { UserPreferences } from '@/types/preferences'

const mockFrom = vi.mocked(supabase.from)
const mockGetUser = vi.mocked(supabase.auth.getUser)

const mockUser = { id: 'user-123', email: 'jane@example.com' }

const savedPrefs: UserPreferences = {
  user_id: 'user-123',
  tone: 'executive',
  writing_style: 'detailed',
  industry: 'Finance',
  job_level: 'senior',
  ats_mode: true,
  notify_export_complete: true,
  notify_product_updates: false,
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

// ── getPreferences ───────────────────────────────────────────────────────────

describe('getPreferences', () => {
  it('calls .select("*").eq("user_id", id).maybeSingle() and returns the row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: savedPrefs, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getPreferences()

    expect(mockFrom).toHaveBeenCalledWith('user_preferences')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(result).toEqual(savedPrefs)
  })

  it('returns null when no row exists yet', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    expect(await getPreferences()).toBeNull()
  })

  it.each([
    ['PGRST205', 'Could not find the table'],
    ['42P01', 'relation "user_preferences" does not exist'],
  ])('returns null when the table does not exist yet (%s)', async (code, message) => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { code, message } })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    expect(await getPreferences()).toBeNull()
  })

  it('throws for any other error code', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const error = { code: '42501', message: 'permission denied' }
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    await expect(getPreferences()).rejects.toEqual(error)
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(getPreferences()).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── upsertPreferences ────────────────────────────────────────────────────────

describe('upsertPreferences', () => {
  it('calls .upsert() with user_id, the given preferences, and updated_at', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedPrefs, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any)

    const result = await upsertPreferences(DEFAULT_PREFERENCES)

    expect(mockFrom).toHaveBeenCalledWith('user_preferences')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', ...DEFAULT_PREFERENCES, updated_at: expect.any(String) })
    )
    expect(result).toEqual(savedPrefs)
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(upsertPreferences(DEFAULT_PREFERENCES)).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws when the upsert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const error = { message: 'db error' }
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any)

    await expect(upsertPreferences(DEFAULT_PREFERENCES)).rejects.toEqual(error)
  })
})
