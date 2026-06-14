import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ResumeSchema } from '@/types/resume'

vi.mock('@/components/ResumePreview', () => ({
  default: () => <div data-testid="resume-preview" />,
}))

import ComparisonView from '@/components/ComparisonView'

const originalResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Software engineer',
  experience: [
    {
      company: 'Google',
      title: 'Software Engineer',
      startDate: 'Jan 2020',
      current: true,
      bullets: ['Worked on backend services'],
    },
  ],
  education: [],
  skills: [],
}

const enrichedResume: ResumeSchema = {
  ...originalResume,
  summary: 'Results-driven software engineer with 5 years of experience',
  experience: [
    {
      ...originalResume.experience[0],
      bullets: ['Led development of backend services, improving latency by 30%'],
    },
  ],
}

function renderComparisonView(props: Partial<Parameters<typeof ComparisonView>[0]> = {}) {
  return render(
    <ComparisonView
      originalResume={originalResume}
      enrichedResume={enrichedResume}
      onAccept={vi.fn()}
      onDiscard={vi.fn()}
      {...props}
    />
  )
}

describe('ComparisonView — view modes', () => {
  it('renders split view by default with Original and AI Enriched badges and two previews', () => {
    renderComparisonView()

    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('AI Enriched')).toBeInTheDocument()
    expect(screen.getAllByTestId('resume-preview')).toHaveLength(2)
  })

  it('switches to unified view when "Unified View" is clicked, hiding split badges and showing a single preview', async () => {
    const user = userEvent.setup()
    renderComparisonView()

    await user.click(screen.getByRole('button', { name: /unified view/i }))

    expect(screen.queryByText('Original')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Enriched')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('resume-preview')).toHaveLength(1)
  })
})

describe('ComparisonView — action bar', () => {
  it('calls onAccept when "Accept Changes" is clicked', async () => {
    const onAccept = vi.fn()
    const user = userEvent.setup()
    renderComparisonView({ onAccept })

    await user.click(screen.getByRole('button', { name: /accept changes/i }))

    expect(onAccept).toHaveBeenCalled()
  })

  it('calls onDiscard when "Discard" is clicked', async () => {
    const onDiscard = vi.fn()
    const user = userEvent.setup()
    renderComparisonView({ onDiscard })

    await user.click(screen.getByRole('button', { name: /discard/i }))

    expect(onDiscard).toHaveBeenCalled()
  })
})
