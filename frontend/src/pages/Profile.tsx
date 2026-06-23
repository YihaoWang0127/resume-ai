import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getProfile, upsertProfile } from '@/services/profile'
import { DEFAULT_PROFILE } from '@/types/profile'
import type { ProfileInput } from '@/types/profile'
import type { ExperienceItem } from '@/types/resume'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import ProfileSettings from '@/components/settings/ProfileSettings'

const COOLDOWN_SECONDS = 60

export default function Profile() {
  const navigate = useNavigate()
  const { user, resendVerificationEmail } = useAuth()
  const initialName = (user?.user_metadata?.full_name as string | undefined) ?? ''

  // --- Account card state ---
  const [displayName, setDisplayName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata?.avatar_url as string | undefined) ?? null,
  )
  const [accountSaving, setAccountSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [accountDirty, setAccountDirty] = useState(false)

  // --- Profile data state ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialInfo, setInitialInfo] = useState<ProfileInput>(DEFAULT_PROFILE)
  const [info, setInfo] = useState<ProfileInput>(DEFAULT_PROFILE)

  const dirty = accountDirty || JSON.stringify(info) !== JSON.stringify(initialInfo)
  const infoDirty = JSON.stringify(info) !== JSON.stringify(initialInfo)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    let active = true
    getProfile()
      .then((data) => {
        if (!active) return
        const next: ProfileInput = data
          ? {
              full_name: data.full_name,
              phone: data.phone,
              address: data.address,
              linkedin_url: data.linkedin_url ?? '',
              github_url: data.github_url ?? '',
              portfolio_url: data.portfolio_url ?? '',
              job_title: data.job_title,
              target_job_title: data.target_job_title ?? '',
              target_industry: data.target_industry ?? '',
              years_of_experience: data.years_of_experience ?? 0,
              experience: data.experience.length > 0 ? data.experience : [],
              experience_bullets: Array.isArray(data.experience_bullets) ? data.experience_bullets : [],
              skills_technical: data.skills_technical ?? '',
              skills_tools: data.skills_tools ?? '',
              skills_certifications: data.skills_certifications ?? '',
            }
          : DEFAULT_PROFILE
        setInitialInfo(next)
        setInfo(next)
      })
      .catch((err) => {
        if (!active) return
        toast.error(err instanceof Error ? err.message : 'Failed to load profile')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  // --- Account handlers ---
  const handleNameChange = (value: string) => {
    setDisplayName(value)
    setAccountDirty(value !== initialName)
  }

  const handleAccountSave = async () => {
    setAccountSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
      if (error) throw error
      setAccountDirty(false)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setAccountSaving(false)
    }
  }

  const handleResendVerification = async () => {
    setResending(true)
    try {
      await resendVerificationEmail()
      toast.success('Verification email sent')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification email')
    } finally {
      setResending(false)
    }
  }

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const cacheBustedUrl = `${data.publicUrl}?t=${Date.now()}`

      const { error } = await supabase.auth.updateUser({ data: { avatar_url: cacheBustedUrl } })
      if (error) throw error

      setAvatarUrl(cacheBustedUrl)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  // --- Profile info handlers ---
  const updateInfo = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setInfo((prev) => ({ ...prev, [key]: value }))
  }

  const setExperience = (index: number, patch: Partial<ExperienceItem>) => {
    setInfo((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) => (i === index ? { ...exp, ...patch } : exp)),
    }))
  }

  const addExperience = () => {
    setInfo((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { company: '', title: '', startDate: '', endDate: '', current: false, bullets: [''] },
      ],
    }))
  }

  const removeExperience = (index: number) => {
    setInfo((prev) => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }))
  }

  const addBullet = () => {
    setInfo((prev) => ({ ...prev, experience_bullets: [...prev.experience_bullets, ''] }))
  }

  const updateBullet = (index: number, value: string) => {
    setInfo((prev) => ({
      ...prev,
      experience_bullets: prev.experience_bullets.map((b, i) => (i === index ? value : b)),
    }))
  }

  const removeBullet = (index: number) => {
    setInfo((prev) => ({
      ...prev,
      experience_bullets: prev.experience_bullets.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await upsertProfile(info)
      const next: ProfileInput = {
        full_name: saved.full_name,
        phone: saved.phone,
        address: saved.address,
        linkedin_url: saved.linkedin_url ?? '',
        github_url: saved.github_url ?? '',
        portfolio_url: saved.portfolio_url ?? '',
        job_title: saved.job_title,
        target_job_title: saved.target_job_title ?? '',
        target_industry: saved.target_industry ?? '',
        years_of_experience: saved.years_of_experience ?? 0,
        experience: saved.experience,
        experience_bullets: Array.isArray(saved.experience_bullets) ? saved.experience_bullets : [],
        skills_technical: saved.skills_technical ?? '',
        skills_tools: saved.skills_tools ?? '',
        skills_certifications: saved.skills_certifications ?? '',
      }
      setInitialInfo(next)
      setInfo(next)
      toast.success('Career profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen lg:h-screen bg-background flex flex-col">
      <Navbar onBack={handleBack} />
      <main className="flex-1 lg:overflow-hidden px-6 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8 py-10 lg:py-0">
        {/* Global account nav */}
        <div className="lg:py-10">
          <AccountSidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6 lg:overflow-y-auto lg:py-10 pb-16">
          <div>
            <h1 className="text-xl font-bold text-foreground">Career Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This information powers AI resume generation and stays in sync with your account.
            </p>
          </div>

          <ProfileSettings
            displayName={displayName}
            avatarUrl={avatarUrl}
            accountSaving={accountSaving}
            uploading={uploading}
            resending={resending}
            cooldown={cooldown}
            accountDirty={accountDirty}
            onNameChange={handleNameChange}
            onAccountSave={handleAccountSave}
            onAvatarChange={handleAvatarChange}
            onResendVerification={handleResendVerification}
            loading={loading}
            saving={saving}
            info={info}
            infoDirty={infoDirty}
            onUpdateInfo={updateInfo}
            onSetExperience={setExperience}
            onAddExperience={addExperience}
            onRemoveExperience={removeExperience}
            onAddBullet={addBullet}
            onUpdateBullet={updateBullet}
            onRemoveBullet={removeBullet}
            onSave={handleSave}
          />
        </div>
      </main>
    </div>
  )
}
