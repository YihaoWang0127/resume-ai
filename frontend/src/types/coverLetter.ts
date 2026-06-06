export interface CoverLetter {
  id: string
  user_id: string
  resume_id: string | null
  title: string
  content: string
  company_name: string | null
  job_description: string | null
  tone: string
  created_at: string
  updated_at: string
}
