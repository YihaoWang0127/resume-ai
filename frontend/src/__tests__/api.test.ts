import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

import { parseResume, exportResume, scoreATS, enrichResume, tailorResume, QuotaExceededError, fromBackend } from '@/services/api'
import type { ResumeSchema } from '@/types/resume'

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
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
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

})

// ── QuotaExceededError ────────────────────────────────────────────────────────

describe('QuotaExceededError', () => {
  it('is an instance of Error', () => {
    const err = new QuotaExceededError()
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "QuotaExceededError"', () => {
    const err = new QuotaExceededError()
    expect(err.name).toBe('QuotaExceededError')
  })

  it('has the expected message', () => {
    const err = new QuotaExceededError()
    expect(err.message).toBe('Monthly AI limit reached')
  })
})

// ── fetchStream — quota handling ──────────────────────────────────────────────

describe('fetchStream — quota handling', () => {
  it('throws QuotaExceededError when the server returns 402', async () => {
    server.use(
      http.post(`${BASE}/api/enrich`, () =>
        new HttpResponse(null, { status: 402 }),
      ),
    )

    await expect(enrichResume(mockResume)).rejects.toThrow(QuotaExceededError)
  })

  it('throws a generic Error (not QuotaExceededError) on other non-ok statuses', async () => {
    server.use(
      http.post(`${BASE}/api/enrich`, () =>
        new HttpResponse('Internal Server Error', { status: 500 }),
      ),
    )

    const promise = enrichResume(mockResume)
    await expect(promise).rejects.toThrow(Error)
    await expect(promise).rejects.not.toThrow(QuotaExceededError)
  })
})

// ── parseResume — quota handling ──────────────────────────────────────────────

describe('parseResume — quota handling', () => {
  it('throws QuotaExceededError when the server returns 402', async () => {
    server.use(
      http.post(`${BASE}/api/parse`, () =>
        new HttpResponse(null, { status: 402 }),
      ),
    )

    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await expect(parseResume(file)).rejects.toThrow(QuotaExceededError)
  })
})

// ── scoreATS — quota handling ─────────────────────────────────────────────────

describe('scoreATS — quota handling', () => {
  it('throws QuotaExceededError when the server returns 402', async () => {
    server.use(
      http.post(`${BASE}/api/ats-score`, () =>
        new HttpResponse(null, { status: 402 }),
      ),
    )

    await expect(scoreATS(mockResume, 'some job description')).rejects.toThrow(QuotaExceededError)
  })
})

// ── enrichResume — career_stage payload ──────────────────────────────────────

describe('enrichResume — career_stage payload', () => {
  function stubEnrich(capturedBody: Record<string, unknown>) {
    server.use(
      http.post(`${BASE}/api/enrich`, async ({ request }) => {
        Object.assign(capturedBody, await request.json())
        return new HttpResponse('{}', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }),
    )
  }

  it('sends career_stage: "student" when careerStage is "student"', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)
    await enrichResume(mockResume, 'professional', 'student')
    expect(body.career_stage).toBe('student')
  })

  it('sends career_stage: "experienced" when careerStage is "experienced"', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)
    await enrichResume(mockResume, 'professional', 'experienced')
    expect(body.career_stage).toBe('experienced')
  })

  it('sends career_stage: null when careerStage is omitted', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)
    await enrichResume(mockResume)
    expect(body.career_stage).toBeNull()
  })

  it('sends career_stage: "early" when careerStage is "early"', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)
    await enrichResume(mockResume, 'concise', 'early')
    expect(body.career_stage).toBe('early')
  })
})

// ── tailorResume — career_stage payload ──────────────────────────────────────

describe('tailorResume — career_stage payload', () => {
  const JD = 'We need a senior Python engineer.'

  function stubTailor(capturedBody: Record<string, unknown>) {
    server.use(
      http.post(`${BASE}/api/tailor`, async ({ request }) => {
        Object.assign(capturedBody, await request.json())
        return new HttpResponse('{}', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }),
    )
  }

  it('sends career_stage: "experienced" when careerStage is "experienced"', async () => {
    const body: Record<string, unknown> = {}
    stubTailor(body)
    await tailorResume(mockResume, JD, 'experienced')
    expect(body.career_stage).toBe('experienced')
  })

  it('sends career_stage: "student" when careerStage is "student"', async () => {
    const body: Record<string, unknown> = {}
    stubTailor(body)
    await tailorResume(mockResume, JD, 'student')
    expect(body.career_stage).toBe('student')
  })

  it('sends career_stage: null when careerStage is omitted', async () => {
    const body: Record<string, unknown> = {}
    stubTailor(body)
    await tailorResume(mockResume, JD)
    expect(body.career_stage).toBeNull()
  })

  it('sends job_description in the request body', async () => {
    const body: Record<string, unknown> = {}
    stubTailor(body)
    await tailorResume(mockResume, JD, 'early')
    expect(body.job_description).toBe(JD)
  })
})

// ── fromBackend — projects mapping ────────────────────────────────────────────

describe('fromBackend — projects mapping', () => {
  it('maps a projects array from the backend payload to ProjectItem[]', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [],
      education: [],
      skills: [],
      projects: [
        {
          name: 'My App',
          description: 'A cool app',
          technologies: ['React', 'TypeScript'],
          url: 'https://github.com/example/my-app',
          bullets: ['Built the frontend', 'Deployed to Vercel'],
        },
      ],
      detected_industry: 'tech',
    }

    const result = fromBackend(raw)

    expect(result.projects).toHaveLength(1)
    const project = result.projects![0]
    expect(project.name).toBe('My App')
    expect(project.description).toBe('A cool app')
    expect(project.technologies).toEqual(['React', 'TypeScript'])
    expect(project.url).toBe('https://github.com/example/my-app')
    expect(project.bullets).toEqual(['Built the frontend', 'Deployed to Vercel'])
  })

  it('returns an empty projects array when the backend payload has no projects field', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [],
      education: [],
      skills: [],
      detected_industry: 'general',
    }

    const result = fromBackend(raw)

    expect(result.projects).toEqual([])
  })

  it('returns an empty projects array when backend projects field is null', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [],
      education: [],
      skills: [],
      projects: null,
      detected_industry: 'general',
    }

    const result = fromBackend(raw)

    expect(result.projects).toEqual([])
  })
})

// ── toBackend (via enrichResume) — projects serialisation ─────────────────────

describe('toBackend (via enrichResume) — projects serialisation', () => {
  function stubEnrich(capturedBody: Record<string, unknown>) {
    server.use(
      http.post(`${BASE}/api/enrich`, async ({ request }) => {
        Object.assign(capturedBody, await request.json())
        return new HttpResponse('{}', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }),
    )
  }

  it('serialises projects array into the request body', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)

    const resumeWithProjects = {
      ...mockResume,
      projects: [
        {
          name: 'Portfolio Site',
          description: 'Personal website',
          technologies: ['React', 'Tailwind'],
          url: 'https://example.com',
          bullets: ['Designed and built from scratch'],
        },
      ],
    }

    await enrichResume(resumeWithProjects)

    const resumeBody = body.resume as Record<string, unknown>
    expect(Array.isArray(resumeBody.projects)).toBe(true)
    const projects = resumeBody.projects as Array<Record<string, unknown>>
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Portfolio Site')
    expect(projects[0].technologies).toEqual(['React', 'Tailwind'])
    expect(projects[0].bullets).toEqual(['Designed and built from scratch'])
  })

  it('includes career_stage: null in the request body when careerStage is omitted', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)

    const resumeWithProjects = {
      ...mockResume,
      projects: [{ name: 'App', description: undefined, technologies: [], url: undefined, bullets: [] }],
    }

    await enrichResume(resumeWithProjects)

    expect(body.career_stage).toBeNull()
    const resumeBody = body.resume as Record<string, unknown>
    expect(Array.isArray(resumeBody.projects)).toBe(true)
  })
})

// ── fromBackend / toBackend — experience.description round-trip ──────────────

describe('fromBackend — experience description mapping', () => {
  it('maps experience.description from the backend payload', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [
        {
          company: 'Acme Corp',
          title: 'Engineer',
          start_date: 'Jan 2020',
          end_date: null,
          description: 'Led the platform team building the internal billing system.',
          bullets: ['Shipped feature X'],
        },
      ],
      education: [],
      skills: [],
      projects: [],
      detected_industry: 'tech',
    }

    const result = fromBackend(raw)

    expect(result.experience).toHaveLength(1)
    expect(result.experience[0].description).toBe(
      'Led the platform team building the internal billing system.',
    )
  })

  it('maps experience.description to undefined when the backend value is null', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [
        {
          company: 'Acme Corp',
          title: 'Engineer',
          start_date: 'Jan 2020',
          end_date: null,
          description: null,
          bullets: [],
        },
      ],
      education: [],
      skills: [],
      projects: [],
      detected_industry: 'tech',
    }

    const result = fromBackend(raw)

    expect(result.experience[0].description).toBeUndefined()
  })

  it('maps experience.description to undefined when the backend field is missing', () => {
    const raw = {
      metadata: { name: 'Jane Smith', email: 'jane@example.com' },
      summary: null,
      experience: [
        { company: 'Acme Corp', title: 'Engineer', start_date: 'Jan 2020', end_date: null, bullets: [] },
      ],
      education: [],
      skills: [],
      projects: [],
      detected_industry: 'tech',
    }

    const result = fromBackend(raw)

    expect(result.experience[0].description).toBeUndefined()
  })
})

describe('toBackend (via enrichResume) — experience description serialisation', () => {
  function stubEnrich(capturedBody: Record<string, unknown>) {
    server.use(
      http.post(`${BASE}/api/enrich`, async ({ request }) => {
        Object.assign(capturedBody, await request.json())
        return new HttpResponse('{}', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }),
    )
  }

  it('serialises experience.description into the request body', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)

    const resumeWithDescription = {
      ...mockResume,
      experience: [
        {
          company: 'Acme Corp',
          title: 'Engineer',
          startDate: 'Jan 2020',
          description: 'Led the platform team building the internal billing system.',
          current: true,
          bullets: ['Shipped feature X'],
        },
      ],
    }

    await enrichResume(resumeWithDescription)

    const resumeBody = body.resume as Record<string, unknown>
    const experience = resumeBody.experience as Array<Record<string, unknown>>
    expect(experience).toHaveLength(1)
    expect(experience[0].description).toBe(
      'Led the platform team building the internal billing system.',
    )
  })

  it('serialises experience.description as null when undefined', async () => {
    const body: Record<string, unknown> = {}
    stubEnrich(body)

    const resumeWithoutDescription = {
      ...mockResume,
      experience: [
        {
          company: 'Acme Corp',
          title: 'Engineer',
          startDate: 'Jan 2020',
          current: true,
          bullets: [],
        },
      ],
    }

    await enrichResume(resumeWithoutDescription)

    const resumeBody = body.resume as Record<string, unknown>
    const experience = resumeBody.experience as Array<Record<string, unknown>>
    expect(experience[0].description).toBeNull()
  })
})
