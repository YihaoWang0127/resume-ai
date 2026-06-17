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
  it('renders 404 page with heading, subtitle, and back button', () => {
    renderNotFound()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
  })

  it('test_back_button_navigates_to_home', async () => {
    const user = userEvent.setup()
    renderNotFound()
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
