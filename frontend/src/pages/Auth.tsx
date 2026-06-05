import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type Tab = 'signin' | 'signup'

export default function Auth() {
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signInWithEmail, signUpWithEmail, signInAsGuest } = useAuth()
  const navigate = useNavigate()

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      if (tab === 'signin') {
        await signInWithEmail(email, password)
        navigate('/')
      } else {
        await signUpWithEmail(email, password)
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInAsGuest()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="size-7 bg-primary rounded flex items-center justify-center">
          <FileText className="size-4 text-primary-foreground" />
        </div>
        <span
          className="font-bold text-sm tracking-widest uppercase text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Resume AI
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#111111] border border-[#222] rounded-xl p-8">
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
            <p className="text-xs text-primary font-medium">
              Check your email to confirm your account!
            </p>
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
