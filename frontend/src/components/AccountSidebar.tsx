import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  Sparkles,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  LayoutList,
  FileText,
  Mail,
  Target,
  Package,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const ACCOUNT_NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/package', label: 'Package', icon: Package },
  { path: '/ai', label: 'AI', icon: Sparkles },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

interface DashboardSubItem {
  label: string
  tab: string | null
  icon: LucideIcon
}

const DASHBOARD_SUB_ITEMS: DashboardSubItem[] = [
  { label: 'Overview', tab: null, icon: LayoutList },
  { label: 'Resumes', tab: 'resumes', icon: FileText },
  { label: 'Cover Letters', tab: 'cover-letters', icon: Mail },
  { label: 'ATS Scores', tab: 'ats-scores', icon: Target },
]

interface PackageSubItem {
  label: string
  sectionId: string
  icon: LucideIcon
}

const PACKAGE_SUB_ITEMS: PackageSubItem[] = [
  { label: 'Package Overview', sectionId: 'package-overview', icon: LayoutList },
  { label: 'Application Package', sectionId: 'application-package', icon: Package },
]

interface ProfileSubItem {
  label: string
  sectionId: string
}

const PROFILE_SUB_ITEMS: ProfileSubItem[] = [
  { sectionId: 'account', label: 'Account' },
  { sectionId: 'contact-info', label: 'Contact Info' },
  { sectionId: 'career-profile', label: 'Career Profile' },
  { sectionId: 'experience-bank', label: 'Experience Bank' },
  { sectionId: 'skills-bank', label: 'Skills Bank' },
  { sectionId: 'work-experience', label: 'Work Experience' },
]

export default function AccountSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isGuest } = useAuth()

  const isDashboard = location.pathname === '/dashboard'
  const isProfile = location.pathname === '/profile'
  const isPackage = location.pathname === '/package'
  const currentTab = searchParams.get('tab')
  const currentSection = searchParams.get('section')

  const [dashExpanded, setDashExpanded] = useState(isDashboard)
  const [profileExpanded, setProfileExpanded] = useState(isProfile)
  const [packageExpanded, setPackageExpanded] = useState(isPackage)

  // Auto-expand when navigating to /dashboard, /profile, or /package from another route
  useEffect(() => {
    if (isDashboard) setDashExpanded(true)
  }, [isDashboard])

  useEffect(() => {
    if (isProfile) setProfileExpanded(true)
  }, [isProfile])

  useEffect(() => {
    if (isPackage) setPackageExpanded(true)
  }, [isPackage])

  // Dashboard requires a persisted (non-guest) account — Dashboard.tsx
  // redirects guests/signed-out users to "/", so don't show a tab that bounces them out.
  const navItems = !user || isGuest
    ? ACCOUNT_NAV_ITEMS.filter((item) => item.path !== '/dashboard' && item.path !== '/package')
    : ACCOUNT_NAV_ITEMS

  const navigateToDashboardTab = (tab: string | null) => {
    const sectionId = tab ?? 'overview'
    if (isDashboard) {
      // Already on dashboard — smooth-scroll to the section anchor
      const el = document.getElementById(sectionId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Update URL param so active highlight reflects current section
      if (tab === null) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate(`/dashboard?tab=${tab}`, { replace: true })
      }
    } else {
      // Navigate to dashboard first; scrolling happens after mount via hash
      if (tab === null) {
        navigate('/dashboard')
      } else {
        navigate(`/dashboard?tab=${tab}`)
      }
    }
  }

  const isSubItemActive = (tab: string | null) => {
    if (tab === null) {
      return currentTab === null || currentTab === 'overview'
    }
    return currentTab === tab
  }

  const scrollPageToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const el = document.querySelector('.lg\\:overflow-y-auto')
    ;(el as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToPackageSection = (sectionId: string) => {
    if (isPackage) {
      const el = document.getElementById(sectionId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate('/package')
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  const isPackageSectionActive = (sectionId: string) => {
    if (!isPackage) return false
    return currentSection === sectionId || (!currentSection && sectionId === 'package-overview')
  }

  const navigateToProfileSection = (sectionId: string) => {
    if (isProfile) {
      const el = document.getElementById(sectionId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      navigate(`/profile?section=${sectionId}`, { replace: true })
    } else {
      navigate(`/profile?section=${sectionId}`)
    }
  }

  const isProfileSectionActive = (sectionId: string) => {
    if (!isProfile) return false
    return currentSection === sectionId
  }

  return (
    <nav className="lg:w-56 lg:shrink-0">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-none -mx-6 px-6 pb-4 mb-2 border-b border-border">
        {navItems.map(({ path, label, icon: Icon }) => {
          if (path === '/package') {
            if (isPackage && packageExpanded) {
              return PACKAGE_SUB_ITEMS.map((sub) => (
                <button
                  key={`package-sub-${sub.sectionId}`}
                  type="button"
                  onClick={() => navigateToPackageSection(sub.sectionId)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                    isPackageSectionActive(sub.sectionId)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  <sub.icon className="size-3.5" />
                  {sub.label}
                </button>
              ))
            }
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                  isPackage
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            )
          }

          if (path === '/profile') {
            if (isProfile && profileExpanded) {
              // Replace Profile pill with 6 sub-item pills
              return PROFILE_SUB_ITEMS.map((sub) => (
                <button
                  key={`profile-sub-${sub.sectionId}`}
                  type="button"
                  onClick={() => navigateToProfileSection(sub.sectionId)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                    isProfileSectionActive(sub.sectionId)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {sub.label}
                </button>
              ))
            }
            // Not on profile — show normal Profile pill
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                  isProfile
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            )
          }

          if (path === '/dashboard') {
            if (isDashboard && dashExpanded) {
              // Replace Dashboard pill with 4 sub-item pills
              return DASHBOARD_SUB_ITEMS.map((sub) => (
                <button
                  key={`dashboard-sub-${sub.tab ?? 'overview'}`}
                  type="button"
                  onClick={() => navigateToDashboardTab(sub.tab)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                    isSubItemActive(sub.tab)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  <sub.icon className="size-3.5" />
                  {sub.label}
                </button>
              ))
            }
            // Not on dashboard — show normal Dashboard pill
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                  'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            )
          }

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
                location.pathname === path
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Desktop: vertical sticky sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:gap-1 lg:sticky lg:top-20">
        {navItems.map(({ path, label, icon: Icon }) => {
          if (path === '/package') {
            const isOpen = isPackage && packageExpanded
            const ChevronIcon = isOpen ? ChevronDown : ChevronRight
            return (
              <div key={path}>
                <button
                  type="button"
                  onClick={() => {
                    if (isPackage) {
                      if (packageExpanded) scrollPageToTop()
                      setPackageExpanded((prev) => !prev)
                    } else {
                      navigate('/package')
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full',
                    isPackage
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  <ChevronIcon className="size-4 shrink-0" />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-0.5 mt-0.5 pl-4">
                    {PACKAGE_SUB_ITEMS.map((sub) => (
                      <button
                        key={`desktop-package-sub-${sub.sectionId}`}
                        type="button"
                        onClick={() => navigateToPackageSection(sub.sectionId)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-left transition-colors w-full min-h-[44px]',
                          isPackageSectionActive(sub.sectionId)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <sub.icon className="size-4" />
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          if (path === '/profile') {
            const isOpen = isProfile && profileExpanded
            const ChevronIcon = isOpen ? ChevronDown : ChevronRight
            return (
              <div key={path}>
                {/* Profile parent row */}
                <button
                  type="button"
                  onClick={() => {
                    if (isProfile) {
                      if (profileExpanded) scrollPageToTop()
                      setProfileExpanded((prev) => !prev)
                    } else {
                      navigate('/profile')
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full',
                    isProfile
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  <ChevronIcon className="size-4 shrink-0" />
                </button>

                {/* Sub-items — visible when on /profile and expanded */}
                {isOpen && (
                  <div className="flex flex-col gap-0.5 mt-0.5 pl-4">
                    {PROFILE_SUB_ITEMS.map((sub) => (
                      <button
                        key={`desktop-profile-sub-${sub.sectionId}`}
                        type="button"
                        onClick={() => navigateToProfileSection(sub.sectionId)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-left transition-colors w-full min-h-[44px]',
                          isProfileSectionActive(sub.sectionId)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          if (path === '/dashboard') {
            const isOpen = isDashboard && dashExpanded
            const ChevronIcon = isOpen ? ChevronDown : ChevronRight
            return (
              <div key={path}>
                {/* Dashboard parent row */}
                <button
                  type="button"
                  onClick={() => {
                    if (isDashboard) {
                      if (dashExpanded) scrollPageToTop()
                      setDashExpanded((prev) => !prev)
                    } else {
                      navigate('/dashboard')
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full',
                    isDashboard
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  <ChevronIcon className="size-4 shrink-0" />
                </button>

                {/* Sub-items — visible when on /dashboard and expanded */}
                {isOpen && (
                  <div className="flex flex-col gap-0.5 mt-0.5 pl-4">
                    {DASHBOARD_SUB_ITEMS.map((sub) => (
                      <button
                        key={`desktop-sub-${sub.tab ?? 'overview'}`}
                        type="button"
                        onClick={() => navigateToDashboardTab(sub.tab)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-left transition-colors w-full min-h-[44px]',
                          isSubItemActive(sub.tab)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <sub.icon className="size-4" />
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors',
                location.pathname === path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
