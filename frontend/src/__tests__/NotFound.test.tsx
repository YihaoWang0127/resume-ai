import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import NotFound from '@/pages/NotFound'

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  )
}

describe('NotFound', () => {
  it('test_renders_404_text', () => {
    renderNotFound()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('test_renders_page_not_found_subtitle', () => {
    renderNotFound()
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
  })

  it('test_renders_back_to_home_button', () => {
    renderNotFound()
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
  })

  it('test_back_button_navigates_to_home', async () => {
    const user = userEvent.setup()
    renderNotFound()
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
