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
  { label: 'Package', path: '/package' },
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
  it('renders all 5 nav links', () => {
    renderSidebar('/profile')

    for (const { label } of NAV_ITEMS) {
      // Mobile pill bar + desktop sidebar both render every link
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('navigates to the correct path when a link is clicked', async () => {
    const user = userEvent.setup()

    // Test non-Profile items from /profile (where Profile is an accordion toggle, not a navigate)
    const { unmount } = renderSidebar('/profile')
    const nonProfileItems = NAV_ITEMS.filter(({ path }) => path !== '/profile')
    for (const { label, path } of nonProfileItems) {
      const buttons = screen.getAllByText(label).map((el) => el.closest('button')!)
      await user.click(buttons[0])
      expect(mockNavigate).toHaveBeenCalledWith(path)
    }

    // Test Profile navigation separately — must be on a non-profile path
    unmount()
    vi.clearAllMocks()
    renderSidebar('/ai')
    const profileButtons = screen.getAllByText('Profile').map((el) => el.closest('button')!)
    await user.click(profileButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('renders nav links in Profile, Dashboard, Package, AI, Settings order on desktop when not on /dashboard', () => {
    const { container } = renderSidebar('/ai')

    // Desktop sidebar is the second nav group in the DOM (mobile pill bar is first)
    const desktopNav = container.querySelectorAll('nav > div')[1]
    const labels = Array.from(desktopNav.querySelectorAll('button')).map((btn) => btn.textContent?.trim())

    // Expect the five top-level items to appear in order (no sub-items when not on /dashboard or /profile)
    expect(labels).toEqual(['Profile', 'Dashboard', 'Package', 'AI', 'Settings'])
  })

  it('renders Profile, Dashboard, AI, Settings top-level items on /dashboard (sub-items follow Dashboard)', () => {
    const { container } = renderSidebar('/dashboard')

    const desktopNav = container.querySelectorAll('nav > div')[1]
    const buttons = Array.from(desktopNav.querySelectorAll('button')).map((btn) => btn.textContent?.trim())

    // Top-level items must all be present
    expect(buttons).toContain('Profile')
    expect(buttons).toContain('Dashboard')
    expect(buttons).toContain('AI')
    expect(buttons).toContain('Settings')
    // Sub-items are also present when on /dashboard
    expect(buttons).toContain('Overview')
    expect(buttons).toContain('Resumes')
    expect(buttons).toContain('Cover Letters')
    expect(buttons).toContain('ATS Scores')
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
    // Mount at /ai so Profile accordion is not expanded
    const { container } = renderSidebar('/ai')

    const [mobileNav, desktopNav] = container.querySelectorAll('nav > div')
    expect(Array.from(mobileNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
    expect(Array.from(desktopNav.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
  })

  it('renders exactly 3 tabs (Profile, AI, Settings) for a signed-out user', () => {
    setupAuth({ user: null, isGuest: false })
    // Mount at /ai so Profile accordion is not expanded
    const { container } = renderSidebar('/ai')

    const [mobileNav, desktopNav] = container.querySelectorAll('nav > div')
    expect(Array.from(mobileNav.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Profile',
      'AI',
      'Settings',
    ])
    expect(Array.from(desktopNav.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
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

describe('AccountSidebar — Dashboard sub-items', () => {
  it('shows sub-items when on /dashboard', () => {
    renderSidebar('/dashboard')

    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Resumes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cover Letters').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ATS Scores').length).toBeGreaterThan(0)
  })

  it('hides sub-items when not on /dashboard', () => {
    renderSidebar('/profile')

    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumes')).not.toBeInTheDocument()
    expect(screen.queryByText('Cover Letters')).not.toBeInTheDocument()
    expect(screen.queryByText('ATS Scores')).not.toBeInTheDocument()
  })

  it('navigates to /dashboard when clicking the Overview sub-item', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard')

    const overviewButtons = screen.getAllByText('Overview').map((el) => el.closest('button')!)
    await user.click(overviewButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('navigates to /dashboard?tab=resumes when clicking the Resumes sub-item', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard')

    const resumeButtons = screen.getAllByText('Resumes').map((el) => el.closest('button')!)
    await user.click(resumeButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=resumes', { replace: true })
  })

  it('navigates to /dashboard?tab=cover-letters when clicking the Cover Letters sub-item', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard')

    const clButtons = screen.getAllByText('Cover Letters').map((el) => el.closest('button')!)
    await user.click(clButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=cover-letters', { replace: true })
  })

  it('navigates to /dashboard?tab=ats-scores when clicking the ATS Scores sub-item', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard')

    const atsButtons = screen.getAllByText('ATS Scores').map((el) => el.closest('button')!)
    await user.click(atsButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=ats-scores', { replace: true })
  })

  it('clicking Dashboard parent button still navigates to /dashboard', async () => {
    const user = userEvent.setup()
    renderSidebar('/profile')

    const dashboardButtons = screen.getAllByText('Dashboard').map((el) => el.closest('button')!)
    await user.click(dashboardButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('mobile pill bar replaces Dashboard pill with sub-item pills when on /dashboard', () => {
    const { container } = renderSidebar('/dashboard')

    const mobileNav = container.querySelectorAll('nav > div')[0]
    const mobileLabels = Array.from(mobileNav.querySelectorAll('button')).map((b) => b.textContent?.trim())

    // Dashboard pill is gone; sub-items appear instead
    expect(mobileLabels).not.toContain('Dashboard')
    expect(mobileLabels).toContain('Overview')
    expect(mobileLabels).toContain('Resumes')
    expect(mobileLabels).toContain('Cover Letters')
    expect(mobileLabels).toContain('ATS Scores')
  })
})
