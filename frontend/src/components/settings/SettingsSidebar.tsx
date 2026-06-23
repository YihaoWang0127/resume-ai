import { useState } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProfileSubTab =
  | 'account'
  | 'contact-info'
  | 'career-profile'
  | 'experience-bank'
  | 'skills-bank'
  | 'work-experience'

const PROFILE_SUBTABS: { id: ProfileSubTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'contact-info', label: 'Contact Info' },
  { id: 'career-profile', label: 'Career Profile' },
  { id: 'experience-bank', label: 'Experience Bank' },
  { id: 'skills-bank', label: 'Skills Bank' },
  { id: 'work-experience', label: 'Work Experience' },
]

interface SettingsSidebarProps {
  activeSubTab: ProfileSubTab
  onSubTabClick: (subTab: ProfileSubTab) => void
}

export default function SettingsSidebar({ activeSubTab, onSubTabClick }: SettingsSidebarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(true)

  const handleSubTabClick = (subTab: ProfileSubTab) => {
    onSubTabClick(subTab)
    const el = document.getElementById(subTab)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="lg:w-52 lg:shrink-0">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-none -mx-6 px-6 pb-4 mb-2 border-b border-border">
        {PROFILE_SUBTABS.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => handleSubTabClick(sub.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
              activeSubTab === sub.id
                ? 'bg-blue-50 text-blue-600'
                : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* Desktop: vertical sticky sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:gap-1 lg:sticky lg:top-20">
        {/* Profile accordion parent */}
        <button
          type="button"
          onClick={() => setIsProfileOpen((prev) => !prev)}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full',
            'bg-primary/10 text-primary',
          )}
        >
          <User className="size-4 shrink-0" />
          <span className="flex-1">Profile</span>
          {isProfileOpen ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
        </button>

        {/* Subtabs */}
        {isProfileOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5 pl-4">
            {PROFILE_SUBTABS.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleSubTabClick(sub.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-left transition-colors w-full min-h-[44px]',
                  activeSubTab === sub.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
