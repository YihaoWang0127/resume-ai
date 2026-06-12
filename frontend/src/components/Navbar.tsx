import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ChevronDown, LayoutDashboard, LogOut, ArrowLeft, User, Settings, Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

interface Props {
  onBack?: () => void
  children?: ReactNode
}

export default function Navbar({ onBack, children }: Props) {
  const { user, loading, isGuest, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

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

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const displayName = fullName.trim() || user?.email || ''

  return (
    <nav className="relative shrink-0 border-b border-border px-6 h-14 flex items-center justify-between bg-background">
      {/* Left: logo + optional back */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="size-7 bg-primary rounded flex items-center justify-center shrink-0">
            <FileText className="size-4 text-primary-foreground" />
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
        {!loading && (
          isGuest || !user ? (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary border border-primary px-4 py-1.5 hover:bg-primary/10 transition-colors"
            >
              <User className="size-3.5" />
              Sign In
            </button>
          ) : user ? (
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
                    onClick={() => { setUserMenuOpen(false); navigate('/dashboard') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <LayoutDashboard className="size-3.5" />
                    My Resumes
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
          ) : null
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
    </nav>
  )
}
