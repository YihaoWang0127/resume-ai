import { supabase } from '@/lib/supabase'
import type { CoverLetter } from '@/types/coverLetter'

export type { CoverLetter }

let _listPromise: Promise<CoverLetter[]> | null = null

async function _fetchCoverLetters(): Promise<CoverLetter[]> {
  try {
    const { data, error } = await supabase
      .from('cover_letters')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data ?? []
  } catch (err) {
    _listPromise = null
    throw err
  }
}

export function prefetchCoverLetters(): void {
  if (!_listPromise) _listPromise = _fetchCoverLetters().catch(() => { _listPromise = null; return [] })
}

export function clearCoverLettersCache(): void {
  _listPromise = null
}

export async function saveCoverLetter(
  content: string,
  title: string,
  companyName?: string,
  jobDescription?: string,
  tone?: string,
  resumeId?: string,
): Promise<CoverLetter> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('cover_letters')
    .insert({
      user_id: user.id,
      resume_id: resumeId ?? null,
      title,
      content,
      company_name: companyName ?? null,
      job_description: jobDescription ?? null,
      tone: tone ?? 'professional',
    })
    .select()
    .single()

  if (error) throw error
  _listPromise = null
  return data
}

export async function updateCoverLetter(
  id: string,
  content: string,
  title?: string,
): Promise<CoverLetter> {
  const update: Record<string, unknown> = {
    content,
    updated_at: new Date().toISOString(),
  }
  if (title !== undefined) update.title = title

  const { data, error } = await supabase
    .from('cover_letters')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  _listPromise = null
  return data
}

export function listCoverLetters(): Promise<CoverLetter[]> {
  if (!_listPromise) _listPromise = _fetchCoverLetters()
  return _listPromise
}

export async function getCoverLetter(id: string): Promise<CoverLetter> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const { error } = await supabase
    .from('cover_letters')
    .delete()
    .eq('id', id)

  if (error) throw error
  _listPromise = null
}
