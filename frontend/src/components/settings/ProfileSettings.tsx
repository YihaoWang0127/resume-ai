import { useRef, type ChangeEvent } from 'react'
import { Loader2, Camera, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials, cn } from '@/lib/utils'
import type { ProfileInput } from '@/types/profile'
import type { ExperienceItem } from '@/types/resume'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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

const field =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const textareaField = cn(field, 'h-24 resize-y py-2')

export interface ProfileSettingsProps {
  // Account section
  displayName: string
  avatarUrl: string | null
  accountSaving: boolean
  uploading: boolean
  resending: boolean
  cooldown: number
  accountDirty: boolean
  onNameChange: (value: string) => void
  onAccountSave: () => void
  onAvatarChange: (e: ChangeEvent<HTMLInputElement>) => void
  onResendVerification: () => void

  // Profile data sections
  loading: boolean
  saving: boolean
  info: ProfileInput
  infoDirty: boolean
  onUpdateInfo: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void
  onSetExperience: (index: number, patch: Partial<ExperienceItem>) => void
  onAddExperience: () => void
  onRemoveExperience: (index: number) => void
  onAddBullet: () => void
  onUpdateBullet: (index: number, value: string) => void
  onRemoveBullet: (index: number) => void
  onSave: () => void
}

export default function ProfileSettings({
  displayName,
  avatarUrl,
  accountSaving,
  uploading,
  resending,
  cooldown,
  accountDirty,
  onNameChange,
  onAccountSave,
  onAvatarChange,
  onResendVerification,
  loading,
  saving,
  info,
  infoDirty,
  onUpdateInfo,
  onSetExperience,
  onAddExperience,
  onRemoveExperience,
  onAddBullet,
  onUpdateBullet,
  onRemoveBullet,
  onSave,
}: ProfileSettingsProps) {
  const { user, isGuest, emailVerified } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fieldSkeleton = (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Account ── */}
      <div id="account" className="scroll-mt-4">
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
                  onChange={async (e) => {
                    await onAvatarChange(e)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
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
                onChange={(e) => onNameChange(e.target.value)}
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
                        onClick={onResendVerification}
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
              onClick={onAccountSave}
              disabled={accountSaving || !accountDirty}
              className="min-h-[44px]"
            >
              {accountSaving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Contact Info ── */}
      <div id="contact-info" className="scroll-mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
            <CardDescription>Used in resumes and cover letters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? fieldSkeleton : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={info.phone}
                    onChange={(e) => onUpdateInfo('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Location</Label>
                  <Input
                    id="address"
                    value={info.address}
                    onChange={(e) => onUpdateInfo('address', e.target.value)}
                    placeholder="City, State or Remote"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="linkedin-url">LinkedIn URL</Label>
                  <Input
                    id="linkedin-url"
                    type="url"
                    value={info.linkedin_url}
                    onChange={(e) => onUpdateInfo('linkedin_url', e.target.value)}
                    placeholder="https://linkedin.com/in/yourname"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="github-url">GitHub URL</Label>
                  <Input
                    id="github-url"
                    type="url"
                    value={info.github_url}
                    onChange={(e) => onUpdateInfo('github_url', e.target.value)}
                    placeholder="https://github.com/yourhandle"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="portfolio-url">Portfolio URL</Label>
                  <Input
                    id="portfolio-url"
                    type="url"
                    value={info.portfolio_url}
                    onChange={(e) => onUpdateInfo('portfolio_url', e.target.value)}
                    placeholder="https://yourportfolio.com"
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSave} disabled={saving || !infoDirty} className="min-h-[44px]">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Career Profile ── */}
      <div id="career-profile" className="scroll-mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Career Profile</CardTitle>
            <CardDescription>Helps AI personalize your content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? fieldSkeleton : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="job-title">Current Job Title</Label>
                  <Input
                    id="job-title"
                    value={info.job_title}
                    onChange={(e) => onUpdateInfo('job_title', e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="target-job-title">Target Job Title</Label>
                  <Input
                    id="target-job-title"
                    value={info.target_job_title}
                    onChange={(e) => onUpdateInfo('target_job_title', e.target.value)}
                    placeholder="e.g. Staff Engineer, Product Manager"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="target-industry">Target Industry</Label>
                  <Input
                    id="target-industry"
                    value={info.target_industry}
                    onChange={(e) => onUpdateInfo('target_industry', e.target.value)}
                    placeholder="e.g. Software, Healthcare, Finance"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="years-of-experience">Years of Experience</Label>
                  <select
                    id="years-of-experience"
                    value={info.years_of_experience}
                    onChange={(e) => onUpdateInfo('years_of_experience', Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {YEARS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSave} disabled={saving || !infoDirty} className="min-h-[44px]">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Experience Bank ── */}
      <div id="experience-bank" className="scroll-mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Experience Bank</CardTitle>
            <CardDescription>
              Add reusable work experience bullets that AI will pull from when tailoring your resume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? fieldSkeleton : (
              <div className="space-y-3">
                {info.experience_bullets.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No bullets yet — add your first achievement or responsibility.
                  </p>
                )}
                {info.experience_bullets.map((bullet, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <textarea
                      className="flex-1 min-h-[72px] resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      placeholder="e.g. Led migration of monolithic backend to microservices, reducing deployment time by 60%"
                      value={bullet}
                      onChange={(e) => onUpdateBullet(i, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveBullet(i)}
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
                  onClick={onAddBullet}
                >
                  <Plus className="size-3.5" /> Add Bullet
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSave} disabled={saving || !infoDirty} className="min-h-[44px]">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Skills Bank ── */}
      <div id="skills-bank" className="scroll-mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Skills Bank</CardTitle>
            <CardDescription>
              List your technical skills, tools, and certifications for AI to reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? fieldSkeleton : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="skills-technical">Technical Skills</Label>
                  <textarea
                    id="skills-technical"
                    className={textareaField}
                    placeholder="e.g. Python, TypeScript, React, PostgreSQL, Docker"
                    value={info.skills_technical}
                    onChange={(e) => onUpdateInfo('skills_technical', e.target.value)}
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
                    onChange={(e) => onUpdateInfo('skills_tools', e.target.value)}
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
                    onChange={(e) => onUpdateInfo('skills_certifications', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of certifications.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSave} disabled={saving || !infoDirty} className="min-h-[44px]">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Work Experience ── */}
      <div id="work-experience" className="scroll-mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
            <CardDescription>Used as the base for AI-generated resumes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? fieldSkeleton : (
              <div className="space-y-3">
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
                        onClick={() => onRemoveExperience(i)}
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
                        onChange={(e) => onSetExperience(i, { title: e.target.value })}
                      />
                      <input
                        className={field}
                        placeholder="Company"
                        value={exp.company}
                        onChange={(e) => onSetExperience(i, { company: e.target.value })}
                      />
                      <input
                        className={field}
                        placeholder="Start (e.g. Jan 2022)"
                        value={exp.startDate}
                        onChange={(e) => onSetExperience(i, { startDate: e.target.value })}
                      />
                      <input
                        className={cn(field, exp.current && 'opacity-50')}
                        placeholder="End"
                        value={exp.endDate ?? ''}
                        disabled={exp.current}
                        onChange={(e) => onSetExperience(i, { endDate: e.target.value })}
                      />
                      <label className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={exp.current}
                          onChange={(e) =>
                            onSetExperience(i, {
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
                        onChange={(e) => onSetExperience(i, { bullets: e.target.value.split('\n') })}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full min-h-[44px]"
                  onClick={onAddExperience}
                >
                  <Plus className="size-3.5" /> Add Experience
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSave} disabled={saving || !infoDirty} className="min-h-[44px]">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
