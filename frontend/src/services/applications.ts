import { supabase } from '@/lib/supabase'

export interface Application {
  id: string
  user_id: string
  resume_id: string | null
  cover_letter_id: string | null
  company: string
  role: string
  job_url: string | null
  job_description: string | null
  ats_score: number | null
  status: 'applied' | 'interviewing' | 'offer' | 'rejected'
  applied_at: string
  created_at: string
  updated_at: string
}

export interface CreateApplicationInput {
  resume_id?: string
  cover_letter_id?: string
  company: string
  role: string
  job_url?: string
  job_description?: string
  ats_score?: number
}

let _listPromise: Promise<Application[]> | null = null

async function _fetchApplications(): Promise<Application[]> {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('applied_at', { ascending: false })

    if (error) throw error
    return data ?? []
  } catch (err) {
    _listPromise = null
    throw err
  }
}

export function clearApplicationsCache(): void {
  _listPromise = null
}

export function listApplications(): Promise<Application[]> {
  if (!_listPromise) _listPromise = _fetchApplications()
  return _listPromise
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const insert: Record<string, unknown> = {
    user_id: user.id,
    company: input.company,
    role: input.role,
    status: 'applied',
    applied_at: new Date().toISOString(),
    resume_id: input.resume_id ?? null,
    cover_letter_id: input.cover_letter_id ?? null,
    job_url: input.job_url ?? null,
    job_description: input.job_description ?? null,
    ats_score: input.ats_score ?? null,
  }

  const { data, error } = await supabase
    .from('applications')
    .insert(insert)
    .select()
    .single()

  if (error) throw error
  _listPromise = null
  return data
}

export async function updateApplicationStatus(
  id: string,
  status: Application['status'],
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  _listPromise = null
  return data
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)

  if (error) throw error
  _listPromise = null
}
