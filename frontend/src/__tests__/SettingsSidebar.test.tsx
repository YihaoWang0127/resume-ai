import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsSidebar, { SETTINGS_TABS } from '@/components/settings/SettingsSidebar'

describe('SettingsSidebar', () => {
  it('renders all tab labels', () => {
    render(<SettingsSidebar activeTab="appearance" onChange={vi.fn()} />)
    for (const tab of SETTINGS_TABS) {
      expect(screen.getAllByText(tab.label).length).toBeGreaterThan(0)
    }
  })

  it('highlights the active tab', () => {
    render(<SettingsSidebar activeTab="appearance" onChange={vi.fn()} />)
    const buttons = screen.getAllByText('Appearance').map((el) => el.closest('button')!)
    for (const button of buttons) {
      expect(button.className).toMatch(/bg-primary/)
    }
  })

  it('does not highlight inactive tabs', () => {
    render(<SettingsSidebar activeTab="appearance" onChange={vi.fn()} />)
    const buttons = screen.getAllByText('Security').map((el) => el.closest('button')!)
    for (const button of buttons) {
      expect(button.className).not.toMatch(/bg-primary/)
    }
  })

  it('calls onChange with the clicked tab id', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SettingsSidebar activeTab="appearance" onChange={onChange} />)

    const [securityButton] = screen.getAllByText('Security').map((el) => el.closest('button')!)
    await user.click(securityButton)

    expect(onChange).toHaveBeenCalledWith('security')
  })
})
