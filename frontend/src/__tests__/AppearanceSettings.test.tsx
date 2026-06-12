import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppearanceSettings from '@/components/settings/AppearanceSettings'

vi.mock('next-themes', () => ({ useTheme: vi.fn() }))

import { useTheme } from 'next-themes'
const mockUseTheme = vi.mocked(useTheme)

const setTheme = vi.fn()

// `hover:border-primary/50` (inactive state) also contains the substring "border-primary",
// so check for the exact active-state token instead of using a substring match.
function isActive(el: HTMLElement) {
  return el.className.split(/\s+/).includes('border-primary')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTheme.mockReturnValue({ theme: 'light', setTheme, themes: [], systemTheme: undefined } as any)
})

describe('AppearanceSettings', () => {
  it('renders Light, Dark, and System options', () => {
    render(<AppearanceSettings />)
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument()
  })

  it('highlights the active theme after mount', async () => {
    render(<AppearanceSettings />)
    await waitFor(() => expect(isActive(screen.getByRole('button', { name: /light/i }))).toBe(true))
    expect(isActive(screen.getByRole('button', { name: /dark/i }))).toBe(false)
  })

  it('calls setTheme("dark") when Dark is clicked', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    await user.click(screen.getByRole('button', { name: /dark/i }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme("system") when System is clicked', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    await user.click(screen.getByRole('button', { name: /system/i }))
    expect(setTheme).toHaveBeenCalledWith('system')
  })

  it('reflects the current theme from useTheme when it is "dark"', async () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme, themes: [], systemTheme: undefined } as any)
    render(<AppearanceSettings />)
    await waitFor(() => expect(isActive(screen.getByRole('button', { name: /dark/i }))).toBe(true))
    expect(isActive(screen.getByRole('button', { name: /light/i }))).toBe(false)
  })
})
