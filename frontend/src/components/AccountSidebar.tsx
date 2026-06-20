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
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const ACCOUNT_NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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

export default function AccountSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isGuest } = useAuth()

  const isDashboard = location.pathname === '/dashboard'
  const currentTab = searchParams.get('tab')

  const [dashExpanded, setDashExpanded] = useState(isDashboard)

  // Auto-expand when navigating to /dashboard from another route
  useEffect(() => {
    if (isDashboard) setDashExpanded(true)
  }, [isDashboard])

  // Dashboard requires a persisted (non-guest) account — Dashboard.tsx
  // redirects guests/signed-out users to "/", so don't show a tab that bounces them out.
  const navItems = !user || isGuest
    ? ACCOUNT_NAV_ITEMS.filter((item) => item.path !== '/dashboard')
    : ACCOUNT_NAV_ITEMS

  const navigateToDashboardTab = (tab: string | null) => {
    if (tab === null) {
      navigate('/dashboard')
    } else {
      navigate(`/dashboard?tab=${tab}`)
    }
  }

  const isSubItemActive = (tab: string | null) => {
    if (tab === null) {
      return currentTab === null || currentTab === 'overview'
    }
    return currentTab === tab
  }

  return (
    <nav className="lg:w-56 lg:shrink-0">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-none -mx-6 px-6 pb-4 mb-2 border-b border-border">
        {navItems.map(({ path, label, icon: Icon }) => {
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
