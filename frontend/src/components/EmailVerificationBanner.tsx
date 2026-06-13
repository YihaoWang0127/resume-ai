import { useEffect, useState } from 'react'
import { Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const COOLDOWN_SECONDS = 60

function dismissalKey(userId: string) {
  return `email-verification-dismissed:${userId}`
}

export default function EmailVerificationBanner() {
  const { user, isGuest, emailVerified, resendVerificationEmail } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!user) return
    setDismissed(sessionStorage.getItem(dismissalKey(user.id)) === 'true')
  }, [user])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!user || isGuest || emailVerified || dismissed) return null

  const handleDismiss = () => {
    sessionStorage.setItem(dismissalKey(user.id), 'true')
    setDismissed(true)
  }

  const handleResend = async () => {
    setSending(true)
    try {
      await resendVerificationEmail()
      toast.success('Verification email sent')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full bg-primary/10 text-foreground border-b border-primary/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Mail className="size-4 text-primary shrink-0" />
          <p className="text-sm truncate">
            Please verify your email address ({user.email}) to secure your account.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || cooldown > 0}
            className="flex items-center gap-2 min-h-[44px] px-4 text-xs font-bold uppercase tracking-wider text-primary border border-primary rounded hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending && <Loader2 className="size-3.5 animate-spin" />}
            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend email'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
