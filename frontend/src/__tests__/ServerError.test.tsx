import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import ServerError from '@/pages/ServerError'

function renderServerError() {
  return render(
    <MemoryRouter>
      <ServerError />
    </MemoryRouter>
  )
}

describe('ServerError', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders 500 page with heading, subtitle, and both action buttons', () => {
    renderServerError()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('test_try_again_calls_reload', async () => {
    const user = userEvent.setup()
    renderServerError()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(reloadSpy).toHaveBeenCalledOnce()
  })
})
