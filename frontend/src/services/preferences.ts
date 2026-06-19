import { supabase } from '@/lib/supabase'
import type { UserPreferences, UserPreferencesInput } from '@/types/preferences'

let _prefsPromise: Promise<UserPreferences | null> | null = null

async function _fetchPreferences(): Promise<UserPreferences | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // Table not yet created (migration not applied) — treat as "no saved preferences"
      if (error.code === 'PGRST205' || error.code === '42P01') return null
      throw error
    }
    return data
  } catch (err) {
    _prefsPromise = null
    throw err
  }
}

export function getPreferences(): Promise<UserPreferences | null> {
  if (!_prefsPromise) _prefsPromise = _fetchPreferences()
  return _prefsPromise
}

export function prefetchPreferences(): void {
  if (!_prefsPromise) _prefsPromise = _fetchPreferences().catch(() => { _prefsPromise = null; return null })
}

export function clearPreferencesCache(): void {
  _prefsPromise = null
}

export async function upsertPreferences(prefs: UserPreferencesInput): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  _prefsPromise = null
  return data
}
