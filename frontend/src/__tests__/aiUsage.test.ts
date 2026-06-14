import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { logAiUsage, getAiUsageStats } from '@/services/aiUsage'
import type { AiUsageEntry } from '@/types/aiUsage'

const mockFrom = vi.mocked(supabase.from)
const mockGetUser = vi.mocked(supabase.auth.getUser)

const mockUser = { id: 'user-123', email: 'jane@example.com' }

beforeEach(() => vi.clearAllMocks())

// ── logAiUsage ───────────────────────────────────────────────────────────────

describe('logAiUsage', () => {
  it('inserts a row with user_id, action, and model', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    await logAiUsage('enrich', 'claude-sonnet-4-6')

    expect(mockFrom).toHaveBeenCalledWith('ai_usage_log')
    expect(mockInsert).toHaveBeenCalledWith({ user_id: 'user-123', action: 'enrich', model: 'claude-sonnet-4-6' })
  })

  it('does nothing when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await logAiUsage('parse', 'claude-haiku-4-5')

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('never throws when the insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockInsert = vi.fn().mockResolvedValue({ error: { code: 'PGRST205', message: 'no table' } })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    await expect(logAiUsage('tailor', 'claude-sonnet-4-6')).resolves.toBeUndefined()
  })

  it('never throws when getUser itself throws', async () => {
    mockGetUser.mockRejectedValue(new Error('network down'))

    await expect(logAiUsage('cover_letter', 'claude-sonnet-4-6')).resolves.toBeUndefined()
  })
})

// ── getAiUsageStats ──────────────────────────────────────────────────────────

describe('getAiUsageStats', () => {
  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(getAiUsageStats()).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty stats when the table does not exist yet (PGRST205)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST205', message: 'no table' } })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getAiUsageStats()

    expect(result).toEqual({
      totalCalls: 0,
      callsThisMonth: 0,
      callsByAction: { parse: 0, enrich: 0, tailor: 0, cover_letter: 0, ats_score: 0 },
      recent: [],
    })
  })

  it('returns empty stats when the table does not exist yet (42P01)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getAiUsageStats()
    expect(result.totalCalls).toBe(0)
  })

  it('throws for any other error code', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const error = { code: '42501', message: 'permission denied' }
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    await expect(getAiUsageStats()).rejects.toEqual(error)
  })

  it('calls .select("*").eq("user_id", id).order("created_at", desc).limit(500)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    await getAiUsageStats()

    expect(mockFrom).toHaveBeenCalledWith('ai_usage_log')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(500)
  })

  it('computes totalCalls, callsThisMonth, and callsByAction from returned rows', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
    const lastYear = new Date(now.getFullYear() - 1, 0, 1).toISOString()

    const rows: AiUsageEntry[] = [
      { id: '1', action: 'parse', model: 'claude-haiku-4-5', created_at: thisMonth },
      { id: '2', action: 'enrich', model: 'claude-sonnet-4-6', created_at: thisMonth },
      { id: '3', action: 'enrich', model: 'claude-sonnet-4-6', created_at: lastYear },
      { id: '4', action: 'ats_score', model: 'claude-sonnet-4-6', created_at: lastYear },
    ]

    const mockLimit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getAiUsageStats()

    expect(result.totalCalls).toBe(4)
    expect(result.callsThisMonth).toBe(2)
    expect(result.callsByAction).toEqual({ parse: 1, enrich: 2, tailor: 0, cover_letter: 0, ats_score: 1 })
    expect(result.recent).toEqual(rows)
  })

  it('limits "recent" to the first 10 rows', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)

    const rows: AiUsageEntry[] = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      action: 'parse',
      model: 'claude-haiku-4-5',
      created_at: new Date().toISOString(),
    }))

    const mockLimit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getAiUsageStats()

    expect(result.recent.length).toBe(10)
    expect(result.totalCalls).toBe(15)
  })

  it('returns empty stats when data is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getAiUsageStats()
    expect(result.totalCalls).toBe(0)
    expect(result.recent).toEqual([])
  })
})
