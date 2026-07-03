import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, ArrowLeft, User, Settings, Menu, X, Sparkles, Zap, CheckSquare, FileText, Download, Upload, Package } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import PackageWizard from '@/components/PackageWizard'
import Modal from '@/components/Modal'

interface Props {
  onBack?: () => void
  children?: ReactNode
}

type NavLabel = 'Features' | 'Steps' | 'Examples' | 'Pricing'

const NAV_LABELS: NavLabel[] = ['Features', 'Steps', 'Examples', 'Pricing']

const RESUME_EXAMPLE = {
  before: {
    summary: 'Marketing professional with experience in social media and content creation. Good communicator and team player.',
    bullets: [
      'Managed social media accounts.',
      'Created content for marketing campaigns.',
      'Worked with the design team on projects.',
    ],
  },
  after: {
    summary: 'Results-driven Marketing Manager with 5+ years scaling B2B SaaS brands. Grew organic traffic 140% and managed $500K annual ad spend across paid and organic channels.',
    bullets: [
      'Grew Instagram following from 2K to 45K in 18 months through a data-driven content strategy, increasing engagement rate by 3.2x.',
      'Led content strategy for 12 product launches, generating $1.2M in attributed pipeline.',
      'Partnered with design and product teams to ship 20+ campaign assets on a 2-week sprint cadence.',
    ],
  },
}

const SAMPLE_COVER_LETTER = `Dear Hiring Manager,

I'm excited to apply for the Marketing Manager position at your company. With over five years of experience scaling B2B SaaS brands through data-driven content strategy and paid acquisition, I'm confident I can help your team grow its audience and pipeline.

In my current role, I grew organic traffic by 140% and managed a $500K annual ad budget across paid and organic channels, consistently exceeding quarterly growth targets. I thrive on turning ambiguous goals into measurable campaigns, and I'd love to bring that same rigor to your marketing team.

Thank you for considering my application. I'd welcome the opportunity to discuss how my background aligns with your team's goals.

Sincerely,
Jordan Avery`

const ATS_SCORE_BREAKDOWN = [
  { label: 'Keyword Match', value: 90 },
  { label: 'Formatting', value: 85 },
  { label: 'Skills Alignment', value: 88 },
  { label: 'Readability', value: 82 },
]

/* ─── Panel content components ─────────────────────────────────── */

function FeaturesPanel() {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">What you get</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Zap className="size-4 text-primary" />, title: 'AI Enhancement', desc: 'Instantly improve bullet points, fix grammar, and boost clarity' },
          { icon: <CheckSquare className="size-4 text-primary" />, title: 'ATS Optimization', desc: 'Score and optimize your resume for any applicant tracking system' },
          { icon: <FileText className="size-4 text-primary" />, title: 'Cover Letters', desc: 'Generate tailored cover letters for any job in seconds' },
          { icon: <Download className="size-4 text-primary" />, title: 'One-Click Export', desc: 'Download as PDF, DOCX, or TXT with a single click' },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors">
            <div className="shrink-0 mt-0.5">{f.icon}</div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HowItWorksPanel() {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Three simple steps</p>
      <div className="flex flex-col gap-4">
        {[
          { step: '1', icon: <Upload className="size-4 text-primary" />, title: 'Upload', desc: 'Drag & drop your existing resume (PDF or Word)' },
          { step: '2', icon: <Sparkles className="size-4 text-primary" />, title: 'Enhance', desc: 'AI analyzes and improves every section automatically' },
          { step: '3', icon: <Download className="size-4 text-primary" />, title: 'Export', desc: 'Download your polished resume and cover letter' },
        ].map((s, i) => (
          <div key={s.step} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{s.step}</span>
              </div>
              {i < 2 && <div className="w-px h-4 bg-border mt-1" />}
            </div>
            <div className="flex items-start gap-3 pt-1">
              {s.icon}
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type ExampleKey = 'Resume' | 'Cover Letter' | 'ATS Score'

const EXAMPLE_ITEMS: { key: ExampleKey; icon: ReactNode; desc: string }[] = [
  { key: 'Resume', icon: <FileText className="size-4 text-primary" />, desc: 'See a full before & after resume rewrite' },
  { key: 'Cover Letter', icon: <FileText className="size-4 text-primary" />, desc: 'A sample AI-generated cover letter' },
  { key: 'ATS Score', icon: <CheckSquare className="size-4 text-primary" />, desc: 'A sample ATS compatibility breakdown' },
]

function ExamplesPanel({ onSelect }: { onSelect: (key: ExampleKey) => void }) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">See sample results</p>
      <div className="flex flex-col gap-1">
        {EXAMPLE_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors text-left min-h-[44px]"
          >
            <div className="shrink-0 mt-0.5">{item.icon}</div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{item.key}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <X className="size-5" />
    </button>
  )
}

function ResumeExampleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl rounded-xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Examples</p>
          <h2 className="text-xl font-bold text-foreground">Resume: Before & After</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Illustrative example — not real user data.
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 flex flex-col gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Before</span>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{RESUME_EXAMPLE.before.summary}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Experience</p>
            <ul className="flex flex-col gap-1.5 list-disc pl-4">
              {RESUME_EXAMPLE.before.bullets.map((b, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed">{b}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 flex flex-col gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">After</span>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Summary</p>
            <p className="text-sm font-medium text-foreground leading-relaxed">{RESUME_EXAMPLE.after.summary}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Experience</p>
            <ul className="flex flex-col gap-1.5 list-disc pl-4">
              {RESUME_EXAMPLE.after.bullets.map((b, i) => (
                <li key={i} className="text-sm font-medium text-foreground leading-relaxed">{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CoverLetterExampleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl rounded-xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Examples</p>
          <h2 className="text-xl font-bold text-foreground">Sample Cover Letter</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Illustrative example — not real user data.
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="border border-border rounded-xl p-4">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{SAMPLE_COVER_LETTER}</p>
      </div>
    </Modal>
  )
}

function AtsExampleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-lg rounded-xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Examples</p>
          <h2 className="text-xl font-bold text-foreground">Sample ATS Score</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Illustrative example — not real user data.
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="flex flex-col gap-6">
        <div className="text-center border border-border rounded-xl py-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Overall Score</p>
          <p className="text-5xl font-bold text-primary">87%</p>
        </div>
        <div className="flex flex-col gap-4">
          {ATS_SCORE_BREAKDOWN.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <span className="text-sm font-bold text-primary">{item.value}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function PricingPanel() {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Simple pricing</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm font-bold text-foreground">Free</p>
          <p className="text-xl font-bold text-primary">$0<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
          <p className="text-xs font-semibold text-muted-foreground">Get Started Free</p>
          <ul className="text-xs text-muted-foreground space-y-1 mt-1">
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> 3 resume enhancements</li>
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> 1 cover letter</li>
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> PDF export</li>
          </ul>
        </div>
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm font-bold text-foreground">Pro</p>
          <p className="text-xl font-bold text-primary">Soon</p>
          <p className="text-xs font-semibold text-muted-foreground">Everything in Free +</p>
          <ul className="text-xs text-muted-foreground space-y-1 mt-1">
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Unlimited enhancements</li>
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Priority AI</li>
            <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> All export formats</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function Navbar({ onBack, children }: Props) {
  const { user, loading, isGuest, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeNav, setActiveNav] = useState<NavLabel | null>(null)
  const [packageOpen, setPackageOpen] = useState(false)
  const [resumeExampleOpen, setResumeExampleOpen] = useState(false)
  const [coverLetterExampleOpen, setCoverLetterExampleOpen] = useState(false)
  const [atsExampleOpen, setAtsExampleOpen] = useState(false)

  const handleSelectExample = (key: ExampleKey) => {
    setActiveNav(null)
    if (key === 'Resume') setResumeExampleOpen(true)
    else if (key === 'Cover Letter') setCoverLetterExampleOpen(true)
    else setAtsExampleOpen(true)
  }

  const NAV_PANELS: Partial<Record<NavLabel, ReactNode>> = {
    Features: <FeaturesPanel />,
    'Steps': <HowItWorksPanel />,
    Examples: <ExamplesPanel onSelect={handleSelectExample} />,
    Pricing: <PricingPanel />,
  }
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  // Close nav dropdown on outside click or Escape
  useEffect(() => {
    if (!activeNav) return
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveNav(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveNav(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [activeNav])

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const displayName = fullName.trim() || user?.email || ''

  return (
    <nav className="sticky top-0 z-10 shrink-0 border-b border-border px-6 h-16 flex items-center justify-between bg-background">
      {/* Left: logo + optional back */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">R</span>
          </div>
          <span className="font-display font-bold text-sm tracking-widest uppercase text-foreground">
            Resume AI
          </span>
        </button>
        {onBack && (
          <>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          </>
        )}
      </div>

      {/* Center: nav links (desktop only, no children/back override) */}
      {!onBack && !children && (
        <div ref={navRef} className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {NAV_LABELS.map((label) => (
            <div key={label} className="relative">
              <button
                type="button"
                onClick={() => setActiveNav(activeNav === label ? null : label)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeNav === label
                    ? 'text-primary bg-primary/8'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                {label}
                <ChevronDown className={cn('size-3 transition-transform', activeNav === label && 'rotate-180')} />
              </button>
              {activeNav === label && NAV_PANELS[label] && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[480px] bg-card border border-border rounded-xl shadow-dropdown animate-in fade-in-0 slide-in-from-top-2 duration-150">
                  {NAV_PANELS[label]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Right: action slot + user area */}
      <div className="flex items-center gap-2">
        {children && (
          <div
            className={cn(
              'items-center gap-2 md:flex md:static md:inset-x-auto md:border-0 md:px-0 md:py-0 md:bg-transparent md:shadow-none md:w-auto md:flex-row',
              mobileMenuOpen
                ? 'flex flex-col absolute top-full inset-x-0 z-40 border-b border-border bg-background px-6 py-3 shadow-dropdown'
                : 'hidden'
            )}
          >
            {children}
          </div>
        )}
        {/* Package button — shown when any session exists */}
        {!loading && (user || isGuest) && (
          isGuest ? (
            <button
              type="button"
              disabled
              title="Sign in to use One Click Package Generation"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider rounded-lg cursor-not-allowed opacity-60 whitespace-nowrap border border-border"
            >
              <Package className="size-3.5" />
              <span>One Click Package</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPackageOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Package className="size-3.5" />
              <span>One Click Package</span>
            </button>
          )
        )}
        {!loading && (
          isGuest ? (
            /* ── Guest: avatar dropdown ── */
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-primary/50 rounded transition-colors"
              >
                <Avatar size="sm" className="border border-primary/40">
                  <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary uppercase">
                    <User className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">
                  Guest
                </span>
                <ChevronDown className={`size-3 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-primary/30 rounded-lg py-1 min-w-[180px] shadow-dropdown">
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/profile') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <User className="size-3.5" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/ai') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <Sparkles className="size-3.5" />
                    AI
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <Settings className="size-3.5" />
                    Settings
                  </button>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    onClick={() => { setUserMenuOpen(false); openAuthModal() }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors text-left"
                  >
                    <User className="size-3.5" />
                    Sign In / Sign Up
                  </button>
                </div>
              )}
            </div>
          ) : !user ? (
            /* ── No session: Get Started Free only ── */
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center justify-center px-4 py-2 min-h-[44px] bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Get Started Free
            </button>
          ) : (
            /* ── Authenticated user: avatar dropdown ── */
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-primary/50 rounded transition-colors"
              >
                <Avatar size="sm" className="border border-primary/40">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary uppercase">
                    {getInitials(fullName, user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">
                  {displayName}
                </span>
                <ChevronDown className={`size-3 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-primary/30 rounded-lg py-1 min-w-[180px] shadow-dropdown">
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/profile') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <User className="size-3.5" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/dashboard') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <LayoutDashboard className="size-3.5" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/ai') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <Sparkles className="size-3.5" />
                    AI
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <Settings className="size-3.5" />
                    Settings
                  </button>
                  <div className="h-px bg-border mx-2 my-1" />
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut() }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left"
                  >
                    <LogOut className="size-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {children && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] text-foreground hover:text-primary transition-colors"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        )}
      </div>
      <PackageWizard open={packageOpen} onClose={() => setPackageOpen(false)} />
      <ResumeExampleModal open={resumeExampleOpen} onClose={() => setResumeExampleOpen(false)} />
      <CoverLetterExampleModal open={coverLetterExampleOpen} onClose={() => setCoverLetterExampleOpen(false)} />
      <AtsExampleModal open={atsExampleOpen} onClose={() => setAtsExampleOpen(false)} />
    </nav>
  )
}
