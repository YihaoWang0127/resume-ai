import { supabase } from '@/lib/supabase'
import type { ResumeSchema, ATSScoreResult } from '@/types/resume'

export interface SavedResume {
  id: string
  user_id: string
  title: string
  resume_data: ResumeSchema
  detected_industry: string
  created_at: string
  updated_at: string
  ats_score?: number | null
  ats_score_updated_at?: string | null
  ats_job_description?: string | null
  ats_result?: ATSScoreResult | null
}

export interface AtsMetadata {
  score: number
  result: ATSScoreResult
  jobDescription: string
}

export async function saveResume(
  resume: ResumeSchema,
  title: string,
  ats?: AtsMetadata,
): Promise<SavedResume> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const insert: Record<string, unknown> = {
    user_id: user.id,
    title,
    resume_data: resume,
    detected_industry: resume.detectedIndustry ?? 'general',
  }
  if (ats) {
    insert.ats_score = ats.score
    insert.ats_score_updated_at = new Date().toISOString()
    insert.ats_job_description = ats.jobDescription
    insert.ats_result = ats.result
  }

  const { data, error } = await supabase
    .from('resumes')
    .insert(insert)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateResume(
  id: string,
  resume: ResumeSchema,
  title?: string,
  ats?: AtsMetadata,
): Promise<SavedResume> {
  const update: Record<string, unknown> = {
    resume_data: resume,
    detected_industry: resume.detectedIndustry ?? 'general',
    updated_at: new Date().toISOString(),
  }
  if (title !== undefined) update.title = title
  if (ats) {
    update.ats_score = ats.score
    update.ats_score_updated_at = new Date().toISOString()
    update.ats_job_description = ats.jobDescription
    update.ats_result = ats.result
  }

  const { data, error } = await supabase
    .from('resumes')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAtsScore(
  id: string,
  score: number,
  extended?: { jobDescription: string; result: ATSScoreResult },
): Promise<SavedResume> {
  const update: Record<string, unknown> = {
    ats_score: score,
    ats_score_updated_at: new Date().toISOString(),
  }
  if (extended) {
    update.ats_job_description = extended.jobDescription
    update.ats_result = extended.result
  }

  const { data, error } = await supabase
    .from('resumes')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function clearAtsScore(id: string): Promise<void> {
  const { error } = await supabase
    .from('resumes')
    .update({
      ats_score: null,
      ats_score_updated_at: null,
      ats_job_description: null,
      ats_result: null,
    })
    .eq('id', id)
  if (error) throw error
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
