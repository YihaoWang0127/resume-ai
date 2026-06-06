import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { X, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type Tab = 'signin' | 'signup'

export default function AuthModal() {
  const {
    user, isGuest,
    showAuthModal, closeAuthModal,
    signInWithEmail, signUpWithEmail, signInAsGuest, signOut,
  } = useAuth()

  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset all internal state each time the modal opens so stale loading /
  // error / field values from a previous session never bleed through.
  useEffect(() => {
    if (showAuthModal) {
      setLoading(false)
      setError(null)
      setSuccess(null)
      setEmail('')
      setPassword('')
      setTab('signin')
    }
  }, [showAuthModal])

  if (!showAuthModal) return null

  // ── Already authenticated non-guest user ───────────────────────────────────
  if (user && !isGuest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <div className="w-full max-w-md bg-[#111111] border border-[#222] rounded-xl p-8 relative">
          <Logo />
          <p className="text-white text-lg font-semibold mb-1">You're already signed in</p>
          <p className="text-sm text-muted-foreground mb-6">{user.email}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeAuthModal}
              className="flex-1 py-3 bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={async () => { await signOut(); closeAuthModal() }}
              className="flex-1 py-3 bg-black border border-[#333] text-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-[#222] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Auth form (no user, or guest upgrading) ────────────────────────────────

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (tab === 'signin') {
        await signInWithEmail(email, password)
        closeAuthModal()
      } else {
        await signUpWithEmail(email, password)
        setSuccess('Check your email to confirm your account!')
        closeAuthModal()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    // Already a guest — nothing to do, just close.
    if (isGuest) {
      closeAuthModal()
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signInAsGuest()
      closeAuthModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[#111111] border border-[#222] rounded-xl p-8 relative">
        {/* X button — only shown when user has a session (guest upgrading) */}
        {user && (
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        )}

        <Logo />

        {/* Tabs */}
        <div className="flex border-b border-[#222] mb-6">
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={cn(
                'flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors',
                tab === t
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />

          {error && (
            <p className="text-xs text-red-400 font-medium">{error}</p>
          )}
          {success && (
            <p className="text-xs text-primary font-medium">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#222]" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-[#222]" />
        </div>

        {/* Guest */}
        <button
          type="button"
          onClick={handleGuest}
          disabled={loading}
          className="w-full py-3 bg-black border border-primary text-primary text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <div className="size-6 bg-primary rounded flex items-center justify-center">
        <FileText className="size-3.5 text-primary-foreground" />
      </div>
      <span
        className="font-bold text-xs tracking-widest uppercase text-foreground"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Resume AI
      </span>
    </div>
  )
}
