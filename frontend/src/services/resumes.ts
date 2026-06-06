import { supabase } from '@/lib/supabase'
import type { ResumeSchema } from '@/types/resume'

export interface SavedResume {
  id: string
  user_id: string
  title: string
  resume_data: ResumeSchema
  detected_industry: string
  created_at: string
  updated_at: string
}

export async function saveResume(resume: ResumeSchema, title: string): Promise<SavedResume> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      title,
      resume_data: resume,
      detected_industry: resume.detectedIndustry ?? 'general',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateResume(id: string, resume: ResumeSchema, title?: string): Promise<SavedResume> {
  const update: Record<string, unknown> = {
    resume_data: resume,
    detected_industry: resume.detectedIndustry ?? 'general',
    updated_at: new Date().toISOString(),
  }
  if (title !== undefined) update.title = title

  const { data, error } = await supabase
    .from('resumes')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listResumes(): Promise<SavedResume[]> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getResume(id: string): Promise<SavedResume> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function deleteResume(id: string): Promise<void> {
  const { error } = await supabase
    .from('resumes')
    .delete()
    .eq('id', id)

  if (error) throw error
}
