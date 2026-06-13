import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { X, FileText, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/Modal'
import { cn } from '@/lib/utils'

type Tab = 'signin' | 'signup'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthModal() {
  const {
    user, isGuest,
    showAuthModal, closeAuthModal,
    signInWithEmail, signUpWithEmail, signInAsGuest, signInWithGoogle, signOut,
  } = useAuth()

  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailValidated, setEmailValidated] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (showAuthModal) {
      setLoading(false)
      setError(null)
      setSuccess(null)
      setEmail('')
      setPassword('')
      setTab('signin')
      setEmailValidated(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [showAuthModal])

  if (!showAuthModal) return null

  // ── Already authenticated non-guest user ───────────────────────────────────
  if (user && !isGuest) {
    return (
      <Modal open={showAuthModal} overlayClassName="bg-black/60 px-4" className="max-w-md rounded-xl relative">
          <Logo />
          <p className="text-foreground text-lg font-semibold mb-1">You're already signed in</p>
          <p className="text-sm text-muted-foreground mb-6">{user.email}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeAuthModal}
              className="flex-1 py-3 min-h-[44px] bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={async () => { await signOut(); closeAuthModal() }}
              className="flex-1 py-3 min-h-[44px] bg-background border border-border text-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-secondary transition-colors"
            >
              Sign Out
            </button>
          </div>
      </Modal>
    )
  }

  // ── Auth form (unauthenticated or guest upgrading) ─────────────────────────

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    setSuccess(null)
    setEmailValidated(false)
  }

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setEmailValidated(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setEmailValidated(true), 300)
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
        setSuccess(email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    if (isGuest) { closeAuthModal(); return }
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

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const emailIsValid = EMAIL_REGEX.test(email)
  const showEmailError = emailValidated && email !== '' && !emailIsValid
  const showEmailValid = emailValidated && emailIsValid

  const emailInputCls = cn(
    'w-full px-4 py-3 bg-background border rounded-lg text-sm text-foreground',
    'placeholder:text-muted-foreground outline-none focus:ring-1 transition-colors',
    showEmailError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
      : showEmailValid
      ? 'border-primary focus:border-primary focus:ring-primary/30'
      : 'border-border focus:border-primary focus:ring-primary/30',
  )

  const passwordInputCls =
    'w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors'

  const submitDisabled = loading || (emailValidated && email !== '' && !emailIsValid)

  return (
    <Modal open={showAuthModal} overlayClassName="bg-black/60 px-4" className="max-w-md rounded-xl relative">
        {user && (
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        )}

        <Logo />

        {/* ── Sign-up success card ─────────────────────────────────────── */}
        {success ? (
          <div className="flex flex-col items-center text-center py-2">
            <CheckCircle className="size-14 text-primary mb-4" />
            <h2 className="text-foreground text-xl font-bold mb-3">Check your email!</h2>
            <p className="text-muted-foreground text-sm mb-1">We sent a verification link to:</p>
            <p className="text-foreground text-sm font-medium mb-4 break-all">{success}</p>
            <p className="text-muted-foreground text-xs mb-8">
              Click the link in the email to verify your account, then sign in.
            </p>
            <button
              type="button"
              onClick={closeAuthModal}
              className="w-full py-3 min-h-[44px] bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors"
            >
              OK, GOT IT
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-border mb-6">
              {(['signin', 'signup'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={cn(
                    'flex-1 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-widest transition-colors',
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
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={handleEmailChange}
                  className={emailInputCls}
                />
                {showEmailError && (
                  <p className="mt-1.5 text-xs text-red-400">Please enter a valid email address</p>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={passwordInputCls}
              />

              {error && (
                <p className="text-xs text-red-400 font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitDisabled}
                className="w-full py-3 min-h-[44px] bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 min-h-[44px] bg-background border border-border text-foreground text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <GoogleIcon className="size-4" />
              Continue with Google
            </button>

            {/* Guest */}
            <button
              type="button"
              onClick={handleGuest}
              disabled={loading}
              className="w-full mt-3 py-3 min-h-[44px] bg-background border border-primary text-primary text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue as Guest
            </button>
          </>
        )}
    </Modal>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <div className="size-6 bg-primary rounded flex items-center justify-center">
        <FileText className="size-3.5 text-primary-foreground" />
      </div>
      <span className="font-display font-bold text-xs tracking-widest uppercase text-foreground">
        Resume AI
      </span>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.43 3.58v2.97h3.91c2.29-2.11 3.54-5.21 3.54-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-2.97c-1.08.73-2.46 1.16-4.02 1.16-3.09 0-5.71-2.09-6.64-4.89H1.36v3.07C3.33 21.3 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.39c-.24-.73-.38-1.5-.38-2.29s.14-1.56.38-2.29V6.74H1.36C.5 8.36 0 10.13 0 12.1s.5 3.74 1.36 5.36l4-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.08 15.24 0 12 0 7.34 0 3.33 2.7 1.36 6.74l4 3.07c.93-2.8 3.55-4.89 6.64-4.89z"
      />
    </svg>
  )
}
