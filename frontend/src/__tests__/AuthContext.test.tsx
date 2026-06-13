import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInAnonymously: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
const mockAuth = vi.mocked(supabase.auth)

const regularUser = { id: 'user-1', email: 'user@test.com', is_anonymous: false }
const verifiedUser = { id: 'user-2', email: 'verified@test.com', is_anonymous: false, email_confirmed_at: '2024-01-01T00:00:00Z' }
const guestUser = { id: 'anon-1', email: null, is_anonymous: true }
const regularSession = { user: regularUser, access_token: 'tok' }
const verifiedSession = { user: verifiedUser, access_token: 'tok' }

function setupAuth(session: typeof regularSession | null = null) {
  mockAuth.getSession.mockResolvedValue({ data: { session } } as any)
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as any)
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth(null)
})

// ── auth operations ───────────────────────────────────────────────────────────

describe('AuthContext — auth operations', () => {
  it('signInWithEmail calls supabase.auth.signInWithPassword', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: null } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signInWithEmail('user@test.com', 'pass123')
    })

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'pass123',
    })
  })

  it('signInWithEmail throws when supabase returns an error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: new Error('Invalid credentials') } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => { await result.current.signInWithEmail('x@x.com', 'bad') })
    ).rejects.toThrow()
  })

  it('signUpWithEmail calls supabase.auth.signUp', async () => {
    mockAuth.signUp.mockResolvedValue({ error: null } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signUpWithEmail('new@test.com', 'pass123')
    })

    expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'new@test.com', password: 'pass123' })
  })

  it('signInAsGuest calls supabase.auth.signInAnonymously', async () => {
    mockAuth.signInAnonymously.mockResolvedValue({ error: null } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signInAsGuest()
    })

    expect(mockAuth.signInAnonymously).toHaveBeenCalled()
  })

  it('signOut calls supabase.auth.signOut', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockAuth.signOut).toHaveBeenCalled()
  })
})

// ── isGuest ───────────────────────────────────────────────────────────────────

describe('AuthContext — isGuest flag', () => {
  it('isGuest is true for an anonymous user', async () => {
    setupAuth({ user: guestUser, access_token: 'tok' } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isGuest).toBe(true)
    expect(result.current.user?.is_anonymous).toBe(true)
  })

  it('isGuest is false for a regular email user', async () => {
    setupAuth(regularSession as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isGuest).toBe(false)
  })

  it('isGuest is false when no session', async () => {
    setupAuth(null)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isGuest).toBe(false)
    expect(result.current.user).toBeNull()
  })
})

// ── modal state ───────────────────────────────────────────────────────────────

describe('AuthContext — auth modal', () => {
  it('openAuthModal sets showAuthModal to true', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.showAuthModal).toBe(false)
    act(() => result.current.openAuthModal())
    expect(result.current.showAuthModal).toBe(true)
  })

  it('closeAuthModal sets showAuthModal to false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.openAuthModal())
    expect(result.current.showAuthModal).toBe(true)

    act(() => result.current.closeAuthModal())
    expect(result.current.showAuthModal).toBe(false)
  })
})

// ── emailVerified ────────────────────────────────────────────────────────────

describe('AuthContext — emailVerified flag', () => {
  it('emailVerified is true for a guest user', async () => {
    setupAuth({ user: guestUser, access_token: 'tok' } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.emailVerified).toBe(true)
  })

  it('emailVerified is true when there is no user', async () => {
    setupAuth(null)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(result.current.emailVerified).toBe(true)
  })

  it('emailVerified is false for a regular user without email_confirmed_at', async () => {
    setupAuth(regularSession as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.emailVerified).toBe(false)
  })

  it('emailVerified is true for a regular user with email_confirmed_at', async () => {
    setupAuth(verifiedSession as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.emailVerified).toBe(true)
  })
})

// ── resendVerificationEmail ─────────────────────────────────────────────────

describe('AuthContext — resendVerificationEmail', () => {
  it('calls supabase.auth.resend with the user email', async () => {
    setupAuth(regularSession as any)
    mockAuth.resend.mockResolvedValue({ error: null } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.resendVerificationEmail()
    })

    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'user@test.com' })
  })

  it('throws when there is no user email', async () => {
    setupAuth(null)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => { await result.current.resendVerificationEmail() })
    ).rejects.toThrow('No email address on file')
    expect(mockAuth.resend).not.toHaveBeenCalled()
  })

  it('throws when supabase returns an error', async () => {
    setupAuth(regularSession as any)
    mockAuth.resend.mockResolvedValue({ error: new Error('Rate limited') } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => { await result.current.resendVerificationEmail() })
    ).rejects.toThrow('Rate limited')
  })
})
