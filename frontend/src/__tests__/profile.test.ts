import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { getProfile, upsertProfile } from '@/services/profile'
import { DEFAULT_PROFILE } from '@/types/profile'
import type { ProfileData } from '@/types/profile'

const mockFrom = vi.mocked(supabase.from)
const mockGetUser = vi.mocked(supabase.auth.getUser)

const mockUser = { id: 'user-123', email: 'jane@example.com' }

const savedProfile: ProfileData = {
  user_id: 'user-123',
  full_name: 'Jane Smith',
  phone: '555-1234',
  address: 'San Francisco, CA',
  job_title: 'Software Engineer',
  experience: [
    { company: 'Acme', title: 'Engineer', startDate: 'Jan 2022', endDate: '', current: true, bullets: ['Did things'] },
  ],
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

// ── getProfile ───────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('calls .select("*").eq("user_id", id).maybeSingle() and returns the row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: savedProfile, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getProfile()

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(result).toEqual(savedProfile)
  })

  it('returns null when no row exists yet', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    expect(await getProfile()).toBeNull()
  })

  it('returns null when the table does not exist yet (PGRST205)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: 'Could not find the table' },
    })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    expect(await getProfile()).toBeNull()
  })

  it('returns null when the table does not exist yet (42P01)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation "profiles" does not exist' },
    })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    expect(await getProfile()).toBeNull()
  })

  it('throws for any other error code', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const error = { code: '42501', message: 'permission denied' }
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    await expect(getProfile()).rejects.toEqual(error)
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(getProfile()).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── upsertProfile ────────────────────────────────────────────────────────────

describe('upsertProfile', () => {
  it('calls .upsert() with user_id, the given profile, and updated_at', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedProfile, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any)

    const result = await upsertProfile(DEFAULT_PROFILE)

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', ...DEFAULT_PROFILE, updated_at: expect.any(String) })
    )
    expect(result).toEqual(savedProfile)
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(upsertProfile(DEFAULT_PROFILE)).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws when the upsert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const error = { message: 'db error' }
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ upsert: mockUpsert } as any)

    await expect(upsertProfile(DEFAULT_PROFILE)).rejects.toEqual(error)
  })
})
