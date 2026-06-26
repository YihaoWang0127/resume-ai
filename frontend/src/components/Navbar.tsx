import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, ArrowLeft, User, Settings, Menu, X, Sparkles, Zap, CheckSquare, FileText, Download, Upload, BookOpen, Package } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import PackageWizard from '@/components/PackageWizard'

interface Props {
  onBack?: () => void
  children?: ReactNode
}

type NavLabel = 'Features' | 'Steps' | 'Examples' | 'Pricing' | 'Blog'

const NAV_LABELS: NavLabel[] = ['Features', 'Steps', 'Examples', 'Pricing', 'Blog']

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

function ExamplesPanel() {
  return (
    <div className="p-5">
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="size-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            We&apos;re putting together real before/after examples. Check back soon!
          </p>
        </div>
      </div>
    </div>
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

function BlogPanel() {
  return (
    <div className="p-5">
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="size-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            Tips, guides, and industry insights for your job search journey. Coming soon!
          </p>
        </div>
      </div>
    </div>
  )
}

const NAV_PANELS: Record<NavLabel, ReactNode> = {
  Features: <FeaturesPanel />,
  'Steps': <HowItWorksPanel />,
  Examples: <ExamplesPanel />,
  Pricing: <PricingPanel />,
  Blog: <BlogPanel />,
}

export default function Navbar({ onBack, children }: Props) {
  const { user, loading, isGuest, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeNav, setActiveNav] = useState<NavLabel | null>(null)
  const [packageOpen, setPackageOpen] = useState(false)
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
              {activeNav === label && (
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
    </nav>
  )
}
