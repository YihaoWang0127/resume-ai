import type { ResumeSchema } from '@/types/resume'

export function resumeToLines(resume: ResumeSchema): string[] {
  const lines: string[] = []

  // Name + contact line
  lines.push(resume.metadata.fullName)
  const contactParts = [
    resume.metadata.email,
    resume.metadata.phone,
    resume.metadata.location,
    resume.metadata.linkedIn,
    resume.metadata.github,
  ].filter(Boolean) as string[]
  if (contactParts.length > 0) lines.push(contactParts.join(' | '))

  // Summary
  if (resume.summary) {
    lines.push('')
    lines.push('SUMMARY')
    lines.push(resume.summary)
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    lines.push('')
    lines.push('EXPERIENCE')
    resume.experience.forEach((exp, i) => {
      if (i > 0) lines.push('')
      const dateRange = exp.current
        ? `${exp.startDate} – Present`
        : `${exp.startDate} – ${exp.endDate ?? ''}`
      lines.push(`${exp.title} @ ${exp.company} (${dateRange})`)
      exp.bullets.forEach(b => {
        if (b.trim()) lines.push(`• ${b}`)
      })
    })
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    lines.push('')
    lines.push('EDUCATION')
    resume.education.forEach(edu => {
      lines.push(`${edu.degree} in ${edu.field} | ${edu.institution} | ${edu.graduationYear}`)
    })
  }

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    lines.push('')
    lines.push('SKILLS')
    resume.skills.forEach(sk => {
      const itemsStr = sk.items.filter(Boolean).join(', ')
      if (sk.category) {
        lines.push(`${sk.category}: ${itemsStr}`)
      } else {
        lines.push(itemsStr)
      }
    })
  }

  return lines
}

export function computeLineDiff(
  original: string[],
  current: string[],
): Array<{ type: 'same' | 'added' | 'removed'; text: string }> {
  const m = original.length, n = current.length
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === current[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  // Traceback
  const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === current[j - 1]) {
      result.unshift({ type: 'same', text: original[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: current[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: original[i - 1] })
      i--
    }
  }
  return result
}
