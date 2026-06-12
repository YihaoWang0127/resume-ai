import { User, Sparkles, Palette, Lock, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettingsTab = 'profile' | 'ai' | 'appearance' | 'security'

export const SETTINGS_TABS: { id: SettingsTab; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'ai', label: 'AI Preferences', icon: Sparkles },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Lock },
]

interface Props {
  activeTab: SettingsTab
  onChange: (tab: SettingsTab) => void
}

export default function SettingsSidebar({ activeTab, onChange }: Props) {
  return (
    <nav className="lg:w-56 lg:shrink-0">
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-none -mx-6 px-6 pb-4 mb-2 border-b border-border">
        {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex shrink-0 items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors',
              activeTab === id
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
        {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors',
              activeTab === id
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
