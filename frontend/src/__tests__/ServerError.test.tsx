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

  it('test_renders_500_text', () => {
    renderServerError()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('test_renders_something_went_wrong_subtitle', () => {
    renderServerError()
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
  })

  it('test_renders_back_to_home_button', () => {
    renderServerError()
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
  })

  it('test_renders_try_again_button', () => {
    renderServerError()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('test_try_again_calls_reload', async () => {
    const user = userEvent.setup()
    renderServerError()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(reloadSpy).toHaveBeenCalledOnce()
  })
})
