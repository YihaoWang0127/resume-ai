import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ResumeSchema } from '@/types/resume'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { saveResume, updateResume, listResumes, getResume, deleteResume } from '@/services/resumes'

const mockFrom = vi.mocked(supabase.from)
const mockGetUser = vi.mocked(supabase.auth.getUser)

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Software engineer',
  experience: [],
  education: [],
  skills: [],
  detectedIndustry: 'tech',
}

const mockUser = { id: 'user-123', email: 'jane@example.com' }

const savedRecord = {
  id: 'resume-1',
  user_id: 'user-123',
  title: 'My Resume',
  resume_data: mockResume,
  detected_industry: 'tech',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

// ── saveResume ────────────────────────────────────────────────────────────────

describe('saveResume', () => {
  it('calls .from("resumes").insert() with correct user_id, title and resume_data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    const result = await saveResume(mockResume, 'My Resume')

    expect(mockFrom).toHaveBeenCalledWith('resumes')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      title: 'My Resume',
      resume_data: mockResume,
      detected_industry: 'tech',
    })
    expect(result).toEqual(savedRecord)
  })

  it('falls back to "general" industry when detectedIndustry is absent', async () => {
    const resumeNoIndustry = { ...mockResume, detectedIndustry: undefined }
    mockGetUser.mockResolvedValue({ data: { user: mockUser } } as any)
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert } as any)

    await saveResume(resumeNoIndustry, 'My Resume')

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ detected_industry: 'general' }))
  })

  it('throws "Not authenticated" when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as any)

    await expect(saveResume(mockResume, 'My Resume')).rejects.toThrow('Not authenticated')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── updateResume ──────────────────────────────────────────────────────────────

describe('updateResume', () => {
  it('calls .update().eq("id", id) with resume data', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate } as any)

    const result = await updateResume('resume-1', mockResume)

    expect(mockFrom).toHaveBeenCalledWith('resumes')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      resume_data: mockResume,
      detected_industry: 'tech',
    }))
    expect(mockEq).toHaveBeenCalledWith('id', 'resume-1')
    expect(result).toEqual(savedRecord)
  })

  it('includes title in the update payload when provided', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate } as any)

    await updateResume('resume-1', mockResume, 'New Title')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }))
  })

  it('omits title from payload when not provided', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate } as any)

    await updateResume('resume-1', mockResume)

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg).not.toHaveProperty('title')
  })
})

// ── listResumes ───────────────────────────────────────────────────────────────

describe('listResumes', () => {
  it('calls .select("*").order("updated_at", ascending: false) and returns the array', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [savedRecord], error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await listResumes()

    expect(mockFrom).toHaveBeenCalledWith('resumes')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(result).toEqual([savedRecord])
  })

  it('returns an empty array when data is null', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await listResumes()

    expect(result).toEqual([])
  })
})

// ── getResume ─────────────────────────────────────────────────────────────────

describe('getResume', () => {
  it('calls .select("*").eq("id", id).single() and returns the record', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: savedRecord, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect } as any)

    const result = await getResume('resume-1')

    expect(mockFrom).toHaveBeenCalledWith('resumes')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('id', 'resume-1')
    expect(result).toEqual(savedRecord)
  })
})

// ── deleteResume ──────────────────────────────────────────────────────────────

describe('deleteResume', () => {
  it('calls .delete().eq("id", id)', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete } as any)

    await deleteResume('resume-1')

    expect(mockFrom).toHaveBeenCalledWith('resumes')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'resume-1')
  })
})
