import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ChevronDown, LayoutDashboard, LogOut, ArrowLeft, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onBack?: () => void
  children?: ReactNode
}

export default function Navbar({ onBack, children }: Props) {
  const { user, loading, isGuest, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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

  return (
    <nav className="shrink-0 border-b border-border px-6 h-14 flex items-center justify-between bg-background">
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
          <span
            className="font-bold text-sm tracking-widest uppercase text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
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
        {children}
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
                <div className="size-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary uppercase">
                    {user.email?.[0] ?? '?'}
                  </span>
                </div>
                <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">
                  {user.email}
                </span>
                <ChevronDown className={`size-3 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-primary/30 rounded-lg py-1 min-w-[180px] shadow-lg shadow-black/40">
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/dashboard') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <LayoutDashboard className="size-3.5" />
                    My Resumes
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
      </div>
    </nav>
  )
}
