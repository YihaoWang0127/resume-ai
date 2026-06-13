import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// A session belongs to a non-anonymous user who hasn't verified their email yet.
// Anonymous/guest sessions are intentionally unverified and must never be gated.
function isUnverifiedSession(session: Session | null): boolean {
  const user = session?.user
  if (!user || user.is_anonymous) return false
  return !user.email_confirmed_at
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isGuest: boolean
  emailVerified: boolean
  showAuthModal: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  resendVerificationEmail: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const autoShowFired = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isUnverifiedSession(session)) {
        void supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setLoading(false)
        toast.error('Please verify your email address before continuing. Check your inbox for the verification link.')
        if (!autoShowFired.current) {
          autoShowFired.current = true
          const timer = setTimeout(() => setShowAuthModal(true), 10000)
          return () => clearTimeout(timer)
        }
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Auto-show modal once after load if no session at all
      if (!session && !autoShowFired.current) {
        autoShowFired.current = true
        const timer = setTimeout(() => setShowAuthModal(true), 10000)
        return () => clearTimeout(timer)
      }
      autoShowFired.current = true
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isUnverifiedSession(session)) {
        void supabase.auth.signOut()
        setSession(null)
        setUser(null)
        toast.error('Please verify your email address before continuing. Check your inbox for the verification link.')
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const openAuthModal = () => setShowAuthModal(true)
  const closeAuthModal = () => setShowAuthModal(false)

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
    if (data.user?.identities?.length === 0) {
      throw new Error('This email is already registered. Please sign in instead.')
    }
  }

  const signInAsGuest = async () => {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resendVerificationEmail = async () => {
    if (!user?.email) throw new Error('No email address on file')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  }

  const isGuest = user?.is_anonymous === true
  const emailVerified = isGuest || !user ? true : !!user?.email_confirmed_at

  return (
    <AuthContext.Provider value={{
      user, session, loading, isGuest, emailVerified,
      showAuthModal, openAuthModal, closeAuthModal,
      signInWithEmail, signUpWithEmail, signInAsGuest, signOut,
      resendVerificationEmail,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
