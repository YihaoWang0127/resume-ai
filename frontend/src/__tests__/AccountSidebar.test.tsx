import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AccountSidebar from '@/components/AccountSidebar'

// Navigate mock — capture calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '@/contexts/AuthContext'
const mockUseAuth = vi.mocked(useAuth)

function setupAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'jane@example.com' } as any,
    isGuest: false,
    ...overrides,
  } as any)
}

const NAV_ITEMS = [
  { label: 'Profile', path: '/profile' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'AI', path: '/ai' },
  { label: 'Settings', path: '/settings' },
]

function renderSidebar(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<AccountSidebar />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
})

describe('AccountSidebar — nav links', () => {
  it('renders all 4 nav links', () => {
    renderSidebar('/dashboard')

    for (const { label } of NAV_ITEMS) {
      // Mobile pill bar + desktop sidebar both render every link
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('navigates to the correct path when a link is clicked', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard')

    for (const { label, path } of NAV_ITEMS) {
      const buttons = screen.getAllByText(label).map((el) => el.closest('button')!)
      await user.click(buttons[0])
      expect(mockNavigate).toHaveBeenCalledWith(path)
    }
  })

  it('renders nav links in Profile, Dashboard, AI, Settings order', () => {
    const { container } = renderSidebar('/dashboard')

    // Desktop sidebar is the second nav group in the DOM (mobile pill bar is first)
    const desktopNav = container.querySelectorAll('nav > div')[1]
    const labels = Array.from(desktopNav.querySelectorAll('button')).map((btn) => btn.textContent)

    expect(labels).toEqual(['Profile', 'Dashboard', 'AI', 'Settings'])
  })
})

describe('AccountSidebar — active link highlighting', () => {
  it.each([
    ['/dashboard', 'Dashboard', 'Profile'],
    ['/profile', 'Profile', 'Dashboard'],
    ['/ai', 'AI', 'Settings'],
    ['/settings', 'Settings', 'AI'],
  ])('highlights %s link when on %s', (path, activeLabel, inactiveLabel) => {
    renderSidebar(path)

    const activeButtons = screen.getAllByText(activeLabel).map((el) => el.closest('button')!)
    for (const button of activeButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const inactiveButtons = screen.getAllByText(inactiveLabel).map((el) => el.closest('button')!)
    for (const button of inactiveButtons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('highlights no nav link on an unrelated route', () => {
    renderSidebar('/some-other-page')

    for (const { label } of NAV_ITEMS) {
      const buttons = screen.getAllByText(label).map((el) => el.closest('button')!)
      for (const button of buttons) {
        expect(button.className).not.toMatch(/bg-primary/)
      }
    }
  })
})

describe('AccountSidebar — guest and signed-out users', () => {
  it('hides the Dashboard tab for a guest user', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderSidebar('/profile')

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
  })

  it('hides the Dashboard tab for a signed-out user', () => {
    setupAuth({ user: null, isGuest: false })
    renderSidebar('/profile')

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
  })

  it('shows the Dashboard tab for a signed-in non-guest user', () => {
    setupAuth({ user: { id: 'u1', email: 'jane@example.com' } as any, isGuest: false })
    renderSidebar('/profile')

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
  })

  it('renders exactly 3 tabs (Profile, AI, Settings) in both the mobile pill bar and desktop sidebar for a guest', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const { container } = renderSidebar('/profile')

    const [mobileNav, desktopNav] = container.querySelectorAll('nav > div')
    expect(Array.from(mobileNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
    expect(Array.from(desktopNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
  })

  it('renders exactly 3 tabs (Profile, AI, Settings) for a signed-out user', () => {
    setupAuth({ user: null, isGuest: false })
    const { container } = renderSidebar('/profile')

    const [mobileNav, desktopNav] = container.querySelectorAll('nav > div')
    expect(Array.from(mobileNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
    expect(Array.from(desktopNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
  })

  it('still highlights the active tab for a guest user when Dashboard is hidden', () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    renderSidebar('/ai')

    const aiButtons = screen.getAllByText('AI').map((el) => el.closest('button')!)
    for (const button of aiButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const profileButtons = screen.getAllByText('Profile').map((el) => el.closest('button')!)
    for (const button of profileButtons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('navigates correctly when clicking AI and Settings tabs as a guest', async () => {
    setupAuth({ user: { id: 'anon1', is_anonymous: true } as any, isGuest: true })
    const user = userEvent.setup()
    renderSidebar('/profile')

    const aiButtons = screen.getAllByText('AI').map((el) => el.closest('button')!)
    await user.click(aiButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/ai')

    const settingsButtons = screen.getAllByText('Settings').map((el) => el.closest('button')!)
    await user.click(settingsButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })
})
