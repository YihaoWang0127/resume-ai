import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import {
  listApplications,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
  clearApplicationsCache,
  type Application,
  type CreateApplicationInput,
} from '@/services/applications'

const mockFrom = vi.mocked(supabase.from)
const mockGetUser = vi.mocked(supabase.auth.getUser)

const mockUser = { id: 'user-456', email: 'test@example.com' }

const savedApplication: Application = {
  id: 'app-1',
  user_id: 'user-456',
  resume_id: 'resume-1',
  cover_letter_id: null,
  company: 'Acme Corp',
  role: 'Senior Software Engineer',
  job_url: null,
  job_description: 'We need a senior Python engineer.',
  ats_score: 82,
  status: 'applied',
  applied_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearApplicationsCache()
})

// ── listApplications ──────────────────────────────────────────────────────────

describe('listApplications', () => {
  it('calls .from("applications").select("*").order("applied_at", ascending: false)', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [savedApplication], error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await listApplications()

    expect(mockFrom).toHaveBeenCalledWith('applications')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('applied_at', { ascending: false })
    expect(result).toEqual([savedApplication])
  })

  it('returns an empty array when data is null', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await listApplications()

    expect(result).toEqual([])
  })

  it('returns the same promise on repeated calls (deduplication cache)', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [savedApplication], error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const p1 = listApplications()
    const p2 = listApplications()

    expect(p1).toBe(p2)
    await p1
  })

  it('throws and clears cache on error so next call retries', async () => {
    const dbError = { message: 'network error' }
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: dbError })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    await expect(listApplications()).rejects.toEqual(dbError)

    // After an error the cache is cleared — a second call should hit the DB again
    const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockSelect2 = vi.fn().mockReturnValue({ order: mockOrder2 })
    mockFrom.mockReturnValue({ select: mockSelect2 } as any)

    const result = await listApplications()
    expect(result).toEqual([])
  })
})

// ── createApplication ─────────────────────────────────────────────────────────

describe('createApplication', () => {
  it('calls .from("applications").insert() with correct shape and returns the record', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedApplication, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    const input: CreateApplicationInput = {
      resume_id: 'resume-1',
      company: 'Acme Corp',
      role: 'Senior Software Engineer',
      job_description: 'We need a senior Python engineer.',
      ats_score: 82,
    }

    const result = await createApplication(input)

    expect(mockFrom).toHaveBeenCalledWith('applications')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-456',
        company: 'Acme Corp',
        role: 'Senior Software Engineer',
        status: 'applied',
        resume_id: 'resume-1',
        ats_score: 82,
      }),
    )
    expect(result).toEqual(savedApplication)
  })

  it('sets optional fields to null when not provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedApplication, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    await createApplication({ company: 'Acme Corp', role: 'Engineer' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: null,
        cover_letter_id: null,
        job_url: null,
        job_description: null,
        ats_score: null,
      }),
    )
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(
      createApplication({ company: 'Acme Corp', role: 'Engineer' }),
    ).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('clears the list cache after inserting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedApplication, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })

    // Pre-populate the cache with one call
    const mockOrder = vi.fn().mockResolvedValue({ data: [savedApplication], error: null })
    const mockSelectList = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelectList } as any)
    await listApplications()

    // Switch mock to support insert
    mockFrom.mockReturnValue({ insert: mockInsert } as any)
    await createApplication({ company: 'Acme Corp', role: 'Engineer' })

    // After create, a fresh listApplications call should hit the DB again (not cache)
    const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockSelectList2 = vi.fn().mockReturnValue({ order: mockOrder2 })
    mockFrom.mockReturnValue({ select: mockSelectList2 } as any)
    await listApplications()

    expect(mockOrder2).toHaveBeenCalled()
  })
})

// ── updateApplicationStatus ───────────────────────────────────────────────────

describe('updateApplicationStatus', () => {
  it('calls .update({status}).eq("id", id) and returns the updated record', async () => {
    const updated = { ...savedApplication, status: 'interviewing' as Application['status'] }
    const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate } as any)

    const result = await updateApplicationStatus('app-1', 'interviewing')

    expect(mockFrom).toHaveBeenCalledWith('applications')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'interviewing' }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'app-1')
    expect(result.status).toBe('interviewing')
  })

  it('throws when the update fails', async () => {
    const error = { message: 'update failed' }
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate } as any)

    await expect(updateApplicationStatus('app-1', 'offer')).rejects.toEqual(error)
  })

  it('accepts all valid status values', async () => {
    const statuses: Array<Application['status']> = ['applied', 'interviewing', 'offer', 'rejected']
    for (const status of statuses) {
      const mockSingle = vi.fn().mockResolvedValue({ data: { ...savedApplication, status }, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ update: mockUpdate } as any)

      const result = await updateApplicationStatus('app-1', status)
      expect(result.status).toBe(status)
    }
  })
})

// ── deleteApplication ─────────────────────────────────────────────────────────

describe('deleteApplication', () => {
  it('calls .from("applications").delete().eq("id", id)', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete } as any)

    await deleteApplication('app-1')

    expect(mockFrom).toHaveBeenCalledWith('applications')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'app-1')
  })

  it('throws when the delete fails', async () => {
    const error = { message: 'delete failed' }
    const mockEq = vi.fn().mockResolvedValue({ error })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete } as any)

    await expect(deleteApplication('app-1')).rejects.toEqual(error)
  })

  it('clears the list cache after deleting', async () => {
    // Populate cache
    const mockOrder = vi.fn().mockResolvedValue({ data: [savedApplication], error: null })
    const mockSelectList = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelectList } as any)
    await listApplications()

    // Delete
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete } as any)
    await deleteApplication('app-1')

    // Next list call should bypass cache
    const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockSelectList2 = vi.fn().mockReturnValue({ order: mockOrder2 })
    mockFrom.mockReturnValue({ select: mockSelectList2 } as any)
    await listApplications()

    expect(mockOrder2).toHaveBeenCalled()
  })
})
