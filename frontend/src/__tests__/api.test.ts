import { describe, it, expect, beforeAll, afterEach, afterAll, vi, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

vi.mock('@/services/aiUsage', () => ({ logAiUsage: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

import { parseResume, exportResume, scoreATS } from '@/services/api'
import { logAiUsage } from '@/services/aiUsage'
import type { ResumeSchema } from '@/types/resume'

const mockLogAiUsage = vi.mocked(logAiUsage)

const BASE = 'http://localhost:8000'

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Software engineer',
  experience: [],
  education: [],
  skills: [],
}

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
beforeEach(() => {
  mockLogAiUsage.mockResolvedValue(undefined)
})
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
  mockLogAiUsage.mockReset()
})
afterAll(() => server.close())

// ── parseResume ──────────────────────────────────────────────────────────────

describe('parseResume', () => {
  it('sends multipart form data with a "file" field', async () => {
    // MSW + axios XHR FormData parsing is incompatible in Node, so we spy on
    // FormData.prototype.append to verify the field name and value directly.
    // Capture the original BEFORE creating the spy — after spyOn, the prototype
    // property points to the spy, causing infinite recursion if called through it.
    const originalAppend = FormData.prototype.append
    const appended: Array<[string, unknown]> = []
    vi.spyOn(FormData.prototype, 'append').mockImplementation(function (
      this: FormData,
      key: string,
      value: unknown,
    ) {
      appended.push([key, value])
      return originalAppend.call(this, key, value as Blob)
    })

    server.use(
      http.post(`${BASE}/api/parse`, () =>
        HttpResponse.json({
          metadata: { name: 'Jane Smith', email: 'jane@example.com' },
          summary: null,
          experience: [],
          education: [],
          skills: [],
          projects: [],
          detected_industry: 'tech',
        }),
      ),
    )

    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await parseResume(file)

    expect(appended.some(([key, val]) => key === 'file' && val === file)).toBe(true)
  })

  it('uses the VITE_API_URL base (defaults to localhost:8000)', async () => {
    let receivedUrl = ''

    server.use(
      http.post(`${BASE}/api/parse`, ({ request }) => {
        receivedUrl = request.url
        return HttpResponse.json({
          metadata: { name: 'Test', email: '' },
          summary: null,
          experience: [],
          education: [],
          skills: [],
          projects: [],
          detected_industry: 'general',
        })
      }),
    )

    const file = new File(['data'], 'resume.pdf', { type: 'application/pdf' })
    await parseResume(file)

    expect(receivedUrl).toContain('localhost:8000')
  })

  it('throws on non-ok response', async () => {
    server.use(
      http.post(`${BASE}/api/parse`, () =>
        HttpResponse.json({ detail: 'Unsupported' }, { status: 415 }),
      ),
    )

    const file = new File(['data'], 'resume.txt', { type: 'text/plain' })
    await expect(parseResume(file)).rejects.toThrow()
  })

  it('logs AI usage with action "parse" and the fast model', async () => {
    server.use(
      http.post(`${BASE}/api/parse`, () =>
        HttpResponse.json({
          metadata: { name: 'Jane Smith', email: 'jane@example.com' },
          summary: null,
          experience: [],
          education: [],
          skills: [],
          projects: [],
          detected_industry: 'tech',
        }),
      ),
    )

    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await parseResume(file)

    expect(mockLogAiUsage).toHaveBeenCalledWith('parse', 'claude-haiku-4-5')
  })
})

// ── exportResume ─────────────────────────────────────────────────────────────

describe('exportResume', () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"

  it('sends format in request body', async () => {
    let body: Record<string, unknown> = {}

    server.use(
      http.post(`${BASE}/api/export`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(pdfBytes, {
          headers: { 'Content-Type': 'application/pdf' },
        })
      }),
    )

    await exportResume(mockResume, 'pdf')
    expect(body.format).toBe('pdf')
  })

  it('sends industry in request body', async () => {
    let body: Record<string, unknown> = {}

    server.use(
      http.post(`${BASE}/api/export`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(pdfBytes, {
          headers: { 'Content-Type': 'application/pdf' },
        })
      }),
    )

    await exportResume(mockResume, 'pdf', 'tech')
    expect(body.industry).toBe('tech')
  })

  it('sends docx format correctly', async () => {
    let body: Record<string, unknown> = {}

    server.use(
      http.post(`${BASE}/api/export`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(new Uint8Array([0x50, 0x4b]), {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        })
      }),
    )

    await exportResume(mockResume, 'docx', 'finance')
    expect(body.format).toBe('docx')
    expect(body.industry).toBe('finance')
  })

  it('defaults format to pdf and industry to general', async () => {
    let body: Record<string, unknown> = {}

    server.use(
      http.post(`${BASE}/api/export`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(pdfBytes, {
          headers: { 'Content-Type': 'application/pdf' },
        })
      }),
    )

    await exportResume(mockResume)
    expect(body.format).toBe('pdf')
    expect(body.industry).toBe('general')
  })

  it('returns a Blob', async () => {
    server.use(
      http.post(`${BASE}/api/export`, () =>
        new HttpResponse(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } }),
      ),
    )

    const result = await exportResume(mockResume, 'pdf')
    expect(result.size).toBeGreaterThan(0)
    expect(result.type).toBe('application/pdf')
  })

  it('throws on non-ok response', async () => {
    server.use(
      http.post(`${BASE}/api/export`, () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 }),
      ),
    )

    await expect(exportResume(mockResume, 'pdf')).rejects.toThrow()
  })
})

// ── scoreATS ─────────────────────────────────────────────────────────────────

describe('scoreATS', () => {
  it('sends resume and job_description in the request body', async () => {
    let body: Record<string, unknown> = {}

    server.use(
      http.post(`${BASE}/api/ats-score`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          overall_score: 78,
          matched_keywords: ['Python'],
          missing_keywords: ['Kubernetes'],
          suggestions: ['Add a bullet about containers.'],
          summary: 'Good match.',
        })
      }),
    )

    await scoreATS(mockResume, 'Senior Software Engineer role requiring Python.')

    expect(body.job_description).toBe('Senior Software Engineer role requiring Python.')
    expect(body.resume).toMatchObject({
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
    })
  })

  it('converts the snake_case response into a camelCase ATSScoreResult', async () => {
    server.use(
      http.post(`${BASE}/api/ats-score`, () =>
        HttpResponse.json({
          overall_score: 78,
          matched_keywords: ['Python', 'Distributed Systems'],
          missing_keywords: ['Kubernetes'],
          suggestions: ['Add a bullet about containers.', 'Mention CI/CD experience.'],
          summary: 'Good overall match.',
        }),
      ),
    )

    const result = await scoreATS(mockResume, 'Senior Software Engineer role requiring Python.')

    expect(result).toEqual({
      overallScore: 78,
      matchedKeywords: ['Python', 'Distributed Systems'],
      missingKeywords: ['Kubernetes'],
      suggestions: ['Add a bullet about containers.', 'Mention CI/CD experience.'],
      summary: 'Good overall match.',
    })
  })

  it('defaults missing fields to empty arrays, an empty summary, and a 0 score', async () => {
    server.use(
      http.post(`${BASE}/api/ats-score`, () => HttpResponse.json({})),
    )

    const result = await scoreATS(mockResume, 'Some job description.')

    expect(result).toEqual({
      overallScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: [],
      summary: '',
    })
  })

  it('throws on non-ok response', async () => {
    server.use(
      http.post(`${BASE}/api/ats-score`, () =>
        HttpResponse.json({ detail: 'job_description must not be empty.' }, { status: 422 }),
      ),
    )

    await expect(scoreATS(mockResume, '')).rejects.toThrow()
  })

  it('logs AI usage with action "ats_score" and the smart model', async () => {
    server.use(
      http.post(`${BASE}/api/ats-score`, () =>
        HttpResponse.json({
          overall_score: 78,
          matched_keywords: ['Python'],
          missing_keywords: ['Kubernetes'],
          suggestions: ['Add a bullet about containers.'],
          summary: 'Good match.',
        }),
      ),
    )

    await scoreATS(mockResume, 'Senior Software Engineer role requiring Python.')

    expect(mockLogAiUsage).toHaveBeenCalledWith('ats_score', 'claude-sonnet-4-6')
  })
})
