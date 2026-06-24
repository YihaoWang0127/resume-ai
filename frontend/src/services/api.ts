import axios from 'axios'
import type { ATSScoreResult, ResumeSchema } from '@/types/resume'
import { supabase } from '@/lib/supabase'

export class QuotaExceededError extends Error {
  constructor() {
    super('Monthly AI limit reached')
    this.name = 'QuotaExceededError'
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

const http = axios.create({ baseURL: BASE })

// Attach the Supabase access token to every axios request
http.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── type conversion ──────────────────────────────────────────────────────────

type BackendPayload = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}
function arr(v: unknown): BackendPayload[] {
  return Array.isArray(v) ? (v as BackendPayload[]) : []
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []
}

export function fromBackend(raw: unknown): ResumeSchema {
  const data = (raw ?? {}) as BackendPayload
  const meta = (data.metadata ?? {}) as BackendPayload
  return {
    metadata: {
      fullName: str(meta.name),
      email: str(meta.email),
      phone: optStr(meta.phone),
      location: optStr(meta.location),
      linkedIn: optStr(meta.linkedin),
      github: optStr(meta.github),
    },
    summary: optStr(data.summary),
    experience: arr(data.experience).map((e) => ({
      company: str(e.company),
      title: str(e.title),
      startDate: str(e.start_date),
      endDate: optStr(e.end_date),
      current: !e.end_date,
      bullets: strArr(e.bullets),
    })),
    education: arr(data.education).map((e) => ({
      institution: str(e.school),
      degree: str(e.degree),
      field: str(e.field),
      graduationYear: str(e.end_date),
    })),
    skills: arr(data.skills).map((s) => ({
      category: str(s.category),
      items: strArr(s.items),
    })),
    detectedIndustry: optStr(data.detected_industry) || 'general',
  }
}

function toBackend(resume: ResumeSchema): object {
  return {
    metadata: {
      name: resume.metadata.fullName,
      email: resume.metadata.email,
      phone: resume.metadata.phone ?? null,
      location: resume.metadata.location ?? null,
      linkedin: resume.metadata.linkedIn ?? null,
      github: resume.metadata.github ?? null,
    },
    summary: resume.summary ?? null,
    experience: resume.experience.map((e) => ({
      company: e.company,
      title: e.title,
      start_date: e.startDate,
      end_date: e.current ? null : (e.endDate ?? null),
      bullets: e.bullets,
    })),
    education: resume.education.map((e) => ({
      school: e.institution,
      degree: e.degree,
      field: e.field,
      end_date: e.graduationYear,
    })),
    skills: resume.skills,
  }
}

// ── auth header helper ────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

// ── streaming helper ─────────────────────────────────────────────────────────

async function fetchStream(
  path: string,
  body: object,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 402) throw new QuotaExceededError()
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (!res.body) throw new Error('No response stream received')
  return res.body
}

// ── public API ───────────────────────────────────────────────────────────────

export async function parseResume(file: File, signal?: AbortSignal): Promise<ResumeSchema> {
  const form = new FormData()
  form.append('file', file)
  const { data: { session } } = await supabase.auth.getSession()
  try {
    const { data } = await http.post<unknown>('/api/parse', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      signal,
    })
    return fromBackend(data)
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 402) throw new QuotaExceededError()
    throw err
  }
}

export async function enrichResume(
  resume: ResumeSchema,
  tone?: string,
): Promise<ReadableStream<Uint8Array>> {
  const stream = await fetchStream('/api/enrich', { resume: toBackend(resume), tone: tone ?? 'professional' })
  return stream
}

export async function tailorResume(
  resume: ResumeSchema,
  jobDescription: string,
): Promise<ReadableStream<Uint8Array>> {
  const stream = await fetchStream('/api/tailor', {
    resume: toBackend(resume),
    job_description: jobDescription,
  })
  return stream
}

export async function generateCoverLetter(
  resume: ResumeSchema,
  jobDescription: string,
  companyName: string,
  tone: 'professional' | 'enthusiastic' | 'concise',
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}/api/cover-letter`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      resume: toBackend(resume),
      job_description: jobDescription,
      company_name: companyName,
      tone,
    }),
    signal,
  })
  if (!res.ok) {
    if (res.status === 402) throw new QuotaExceededError()
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (!res.body) throw new Error('No response stream received')
  return res.body
}

export async function improveCoverLetter(
  text: string,
  options: {
    selection?: string
    jobDescription?: string
    resume?: ResumeSchema
    tone?: 'professional' | 'enthusiastic' | 'concise'
  } = {},
): Promise<ReadableStream<Uint8Array>> {
  const stream = await fetchStream('/api/cover-letter/improve', {
    text,
    selection: options.selection ?? null,
    job_description: options.jobDescription ?? null,
    resume: options.resume ? toBackend(options.resume) : null,
    tone: options.tone ?? 'professional',
  })
  return stream
}

export async function exportCoverLetter(
  content: string,
  companyName: string,
  format: 'pdf' | 'docx' | 'txt',
): Promise<Blob> {
  const res = await fetch(`${BASE}/api/cover-letter/export`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ content, company_name: companyName, format }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function scoreATS(
  resume: ResumeSchema,
  jobDescription: string,
): Promise<ATSScoreResult> {
  try {
    const { data } = await http.post<BackendPayload>('/api/ats-score', {
      resume: toBackend(resume),
      job_description: jobDescription,
    })
    return {
      overallScore: typeof data.overall_score === 'number' ? data.overall_score : 0,
      matchedKeywords: strArr(data.matched_keywords),
      missingKeywords: strArr(data.missing_keywords),
      suggestions: strArr(data.suggestions),
      summary: str(data.summary),
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 402) throw new QuotaExceededError()
    throw err
  }
}

export async function exportResume(
  resume: ResumeSchema,
  format: 'pdf' | 'docx' = 'pdf',
  industry = 'general',
): Promise<Blob> {
  const res = await fetch(`${BASE}/api/export`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ resume: toBackend(resume), format, industry }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function validateJobDescription(
  text: string,
): Promise<{ valid: boolean; reason: string }> {
  const { data } = await http.post<{ valid: boolean; reason: string }>(
    '/api/validate-jd',
    { text },
  )
  return data
}
