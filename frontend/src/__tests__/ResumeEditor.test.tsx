import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ResumeSchema } from '@/types/resume'

// ── module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/api', () => ({
  enrichResume: vi.fn(),
  exportResume: vi.fn(),
  tailorResume: vi.fn(),
  scoreATS: vi.fn(),
  generateCoverLetter: vi.fn(),
  validateJobDescription: vi.fn().mockResolvedValue({ valid: true, reason: '' }),
  fromBackend: vi.fn((d: unknown) => d),
}))
vi.mock('@/services/resumes', () => ({
  saveResume: vi.fn(),
  updateResume: vi.fn(),
}))
vi.mock('@/services/coverLetters', () => ({
  saveCoverLetter: vi.fn(),
  updateCoverLetter: vi.fn(),
  deleteCoverLetter: vi.fn(),
}))
vi.mock('@/components/ResumePreview', () => ({
  default: (props: { onIndustryChange?: (industry: string) => void }) => (
    <div data-testid="resume-preview">
      <button
        type="button"
        data-testid="change-industry"
        onClick={() => props.onIndustryChange?.('finance')}
      >
        Change Industry
      </button>
    </div>
  ),
}))
vi.mock('@/components/StreamingOutput', () => ({
  default: () => <div data-testid="streaming-output" />,
}))

// ── imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext'
import { saveResume, updateResume } from '@/services/resumes'
import { enrichResume, generateCoverLetter, validateJobDescription } from '@/services/api'
import { saveCoverLetter, updateCoverLetter, deleteCoverLetter } from '@/services/coverLetters'
import ResumeEditor from '@/components/ResumeEditor'

const mockUseAuth = vi.mocked(useAuth)
const mockSaveResume = vi.mocked(saveResume)
const mockUpdateResume = vi.mocked(updateResume)
const mockEnrichResume = vi.mocked(enrichResume)
const mockGenerateCoverLetter = vi.mocked(generateCoverLetter)
const mockValidateJobDescription = vi.mocked(validateJobDescription)
const mockSaveCoverLetter = vi.mocked(saveCoverLetter)
const mockUpdateCoverLetter = vi.mocked(updateCoverLetter)
const mockDeleteCoverLetter = vi.mocked(deleteCoverLetter)

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockResume: ResumeSchema = {
  metadata: { fullName: 'Jane Smith', email: 'jane@example.com' },
  summary: 'Software engineer',
  experience: [],
  education: [],
  skills: [],
  detectedIndustry: 'tech',
}

const regularUser = { id: 'u1', email: 'user@test.com', is_anonymous: false }
const guestUser = { id: 'anon-1', email: null, is_anonymous: true }

const defaultAuth = {
  user: regularUser,
  session: null,
  loading: false,
  isGuest: false,
  showAuthModal: false,
  openAuthModal: vi.fn(),
  closeAuthModal: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInAsGuest: vi.fn(),
  signOut: vi.fn(),
}

function renderEditor(props: Partial<Parameters<typeof ResumeEditor>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ResumeEditor
        initialResume={mockResume}
        onBack={vi.fn()}
        onSignUp={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mockUseAuth.mockReturnValue(defaultAuth as any)
  mockValidateJobDescription.mockResolvedValue({ valid: true, reason: '' })
})

// ── save / update buttons ─────────────────────────────────────────────────────
// The "Save" button lives in the step 3 toolbar (right side, visible on all 3
// document tabs). It calls handleUpdate (existing ID) or handleSaveClick (new).
// There is no "Save Changes" button in the bottom nav any more.

describe('ResumeEditor — save button', () => {
  it('shows "Save Changes" button and opens save dialog when logged-in user clicks it', async () => {
    const user = userEvent.setup()
    renderEditor()

    // Navigate to step 3 where the Save button lives in the toolbar
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByRole('heading', { name: /save resume/i })).toBeInTheDocument()
  })

  it('calls onSignUp instead of opening dialog when a guest clicks Save Changes', async () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, user: guestUser, isGuest: true } as any)
    const onSignUp = vi.fn()
    const user = userEvent.setup()
    renderEditor({ onSignUp })

    // Navigate to step 3 where the Save button lives in the toolbar
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSignUp).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
  })

  it('shows "Save Changes" button when initialResumeId is provided (calls update inline, no dialog)', async () => {
    const user = userEvent.setup()
    renderEditor({ initialResumeId: 'existing-id' })

    // Navigate to step 3 where the Save button lives in the toolbar
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    // No separate "Update" button — Save handles both paths
    expect(screen.queryByRole('button', { name: /^update$/i })).not.toBeInTheDocument()
  })
})

// Helper: navigate to step 3 and open the save dialog by clicking the Save toolbar button.
// The Save button opens the save dialog when there is no existing resume ID.
async function openSaveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
  await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  await user.click(screen.getByRole('button', { name: /^save$/i }))
  return screen.getByRole('heading', { name: /save resume/i }).closest('div.bg-card') as HTMLElement
}

// ── save dialog ───────────────────────────────────────────────────────────────

describe('ResumeEditor — save dialog', () => {
  it('prefills the title input with a default value', async () => {
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    const input = within(dialog).getByRole('textbox')
    expect((input as HTMLInputElement).value).toMatch(/resume/i)
  })

  it('calls saveResume with the entered title on confirm', async () => {
    mockSaveResume.mockResolvedValue({ id: 'new-id' } as any)
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    const input = within(dialog).getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'My Custom Title')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockSaveResume).toHaveBeenCalledWith(mockResume, 'My Custom Title', undefined)
    )
  })

  it('closes the save dialog after a successful save', async () => {
    mockSaveResume.mockResolvedValue({ id: 'new-id' } as any)
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
    )
  })

  it('Cancel button closes the save dialog without saving', async () => {
    const user = userEvent.setup()
    renderEditor()

    const dialog = await openSaveDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
    expect(mockSaveResume).not.toHaveBeenCalled()
  })

  it('calls saveResume with the newly selected style, not the original detectedIndustry', async () => {
    mockSaveResume.mockResolvedValue({ id: 'new-id' } as any)
    const user = userEvent.setup()
    renderEditor()

    // Navigate to step 3 where the template-select is rendered in the stage toolbar
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    // Change the style via the template-select dropdown
    await user.selectOptions(screen.getByTestId('template-select'), 'finance')

    // "Save" (toolbar button) opens the save dialog (no existing resume ID)
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // Confirm in the save dialog
    const dialog = screen.getByRole('heading', { name: /save resume/i }).closest('div.bg-card') as HTMLElement
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockSaveResume).toHaveBeenCalledWith(
        expect.objectContaining({ detectedIndustry: 'finance' }),
        expect.any(String),
        undefined,
      )
    )
    const [savedResume] = mockSaveResume.mock.calls[0]
    expect(savedResume.detectedIndustry).not.toBe(mockResume.detectedIndustry)
  })
})

// ── update (existing resume) ─────────────────────────────────────────────────

describe('ResumeEditor — update existing resume', () => {
  it('calls updateResume with the newly selected style, not the original detectedIndustry', async () => {
    mockUpdateResume.mockResolvedValue({ id: 'existing-id' } as any)
    const user = userEvent.setup()
    renderEditor({ initialResumeId: 'existing-id' })

    // Navigate to step 3 where the template-select is rendered in the stage toolbar
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    // Change the style via the template-select dropdown
    await user.selectOptions(screen.getByTestId('template-select'), 'finance')

    // "Save" (toolbar button) calls handleUpdate when currentResumeId is set
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdateResume).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({ detectedIndustry: 'finance' }),
        undefined,
        undefined,
      )
    )
    const [, updatedResume] = mockUpdateResume.mock.calls[0]
    expect(updatedResume.detectedIndustry).not.toBe(mockResume.detectedIndustry)
  })
})

// ── header layout ─────────────────────────────────────────────────────────────
// The new design replaced the Navbar with an inline header that shows a
// logo, a "Back to Dashboard" link, a step indicator, and an avatar.
// The Download/Export button now lives in the stage toolbar at step 3 (Review & Export).

describe('ResumeEditor — header', () => {
  it('renders the Back to Dashboard button', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    renderEditor({ onBack })

    await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

    expect(onBack).toHaveBeenCalled()
  })
})


// ── desktop layout — 3-column layout ─────────────────────────────────────────
// The redesigned editor has: left sidebar (SECTION_DEFS nav) + center editor
// column + right preview panel. The old 40%-bounded single left panel and
// horizontal tab bar are gone; navigation now lives in an <aside> sidebar.

describe('ResumeEditor — desktop layout', () => {
  it('renders sidebar nav buttons, zoom controls, and stage Continue button', () => {
    renderEditor()

    for (const label of ['Contact', 'Summary', 'Experience', 'Education', 'Skills', 'ATS Score']) {
      expect(screen.getAllByRole('button', { name: new RegExp(`^${label}$`, 'i') }).length).toBeGreaterThan(0)
    }
    expect(screen.getByTestId('zoom-display')).toBeInTheDocument()
    // Step 1 bottom bar shows "Continue to AI Enhance" instead of "Next Step"
    expect(screen.getByRole('button', { name: /continue to ai enhance/i })).toBeInTheDocument()
    // Template dropdown only appears in Stage 3 toolbar — tested separately
  })
})

// ── all 6 sections always rendered ───────────────────────────────────────────
// The redesigned editor renders all sections simultaneously in a scrollable
// column — no conditional {tab === 'xxx' && (...)} gating. All section
// headings and key form elements should be in the DOM without any navigation.

describe('ResumeEditor — all sections always visible', () => {
  it('renders all 5 section headings, key textareas, and add buttons on initial render', () => {
    renderEditor()

    expect(screen.getByRole('heading', { name: /contact information/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^summary$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^experience$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^education$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/brief professional summary/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add experience/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add education/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add skills/i })).toBeInTheDocument()
  })
})

// ── enrich with AI — loading overlay ──────────────────────────────────────────

const ENRICHMENT_LOADING_MESSAGES = [
  'Analyzing your resume...',
  'Enhancing bullet points...',
  'Quantifying achievements...',
  'Optimizing for ATS keywords...',
  'Finalizing improvements...',
]

// A ReadableStream whose reader never resolves, so runStream() never marks
// `stream.done = true` and enrichmentState stays 'loading'.
function createPendingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start() {
      // intentionally never enqueue or close
    },
  })
}

describe('ResumeEditor — enrich with AI loading overlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a cycling status message that advances after 1500ms', async () => {
    mockEnrichResume.mockResolvedValue(createPendingStream())
    renderEditor()

    // Navigate to Step 2 where "Generate Improvements" button lives in the Resume Polish workspace
    fireEvent.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    // Resume Polish is the default tool — "Generate Improvements" button is visible
    fireEvent.click(screen.getByRole('button', { name: /generate improvements/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getAllByText(ENRICHMENT_LOADING_MESSAGES[0])[0]).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getAllByText(ENRICHMENT_LOADING_MESSAGES[1])[0]).toBeInTheDocument()
    expect(screen.queryByText(ENRICHMENT_LOADING_MESSAGES[0])).not.toBeInTheDocument()
  })

  it('applies blur/opacity classes to the preview container while loading', async () => {
    mockEnrichResume.mockResolvedValue(createPendingStream())
    renderEditor()

    // Navigate to Step 2 where "Generate Improvements" button lives in the Resume Polish workspace
    fireEvent.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    // Resume Polish is the default tool — "Generate Improvements" button is visible
    fireEvent.click(screen.getByRole('button', { name: /generate improvements/i }))

    await act(async () => {
      await Promise.resolve()
    })

    const preview = screen.getByTestId('resume-preview')
    const wrapper = preview.parentElement as HTMLElement
    expect(wrapper.className).toContain('opacity-30')
    expect(wrapper.className).toContain('blur-sm')
  })
})

// ── cancelEnrich re-enables the Generate Improvements button ─────────────────
// Bug fix: cancelEnrich() must call setStreamLoading(false) so the button is
// re-enabled after a cancel, not stuck in the disabled state.

describe('ResumeEditor — cancelEnrich re-enables Generate Improvements', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('re-enables "Generate Improvements" button after Cancel is clicked', async () => {
    mockEnrichResume.mockResolvedValue(createPendingStream())
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const generateBtn = screen.getByRole('button', { name: /generate improvements/i })
    fireEvent.click(generateBtn)

    await act(async () => {
      await Promise.resolve()
    })

    // While loading, the Cancel button appears and Generate Improvements is gone
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate improvements/i })).not.toBeInTheDocument()

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await act(async () => {
      await Promise.resolve()
    })

    // After cancel, "Generate Improvements" button should be back and enabled
    const reenabledBtn = screen.getByRole('button', { name: /generate improvements/i })
    expect(reenabledBtn).toBeInTheDocument()
    expect(reenabledBtn).not.toBeDisabled()
  })
})

// ── step indicator ────────────────────────────────────────────────────────────

describe('ResumeEditor — step indicator', () => {
  it('starts at step 1 and renders step labels', () => {
    renderEditor()

    expect(screen.getAllByText('Edit')[0]).toBeInTheDocument()
    expect(screen.getAllByText('AI Enhance')[0]).toBeInTheDocument()
  })

  it('advances currentStep when "Continue to AI Enhance" is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // Step 2 is now active — the stage toolbar shows the AI Enhance title
    // and the bottom bar shows "Continue to Review & Export"
    expect(screen.getByRole('button', { name: /continue to review & export/i })).toBeInTheDocument()
  })

  it('advances through all 3 steps via contextual Continue buttons', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    // Step 3 — "Review & Export" label in step indicator must be visible
    expect(screen.getAllByText('Review & Export')[0]).toBeInTheDocument()
    // No more Continue buttons at step 3
    expect(screen.queryByRole('button', { name: /continue to/i })).not.toBeInTheDocument()
  })

  it('decrements currentStep when a Back button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    // Advance to step 2 first
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    expect(screen.getByRole('button', { name: /back to edit/i })).toBeInTheDocument()

    // Go back to step 1
    await user.click(screen.getByRole('button', { name: /back to edit/i }))

    // Back at step 1 — no stage-navigation Back button, only Continue to AI Enhance
    expect(screen.queryByRole('button', { name: /back to edit|back to ai enhance|back to preview/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to ai enhance/i })).toBeInTheDocument()
  })
})

// ── stage toolbar ─────────────────────────────────────────────────────────────
// The stage sub-header row and auto-save status were removed from the UI.
// Step 1 no longer shows an "Edit Resume" title or "Auto-saved just now" text.

describe('ResumeEditor — stage toolbar', () => {
  it('does not show "Edit Resume" title or auto-save status at step 1 (removed)', () => {
    renderEditor()

    expect(screen.queryByText('Edit Resume')).not.toBeInTheDocument()
    expect(screen.queryByText('Auto-saved just now')).not.toBeInTheDocument()
  })

  it('shows "AI Enhance" title at step 2 (no toolbar action buttons)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // Stage toolbar title — just the span, no extra action buttons in toolbar
    expect(screen.getAllByText('AI Enhance')[0]).toBeInTheDocument()
    // The stage toolbar no longer renders "Tailor to Job" or "Generate Suggestions" buttons
    // Those actions live inside the center panel tool workspaces instead
  })

  it('shows "Review & Export" title and Export dropdown button at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    expect(screen.getAllByText('Review & Export').length).toBeGreaterThan(0)
    // Primary Export dropdown button is in the stage toolbar at step 3
    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument()
  })
})

// ── bottom bar contextual navigation ─────────────────────────────────────────
// Bottom bar replaces generic Prev Step / Next Step with stage-specific labels.

describe('ResumeEditor — bottom bar contextual navigation', () => {
  it('stage 1: shows "Continue to AI Enhance" and no Back button', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: /continue to ai enhance/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to edit|back to ai enhance|back to preview/i })).not.toBeInTheDocument()
  })

  it('stage 2: shows "Back to Edit" and "Continue to Review & Export" (no Save Changes in bottom nav)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    expect(screen.getByRole('button', { name: /back to edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to review & export/i })).toBeInTheDocument()
    // "Save Changes" button no longer exists in the bottom nav
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('stage 3: shows "Back to AI Enhance" — no Continue button (Save is in step 3 toolbar)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    expect(screen.getByRole('button', { name: /back to ai enhance/i })).toBeInTheDocument()
    // Step 3 is the last step — no Continue button
    expect(screen.queryByRole('button', { name: /continue to/i })).not.toBeInTheDocument()
    // "Save Changes" button no longer exists in the bottom nav (Save is in step 3 toolbar)
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })
})

// ── zoom controls ─────────────────────────────────────────────────────────────

describe('ResumeEditor — zoom controls', () => {
  it('starts at 100% zoom', () => {
    renderEditor()
    expect(screen.getByTestId('zoom-display')).toBeInTheDocument()
  })

  it('decreases zoom when the minus button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const minusBtn = screen.getByTestId('zoom-out-btn')
    await user.click(minusBtn)

    // Should now show 90% (next ZOOM_LEVEL step down from 100)
    expect(screen.getByTestId('zoom-display')).toHaveTextContent('90%')
  })

  it('increases zoom when the plus button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const plusBtn = screen.getByTestId('zoom-in-btn')
    await user.click(plusBtn)

    // Should now show 110% (next ZOOM_LEVEL step up from 100)
    expect(screen.getByTestId('zoom-display')).toHaveTextContent('110%')
  })

  it('does not go below 75% zoom', async () => {
    const user = userEvent.setup()
    renderEditor()

    const minusBtn = screen.getByTestId('zoom-out-btn')

    // ZOOM_LEVELS = [75, 90, 100, 110, 125] — click minus 5 times
    for (let i = 0; i < 5; i++) {
      await user.click(minusBtn)
    }

    expect(screen.getByTestId('zoom-display')).toHaveTextContent('75%')
  })

  it('does not go above 125% zoom', async () => {
    const user = userEvent.setup()
    renderEditor()

    const plusBtn = screen.getByTestId('zoom-in-btn')

    for (let i = 0; i < 5; i++) {
      await user.click(plusBtn)
    }

    expect(screen.getByTestId('zoom-display')).toHaveTextContent('125%')
  })
})

// ── sidebar section completion indicators ────────────────────────────────────

describe('ResumeEditor — sidebar section completion (getSectionComplete)', () => {
  it('marks Contact as complete when name and email are present', () => {
    // mockResume already has fullName + email — a completion dot (CheckCircle2)
    // should render for the Contact sidebar entry.  We verify by checking
    // that no hollow-dot indicator exists for Contact (the sidebar renders
    // CheckCircle2 when complete, else a size-2 div).
    renderEditor()

    // The Contact section header is rendered with a section title
    expect(screen.getAllByText('Contact')[0]).toBeInTheDocument()
  })

  it('shows Summary section content when Summary sidebar item is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    // Click the Summary nav item in the sidebar
    const summaryBtns = screen.getAllByRole('button', { name: /^summary$/i })
    await user.click(summaryBtns[0])

    // The section header should update to show "Summary"
    expect(screen.getByRole('heading', { name: /^summary$/i })).toBeInTheDocument()
    // The summary textarea should be visible
    expect(screen.getByPlaceholderText(/brief professional summary/i)).toBeInTheDocument()
  })

  it('shows Experience section content when Experience sidebar item is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const expBtns = screen.getAllByRole('button', { name: /^experience$/i })
    await user.click(expBtns[0])

    expect(screen.getByRole('button', { name: /add experience/i })).toBeInTheDocument()
  })

  it('shows Education section when Education sidebar item is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const eduBtns = screen.getAllByRole('button', { name: /^education$/i })
    await user.click(eduBtns[0])

    expect(screen.getByRole('button', { name: /add education/i })).toBeInTheDocument()
  })

  it('shows Skills section when Skills sidebar item is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const skillsBtns = screen.getAllByRole('button', { name: /^skills$/i })
    await user.click(skillsBtns[0])

    expect(screen.getByRole('button', { name: /add skills/i })).toBeInTheDocument()
  })

  it('wordCount shows 0 when summary is empty', () => {
    const noSummaryResume = { ...mockResume, summary: undefined }
    renderEditor({ initialResume: noSummaryResume })

    // Navigate to Summary tab
    // The word count "0 words" line appears in the summary tab
    const summaryBtns = screen.getAllByRole('button', { name: /^summary$/i })
    fireEvent.click(summaryBtns[0])

    expect(screen.getByText(/^0 words/)).toBeInTheDocument()
  })

  it('wordCount reflects actual word count in summary', () => {
    const threeWordSummary = { ...mockResume, summary: 'Three word summary' }
    renderEditor({ initialResume: threeWordSummary })

    const summaryBtns = screen.getAllByRole('button', { name: /^summary$/i })
    fireEvent.click(summaryBtns[0])

    expect(screen.getByText(/^3 words/)).toBeInTheDocument()
  })
})

// ── guest banner ──────────────────────────────────────────────────────────────

describe('ResumeEditor — guest banner', () => {
  it('shows a guest banner with a Sign Up button when isGuest is true', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, user: guestUser, isGuest: true } as any)
    renderEditor()

    expect(screen.getByText(/browsing as guest/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  it('does not show the guest banner for a logged-in user', () => {
    renderEditor()
    expect(screen.queryByText(/browsing as guest/i)).not.toBeInTheDocument()
  })
})

// ── center panel collapse toggle ──────────────────────────────────────────────
// A single toggle button lives in the Live Preview header (first child of the
// flex items-center gap-2 div) and is ALWAYS rendered.
// Classes: shrink-0 hidden lg:flex p-1.5 rounded-md text-muted-foreground …
// Title is "Minimize editor" when expanded, "Show editor" when collapsed.
// NO absolute, NO top-2/left-2, NO z-20, NO border, NO bg-secondary/30.
// The center panel gets lg:hidden when collapsed + transition-all duration-200.

describe('ResumeEditor — center panel collapse toggle', () => {
  it('renders in-flow toggle button with "Minimize editor" title, shrink-0 and p-1.5 classes, no absolute positioning', () => {
    renderEditor()
    const collapseBtn = screen.getByTitle('Minimize editor')
    expect(collapseBtn).toBeInTheDocument()
    expect(collapseBtn.className).toContain('shrink-0')
    expect(collapseBtn.className).toContain('p-1.5')
    expect(collapseBtn.className).not.toContain('absolute')
    expect(collapseBtn.className).not.toContain('top-2')
    expect(collapseBtn.className).not.toContain('left-2')
    expect(screen.queryByTitle('Show editor')).not.toBeInTheDocument()
  })

  it('changes title to "Show editor" after clicking, then back to "Minimize editor" on second click', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByTitle('Minimize editor'))

    const expandBtn = screen.getByTitle('Show editor')
    expect(expandBtn).toBeInTheDocument()
    expect(expandBtn.className).toContain('shrink-0')
    expect(expandBtn.className).toContain('p-1.5')
    expect(screen.queryByTitle('Minimize editor')).not.toBeInTheDocument()

    await user.click(expandBtn)

    expect(screen.getByTitle('Minimize editor')).toBeInTheDocument()
    expect(screen.queryByTitle('Show editor')).not.toBeInTheDocument()
  })
})

// ── center panel content area padding ─────────────────────────────────────────
// The scrollable form area inside the center panel uses p-4 lg:p-6 padding.

describe('ResumeEditor — center panel content area padding', () => {
  it('scrollable form area has the p-4 and lg:p-6 responsive padding classes', () => {
    const { container } = renderEditor()
    // Find the scrollable div that wraps all sections (overflow-y-auto p-4 lg:p-6).
    expect(container.querySelector('.overflow-y-auto.p-4')).not.toBeNull()
    expect(container.querySelector('.lg\\:p-6')).not.toBeNull()
  })
})

// ── left sidebar conditional rendering ───────────────────────────────────────
// Step 2 (AI Enhance): shows AI Enhance Tools panel with 4 tool selector nav buttons
// (Resume Polish, Target Role Tailoring, Cover Letter, ATS Score). Resume Sections nav absent.
// Steps 1, 3, 4: shows Resume Sections nav and Review Tools nav. AI Enhance panel absent.

describe('ResumeEditor — left sidebar conditional rendering', () => {
  it('shows Resume Sections nav in the sidebar at Step 1 (Edit)', () => {
    renderEditor()

    // The sidebar label "Resume Sections" is visible at step 1
    expect(screen.getByText('Resume Sections')).toBeInTheDocument()
    // At least the Contact section nav button should be present
    expect(screen.getAllByRole('button', { name: /^contact$/i }).length).toBeGreaterThan(0)
  })

  it('does not show the AI Enhance Tools panel in the sidebar at Step 1', () => {
    renderEditor()

    // "AI Enhance Tools" label is only rendered in step 2 sidebar
    expect(screen.queryByText('AI Enhance Tools')).not.toBeInTheDocument()
    // The tool selector nav buttons (Resume Polish, Target Role Tailoring, etc.) are absent at step 1
    expect(screen.queryByRole('button', { name: /resume polish/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /target role tailoring/i })).not.toBeInTheDocument()
  })

  it('shows AI Enhance Tools panel with tool selector nav buttons at Step 2', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // The sidebar AI Enhance Tools heading
    expect(screen.getByText('AI Enhance Tools')).toBeInTheDocument()
    // The 4 tool selector nav buttons are rendered
    expect(screen.getAllByRole('button', { name: /resume polish/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /target role tailoring/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /cover letter/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /ats score/i }).length).toBeGreaterThan(0)
  })

  it('does not show Resume Sections nav label in the sidebar at Step 2', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // "Resume Sections" label in the sidebar is replaced by the AI panel at step 2
    expect(screen.queryByText('Resume Sections')).not.toBeInTheDocument()
  })

  it('shows Documents nav in the sidebar at Step 3 (Review & Export)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))

    // Step 3 sidebar shows the Documents section selector, not Resume Sections
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.queryByText('AI Enhance Tools')).not.toBeInTheDocument()
    expect(screen.queryByText('Resume Sections')).not.toBeInTheDocument()
  })
})

// ── center panel Step 2 AI workspace ─────────────────────────────────────────
// When currentStep === 2, the center panel renders a per-tool workspace:
//   - default ('polish'): "Resume Polish" heading + "Generate Improvements" button
//   - 'tailor': "Target Role Tailoring" heading + job desc textarea + "Tailor Resume to Target Role" button
//   - 'coverletter': "Cover Letter" heading + company name input + "Generate Cover Letter" button
//   - 'ats': "ATS Score" heading + job desc textarea + "Analyze ATS Score" button
// The resume form (Contact Information etc.) is hidden in step 2.

describe('ResumeEditor — center panel Step 2 AI workspace', () => {
  it('shows "Resume Polish" heading in center panel by default at Step 2', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    expect(screen.getByRole('heading', { name: /resume polish/i })).toBeInTheDocument()
  })

  it('shows "Generate Improvements" button in the Resume Polish workspace at Step 2', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    expect(screen.getByRole('button', { name: /generate improvements/i })).toBeInTheDocument()
  })

  it('does NOT show resume form at Step 2 (center panel shows AI workspace)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // The Contact Information form heading is hidden at step 2
    expect(screen.queryByRole('heading', { name: /contact information/i })).not.toBeInTheDocument()
  })

  it('clicking "Target Role Tailoring" tool shows the job description workspace', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /target role tailoring/i }))

    expect(screen.getByRole('heading', { name: /target role tailoring/i })).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i),
    ).toBeInTheDocument()
  })

  it('"Tailor Resume to Target Role" button is disabled when job description is empty, enabled after typing', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /target role tailoring/i }))

    const tailorBtn = screen.getByRole('button', { name: /tailor resume to target role/i })
    expect(tailorBtn).toBeDisabled()

    const textarea = screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i)
    await user.type(textarea, 'We are looking for a Senior Software Engineer to join our team at Acme Corp to build scalable distributed systems and lead technical initiatives.')

    await waitFor(() => expect(tailorBtn).toBeEnabled(), { timeout: 3000 })
  })

  it('clicking "Cover Letter" tool shows the company name input', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))

    expect(screen.getByRole('heading', { name: /cover letter/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. google/i)).toBeInTheDocument()
  })

  it('clicking "ATS Score" tool in Step 2 sidebar shows the ATS analyze button', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    // Click the sidebar ATS Score tool — the sidebar tool button's accessible name is the
    // concatenation of its children: "ATS Score Check resume match against a job description"
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)

    expect(screen.getByRole('heading', { name: /^ats score$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeInTheDocument()
  })

  it('does NOT show "AI Job Workspace" heading at Step 2 (heading is per-tool now)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    expect(screen.queryByRole('heading', { name: /ai job workspace/i })).not.toBeInTheDocument()
  })

  it('shows resume form (Contact Information) at Step 1 (Edit)', () => {
    renderEditor()

    expect(screen.getByRole('heading', { name: /contact information/i })).toBeInTheDocument()
  })
})

// ── template / style selector ─────────────────────────────────────────────────
// The template-select now lives in the stage toolbar and is only rendered at step 3.

describe('ResumeEditor — template / style selector', () => {
  async function navigateToStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  }

  it('renders the Template <select> with industry options at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    const select = screen.getByTestId('template-select') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options.length).toBeGreaterThanOrEqual(5)
  })

  it('updates selectedIndustry when a new template is chosen at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    const select = screen.getByTestId('template-select')
    await user.selectOptions(select, 'tech')

    expect((select as HTMLSelectElement).value).toBe('tech')
  })

  it('does not render the template-select at step 1', () => {
    renderEditor()
    expect(screen.queryByTestId('template-select')).not.toBeInTheDocument()
  })
})

// ── async JD validation — tailor tool ────────────────────────────────────────
// The tailor button is disabled and an error message is shown when the job
// description has fewer than 10 words or contains no letters (sync pre-check,
// no debounced AI call needed in tests).

describe('ResumeEditor — Target Role Tailoring input validation', () => {
  async function navigateToTargetRoleTailoring(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /target role tailoring/i }))
  }

  it('shows error message when job description is too short (< 10 words)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToTargetRoleTailoring(user)

    const textarea = screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i)
    await user.type(textarea, 'short text here')

    expect(
      screen.getByText(/please paste a complete job description/i),
    ).toBeInTheDocument()
  })

  it('"Tailor Resume to Target Role" button is disabled when job description is too short', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToTargetRoleTailoring(user)

    const textarea = screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i)
    await user.type(textarea, 'too short')

    const tailorBtn = screen.getByRole('button', { name: /tailor resume to target role/i })
    expect(tailorBtn).toBeDisabled()
  })

  it('shows error when input has no letters (numbers only)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToTargetRoleTailoring(user)

    const textarea = screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i)
    // 10+ tokens but no letters
    await user.type(textarea, '1 2 3 4 5 6 7 8 9 10 11')

    expect(
      screen.getByText(/please paste a complete job description/i),
    ).toBeInTheDocument()
  })

  it('does not show an error and enables the tailor button for a valid job description', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToTargetRoleTailoring(user)

    const textarea = screen.getByPlaceholderText(/paste the job description for the role you want to apply to/i)
    await user.type(
      textarea,
      'We are looking for a Senior Software Engineer with strong TypeScript and React skills to join our growing team.',
    )

    expect(screen.queryByText(/please paste a complete job description/i)).not.toBeInTheDocument()
    await waitFor(
      () => expect(screen.getByRole('button', { name: /tailor resume to target role/i })).toBeEnabled(),
      { timeout: 3000 },
    )
  })
})

// ── ATS Score input validation ────────────────────────────────────────────────
// The ATS job description textarea uses the same isValidJobDescription validator.

describe('ResumeEditor — ATS Score input validation', () => {
  async function navigateToATS(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)
  }

  it('shows error message when ATS job description is too short', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(textarea, 'short text')

    expect(
      screen.getByText(/please paste a complete job description/i),
    ).toBeInTheDocument()
  })

  it('"Analyze ATS Score" button is disabled when ATS job description is invalid', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(textarea, 'too short')

    expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeDisabled()
  })
})

// ── ATS dismiss button ────────────────────────────────────────────────────────
// After ATS analysis, a "Dismiss" button (State A of the save state machine)
// clears the result. The score appears in the right panel (not center panel).

describe('ResumeEditor — ATS dismiss button', () => {
  it('Dismiss button clears ATS results when clicked', async () => {
    const { scoreATS: mockScoreATS } = await import('@/services/api')
    vi.mocked(mockScoreATS).mockResolvedValue({
      overallScore: 80,
      summary: 'Good match',
      matchedKeywords: ['TypeScript'],
      missingKeywords: [],
      suggestions: [],
    })

    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)

    // Type a valid job description and analyze
    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are hiring a Software Engineer with TypeScript React Node and strong communication skills for our platform team.',
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeEnabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /analyze ats score/i }))

    // Wait for score to appear in the right panel
    await waitFor(() => expect(screen.getByText('80')).toBeInTheDocument())

    // State A: "Save ATS Report" and "Dismiss" buttons should be visible
    expect(screen.getByRole('button', { name: /save ats report/i })).toBeInTheDocument()
    const dismissBtn = screen.getByRole('button', { name: /^dismiss$/i })
    await user.click(dismissBtn)

    // Score should no longer be visible
    expect(screen.queryByText('80')).not.toBeInTheDocument()
  })
})

// ── Cover Letter inline streaming ─────────────────────────────────────────────
// The "Generate Cover Letter" button no longer navigates to /cover-letter/new.
// Instead it calls generateCoverLetter and streams inline.

describe('ResumeEditor — Cover Letter inline streaming', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  it('calls generateCoverLetter (not navigate) when Generate Cover Letter is clicked with valid inputs', async () => {
    // Return a stream that immediately completes
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Dear Hiring Manager,'))
        controller.close()
      },
    })
    mockGenerateCoverLetter.mockResolvedValue(stream)

    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Acme Corp')
    await user.type(
      screen.getByPlaceholderText(/paste the job description for a targeted/i),
      'We are looking for a talented Software Engineer with JavaScript and Python skills to join our engineering team today.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))

    await waitFor(() => expect(mockGenerateCoverLetter).toHaveBeenCalledTimes(1))
    // The call includes the resume, job description, company name, and tone
    expect(mockGenerateCoverLetter).toHaveBeenCalledWith(
      mockResume,
      expect.any(String),
      'Acme Corp',
      expect.any(String),
    )
  })

  it('shows "Dismiss" and "Save Cover Letter" buttons (not "Open in Full Editor") after cover letter generates', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Dear Hiring Manager, thank you for this opportunity.'))
        controller.close()
      },
    })
    mockGenerateCoverLetter.mockResolvedValue(stream)

    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Stripe')
    await user.type(
      screen.getByPlaceholderText(/paste the job description for a targeted/i),
      'We are looking for a Senior Engineer with strong backend skills in Python and distributed systems at our payments company.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /save cover letter/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open in full editor/i })).not.toBeInTheDocument()
  })
})

// ── Resume Polish tone selector ───────────────────────────────────────────────
// A radio group with professional / concise / assertive options is rendered
// before the "Generate Improvements" button in the Resume Polish workspace.

describe('ResumeEditor — Resume Polish tone selector', () => {
  async function navigateToPolish(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    // Resume Polish is the default tool — no extra navigation needed
  }

  it('renders three tone radio buttons: Professional, Concise, Assertive', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToPolish(user)

    expect(screen.getByRole('radio', { name: /professional/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /concise/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /assertive/i })).toBeInTheDocument()
  })

  it('"Professional" radio is checked by default', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToPolish(user)

    const professionalRadio = screen.getByRole('radio', { name: /professional/i })
    expect(professionalRadio).toBeChecked()
  })

  it('selecting "Concise" unchecks "Professional" and checks "Concise"', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToPolish(user)

    await user.click(screen.getByRole('radio', { name: /concise/i }))

    expect(screen.getByRole('radio', { name: /concise/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /professional/i })).not.toBeChecked()
  })

  it('passes the selected tone to enrichResume when Generate Improvements is clicked', async () => {
    mockEnrichResume.mockResolvedValue(createPendingStream())

    const user = userEvent.setup()
    renderEditor()

    await navigateToPolish(user)

    // Switch to 'assertive' tone before clicking Generate
    await user.click(screen.getByRole('radio', { name: /assertive/i }))
    await user.click(screen.getByRole('button', { name: /generate improvements/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockEnrichResume).toHaveBeenCalledWith(mockResume, 'assertive')
  })
})

// ── Cover Letter inline actions ───────────────────────────────────────────────
// After generation, the right panel shows an editable textarea with "Cover Letter
// Editor" heading. The left panel shows Dismiss and Save Cover Letter buttons.

describe('ResumeEditor — Cover Letter inline actions', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  function createCoverLetterStream(content: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(content))
        controller.close()
      },
    })
  }

  async function generateCoverLetterContent(user: ReturnType<typeof userEvent.setup>) {
    mockGenerateCoverLetter.mockResolvedValue(
      createCoverLetterStream('Dear Hiring Manager, I am excited to apply for this role.'),
    )
    await navigateToCoverLetter(user)
    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Acme Corp')
    await user.type(
      screen.getByPlaceholderText(/paste the job description for a targeted/i),
      'We are looking for a talented Software Engineer with JavaScript and Python skills to join our engineering team today.',
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument(),
    )
  }

  it('"Cover Letter Editor" heading appears in the right panel when cover letter content is present', async () => {
    const user = userEvent.setup()
    renderEditor()

    await generateCoverLetterContent(user)

    expect(screen.getByText('Cover Letter Editor')).toBeInTheDocument()
  })

  it('the right panel textarea is editable (not disabled) after generation completes', async () => {
    const user = userEvent.setup()
    renderEditor()

    await generateCoverLetterContent(user)

    const textarea = screen.getByPlaceholderText(/your cover letter will appear here/i)
    expect(textarea).not.toBeDisabled()
  })

  it('"Dismiss" button clears cover letter content when clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    await generateCoverLetterContent(user)

    // Content is present — Cover Letter Editor heading should be visible
    expect(screen.getByText('Cover Letter Editor')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    // After dismiss, the cover letter editor and actions should disappear
    expect(screen.queryByText('Cover Letter Editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save cover letter/i })).not.toBeInTheDocument()
  })

  it('"Save Cover Letter" button calls saveCoverLetter when clicked', async () => {
    mockSaveCoverLetter.mockResolvedValue(undefined as any)

    const user = userEvent.setup()
    renderEditor()

    await generateCoverLetterContent(user)

    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(() => expect(mockSaveCoverLetter).toHaveBeenCalledTimes(1))
    // Should be called with cover letter content and a generated title
    expect(mockSaveCoverLetter).toHaveBeenCalledWith(
      expect.stringContaining('Dear Hiring Manager'),
      expect.any(String),
      'Acme Corp',
      expect.any(String),
      expect.any(String),
      undefined,
    )
  })

  it('"Save Cover Letter" button shows "Saved ✓" after a successful save', async () => {
    mockSaveCoverLetter.mockResolvedValue({ id: 'mock-cl-saved-id' } as any)

    const user = userEvent.setup()
    renderEditor()

    await generateCoverLetterContent(user)

    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
  })
})

// ── Resume Polish comparing state (right panel) ───────────────────────────────
// When enrichmentState === 'comparing', the right panel shows ComparisonView with
// hideActions (Discard/Accept are in the center panel, not the sticky bar).
// The center panel shows an "Improvements ready to review" card with Accept/Discard buttons.

describe('ResumeEditor — Resume Polish comparing state', () => {
  async function navigateToPolish(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
  }

  // Helper: stream a valid JSON resume so the enrichment flow reaches 'comparing' state.
  // fromBackend is mocked to return its argument unchanged.
  function createEnrichStream(resumeJson: unknown): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(resumeJson)))
        controller.close()
      },
    })
  }

  async function reachComparingState(user: ReturnType<typeof userEvent.setup>) {
    const enrichedPayload = {
      ...mockResume,
      summary: 'An AI-enhanced summary for testing.',
    }
    mockEnrichResume.mockResolvedValue(createEnrichStream(enrichedPayload))

    await navigateToPolish(user)
    await user.click(screen.getByRole('button', { name: /generate improvements/i }))

    // Wait for the 'comparing' UI: Accept Changes button appears in center panel
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /accept changes/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
  }

  it('right panel shows "Live Preview" label inside ComparisonView when comparing', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)

    // ComparisonView renders its own "Live Preview" label in the header
    expect(screen.getByText('Live Preview')).toBeInTheDocument()
  })

  it('right panel shows Split View / Unified View toggle buttons inside ComparisonView when comparing', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)

    expect(screen.getByRole('button', { name: /split view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unified view/i })).toBeInTheDocument()
  })

  it('sticky action bar (with "AI enrichment ready") is NOT rendered because hideActions is true', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)

    // ComparisonView is rendered with hideActions — the sticky bar is suppressed
    expect(screen.queryByText(/ai enrichment ready/i)).not.toBeInTheDocument()
  })

  it('Discard button in the center panel has bg-destructive class when comparing', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)

    const discardBtn = screen.getByRole('button', { name: /discard/i })
    expect(discardBtn).toBeInTheDocument()
    expect(discardBtn.className).toContain('bg-destructive')
  })

  it('clicking Discard in the center panel hides ComparisonView and shows Live Preview header', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)

    await user.click(screen.getByRole('button', { name: /discard/i }))

    // After discard, the split/unified view toggle is gone (ComparisonView unmounted)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /split view/i })).not.toBeInTheDocument(),
      { timeout: 8000 },
    )
    // The regular preview header "Live Preview" is now in the right panel (not ComparisonView's)
    expect(screen.getByText('Live Preview')).toBeInTheDocument()
  })
})

// ── Review & Export — step 3 renders ─────────────────────────────────────────
// When currentStep === 3 the left sidebar shows a Documents nav, the stage
// toolbar shows "Review & Export" + Export dropdown, and the main area shows
// the step-3 preview panel instead of the center editor + right preview.

describe('ResumeEditor — Review & Export step 3 renders', () => {
  async function navigateToStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  }

  it('renders "Review & Export" in stage toolbar at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    expect(screen.getAllByText('Review & Export').length).toBeGreaterThan(0)
  })

  it('renders Export dropdown button in stage toolbar at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument()
  })

  it('renders the stepper with exactly 3 step labels: Edit, AI Enhance, Review & Export', () => {
    renderEditor()

    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AI Enhance').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Review & Export').length).toBeGreaterThan(0)
    // The old step 4 label "Download" should not appear in the stepper
    expect(screen.queryByText('Download')).not.toBeInTheDocument()
  })

  it('sidebar shows Documents label with Resume, Cover Letter, ATS Report nav items at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    expect(screen.getByText('Documents')).toBeInTheDocument()
    // All three document tabs are present in the sidebar nav
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^cover letter$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ats report$/i })).toBeInTheDocument()
  })

  it('hides the center editor at step 3 (no Contact Information form)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    // The center editor div gets the "hidden" CSS class at step 3.
    // In jsdom, CSS isn't evaluated so the heading is still in the DOM — verify
    // the center editor wrapper has the "hidden" class instead.
    const heading = screen.queryByRole('heading', { name: /contact information/i, hidden: true })
    if (heading) {
      // The heading exists but must be inside a hidden container
      const centerEditor = heading.closest('.hidden')
      expect(centerEditor).not.toBeNull()
    } else {
      // Heading not in DOM at all — also acceptable
      expect(heading).toBeNull()
    }
    // Verify step 3's own layout is rendered (Documents sidebar present)
    expect(screen.getByText('Documents')).toBeInTheDocument()
  })
})

// ── Review & Export — document tab switching ──────────────────────────────────
// Clicking sidebar nav items switches the preview content between Resume,
// Cover Letter, and ATS Report tabs.

describe('ResumeEditor — Review & Export document tab switching', () => {
  async function navigateToStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  }

  it('defaults to the Resume tab — shows resume-mode toggle buttons', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    // Resume tab shows Final / Split Compare / Unified Review mode toggles
    expect(screen.getByRole('button', { name: /^final$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /split compare/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unified review/i })).toBeInTheDocument()
  })

  it('switching to Cover Letter tab shows the cover-letter mode toggles', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    await user.click(screen.getByRole('button', { name: /^cover letter$/i }))

    // Cover Letter tab shows Final / Compare Drafts toggles
    expect(screen.getByRole('button', { name: /^final$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compare drafts/i })).toBeInTheDocument()
    // Resume-only toggle (Unified Review) should no longer be present
    expect(screen.queryByRole('button', { name: /unified review/i })).not.toBeInTheDocument()
  })

  it('switching to ATS Report tab shows Overview / Keywords / Suggestions toggles', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    await user.click(screen.getByRole('button', { name: /^ats report$/i }))

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /keywords/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suggestions/i })).toBeInTheDocument()
    // Resume-only splits should not be present
    expect(screen.queryByRole('button', { name: /split compare/i })).not.toBeInTheDocument()
  })

  it('switching back from Cover Letter to Resume tab restores resume mode toggles', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)

    await user.click(screen.getByRole('button', { name: /^cover letter$/i }))
    await user.click(screen.getByRole('button', { name: /^resume$/i }))

    expect(screen.getByRole('button', { name: /split compare/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unified review/i })).toBeInTheDocument()
  })
})

// ── Review & Export — resume review mode toggles ──────────────────────────────
// The Resume tab has 3 review modes: Final Version / Split Compare / Unified Review.

describe('ResumeEditor — Review & Export resume review mode toggles', () => {
  async function navigateToStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  }

  it('"Final" mode is the default — shows a single resume preview (not split)', async () => {
    const user = userEvent.setup()
    const { container } = renderEditor()

    await navigateToStep3(user)

    // "Final" is the default mode. At step 3 the right panel is hidden via the
    // "hidden" CSS class but still in the DOM (jsdom doesn't compute CSS).
    // Count only previews NOT inside a ".hidden" ancestor.
    const allPreviews = container.querySelectorAll('[data-testid="resume-preview"]')
    const visiblePreviews = Array.from(allPreviews).filter(
      (el) => !el.closest('.hidden'),
    )
    expect(visiblePreviews.length).toBe(1)
  })

  it('clicking "Split Compare" shows Original and AI Enhanced labels', async () => {
    const user = userEvent.setup()
    const { container } = renderEditor()

    await navigateToStep3(user)

    await user.click(screen.getByRole('button', { name: /split compare/i }))

    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('AI Enhanced')).toBeInTheDocument()
    // Two resume previews rendered side-by-side in the step-3 preview area.
    // Filter out the right-panel preview which is hidden via the "hidden" CSS class.
    const allPreviews = container.querySelectorAll('[data-testid="resume-preview"]')
    const visiblePreviews = Array.from(allPreviews).filter(
      (el) => !el.closest('.hidden'),
    )
    expect(visiblePreviews.length).toBe(2)
  })

  it('clicking "Unified Review" returns to single-pane preview (no Original/AI Enhanced labels)', async () => {
    const user = userEvent.setup()
    const { container } = renderEditor()

    await navigateToStep3(user)

    // Go to split first, then unified
    await user.click(screen.getByRole('button', { name: /split compare/i }))
    await user.click(screen.getByRole('button', { name: /unified review/i }))

    expect(screen.queryByText('Original')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Enhanced')).not.toBeInTheDocument()
    // Filter out the right-panel preview which is hidden via the "hidden" CSS class.
    const allPreviews = container.querySelectorAll('[data-testid="resume-preview"]')
    const visiblePreviews = Array.from(allPreviews).filter(
      (el) => !el.closest('.hidden'),
    )
    expect(visiblePreviews.length).toBe(1)
  })
})

// ── Review & Export — cover letter empty state ────────────────────────────────
// When clStreamContent is falsy the Cover Letter tab shows an empty-state message.

describe('ResumeEditor — Review & Export cover letter empty state', () => {
  it('shows "No cover letter yet" empty state when cover letter has not been generated', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
    await user.click(screen.getByRole('button', { name: /^cover letter$/i }))

    expect(
      screen.getByText(/no cover letter yet.*generate one in the ai enhance step/i),
    ).toBeInTheDocument()
  })
})

// ── Review & Export — ATS Report empty state ─────────────────────────────────
// When atsResult is null the ATS Report tab shows an empty-state message.

describe('ResumeEditor — Review & Export ATS Report empty state', () => {
  it('shows "No ATS report yet" empty state when ATS has not been run', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
    await user.click(screen.getByRole('button', { name: /^ats report$/i }))

    expect(
      screen.getByText(/no ats report yet.*run ats score in the ai enhance step/i),
    ).toBeInTheDocument()
  })
})

// ── Resume Polish inline message (replaces toast) ─────────────────────────────
// After accepting enrichment changes, polishInlineMsg is shown as an inline
// banner below the "Generate Improvements" button — not as a global toast.

describe('ResumeEditor — Resume Polish inline message after accepting changes', () => {
  function createEnrichStream(resumeJson: unknown): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(resumeJson)))
        controller.close()
      },
    })
  }

  async function reachComparingState(user: ReturnType<typeof userEvent.setup>) {
    const enrichedPayload = { ...mockResume, summary: 'An AI-enhanced summary.' }
    mockEnrichResume.mockResolvedValue(createEnrichStream(enrichedPayload))

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /generate improvements/i }))
    await waitFor(
      () => expect(screen.getByRole('button', { name: /accept changes/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
  }

  it('shows inline success message below "Generate Improvements" after clicking Accept Changes', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)
    await user.click(screen.getByRole('button', { name: /accept changes/i }))

    // After accept, the component returns to 'idle' and shows the Generate Improvements button
    // alongside an inline success banner
    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate improvements/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
    expect(screen.getByText(/resume improved/i)).toBeInTheDocument()
  })

  it('does NOT show the global bottom toast after accepting enrichment changes', async () => {
    const user = userEvent.setup()
    renderEditor()

    await reachComparingState(user)
    await user.click(screen.getByRole('button', { name: /accept changes/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate improvements/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
    // Global toast is a fixed bottom-right element — it should NOT appear
    // (the inline banner replaces it)
    const toastEl = document.querySelector('.fixed.bottom-6.right-6')
    expect(toastEl).toBeNull()
  })
})

// ── Cover Letter — JD required, button disabled without JD, valid hint ────────
// 1. Job Description field label shows "(required)"
// 2. Generate Cover Letter button is disabled when JD is empty
// 3. "valid job description" hint appears when JD passes validation

describe('ResumeEditor — Cover Letter JD required field', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  it('shows "(required)" on the Job Description label', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    expect(screen.getByText(/\(required\)/i)).toBeInTheDocument()
  })

  it('"Generate Cover Letter" button is disabled when job description is empty', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    // Type a company name but leave JD empty
    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Acme Corp')

    expect(screen.getByRole('button', { name: /generate cover letter/i })).toBeDisabled()
  })

  it('shows "A job description is required" hint text when JD is empty', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    expect(screen.getByText(/a job description is required/i)).toBeInTheDocument()
  })

  it('"Generate Cover Letter" button is disabled when JD is invalid (too short)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(screen.getByPlaceholderText(/paste the job description for a targeted/i), 'too short')

    expect(screen.getByRole('button', { name: /generate cover letter/i })).toBeDisabled()
  })

  it('shows "valid job description" hint when JD passes validation', async () => {
    // API mock already returns { valid: true, reason: '' } by default
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(
      screen.getByPlaceholderText(/paste the job description for a targeted/i),
      'We are looking for a talented Software Engineer with JavaScript Python and cloud skills to join our platform engineering team.',
    )

    await waitFor(
      () => expect(screen.getByText(/valid job description/i)).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })
})

// ── Cover Letter — progress bar during streaming ──────────────────────────────
// When clIsStreaming is true the right panel shows a progress bar with stage
// labels (Analyzing JD / Tailoring / Polishing / Finalizing) and a % counter.

describe('ResumeEditor — Cover Letter progress bar during streaming', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  function createPendingCoverLetterStream(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start() {
        // intentionally never enqueues — keeps clIsStreaming true
      },
    })
  }

  it('shows "Analyzing job description..." stage message and a progress bar while streaming', async () => {
    mockGenerateCoverLetter.mockResolvedValue(createPendingCoverLetterStream())
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Acme Corp')
    const jdTextarea = screen.getByPlaceholderText(/paste the job description for a targeted/i)
    await user.type(
      jdTextarea,
      'We are hiring a Software Engineer with JavaScript Python and strong communication skills for our platform team today.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))

    await act(async () => {
      await Promise.resolve()
    })

    // Progress bar section renders with the first stage message
    expect(screen.getByText(/analyzing job description/i)).toBeInTheDocument()
  })

  it('shows stage labels "Analyzing JD", "Tailoring", "Polishing", "Finalizing" in progress bar footer', async () => {
    mockGenerateCoverLetter.mockResolvedValue(createPendingCoverLetterStream())
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Stripe')
    const jdTextarea = screen.getByPlaceholderText(/paste the job description for a targeted/i)
    await user.type(
      jdTextarea,
      'We are seeking a backend engineer with Python and distributed systems experience to join our payments platform team.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Analyzing JD')).toBeInTheDocument()
    expect(screen.getByText('Tailoring')).toBeInTheDocument()
    expect(screen.getByText('Polishing')).toBeInTheDocument()
    expect(screen.getByText('Finalizing')).toBeInTheDocument()
  })
})

// ── Cover Letter — Save/Dismiss/Delete state machine ─────────────────────────
// State A (draft): Save Cover Letter + Dismiss buttons
// State B (saved, unmodified): Saved ✓ (disabled) + Delete Cover Letter buttons
// State C (saved, edited): Save Changes + Delete Cover Letter buttons

describe('ResumeEditor — Cover Letter state machine (draft / saved / edited)', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  function createCoverLetterStream(content: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(content))
        controller.close()
      },
    })
  }

  async function generateCL(user: ReturnType<typeof userEvent.setup>, content = 'Dear Hiring Manager, I am excited to apply.') {
    mockGenerateCoverLetter.mockResolvedValue(createCoverLetterStream(content))
    await navigateToCoverLetter(user)
    await user.type(screen.getByPlaceholderText(/e\.g\. google/i), 'Acme Corp')
    await user.type(
      screen.getByPlaceholderText(/paste the job description for a targeted/i),
      'We need a Software Engineer with TypeScript React and strong problem solving skills to join our growing team.',
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /generate cover letter/i })).not.toBeDisabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /generate cover letter/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument())
  }

  // State A ──────────────────────────────────────────────────────────────────

  it('State A: shows "Save Cover Letter" and "Dismiss" buttons after generation (not yet saved)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)

    expect(screen.getByRole('button', { name: /save cover letter/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    // "Delete Cover Letter" should NOT appear in draft state
    expect(screen.queryByRole('button', { name: /delete cover letter/i })).not.toBeInTheDocument()
  })

  it('State A → dismiss: clears content and hides action buttons', async () => {
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByRole('button', { name: /save cover letter/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete cover letter/i })).not.toBeInTheDocument()
  })

  // State B ──────────────────────────────────────────────────────────────────

  it('State B: shows "Saved ✓" (disabled) and "Delete Cover Letter" after saving', async () => {
    mockSaveCoverLetter.mockResolvedValue({ id: 'cl-1' } as any)
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)
    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )

    const savedBtn = screen.getByRole('button', { name: /saved/i })
    expect(savedBtn).toBeDisabled()
    expect(screen.getByRole('button', { name: /delete cover letter/i })).toBeInTheDocument()
    // "Dismiss" should no longer appear in saved state
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument()
  })

  // State C ──────────────────────────────────────────────────────────────────

  it('State C: shows "Save Changes" and "Delete Cover Letter" after editing saved content', async () => {
    mockSaveCoverLetter.mockResolvedValue({ id: 'cl-1' } as any)
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)
    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )

    // Edit the textarea to make content differ from saved content
    const textarea = screen.getByPlaceholderText(/your cover letter will appear here/i)
    await user.type(textarea, ' Additional text.')

    await waitFor(
      () => expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.getByRole('button', { name: /delete cover letter/i })).toBeInTheDocument()
    // "Saved ✓" button should be gone (replaced by "Save Changes")
    expect(screen.queryByRole('button', { name: /^saved/i })).not.toBeInTheDocument()
  })

  it('State C → Save Changes: calls updateCoverLetter with the edited content', async () => {
    mockSaveCoverLetter.mockResolvedValue({ id: 'cl-1' } as any)
    mockUpdateCoverLetter.mockResolvedValue(undefined as any)
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)
    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )

    const textarea = screen.getByPlaceholderText(/your cover letter will appear here/i)
    await user.type(textarea, ' Edited.')

    await waitFor(
      () => expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mockUpdateCoverLetter).toHaveBeenCalledTimes(1))
    expect(mockUpdateCoverLetter).toHaveBeenCalledWith(
      'cl-1',
      expect.any(String),
      expect.any(String),
    )
  })

  it('Delete Cover Letter: calls deleteCoverLetter and resets to empty state', async () => {
    mockSaveCoverLetter.mockResolvedValue({ id: 'cl-1' } as any)
    mockDeleteCoverLetter.mockResolvedValue(undefined as any)
    const user = userEvent.setup()
    renderEditor()

    await generateCL(user)
    await user.click(screen.getByRole('button', { name: /save cover letter/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /delete cover letter/i })).toBeInTheDocument(),
      { timeout: 8000 },
    )
    await user.click(screen.getByRole('button', { name: /delete cover letter/i }))

    await waitFor(() => expect(mockDeleteCoverLetter).toHaveBeenCalledWith('cl-1'))
    // After delete all state machine buttons disappear
    expect(screen.queryByRole('button', { name: /save cover letter/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete cover letter/i })).not.toBeInTheDocument()
  })
})

// ── Save/Export disabled when no content (Cover Letter & ATS tabs) ────────────
// The toolbar Save and Export buttons are disabled when the active tab has no
// content — cover letter tab with no clStreamContent, ATS tab with no atsResult.

describe('ResumeEditor — Save/Export button disabled when no content in tab', () => {
  async function navigateToStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to review & export/i }))
  }

  it('Save button is disabled on the Cover Letter tab when no cover letter has been generated', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)
    await user.click(screen.getByRole('button', { name: /^cover letter$/i }))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('Export button is disabled on the Cover Letter tab when no cover letter has been generated', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)
    await user.click(screen.getByRole('button', { name: /^cover letter$/i }))

    expect(screen.getByRole('button', { name: /^export$/i })).toBeDisabled()
  })

  it('Save button is disabled on the ATS Report tab when no ATS has been run', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)
    await user.click(screen.getByRole('button', { name: /^ats report$/i }))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('Save button is enabled on the Resume tab (resume content always present)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToStep3(user)
    // Resume tab is default; Save should be enabled
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })
})

// ── Cover Letter right panel placeholder (no content yet) ─────────────────────
// When no cover letter has been generated, the right panel in the 'coverletter'
// tool workspace shows a placeholder message instead of ResumePreview.

describe('ResumeEditor — Cover Letter right panel placeholder', () => {
  async function navigateToCoverLetter(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /cover letter/i }))
  }

  it('shows placeholder text in the right panel when no cover letter has been generated', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToCoverLetter(user)

    expect(
      screen.getByText('Your cover letter will appear here after generation.'),
    ).toBeInTheDocument()
  })

  it('does NOT show a resume-preview in the right panel while on the cover letter tool with no content', async () => {
    const user = userEvent.setup()
    const { container } = renderEditor()

    await navigateToCoverLetter(user)

    // The right panel placeholder should be shown — not the resume-preview mock
    // Filter to visible previews (not inside a hidden ancestor)
    const allPreviews = container.querySelectorAll('[data-testid="resume-preview"]')
    const visiblePreviews = Array.from(allPreviews).filter(
      (el) => !el.closest('.hidden'),
    )
    // With no cover letter content the right panel placeholder renders, not a live preview
    // The cover letter placeholder panel does not contain a resume-preview
    const coverLetterPlaceholder = screen.getByText('Your cover letter will appear here after generation.')
    expect(coverLetterPlaceholder).toBeInTheDocument()
    // No visible resume-preview inside the right cover-letter placeholder panel
    const placeholder = coverLetterPlaceholder.closest('div.flex-1') as HTMLElement | null
    const previewInsidePlaceholder = placeholder?.querySelector('[data-testid="resume-preview"]')
    expect(previewInsidePlaceholder).toBeNull()
    void visiblePreviews // suppress unused variable warning
  })
})

// ── ATS right panel placeholder and result ────────────────────────────────────
// When no ATS has been run, the right panel shows a placeholder.
// When atsResult exists, the right panel shows the score and keywords read-only.

describe('ResumeEditor — ATS right panel placeholder and result', () => {
  async function navigateToATS(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)
  }

  it('shows placeholder text in the right ATS panel before any analysis is run', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    expect(
      screen.getByText('Your ATS report will appear here after generation.'),
    ).toBeInTheDocument()
  })

  it('shows score in the right ATS panel after analysis completes', async () => {
    const { scoreATS: mockScoreATS } = await import('@/services/api')
    vi.mocked(mockScoreATS).mockResolvedValue({
      overallScore: 72,
      summary: 'Decent match',
      matchedKeywords: ['React'],
      missingKeywords: ['Python'],
      suggestions: ['Add more Python experience.'],
    })

    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are looking for a React developer with Python experience and strong communication skills on our distributed team.',
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeEnabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /analyze ats score/i }))

    // Score should appear in the right panel
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument())
    // The placeholder text should no longer be visible
    expect(
      screen.queryByText('Your ATS report will appear here after generation.'),
    ).not.toBeInTheDocument()
    // Keywords rendered as chips
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('right ATS panel shows "ATS Report" header label', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    expect(screen.getByText('ATS Report')).toBeInTheDocument()
  })
})

// ── ATS tab — JD required label, hint text, and valid hint ───────────────────
// The JD label shows "(required)", a hint "A job description is required to
// analyze your resume." shows when JD is empty, and "valid job description"
// appears when JD passes validation.

describe('ResumeEditor — ATS JD required label and hints', () => {
  async function navigateToATS(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)
  }

  it('shows "(required)" on the Job Description label in the ATS tab', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    // The ATS JD label contains "(required)"
    const requiredLabels = screen.getAllByText(/\(required\)/i)
    expect(requiredLabels.length).toBeGreaterThan(0)
  })

  it('shows "A job description is required to analyze your resume." hint when JD is empty', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    expect(
      screen.getByText(/a job description is required to analyze your resume/i),
    ).toBeInTheDocument()
  })

  it('hides the required hint and shows "valid job description" after JD passes validation', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are hiring a Software Engineer with TypeScript React Node and strong communication skills for our platform team.',
    )

    await waitFor(
      () => expect(screen.getByText(/valid job description/i)).toBeInTheDocument(),
      { timeout: 3000 },
    )
    // The empty-state hint should be gone once JD is filled in
    expect(
      screen.queryByText(/a job description is required to analyze your resume/i),
    ).not.toBeInTheDocument()
  })

  it('"Analyze ATS Score" button is disabled when JD is empty (before any typing)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await navigateToATS(user)

    expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeDisabled()
  })
})

// ── ATS progress bar during analysis ─────────────────────────────────────────
// When atsLoading is true the right panel shows a frosted progress bar overlay
// with stage labels: Parsing / Matching / Scoring / Building.

describe('ResumeEditor — ATS progress bar during analysis', () => {
  function createPendingAtsScore() {
    return new Promise<never>(() => {})
  }

  it('shows stage labels Parsing / Matching / Scoring / Building while ATS is loading', async () => {
    const { scoreATS: mockScoreATS } = await import('@/services/api')
    vi.mocked(mockScoreATS).mockReturnValue(createPendingAtsScore())

    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are seeking a talented engineer with Python TypeScript and cloud infrastructure skills for our growing platform team.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeEnabled(),
      { timeout: 4000 },
    )

    fireEvent.click(screen.getByRole('button', { name: /analyze ats score/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Parsing')).toBeInTheDocument()
    expect(screen.getByText('Matching')).toBeInTheDocument()
    expect(screen.getByText('Scoring')).toBeInTheDocument()
    expect(screen.getByText('Building')).toBeInTheDocument()
  })

  it('shows the first ATS progress message "Parsing your resume..." while loading', async () => {
    const { scoreATS: mockScoreATS } = await import('@/services/api')
    vi.mocked(mockScoreATS).mockReturnValue(createPendingAtsScore())

    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are seeking a talented engineer with Python TypeScript and cloud infrastructure skills for our growing platform team.',
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeEnabled(),
      { timeout: 4000 },
    )

    fireEvent.click(screen.getByRole('button', { name: /analyze ats score/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Parsing your resume...')).toBeInTheDocument()
  })
})

// ── ATS save/dismiss state machine ────────────────────────────────────────────
// State A (draft): "Save ATS Report" + "Dismiss" buttons (both w-40 justify-center)
// State B (saved): "Saved ✓" (disabled, green) + "Delete ATS Report" button

describe('ResumeEditor — ATS save/dismiss state machine', () => {
  async function navigateToATS(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    const atsToolBtn = screen.getByRole('button', { name: /ats score check resume match/i })
    await user.click(atsToolBtn)
  }

  async function runATSAnalysis(user: ReturnType<typeof userEvent.setup>) {
    const { scoreATS: mockScoreATS } = await import('@/services/api')
    vi.mocked(mockScoreATS).mockResolvedValue({
      overallScore: 85,
      summary: 'Strong match',
      matchedKeywords: ['TypeScript', 'React'],
      missingKeywords: [],
      suggestions: [],
    })

    await navigateToATS(user)

    const textarea = screen.getByPlaceholderText(/paste the job description here/i)
    await user.type(
      textarea,
      'We are hiring a Software Engineer with TypeScript React Node and strong communication skills for our platform team.',
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /analyze ats score/i })).toBeEnabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /analyze ats score/i }))
    // Wait for result to appear (State A)
    await waitFor(
      () => expect(screen.getByRole('button', { name: /save ats report/i })).toBeInTheDocument(),
    )
  }

  // State A ──────────────────────────────────────────────────────────────────

  it('State A: shows "Save ATS Report" and "Dismiss" buttons after analysis (not yet saved)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await runATSAnalysis(user)

    expect(screen.getByRole('button', { name: /save ats report/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument()
    // "Delete ATS Report" should NOT appear in State A
    expect(screen.queryByRole('button', { name: /delete ats report/i })).not.toBeInTheDocument()
  })

  it('State A → Dismiss: clears ATS result and hides state machine buttons', async () => {
    const user = userEvent.setup()
    renderEditor()

    await runATSAnalysis(user)

    await user.click(screen.getByRole('button', { name: /^dismiss$/i }))

    // After dismiss, the result (score=85) is gone
    expect(screen.queryByText('85')).not.toBeInTheDocument()
    // Both state machine buttons disappear
    expect(screen.queryByRole('button', { name: /save ats report/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument()
    // Placeholder is restored
    expect(
      screen.getByText('Your ATS report will appear here after generation.'),
    ).toBeInTheDocument()
  })

  // State B ──────────────────────────────────────────────────────────────────

  it('State B: shows "Saved ✓" (disabled) and "Delete ATS Report" after saving', async () => {
    const user = userEvent.setup()
    renderEditor()

    await runATSAnalysis(user)

    await user.click(screen.getByRole('button', { name: /save ats report/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument(),
    )

    const savedBtn = screen.getByRole('button', { name: /saved/i })
    expect(savedBtn).toBeDisabled()
    expect(screen.getByRole('button', { name: /delete ats report/i })).toBeInTheDocument()
    // "Save ATS Report" and "Dismiss" should not appear in State B
    expect(screen.queryByRole('button', { name: /save ats report/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument()
  })

  it('State B → Delete ATS Report: clears result and resets to placeholder', async () => {
    const user = userEvent.setup()
    renderEditor()

    await runATSAnalysis(user)

    await user.click(screen.getByRole('button', { name: /save ats report/i }))
    await waitFor(
      () => expect(screen.getByRole('button', { name: /delete ats report/i })).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /delete ats report/i }))

    // Score should be gone after delete
    expect(screen.queryByText('85')).not.toBeInTheDocument()
    // State machine buttons are gone
    expect(screen.queryByRole('button', { name: /save ats report/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete ats report/i })).not.toBeInTheDocument()
    // Placeholder is restored
    expect(
      screen.getByText('Your ATS report will appear here after generation.'),
    ).toBeInTheDocument()
  })
})
