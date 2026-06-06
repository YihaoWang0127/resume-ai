import { supabase } from '@/lib/supabase'
import type { CoverLetter } from '@/types/coverLetter'

export type { CoverLetter }

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
  return data
}

export async function listCoverLetters(): Promise<CoverLetter[]> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
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
}
