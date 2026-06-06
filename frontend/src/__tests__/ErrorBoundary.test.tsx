import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import ErrorBoundary from '@/components/ErrorBoundary'

function Boom(): never {
  throw new Error('test crash')
}

function renderBoundary(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ErrorBoundary>{children}</ErrorBoundary>
    </MemoryRouter>
  )
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('test_renders_children_when_no_error', () => {
    renderBoundary(<p>All good</p>)
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('test_renders_fallback_when_error_thrown', () => {
    renderBoundary(<Boom />)
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
  })
})
