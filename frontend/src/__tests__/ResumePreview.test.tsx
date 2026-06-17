import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResumePreview from '@/components/ResumePreview'
import type { ResumeSchema } from '@/types/resume'

const mockResume: ResumeSchema = {
  metadata: {
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
    linkedIn: 'https://linkedin.com/in/jane',
    github: 'https://github.com/jane',
  },
  summary: 'Experienced software engineer with 8 years building scalable systems.',
  experience: [
    {
      company: 'Google',
      title: 'Senior Software Engineer',
      startDate: 'Jan 2020',
      current: true,
      bullets: ['Led team of 5 engineers', 'Reduced latency by 40%'],
    },
    {
      company: 'Stripe',
      title: 'Software Engineer',
      startDate: 'Jun 2017',
      endDate: 'Dec 2019',
      current: false,
      bullets: ['Built payment pipeline'],
    },
  ],
  education: [
    {
      institution: 'MIT',
      degree: 'B.S.',
      field: 'Computer Science',
      graduationYear: 'Jun 2017',
    },
  ],
  skills: [
    { category: 'Languages', items: ['Python', 'Go', 'TypeScript'] },
    { category: 'Frameworks', items: ['FastAPI', 'React'] },
  ],
}

describe('ResumePreview — content rendering', () => {
  it('renders all resume content correctly', () => {
    render(<ResumePreview resume={mockResume} />)
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText(/Experienced software engineer/)).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Led team of 5 engineers')).toBeInTheDocument()
    expect(screen.getByText('Reduced latency by 40%')).toBeInTheDocument()
    expect(screen.getByText('MIT')).toBeInTheDocument()
    expect(screen.getByText(/Languages:/)).toBeInTheDocument()
    expect(screen.getByText(/Frameworks:/)).toBeInTheDocument()
    expect(screen.getByText(/Python, Go, TypeScript/)).toBeInTheDocument()
    expect(screen.getByText(/jane@example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/Present/)).toBeInTheDocument()
  })
})

describe('ResumePreview — style switcher', () => {
  it('renders all 5 industry style pills when onIndustryChange is provided', () => {
    render(
      <ResumePreview
        resume={mockResume}
        industry="general"
        onIndustryChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Tech')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
    expect(screen.getByText('Creative')).toBeInTheDocument()
    expect(screen.getByText('Healthcare')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('does not render style pills when onIndustryChange is omitted', () => {
    render(<ResumePreview resume={mockResume} industry="general" />)
    expect(screen.queryByText('Tech')).not.toBeInTheDocument()
  })

  it('shows "✓ AI" badge next to the detected industry', () => {
    render(
      <ResumePreview
        resume={mockResume}
        industry="general"
        detectedIndustry="tech"
        onIndustryChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/✓ AI/)).toBeInTheDocument()
  })

  it('does not show AI detected badge when detectedIndustry is not set', () => {
    render(
      <ResumePreview
        resume={mockResume}
        industry="general"
        onIndustryChange={vi.fn()}
      />,
    )
    expect(screen.queryByText(/AI detected/i)).not.toBeInTheDocument()
  })

  it.each([
    ['Finance', 'finance'],
    ['Tech', 'tech'],
  ])('calls onIndustryChange with "%s" when %s pill is clicked', async (label, expectedValue) => {
    const onChange = vi.fn()
    render(
      <ResumePreview
        resume={mockResume}
        industry="general"
        onIndustryChange={onChange}
      />,
    )
    await userEvent.click(screen.getByText(label))
    expect(onChange).toHaveBeenCalledWith(expectedValue)
  })

  it('renders "Style:" label', () => {
    render(
      <ResumePreview
        resume={mockResume}
        industry="general"
        onIndustryChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Style:')).toBeInTheDocument()
  })
})

describe('ResumePreview — empty resume', () => {
  const emptyResume: ResumeSchema = {
    metadata: { fullName: '', email: '' },
    experience: [],
    education: [],
    skills: [],
  }

  it('renders placeholder name when fullName is empty', () => {
    render(<ResumePreview resume={emptyResume} />)
    expect(screen.getByText('Your Name')).toBeInTheDocument()
  })

  it('does not render experience section when empty', () => {
    render(<ResumePreview resume={emptyResume} />)
    expect(screen.queryByText('Experience')).not.toBeInTheDocument()
  })

  it('does not render skills section when empty', () => {
    render(<ResumePreview resume={emptyResume} />)
    expect(screen.queryByText('Skills')).not.toBeInTheDocument()
  })
})
