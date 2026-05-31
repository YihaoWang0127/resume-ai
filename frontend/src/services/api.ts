import axios from 'axios'
import type { ResumeSchema } from '@/types/resume'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

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

export async function parseResume(file: File): Promise<ResumeSchema> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<unknown>('/api/parse', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return fromBackend(data)
}

export async function enrichResume(
  resume: ResumeSchema,
): Promise<ReadableStream<Uint8Array>> {
  return fetchStream('/api/enrich', { resume: toBackend(resume) })
}

export async function tailorResume(
  resume: ResumeSchema,
  jobDescription: string,
): Promise<ReadableStream<Uint8Array>> {
  return fetchStream('/api/tailor', {
    resume: toBackend(resume),
    job_description: jobDescription,
  })
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
