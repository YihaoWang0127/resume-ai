import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Settings from '@/pages/Settings'

vi.mock('@/components/Navbar', () => ({
  default: ({ onBack }: { onBack?: () => void }) => <button onClick={onBack}>Back</button>,
}))

vi.mock('@/components/settings/ProfileSettings', () => ({
  default: ({ onDirtyChange }: { onDirtyChange: (d: boolean) => void }) => (
    <div data-testid="profile-panel">
      Profile Panel
      <button onClick={() => onDirtyChange(true)}>Make Profile Dirty</button>
    </div>
  ),
}))
vi.mock('@/components/settings/AIPreferencesSettings', () => ({
  default: () => <div data-testid="ai-panel">AI Panel</div>,
}))
vi.mock('@/components/settings/AppearanceSettings', () => ({
  default: () => <div data-testid="appearance-panel">Appearance Panel</div>,
}))
vi.mock('@/components/settings/SecuritySettings', () => ({
  default: () => <div data-testid="security-panel">Security Panel</div>,
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
  it('shows the Profile tab by default and hides the others', () => {
    renderSettings()
    expect(screen.getByTestId('profile-panel').parentElement?.className).not.toMatch(/hidden/)
    expect(screen.getByTestId('ai-panel').parentElement?.className).toMatch(/hidden/)
  })

  it('switches to the AI Preferences tab', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('AI Preferences')[0])

    expect(screen.getByTestId('ai-panel').parentElement?.className).not.toMatch(/hidden/)
    expect(screen.getByTestId('profile-panel').parentElement?.className).toMatch(/hidden/)
  })

  it('keeps inactive tab panels mounted in the DOM when switching', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getAllByText('Appearance')[0])

    expect(screen.getByTestId('profile-panel')).toBeInTheDocument()
    expect(screen.getByTestId('appearance-panel').parentElement?.className).not.toMatch(/hidden/)
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

    await user.click(screen.getByText('Make Profile Dirty'))
    await user.click(screen.getByText('Back'))

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(screen.getByTestId('profile-panel')).toBeInTheDocument()
  })

  it('navigates to the dashboard if the user confirms discarding changes', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByText('Make Profile Dirty'))
    await user.click(screen.getByText('Back'))

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })
})
