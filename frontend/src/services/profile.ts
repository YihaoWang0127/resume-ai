import { supabase } from '@/lib/supabase'
import type { ProfileData, ProfileInput } from '@/types/profile'

export async function getProfile(): Promise<ProfileData | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    // Table not yet created (migration not applied) — treat as "no saved profile"
    if (error.code === 'PGRST205' || error.code === '42P01') return null
    throw error
  }
  return data
}

export async function upsertProfile(input: ProfileInput): Promise<ProfileData> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      ...input,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
