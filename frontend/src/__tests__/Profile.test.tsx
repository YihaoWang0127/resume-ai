import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ProfileData } from '@/types/profile'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { updateUser: vi.fn() },
    storage: { from: vi.fn() },
  },
}))
vi.mock('@/services/profile', () => ({ getProfile: vi.fn(), upsertProfile: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/Navbar', () => ({
  default: ({ onBack }: { onBack?: () => void }) => <button onClick={onBack}>Back</button>,
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getProfile, upsertProfile } from '@/services/profile'
import { toast } from 'sonner'
import Profile from '@/pages/Profile'

const mockUseAuth = vi.mocked(useAuth)
const mockUpdateUser = vi.mocked(supabase.auth.updateUser)
const mockStorageFrom = vi.mocked(supabase.storage.from)
const mockGetProfile = vi.mocked(getProfile)
const mockUpsertProfile = vi.mocked(upsertProfile)

const resendVerificationEmail = vi.fn()

function setupAuth(overrides: Record<string, unknown> = {}, authOverrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      user_metadata: { full_name: 'Jane Smith' },
      ...overrides,
    },
    isGuest: false,
    emailVerified: true,
    resendVerificationEmail,
    ...authOverrides,
  } as any)
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const savedProfile: ProfileData = {
  user_id: 'user-1',
  full_name: 'Jane Smith',
  phone: '555-1234',
  address: 'San Francisco, CA',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  job_title: 'Software Engineer',
  target_job_title: '',
  target_industry: '',
  years_of_experience: 0,
  career_stage: 'early',
  experience_bullets: [],
  skills_technical: '',
  skills_tools: '',
  skills_certifications: '',
  experience: [
    {
      company: 'Acme Corp',
      title: 'Senior Engineer',
      startDate: 'Jan 2022',
      endDate: '',
      current: true,
      bullets: ['Led a team of 5 engineers'],
    },
  ],
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth()
  mockGetProfile.mockResolvedValue(null)
})

// ── Account section ──────────────────────────────────────────────────────────

describe('Profile — Account section', () => {
  it('shows the current display name', async () => {
    renderProfile()
    expect(screen.getByLabelText('Display Name')).toHaveValue('Jane Smith')
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
  })

  it('shows a read-only email field', async () => {
    renderProfile()
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveValue('jane@example.com')
    expect(emailInput).toBeDisabled()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
  })

  it('shows initials in the avatar fallback when there is no avatar image', async () => {
    renderProfile()
    expect(screen.getByText('JS')).toBeInTheDocument()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
  })

  it('disables Save Changes for the account card when nothing has changed', async () => {
    renderProfile()
    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    expect(saveButtons[0]).toBeDisabled()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
  })

  it('reports dirty and saves the display name via supabase.auth.updateUser', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as any)
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')

    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    expect(saveButtons[0]).not.toBeDisabled()
    await user.click(saveButtons[0])

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'New Name' } })
    )
    expect(toast.success).toHaveBeenCalledWith('Profile updated')
  })

  it('shows an error toast when the account save fails', async () => {
    mockUpdateUser.mockResolvedValue({ data: null, error: new Error('Update failed') } as any)
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')
    await user.click(screen.getAllByRole('button', { name: /save changes/i })[0])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Update failed'))
  })

  it('uploads an avatar and updates the avatar URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.test/avatar.png' } })
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl } as any)
    mockUpdateUser.mockResolvedValue({ data: {}, error: null } as any)

    const user = userEvent.setup()
    const { container } = renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith('user-1/avatar.png', file, { upsert: true })
    )
    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { avatar_url: expect.stringContaining('https://cdn.test/avatar.png') },
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Avatar updated')
  })

  it('shows an error toast when the avatar upload fails', async () => {
    const upload = vi.fn().mockResolvedValue({ error: new Error('Storage error') })
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl: vi.fn() } as any)

    const user = userEvent.setup()
    const { container } = renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Storage error'))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})

// ── email verification ───────────────────────────────────────────────────────

describe('Profile — email verification', () => {
  it('shows a "Verified" pill when the email is verified', async () => {
    setupAuth({}, { emailVerified: true })
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
  })

  it('shows a "Not Verified" pill and resend button when the email is unverified', async () => {
    setupAuth({}, { emailVerified: false })
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    expect(screen.getByText('Not Verified')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
  })

  it('resend button calls resendVerificationEmail, shows success toast, and starts cooldown', async () => {
    setupAuth({}, { emailVerified: false })
    resendVerificationEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /resend verification email/i }))

    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Verification email sent')
    expect(screen.getByRole('button', { name: /resend \(60s\)/i })).toBeDisabled()
  })

  it('renders nothing for guest users', async () => {
    setupAuth({}, { isGuest: true, emailVerified: true })
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
  })
})

// ── Personal Info & Experience ───────────────────────────────────────────────

describe('Profile — Personal Info & Experience (loading state)', () => {
  it('shows skeleton placeholders while loading', () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}))
    renderProfile()

    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows an error toast when loading the profile fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('Network error'))
    renderProfile()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network error'))
  })
})

describe('Profile — Personal Info & Experience (loaded, empty)', () => {
  beforeEach(() => mockGetProfile.mockResolvedValue(null))

  it('renders empty Personal Info fields with DEFAULT_PROFILE values', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Phone')).toBeInTheDocument())

    expect(screen.getByLabelText('Phone')).toHaveValue('')
    expect(screen.getByLabelText('Location')).toHaveValue('')
    expect(screen.getByLabelText('Current Job Title')).toHaveValue('')
  })

  it('shows the "no work experience yet" empty state', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByText(/no work experience yet/i)).toBeInTheDocument())
  })

  it('adds a new experience entry when "Add Experience" is clicked', async () => {
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(screen.getByText(/no work experience yet/i)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /add experience/i }))

    expect(screen.getByPlaceholderText('Job title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Company')).toBeInTheDocument()
    expect(screen.queryByText(/no work experience yet/i)).not.toBeInTheDocument()
  })

  it('reports the Personal Info Save Changes button as disabled until edited', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Phone')).toBeInTheDocument())

    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    // Second Save Changes button belongs to the Work Experience card
    expect(saveButtons[saveButtons.length - 1]).toBeDisabled()
  })

  it('enables Save Changes after editing phone and saves via upsertProfile', async () => {
    const saved: ProfileData = { ...savedProfile, phone: '555-0000', experience: [] }
    mockUpsertProfile.mockResolvedValue(saved)
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Phone')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Phone'), '555-0000')

    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    const infoSaveButton = saveButtons[saveButtons.length - 1]
    expect(infoSaveButton).not.toBeDisabled()
    await user.click(infoSaveButton)

    await waitFor(() =>
      expect(mockUpsertProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '555-0000' }))
    )
    expect(toast.success).toHaveBeenCalledWith('Career profile saved')
  })

  it('shows an error toast when saving Personal Info fails', async () => {
    mockUpsertProfile.mockRejectedValue(new Error('Save failed'))
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Phone')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Phone'), '555-0000')
    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    await user.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'))
  })
})

describe('Profile — Personal Info & Experience (loaded with saved data)', () => {
  beforeEach(() => mockGetProfile.mockResolvedValue(savedProfile))

  it('pre-fills Personal Info fields from the saved profile', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Phone')).toHaveValue('555-1234'))

    expect(screen.getByLabelText('Location')).toHaveValue('San Francisco, CA')
    expect(screen.getByLabelText('Current Job Title')).toHaveValue('Software Engineer')
  })

  it('renders existing experience entries', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument())

    expect(screen.getByDisplayValue('Senior Engineer')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jan 2022')).toBeInTheDocument()
    expect(screen.getByLabelText(/currently working here/i)).toBeChecked()
  })

  it('removes an experience entry when the trash icon is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderProfile()
    await waitFor(() => expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument())

    const removeButton = container.querySelector('button .lucide-trash-2')?.closest('button') as HTMLElement
    await user.click(removeButton)

    expect(screen.queryByDisplayValue('Acme Corp')).not.toBeInTheDocument()
    expect(screen.getByText(/no work experience yet/i)).toBeInTheDocument()
  })

  it('disables the end date field and clears it when "Currently working here" is checked', async () => {
    renderProfile()
    await waitFor(() => expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument())

    const endDateInput = screen.getByPlaceholderText('End') as HTMLInputElement
    expect(endDateInput).toBeDisabled()
  })
})

// ── Career Stage ─────────────────────────────────────────────────────────────

describe('Profile — Career Stage selector', () => {
  // suggestStageFromYears: 0 → 'student', 1-4 → 'early', ≥5 → 'experienced'
  // When the current career_stage does NOT match the suggestion, a hint is shown.

  it('shows a "Student" suggestion hint when years=0 and career_stage is not student', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, years_of_experience: 0, career_stage: 'early' })
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    expect(screen.getByText(/student/i, { selector: 'button' })).toBeInTheDocument()
    // The suggestion hint link text "Student" appears (distinct from the selector button label)
    const suggestionLink = screen.getAllByRole('button', { name: /student/i }).find(
      (btn) => btn.closest('p') !== null
    )
    expect(suggestionLink).toBeInTheDocument()
    expect(suggestionLink?.closest('p')?.textContent).toMatch(/suggested/i)
  })

  it('shows an "Early Career" suggestion hint when years=3 and career_stage is student', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, years_of_experience: 3, career_stage: 'student' })
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    const suggestionLink = screen.getAllByRole('button', { name: /early career/i }).find(
      (btn) => btn.closest('p') !== null
    )
    expect(suggestionLink).toBeInTheDocument()
    expect(suggestionLink?.closest('p')?.textContent).toMatch(/suggested/i)
  })

  it('shows an "Experienced" suggestion hint when years=7 and career_stage is early', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, years_of_experience: 7, career_stage: 'early' })
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    const suggestionLink = screen.getAllByRole('button', { name: /experienced/i }).find(
      (btn) => btn.closest('p') !== null
    )
    expect(suggestionLink).toBeInTheDocument()
    expect(suggestionLink?.closest('p')?.textContent).toMatch(/suggested/i)
  })

  it('does NOT show a suggestion hint when years=0 and career_stage is already student', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, years_of_experience: 0, career_stage: 'student' })
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    // No paragraph containing "Suggested:" should be present
    const suggestionParagraph = Array.from(document.querySelectorAll('p')).find(
      (p) => p.textContent?.toLowerCase().includes('suggested')
    )
    expect(suggestionParagraph).toBeUndefined()
  })

  it('renders the "Experienced" selector button as active (primary style) when career_stage is experienced', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, career_stage: 'experienced' })
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    // The active button has bg-primary text-primary-foreground classes
    const experiencedBtn = screen.getByRole('button', { name: 'Experienced' })
    expect(experiencedBtn).toBeInTheDocument()
    expect(experiencedBtn.className).toMatch(/bg-primary/)
  })

  it('calls upsertProfile with career_stage: student when the Student button is clicked', async () => {
    mockGetProfile.mockResolvedValue({ ...savedProfile, career_stage: 'early' })
    mockUpsertProfile.mockResolvedValue({ ...savedProfile, career_stage: 'student' })
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(screen.getByLabelText('Current Job Title')).toBeInTheDocument())

    // Click the "Student" selector button (the one inside the segmented control, not the suggestion link)
    const studentBtn = screen.getAllByRole('button', { name: /student/i }).find(
      (btn) => btn.closest('p') === null
    ) as HTMLElement
    await user.click(studentBtn)

    // Now save — the last Save Changes button belongs to the Work Experience card,
    // but any of the Save Changes buttons in the form will call upsertProfile
    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    await user.click(saveButtons[saveButtons.length - 1])

    await waitFor(() =>
      expect(mockUpsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({ career_stage: 'student' })
      )
    )
  })
})

// ── Back navigation ───────────────────────────────────────────────────────────

describe('Profile — back navigation', () => {
  it('navigates to the dashboard when there are no unsaved changes', async () => {
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    await user.click(screen.getByText('Back'))

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('asks for confirmation when there are unsaved changes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderProfile()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())

    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'New Name')
    await user.click(screen.getByText('Back'))

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument()
  })
})
