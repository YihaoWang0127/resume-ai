import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Loader2, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  onDirtyChange: (dirty: boolean) => void
}

export default function ProfileSettings({ onDirtyChange }: Props) {
  const { user } = useAuth()
  const initialName = (user?.user_metadata?.full_name as string | undefined) ?? ''

  const [displayName, setDisplayName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata?.avatar_url as string | undefined) ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNameChange = (value: string) => {
    setDisplayName(value)
    onDirtyChange(value !== initialName)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
      if (error) throw error
      onDirtyChange(false)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your personal information.</CardDescription>
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
          <p className="text-xs text-muted-foreground">
            Your email is tied to your account. To change it, verify a new address via email.
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} disabled={saving || displayName === initialName} className="min-h-[44px]">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  )
}
