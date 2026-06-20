import { describe, it, expect } from 'vitest'
import { resumeToLines, computeLineDiff } from '@/lib/resumeDiff'
import type { ResumeSchema } from '@/types/resume'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const minimalResume: ResumeSchema = {
  metadata: { fullName: 'Jane Doe', email: 'jane@example.com' },
  experience: [],
  education: [],
  skills: [],
}

const fullResume: ResumeSchema = {
  metadata: {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
    linkedIn: 'linkedin.com/in/janedoe',
    github: 'github.com/janedoe',
  },
  summary: 'Experienced software engineer.',
  experience: [
    {
      company: 'Acme Corp',
      title: 'Senior Engineer',
      startDate: '2020-01',
      endDate: '2023-06',
      current: false,
      bullets: ['Built features', 'Led team'],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      graduationYear: '2019',
    },
  ],
  skills: [{ category: 'Languages', items: ['TypeScript', 'Python'] }],
}

// ── resumeToLines ─────────────────────────────────────────────────────────────

describe('resumeToLines', () => {
  it('includes name as the first line', () => {
    const lines = resumeToLines(fullResume)
    expect(lines[0]).toBe('Jane Doe')
  })

  it('pipe-joins all contact fields on the second line', () => {
    const lines = resumeToLines(fullResume)
    expect(lines[1]).toBe(
      'jane@example.com | 555-1234 | San Francisco, CA | linkedin.com/in/janedoe | github.com/janedoe',
    )
  })

  it('full resume with all sections produces correct section headers', () => {
    const lines = resumeToLines(fullResume)
    expect(lines).toContain('SUMMARY')
    expect(lines).toContain('EXPERIENCE')
    expect(lines).toContain('EDUCATION')
    expect(lines).toContain('SKILLS')
  })

  it('full resume includes experience entry in correct format', () => {
    const lines = resumeToLines(fullResume)
    expect(lines).toContain('Senior Engineer @ Acme Corp (2020-01 – 2023-06)')
  })

  it('full resume includes education entry in correct format', () => {
    const lines = resumeToLines(fullResume)
    expect(lines).toContain('Bachelor of Science in Computer Science | State University | 2019')
  })

  it('full resume includes skill with category prefix', () => {
    const lines = resumeToLines(fullResume)
    expect(lines).toContain('Languages: TypeScript, Python')
  })

  it('resume with no summary omits SUMMARY section', () => {
    const resume: ResumeSchema = { ...fullResume, summary: undefined }
    const lines = resumeToLines(resume)
    expect(lines).not.toContain('SUMMARY')
  })

  it('resume with empty summary string omits SUMMARY section', () => {
    const resume: ResumeSchema = { ...fullResume, summary: '' }
    const lines = resumeToLines(resume)
    expect(lines).not.toContain('SUMMARY')
  })

  it('resume with no experience omits EXPERIENCE section', () => {
    const resume: ResumeSchema = { ...fullResume, experience: [] }
    const lines = resumeToLines(resume)
    expect(lines).not.toContain('EXPERIENCE')
  })

  it('current job (no endDate) shows "Present"', () => {
    const resume: ResumeSchema = {
      ...minimalResume,
      experience: [
        {
          company: 'StartupCo',
          title: 'Engineer',
          startDate: '2022-03',
          current: true,
          bullets: [],
        },
      ],
    }
    const lines = resumeToLines(resume)
    expect(lines).toContain('Engineer @ StartupCo (2022-03 – Present)')
  })

  it('experience with empty bullets omits those bullets', () => {
    const resume: ResumeSchema = {
      ...minimalResume,
      experience: [
        {
          company: 'Corp',
          title: 'Dev',
          startDate: '2021-01',
          endDate: '2022-01',
          current: false,
          bullets: ['', '  ', 'Real bullet'],
        },
      ],
    }
    const lines = resumeToLines(resume)
    expect(lines).toContain('• Real bullet')
    expect(lines.filter(l => l === '• ')).toHaveLength(0)
    expect(lines.filter(l => l === '•   ')).toHaveLength(0)
  })

  it('skill with no category renders just the items without prefix', () => {
    const resume: ResumeSchema = {
      ...minimalResume,
      skills: [{ category: '', items: ['React', 'Node.js'] }],
    }
    const lines = resumeToLines(resume)
    expect(lines).toContain('React, Node.js')
    // Should not contain a colon prefix
    expect(lines.some(l => l.startsWith(': '))).toBe(false)
  })

  it('empty resume (just name and email) produces only header lines', () => {
    const lines = resumeToLines(minimalResume)
    // Name + email contact line — no section headers
    expect(lines).toEqual(['Jane Doe', 'jane@example.com'])
    expect(lines).not.toContain('SUMMARY')
    expect(lines).not.toContain('EXPERIENCE')
    expect(lines).not.toContain('EDUCATION')
    expect(lines).not.toContain('SKILLS')
  })

  it('multiple contact fields are pipe-joined', () => {
    const resume: ResumeSchema = {
      metadata: {
        fullName: 'Bob',
        email: 'bob@test.com',
        phone: '111-2222',
        location: 'NYC',
      },
      experience: [],
      education: [],
      skills: [],
    }
    const lines = resumeToLines(resume)
    expect(lines[1]).toBe('bob@test.com | 111-2222 | NYC')
  })

  it('separates consecutive experience entries with a blank line', () => {
    const resume: ResumeSchema = {
      ...minimalResume,
      experience: [
        {
          company: 'A',
          title: 'Dev',
          startDate: '2020-01',
          endDate: '2021-01',
          current: false,
          bullets: ['Bullet A'],
        },
        {
          company: 'B',
          title: 'Lead',
          startDate: '2021-02',
          endDate: '2022-02',
          current: false,
          bullets: ['Bullet B'],
        },
      ],
    }
    const lines = resumeToLines(resume)
    const firstEntry = lines.indexOf('Dev @ A (2020-01 – 2021-01)')
    const secondEntry = lines.indexOf('Lead @ B (2021-02 – 2022-02)')
    // There must be a blank line between the two entries
    expect(lines[secondEntry - 1]).toBe('')
    expect(secondEntry).toBeGreaterThan(firstEntry)
  })
})

// ── computeLineDiff ───────────────────────────────────────────────────────────

describe('computeLineDiff', () => {
  it('identical arrays produce all "same" entries', () => {
    const arr = ['line one', 'line two', 'line three']
    const result = computeLineDiff(arr, arr)
    expect(result.every(r => r.type === 'same')).toBe(true)
    expect(result.map(r => r.text)).toEqual(arr)
  })

  it('completely different arrays produce all removed then all added', () => {
    const original = ['alpha', 'beta']
    const current = ['gamma', 'delta']
    const result = computeLineDiff(original, current)
    const removed = result.filter(r => r.type === 'removed')
    const added = result.filter(r => r.type === 'added')
    expect(removed.map(r => r.text)).toEqual(['alpha', 'beta'])
    expect(added.map(r => r.text)).toEqual(['gamma', 'delta'])
    expect(result.filter(r => r.type === 'same')).toHaveLength(0)
  })

  it('one line added at the end produces one "added" entry', () => {
    const original = ['line one', 'line two']
    const current = ['line one', 'line two', 'line three']
    const result = computeLineDiff(original, current)
    const added = result.filter(r => r.type === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].text).toBe('line three')
    expect(result.filter(r => r.type === 'same')).toHaveLength(2)
  })

  it('one line removed produces one "removed" entry', () => {
    const original = ['line one', 'line two', 'line three']
    const current = ['line one', 'line three']
    const result = computeLineDiff(original, current)
    const removed = result.filter(r => r.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].text).toBe('line two')
    expect(result.filter(r => r.type === 'same')).toHaveLength(2)
  })

  it('one line changed produces one "removed" and one "added"', () => {
    const original = ['unchanged', 'old value', 'also unchanged']
    const current = ['unchanged', 'new value', 'also unchanged']
    const result = computeLineDiff(original, current)
    expect(result.filter(r => r.type === 'removed').map(r => r.text)).toEqual(['old value'])
    expect(result.filter(r => r.type === 'added').map(r => r.text)).toEqual(['new value'])
    expect(result.filter(r => r.type === 'same')).toHaveLength(2)
  })

  it('empty original and non-empty current → all "added"', () => {
    const current = ['a', 'b', 'c']
    const result = computeLineDiff([], current)
    expect(result.every(r => r.type === 'added')).toBe(true)
    expect(result.map(r => r.text)).toEqual(current)
  })

  it('non-empty original and empty current → all "removed"', () => {
    const original = ['x', 'y', 'z']
    const result = computeLineDiff(original, [])
    expect(result.every(r => r.type === 'removed')).toBe(true)
    expect(result.map(r => r.text)).toEqual(original)
  })

  it('both empty arrays → empty result', () => {
    expect(computeLineDiff([], [])).toEqual([])
  })

  it('preserves order: same/removed/added entries appear in document order', () => {
    const original = ['A', 'B', 'C']
    const current = ['A', 'D', 'C']
    const result = computeLineDiff(original, current)
    // A same, B removed, D added, C same
    expect(result[0]).toEqual({ type: 'same', text: 'A' })
    expect(result[result.length - 1]).toEqual({ type: 'same', text: 'C' })
  })
})
