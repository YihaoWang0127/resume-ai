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
  it('highlights Dashboard when on /dashboard', () => {
    renderSidebar('/dashboard')

    const dashboardButtons = screen.getAllByText('Dashboard').map((el) => el.closest('button')!)
    for (const button of dashboardButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const profileButtons = screen.getAllByText('Profile').map((el) => el.closest('button')!)
    for (const button of profileButtons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('highlights Profile when on /profile', () => {
    renderSidebar('/profile')

    const profileButtons = screen.getAllByText('Profile').map((el) => el.closest('button')!)
    for (const button of profileButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const dashboardButtons = screen.getAllByText('Dashboard').map((el) => el.closest('button')!)
    for (const button of dashboardButtons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('highlights AI when on /ai', () => {
    renderSidebar('/ai')

    const aiButtons = screen.getAllByText('AI').map((el) => el.closest('button')!)
    for (const button of aiButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const settingsButtons = screen.getAllByText('Settings').map((el) => el.closest('button')!)
    for (const button of settingsButtons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('highlights Settings when on /settings', () => {
    renderSidebar('/settings')

    const settingsButtons = screen.getAllByText('Settings').map((el) => el.closest('button')!)
    for (const button of settingsButtons) {
      expect(button.className).toMatch(/bg-primary/)
    }

    const aiButtons = screen.getAllByText('AI').map((el) => el.closest('button')!)
    for (const button of aiButtons) {
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
