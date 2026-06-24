import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuotaExceededModal from '@/components/QuotaExceededModal'

// ── QuotaExceededModal ────────────────────────────────────────────────────────

describe('QuotaExceededModal', () => {
  it('renders nothing when open is false', () => {
    render(<QuotaExceededModal open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Monthly Limit Reached')).not.toBeInTheDocument()
  })

  it('renders modal content when open is true', () => {
    render(<QuotaExceededModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Monthly Limit Reached')).toBeInTheDocument()
  })

  it('shows quota reset information when open', () => {
    render(<QuotaExceededModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/quota resets on the 1st of each month/i)).toBeInTheDocument()
  })

  it('calls onClose when the "Got it" button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QuotaExceededModal open={true} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /got it/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not show the "Got it" button when closed', () => {
    render(<QuotaExceededModal open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /got it/i })).not.toBeInTheDocument()
  })
})
