import axios from 'axios'
import type { ATSScoreResult, ResumeSchema } from '@/types/resume'
import { logAiUsage } from '@/services/aiUsage'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

// Mirrors backend/app/services/claude.py
const FAST_MODEL = 'claude-haiku-4-5'
const SMART_MODEL = 'claude-sonnet-4-6'

const http = axios.create({ baseURL: BASE })

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

// ── streaming helper ─────────────────────────────────────────────────────────

async function fetchStream(
  path: string,
  body: object,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
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
  const { data } = await http.post<unknown>('/api/parse', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  })
  logAiUsage('parse', FAST_MODEL).catch(() => {})
  return fromBackend(data)
}

export async function enrichResume(
  resume: ResumeSchema,
): Promise<ReadableStream<Uint8Array>> {
  const stream = await fetchStream('/api/enrich', { resume: toBackend(resume) })
  logAiUsage('enrich', SMART_MODEL).catch(() => {})
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
  logAiUsage('tailor', SMART_MODEL).catch(() => {})
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume: toBackend(resume),
      job_description: jobDescription,
      company_name: companyName,
      tone,
    }),
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (!res.body) throw new Error('No response stream received')
  logAiUsage('cover_letter', SMART_MODEL).catch(() => {})
  return res.body
}

export async function exportCoverLetter(
  content: string,
  companyName: string,
  format: 'pdf' | 'docx' | 'txt',
): Promise<Blob> {
  const res = await fetch(`${BASE}/api/cover-letter/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, company_name: companyName, format }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function scoreATS(
  resume: ResumeSchema,
  jobDescription: string,
): Promise<ATSScoreResult> {
  const { data } = await http.post<BackendPayload>('/api/ats-score', {
    resume: toBackend(resume),
    job_description: jobDescription,
  })
  logAiUsage('ats_score', SMART_MODEL).catch(() => {})
  return {
    overallScore: typeof data.overall_score === 'number' ? data.overall_score : 0,
    matchedKeywords: strArr(data.matched_keywords),
    missingKeywords: strArr(data.missing_keywords),
    suggestions: strArr(data.suggestions),
    summary: str(data.summary),
  }
}

export async function exportResume(
  resume: ResumeSchema,
  format: 'pdf' | 'docx' = 'pdf',
  industry = 'general',
): Promise<Blob> {
  const res = await fetch(`${BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume: toBackend(resume), format, industry }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}
