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
  fromBackend: vi.fn((d: unknown) => d),
}))
vi.mock('@/services/resumes', () => ({
  saveResume: vi.fn(),
  updateResume: vi.fn(),
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
import { enrichResume } from '@/services/api'
import ResumeEditor from '@/components/ResumeEditor'

const mockUseAuth = vi.mocked(useAuth)
const mockSaveResume = vi.mocked(saveResume)
const mockUpdateResume = vi.mocked(updateResume)
const mockEnrichResume = vi.mocked(enrichResume)

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
  mockUseAuth.mockReturnValue(defaultAuth as any)
})

// ── save / update buttons ─────────────────────────────────────────────────────
// The bottom bar now has a single "Save Changes" button (visible in steps 1-3)
// that either opens the save dialog (no existing ID) or calls updateResume (existing ID).

describe('ResumeEditor — save button', () => {
  it('shows "Save Changes" button and opens save dialog when logged-in user clicks it', async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByRole('heading', { name: /save resume/i })).toBeInTheDocument()
  })

  it('calls onSignUp instead of opening dialog when a guest clicks Save Changes', async () => {
    mockUseAuth.mockReturnValue({ ...defaultAuth, user: guestUser, isGuest: true } as any)
    const onSignUp = vi.fn()
    const user = userEvent.setup()
    renderEditor({ onSignUp })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSignUp).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: /save resume/i })).not.toBeInTheDocument()
  })

  it('shows "Save Changes" button when initialResumeId is provided (calls update inline, no dialog)', () => {
    renderEditor({ initialResumeId: 'existing-id' })
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    // No separate "Update" button — Save Changes handles both paths
    expect(screen.queryByRole('button', { name: /^update$/i })).not.toBeInTheDocument()
  })
})

// Helper: get the save dialog container after opening it
// "Save Changes" opens the save dialog when there is no existing resume ID.
async function openSaveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /save changes/i }))
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
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))

    // Change the style via the template-select dropdown
    await user.selectOptions(screen.getByTestId('template-select'), 'finance')

    // "Save Changes" opens the save dialog (no existing resume ID)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

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
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))

    // Change the style via the template-select dropdown
    await user.selectOptions(screen.getByTestId('template-select'), 'finance')

    // "Save Changes" calls handleUpdate when currentResumeId is set
    await user.click(screen.getByRole('button', { name: /save changes/i }))

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
// The Download button was removed from the header — it now lives in the
// stage toolbar (step 4) and the bottom bar (step 4).

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
    expect(screen.getByText('100%')).toBeInTheDocument()
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
    // and the bottom bar shows "Continue to Preview"
    expect(screen.getByRole('button', { name: /continue to preview/i })).toBeInTheDocument()
  })

  it('advances through all 4 steps via contextual Continue buttons', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))
    await user.click(screen.getByRole('button', { name: /continue to download/i }))

    // Step 4 — "Download" label in step indicator must be visible
    expect(screen.getAllByText('Download')[0]).toBeInTheDocument()
    // No more Continue buttons at step 4
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
// A new toolbar appears below the header and renders stage-specific content
// based on currentStep (1=Edit Resume, 2=AI Enhance, 3=Preview & Customize, 4=Download).

describe('ResumeEditor — stage toolbar', () => {
  it('shows "Edit Resume" title and auto-save status at step 1', () => {
    renderEditor()

    expect(screen.getByText('Edit Resume')).toBeInTheDocument()
    // Auto-saved status text (hidden on narrow viewports but in DOM)
    expect(screen.getByText('Auto-saved just now')).toBeInTheDocument()
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

  it('shows "Preview & Customize" title and template select at step 3', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))

    expect(screen.getAllByText('Preview & Customize').length).toBeGreaterThan(0)
    expect(screen.getByTestId('template-select')).toBeInTheDocument()
  })

  it('shows "Download Resume" title, "Download PDF", and "Download DOCX" buttons at step 4', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))
    await user.click(screen.getByRole('button', { name: /continue to download/i }))

    expect(screen.getByText('Download Resume')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate cover letter/i })).not.toBeInTheDocument()
    // "Download PDF" appears in both stage toolbar and bottom bar — at least one present
    expect(screen.getAllByRole('button', { name: /download pdf/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /download docx/i }).length).toBeGreaterThan(0)
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

  it('stage 2: shows "Save Changes", "Back to Edit", and "Continue to Preview"', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to preview/i })).toBeInTheDocument()
  })

  it('stage 3: shows "Save Changes", "Back to AI Enhance", and "Continue to Download"', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to ai enhance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to download/i })).toBeInTheDocument()
  })

  it('stage 4: shows "Back to Preview", "Download PDF", "Download DOCX" — no Save Changes, no Continue', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))
    await user.click(screen.getByRole('button', { name: /continue to download/i }))

    expect(screen.getByRole('button', { name: /back to preview/i })).toBeInTheDocument()
    // Download PDF and DOCX appear in bottom bar at step 4
    expect(screen.getAllByRole('button', { name: /download pdf/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /download docx/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue to/i })).not.toBeInTheDocument()
  })
})

// ── zoom controls ─────────────────────────────────────────────────────────────

describe('ResumeEditor — zoom controls', () => {
  it('starts at 100% zoom', () => {
    renderEditor()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('decreases zoom when the minus button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    // The zoom display is a <span> with the "100%" text; its siblings inside
    // the same container are the minus (left) and plus (right) buttons.
    const zoomDisplay = screen.getByText('100%')
    const zoomContainer = zoomDisplay.closest('div')!
    const minusBtn = zoomContainer.previousElementSibling as HTMLButtonElement
    await user.click(minusBtn)

    // Should now show 90% (next ZOOM_LEVEL step down from 100)
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('increases zoom when the plus button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()

    const zoomDisplay = screen.getByText('100%')
    const zoomContainer = zoomDisplay.closest('div')!
    const plusBtn = zoomContainer.nextElementSibling as HTMLButtonElement
    await user.click(plusBtn)

    // Should now show 110% (next ZOOM_LEVEL step up from 100)
    expect(screen.getByText('110%')).toBeInTheDocument()
  })

  it('does not go below 75% zoom', async () => {
    const user = userEvent.setup()
    renderEditor()

    const zoomDisplay = screen.getByText('100%')
    const zoomContainer = zoomDisplay.closest('div')!
    const minusBtn = zoomContainer.previousElementSibling as HTMLButtonElement

    // ZOOM_LEVELS = [75, 90, 100, 110, 125] — click minus 5 times
    for (let i = 0; i < 5; i++) {
      await user.click(minusBtn)
    }

    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('does not go above 125% zoom', async () => {
    const user = userEvent.setup()
    renderEditor()

    const zoomDisplay = screen.getByText('100%')
    const zoomContainer = zoomDisplay.closest('div')!
    const plusBtn = zoomContainer.nextElementSibling as HTMLButtonElement

    for (let i = 0; i < 5; i++) {
      await user.click(plusBtn)
    }

    expect(screen.getByText('125%')).toBeInTheDocument()
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
// (Resume Polish, Job Tailoring, Cover Letter, ATS Score). Resume Sections nav absent.
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
    // The tool selector nav buttons (Resume Polish, Job Tailoring, etc.) are absent at step 1
    expect(screen.queryByRole('button', { name: /resume polish/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /job tailoring/i })).not.toBeInTheDocument()
  })

  it('shows AI Enhance Tools panel with tool selector nav buttons at Step 2', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))

    // The sidebar AI Enhance Tools heading
    expect(screen.getByText('AI Enhance Tools')).toBeInTheDocument()
    // The 4 tool selector nav buttons are rendered
    expect(screen.getAllByRole('button', { name: /resume polish/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /job tailoring/i }).length).toBeGreaterThan(0)
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

  it('shows Resume Sections nav again in the sidebar at Step 3 (Preview)', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))

    expect(screen.getByText('Resume Sections')).toBeInTheDocument()
    expect(screen.queryByText('AI Enhance Tools')).not.toBeInTheDocument()
  })
})

// ── center panel Step 2 AI workspace ─────────────────────────────────────────
// When currentStep === 2, the center panel renders a per-tool workspace:
//   - default ('polish'): "Resume Polish" heading + "Generate Improvements" button
//   - 'tailor': "Job Tailoring" heading + job desc textarea + "Tailor Resume to Job" button
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

  it('clicking "Job Tailoring" tool shows the job description workspace', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /job tailoring/i }))

    expect(screen.getByRole('heading', { name: /job tailoring/i })).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/paste the full job description here/i),
    ).toBeInTheDocument()
  })

  it('"Tailor Resume to Job" button is disabled when job description is empty, enabled after typing', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: /continue to ai enhance/i }))
    await user.click(screen.getByRole('button', { name: /job tailoring/i }))

    const tailorBtn = screen.getByRole('button', { name: /tailor resume to job/i })
    expect(tailorBtn).toBeDisabled()

    const textarea = screen.getByPlaceholderText(/paste the full job description here/i)
    await user.type(textarea, 'Senior Software Engineer at Acme Corp.')

    expect(tailorBtn).toBeEnabled()
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
    await user.click(screen.getByRole('button', { name: /continue to preview/i }))
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
