import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Camera, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getInitials, cn } from '@/lib/utils'
import { getProfile, upsertProfile } from '@/services/profile'
import { DEFAULT_PROFILE } from '@/types/profile'
import type { ProfileInput } from '@/types/profile'
import type { ExperienceItem } from '@/types/resume'
import Navbar from '@/components/Navbar'
import AccountSidebar from '@/components/AccountSidebar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const COOLDOWN_SECONDS = 60

const field =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const textareaField = cn(field, 'h-24 resize-y py-2')

function emptyExperience(): ExperienceItem {
  return { company: '', title: '', startDate: '', endDate: '', current: false, bullets: [''] }
}

const YEARS_OPTIONS = [
  { value: 0, label: 'Less than 1 year' },
  { value: 1, label: '1 year' },
  { value: 2, label: '2 years' },
  { value: 3, label: '3 years' },
  { value: 4, label: '4 years' },
  { value: 5, label: '5 years' },
  { value: 7, label: '6–7 years' },
  { value: 10, label: '8–10 years' },
  { value: 15, label: '11–15 years' },
  { value: 20, label: '15+ years' },
]


export default function Profile() {
  const navigate = useNavigate()
  const { user, isGuest, emailVerified, resendVerificationEmail } = useAuth()
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [accountDirty, setAccountDirty] = useState(false)

  // --- Profile data state ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialInfo, setInitialInfo] = useState<ProfileInput>(DEFAULT_PROFILE)
  const [info, setInfo] = useState<ProfileInput>(DEFAULT_PROFILE)

  const dirty = accountDirty || JSON.stringify(info) !== JSON.stringify(initialInfo)

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
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    setInfo((prev) => ({ ...prev, experience: [...prev.experience, emptyExperience()] }))
  }

  const removeExperience = (index: number) => {
    setInfo((prev) => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }))
  }

  // Experience bullets handlers
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

  const infoDirty = JSON.stringify(info) !== JSON.stringify(initialInfo)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onBack={handleBack} />
      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        <AccountSidebar />
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Career Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This information powers AI resume generation and stays in sync with your account.
            </p>
          </div>

          {/* ── Section 1: Account ── */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your avatar, display name, and login email.</CardDescription>
            </CardHeader>

            <CardContent>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || user?.email || 'avatar'} />}
                  <AvatarFallback className="text-base font-bold">
                    {getInitials(displayName, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                    Change Avatar
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG, up to 2MB.</p>
                </div>
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ''} readOnly disabled />

                {!isGuest && user?.email && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1.5 w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="size-3.5" />
                        Verified
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 w-fit rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                          <AlertCircle className="size-3.5" />
                          Not Verified
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] w-full sm:w-auto"
                          disabled={resending || cooldown > 0}
                          onClick={handleResendVerification}
                        >
                          {resending && <Loader2 className="size-3.5 animate-spin" />}
                          {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend verification email'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Your email is tied to your account. To change it, verify a new address via email.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleAccountSave}
                disabled={accountSaving || !accountDirty}
                className="min-h-[44px]"
              >
                {accountSaving && <Loader2 className="size-3.5 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>

          {/* ── Sections 2–5: Career Profile (one card per section) ── */}
          {loading ? (
            <>
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="space-y-1.5">
                          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                          <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Info</CardTitle>
                  <CardDescription>Used in resumes and cover letters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={info.phone}
                      onChange={(e) => updateInfo('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Location</Label>
                    <Input
                      id="address"
                      value={info.address}
                      onChange={(e) => updateInfo('address', e.target.value)}
                      placeholder="City, State or Remote"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="linkedin-url">LinkedIn URL</Label>
                    <Input
                      id="linkedin-url"
                      type="url"
                      value={info.linkedin_url}
                      onChange={(e) => updateInfo('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="github-url">GitHub URL</Label>
                    <Input
                      id="github-url"
                      type="url"
                      value={info.github_url}
                      onChange={(e) => updateInfo('github_url', e.target.value)}
                      placeholder="https://github.com/yourhandle"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="portfolio-url">Portfolio URL</Label>
                    <Input
                      id="portfolio-url"
                      type="url"
                      value={info.portfolio_url}
                      onChange={(e) => updateInfo('portfolio_url', e.target.value)}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSave} disabled={saving || !infoDirty} className="min-h-[44px]">
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              {/* Career Profile */}
              <Card>
                <CardHeader>
                  <CardTitle>Career Profile</CardTitle>
                  <CardDescription>Helps AI personalize your content.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="job-title">Current Job Title</Label>
                    <Input
                      id="job-title"
                      value={info.job_title}
                      onChange={(e) => updateInfo('job_title', e.target.value)}
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="target-job-title">Target Job Title</Label>
                    <Input
                      id="target-job-title"
                      value={info.target_job_title}
                      onChange={(e) => updateInfo('target_job_title', e.target.value)}
                      placeholder="e.g. Staff Engineer, Product Manager"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="target-industry">Target Industry</Label>
                    <Input
                      id="target-industry"
                      value={info.target_industry}
                      onChange={(e) => updateInfo('target_industry', e.target.value)}
                      placeholder="e.g. Software, Healthcare, Finance"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="years-of-experience">Years of Experience</Label>
                    <select
                      id="years-of-experience"
                      value={info.years_of_experience}
                      onChange={(e) => updateInfo('years_of_experience', Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {YEARS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSave} disabled={saving || !infoDirty} className="min-h-[44px]">
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              {/* Experience Bank */}
              <Card>
                <CardHeader>
                  <CardTitle>Experience Bank</CardTitle>
                  <CardDescription>Add reusable work experience bullets that AI will pull from when tailoring your resume.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {info.experience_bullets.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No bullets yet — add your first achievement or responsibility.
                    </p>
                  )}
                  {info.experience_bullets.map((bullet, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <textarea
                        className={cn(
                          'flex-1 min-h-[72px] resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                        )}
                        placeholder="e.g. Led migration of monolithic backend to microservices, reducing deployment time by 60%"
                        value={bullet}
                        onChange={(e) => updateBullet(i, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeBullet(i)}
                        className="mt-1.5 text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Remove bullet"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[44px]"
                    onClick={addBullet}
                  >
                    <Plus className="size-3.5" /> Add Bullet
                  </Button>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSave} disabled={saving || !infoDirty} className="min-h-[44px]">
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              {/* Skills Bank */}
              <Card>
                <CardHeader>
                  <CardTitle>Skills Bank</CardTitle>
                  <CardDescription>List your technical skills, tools, and certifications for AI to reference.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="skills-technical">Technical Skills</Label>
                    <textarea
                      id="skills-technical"
                      className={textareaField}
                      placeholder="e.g. Python, TypeScript, React, PostgreSQL, Docker"
                      value={info.skills_technical}
                      onChange={(e) => updateInfo('skills_technical', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated list of technical skills.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="skills-tools">Tools &amp; Platforms</Label>
                    <textarea
                      id="skills-tools"
                      className={textareaField}
                      placeholder="e.g. AWS, Kubernetes, Figma, Jira, GitHub Actions"
                      value={info.skills_tools}
                      onChange={(e) => updateInfo('skills_tools', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated list of tools and platforms.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="skills-certifications">Certifications</Label>
                    <textarea
                      id="skills-certifications"
                      className={textareaField}
                      placeholder="e.g. AWS Solutions Architect, PMP, Google Cloud Professional"
                      value={info.skills_certifications}
                      onChange={(e) => updateInfo('skills_certifications', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated list of certifications.</p>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSave} disabled={saving || !infoDirty} className="min-h-[44px]">
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              {/* Work Experience */}
              <Card>
                <CardHeader>
                  <CardTitle>Work Experience</CardTitle>
                  <CardDescription>Used as the base for AI-generated resumes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {info.experience.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No work experience yet — add your first role.
                    </p>
                  )}

                  {info.experience.map((exp, i) => (
                    <div key={i} className="border border-border p-3 space-y-2 bg-background rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Position {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExperience(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className={field}
                          placeholder="Job title"
                          value={exp.title}
                          onChange={(e) => setExperience(i, { title: e.target.value })}
                        />
                        <input
                          className={field}
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => setExperience(i, { company: e.target.value })}
                        />
                        <input
                          className={field}
                          placeholder="Start (e.g. Jan 2022)"
                          value={exp.startDate}
                          onChange={(e) => setExperience(i, { startDate: e.target.value })}
                        />
                        <input
                          className={cn(field, exp.current && 'opacity-50')}
                          placeholder="End"
                          value={exp.endDate ?? ''}
                          disabled={exp.current}
                          onChange={(e) => setExperience(i, { endDate: e.target.value })}
                        />
                        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer min-h-[44px]">
                          <input
                            type="checkbox"
                            className="accent-primary size-4"
                            checked={exp.current}
                            onChange={(e) =>
                              setExperience(i, {
                                current: e.target.checked,
                                endDate: e.target.checked ? '' : exp.endDate,
                              })
                            }
                          />
                          Currently working here
                        </label>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`bullets-${i}`}>Bullets (one per line)</Label>
                        <textarea
                          id={`bullets-${i}`}
                          className={textareaField}
                          placeholder={'Achievement or responsibility…\nAnother achievement…'}
                          value={exp.bullets.join('\n')}
                          onChange={(e) => setExperience(i, { bullets: e.target.value.split('\n') })}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[44px]"
                    onClick={addExperience}
                  >
                    <Plus className="size-3.5" /> Add Experience
                  </Button>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSave} disabled={saving || !infoDirty} className="min-h-[44px]">
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
