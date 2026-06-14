import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, User, Sparkles, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCOUNT_NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ai', label: 'AI', icon: Sparkles },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function AccountSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="lg:w-56 lg:shrink-0">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-none -mx-6 px-6 pb-4 mb-2 border-b border-border">
        {ACCOUNT_NAV_ITEMS.map(({ path, label, icon: Icon }) => (
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
        ))}
      </div>

      {/* Desktop: vertical sticky sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:gap-1 lg:sticky lg:top-20">
        {ACCOUNT_NAV_ITEMS.map(({ path, label, icon: Icon }) => (
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
        ))}
      </div>
    </nav>
  )
}
