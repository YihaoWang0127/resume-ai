import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Settings from '@/pages/Settings'

vi.mock('@/components/Navbar', () => ({
  default: ({ onBack }: { onBack?: () => void }) => <button onClick={onBack}>Back</button>,
}))

vi.mock('@/components/settings/ChangePasswordSettings', () => ({
  default: () => <div data-testid="change-password-panel">Change Password Panel</div>,
}))
vi.mock('@/components/settings/AppearanceSettings', () => ({
  default: () => <div data-testid="appearance-panel">Appearance Panel</div>,
}))
vi.mock('@/components/settings/NotificationSettings', () => ({
  default: ({ onDirtyChange }: { onDirtyChange: (d: boolean) => void }) => (
    <div data-testid="notifications-panel">
      Notifications Panel
      <button onClick={() => onDirtyChange(true)}>Make Notifications Dirty</button>
    </div>
  ),
}))
vi.mock('@/components/settings/DangerZoneSettings', () => ({
  default: () => <div data-testid="danger-zone-panel">Danger Zone Panel</div>,
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

describe('Settings — layout', () => {
  it('renders the Settings page heading and description', () => {
    renderSettings()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(
      screen.getByText('Manage your appearance, security, and notification preferences.')
    ).toBeInTheDocument()
  })

  it('renders all settings sections at once with no tab-switcher', () => {
    renderSettings()

    expect(screen.getByTestId('change-password-panel')).toBeInTheDocument()
    expect(screen.getByTestId('appearance-panel')).toBeInTheDocument()
    expect(screen.getByTestId('notifications-panel')).toBeInTheDocument()
    expect(screen.getByTestId('danger-zone-panel')).toBeInTheDocument()

    // None of the panels should be hidden — all stacked on one page
    expect(screen.getByTestId('change-password-panel').className).not.toMatch(/hidden/)
    expect(screen.getByTestId('appearance-panel').className).not.toMatch(/hidden/)
    expect(screen.getByTestId('notifications-panel').className).not.toMatch(/hidden/)
    expect(screen.getByTestId('danger-zone-panel').className).not.toMatch(/hidden/)
  })

  it('does not render a settings tab-switcher sidebar', () => {
    renderSettings()

    expect(screen.queryByRole('button', { name: 'Appearance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('renders the sections in order: Change Password, Appearance, Notifications, Danger Zone', () => {
    renderSettings()

    const testIds = [
      'change-password-panel',
      'appearance-panel',
      'notifications-panel',
      'danger-zone-panel',
    ]
    const positions = testIds.map((id) => screen.getByTestId(id))

    for (let i = 0; i < positions.length - 1; i++) {
      // Each section should appear before the next one in the DOM
      // eslint-disable-next-line no-bitwise
      expect(
        positions[i].compareDocumentPosition(positions[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }

    // Danger Zone is last
    expect(positions[positions.length - 1].getAttribute('data-testid')).toBe('danger-zone-panel')
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

    await user.click(screen.getByText('Make Notifications Dirty'))
    await user.click(screen.getByText('Back'))

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(screen.getByTestId('notifications-panel')).toBeInTheDocument()
  })

  it('navigates to the dashboard if the user confirms discarding changes', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByText('Make Notifications Dirty'))
    await user.click(screen.getByText('Back'))

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })
})
