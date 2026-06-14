import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Settings from '@/pages/Settings'

vi.mock('@/components/Navbar', () => ({
  default: ({ onBack }: { onBack?: () => void }) => <button onClick={onBack}>Back</button>,
}))

vi.mock('@/components/settings/AppearanceSettings', () => ({
  default: () => <div data-testid="appearance-panel">Appearance Panel</div>,
}))
vi.mock('@/components/settings/SecuritySettings', () => ({
  default: () => <div data-testid="security-panel">Security Panel</div>,
}))
vi.mock('@/components/settings/NotificationSettings', () => ({
  default: ({ onDirtyChange }: { onDirtyChange: (d: boolean) => void }) => (
    <div data-testid="notifications-panel">
      Notifications Panel
      <button onClick={() => onDirtyChange(true)}>Make Notifications Dirty</button>
    </div>
  ),
}))

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm')
})

describe('Settings — tab switching', () => {
  it('shows the Appearance tab by default and hides the others', () => {
    renderSettings()
    expect(screen.getByTestId('appearance-panel').parentElement?.className).not.toMatch(/hidden/)
    expect(screen.getByTestId('security-panel').parentElement?.className).toMatch(/hidden/)
    expect(screen.getByTestId('notifications-panel').parentElement?.className).toMatch(/hidden/)
  })

  it('switches to the Security tab', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Security')[0])

    expect(screen.getByTestId('security-panel').parentElement?.className).not.toMatch(/hidden/)
    expect(screen.getByTestId('appearance-panel').parentElement?.className).toMatch(/hidden/)
  })

  it('switches to the Notifications tab', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Notifications')[0])

    expect(screen.getByTestId('notifications-panel').parentElement?.className).not.toMatch(/hidden/)
    expect(screen.getByTestId('appearance-panel').parentElement?.className).toMatch(/hidden/)
  })

  it('keeps inactive tab panels mounted in the DOM when switching', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Security')[0])

    expect(screen.getByTestId('appearance-panel')).toBeInTheDocument()
    expect(screen.getByTestId('security-panel').parentElement?.className).not.toMatch(/hidden/)
  })
})

describe('Settings — back navigation', () => {
  it('navigates to the dashboard when there are no unsaved changes', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByText('Back'))

    expect(window.confirm).not.toHaveBeenCalled()
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('asks for confirmation and stays on the page if the user cancels', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Notifications')[0])
    await user.click(screen.getByText('Make Notifications Dirty'))
    await user.click(screen.getByText('Back'))

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(screen.getByTestId('notifications-panel')).toBeInTheDocument()
  })

  it('navigates to the dashboard if the user confirms discarding changes', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Notifications')[0])
    await user.click(screen.getByText('Make Notifications Dirty'))
    await user.click(screen.getByText('Back'))

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })
})
